import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAuditSchema, insertFindingSchema } from "@shared/schema";
import { getUncachableGitHubClient } from "./github";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";
import { scanRepository } from "./scanner";
import { seedStripeProducts } from "./stripe-seed";
import { z } from "zod";
import { db } from "./db";
import { sql } from "drizzle-orm";

const updateAuditSchema = insertAuditSchema.partial().extend({
  securityScore: z.number().min(0).max(10).nullable().optional(),
  stabilityScore: z.number().min(0).max(10).nullable().optional(),
  maintainabilityScore: z.number().min(0).max(10).nullable().optional(),
  scalabilityScore: z.number().min(0).max(10).nullable().optional(),
  cicdScore: z.number().min(0).max(10).nullable().optional(),
  executiveSummary: z.string().nullable().optional(),
  remediationPlan: z.any().optional(),
});

const updateFindingSchema = insertFindingSchema.partial();

const createRepoSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  isPrivate: z.boolean().optional(),
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await seedStripeProducts();

  app.get("/api/audits", async (_req, res) => {
    const audits = await storage.getAudits();
    const sanitized = audits.map((a) => ({
      ...a,
      remediationPlan: a.paidAt ? a.remediationPlan : null,
      isPaid: !!a.paidAt,
    }));
    res.json(sanitized);
  });

  app.get("/api/audits/:id", async (req, res) => {
    const audit = await storage.getAudit(req.params.id);
    if (!audit) return res.status(404).json({ message: "Audit not found" });
    const isPaid = !!audit.paidAt;
    const sanitized = {
      ...audit,
      remediationPlan: isPaid ? audit.remediationPlan : null,
      isPaid,
    };
    res.json(sanitized);
  });

  app.get("/api/audits/:id/findings", async (req, res) => {
    const audit = await storage.getAudit(req.params.id);
    if (!audit) return res.status(404).json({ message: "Audit not found" });
    const findings = await storage.getFindingsByAudit(req.params.id);
    const isPaid = !!audit.paidAt;
    if (!isPaid) {
      const gated = findings.map((f) => ({
        ...f,
        fixSteps: "Unlock this audit to see fix steps",
        codeSnippet: null,
      }));
      return res.json(gated);
    }
    res.json(findings);
  });

  app.post("/api/audits", async (req, res) => {
    const parsed = insertAuditSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const audit = await storage.createAudit(parsed.data);
    res.status(201).json(audit);
  });

  app.patch("/api/audits/:id", async (req, res) => {
    const parsed = updateAuditSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const audit = await storage.updateAudit(req.params.id, parsed.data);
    if (!audit) return res.status(404).json({ message: "Audit not found" });
    res.json(audit);
  });

  app.delete("/api/audits/:id", async (req, res) => {
    await storage.deleteAudit(req.params.id);
    res.status(204).send();
  });

  app.post("/api/audits/:id/findings", async (req, res) => {
    const parsed = insertFindingSchema.safeParse({ ...req.body, auditId: req.params.id });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const finding = await storage.createFinding(parsed.data);
    res.status(201).json(finding);
  });

  app.patch("/api/findings/:id", async (req, res) => {
    const parsed = updateFindingSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const finding = await storage.updateFinding(req.params.id, parsed.data);
    if (!finding) return res.status(404).json({ message: "Finding not found" });
    res.json(finding);
  });

  app.delete("/api/findings/:id", async (req, res) => {
    await storage.deleteFinding(req.params.id);
    res.status(204).send();
  });

  app.post("/api/audits/:id/scan", async (req, res) => {
    const audit = await storage.getAudit(req.params.id);
    if (!audit) return res.status(404).json({ message: "Audit not found" });
    if (audit.status === "in_progress") {
      return res.status(409).json({ message: "Scan already in progress" });
    }

    const existingFindings = await storage.getFindingsByAudit(audit.id);
    const autoFindings = existingFindings.filter((f) => f.autoDetected);
    for (const f of autoFindings) {
      await storage.deleteFinding(f.id);
    }

    await storage.updateAudit(audit.id, {
      status: "in_progress",
      securityScore: null,
      stabilityScore: null,
      maintainabilityScore: null,
      scalabilityScore: null,
      cicdScore: null,
      executiveSummary: null,
      remediationPlan: null,
      scanLog: [],
    });

    res.json({ message: "Scan started", auditId: audit.id });

    scanRepository(audit.id).catch((err) => {
      console.error(`Scan failed for audit ${audit.id}:`, err);
    });
  });

  app.get("/api/audits/:id/scan-status", async (req, res) => {
    const audit = await storage.getAudit(req.params.id);
    if (!audit) return res.status(404).json({ message: "Audit not found" });
    res.json({
      status: audit.status,
      scanLog: audit.scanLog,
      scannedAt: audit.scannedAt,
    });
  });

  app.post("/api/audits/:id/checkout", async (req, res) => {
    try {
      const audit = await storage.getAudit(req.params.id);
      if (!audit) return res.status(404).json({ message: "Audit not found" });

      if (audit.paidAt) {
        return res.json({ alreadyPaid: true });
      }

      const stripe = await getUncachableStripeClient();

      const priceResult = await db.execute(
        sql`SELECT pr.id as price_id FROM stripe.products p JOIN stripe.prices pr ON pr.product = p.id WHERE p.active = true AND p.metadata->>'type' = 'audit_unlock' LIMIT 1`
      );

      if (!priceResult.rows.length) {
        return res.status(500).json({ message: "Payment not configured" });
      }

      const priceId = priceResult.rows[0].price_id as string;

      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: "payment",
        success_url: `${baseUrl}/audit/${audit.id}?payment=success`,
        cancel_url: `${baseUrl}/audit/${audit.id}?payment=cancelled`,
        metadata: {
          auditId: audit.id,
        },
      });

      await storage.updateAudit(audit.id, {
        stripeSessionId: session.id,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Checkout error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/audits/:id/verify-payment", async (req, res) => {
    try {
      const audit = await storage.getAudit(req.params.id);
      if (!audit) return res.status(404).json({ message: "Audit not found" });

      if (audit.paidAt) {
        return res.json({ paid: true });
      }

      if (!audit.stripeSessionId) {
        return res.json({ paid: false });
      }

      const stripe = await getUncachableStripeClient();
      const session = await stripe.checkout.sessions.retrieve(audit.stripeSessionId);

      if (session.payment_status === "paid") {
        await storage.updateAudit(audit.id, {
          paidAt: new Date(),
        });
        return res.json({ paid: true });
      }

      res.json({ paid: false });
    } catch (error: any) {
      console.error("Payment verification error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/stripe/publishable-key", async (_req, res) => {
    try {
      const key = await getStripePublishableKey();
      res.json({ publishableKey: key });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/github/create-repo", async (req, res) => {
    const parsed = createRepoSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    try {
      const octokit = await getUncachableGitHubClient();
      const repo = await octokit.repos.createForAuthenticatedUser({
        name: parsed.data.name,
        description: parsed.data.description || "Code audit project created by CodeScope",
        private: parsed.data.isPrivate ?? false,
        auto_init: true,
      });
      res.json({ url: repo.data.html_url, name: repo.data.full_name });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ message: err.message });
    }
  });

  app.get("/api/github/user", async (_req, res) => {
    try {
      const octokit = await getUncachableGitHubClient();
      const { data } = await octokit.users.getAuthenticated();
      res.json({ login: data.login, avatar: data.avatar_url, name: data.name });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/github/repos", async (req, res) => {
    try {
      const octokit = await getUncachableGitHubClient();
      const { data } = await octokit.repos.listForAuthenticatedUser({
        sort: "updated",
        per_page: 50,
      });
      res.json(
        data.map((r) => ({
          fullName: r.full_name,
          name: r.name,
          owner: r.owner.login,
          url: r.html_url,
          description: r.description,
          language: r.language,
          isPrivate: r.private,
          updatedAt: r.updated_at,
        }))
      );
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  return httpServer;
}
