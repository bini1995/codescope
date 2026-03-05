import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { insertAuditSchema, insertFindingSchema } from "@shared/schema";
import { getUncachableGitHubClient } from "./github";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";
import { enqueueScan } from "./scanQueue";
import { seedStripeProducts } from "./stripe-seed";
import { z } from "zod";
import { submitAuditSchema, updateAuditSchema } from "./auditSchemas";
import { db } from "./db";
import { sql } from "drizzle-orm";
import {
  clearAuthSession,
  createAuthSession,
  hashPassword,
  optionalAuth,
  requireAuth,
  verifyPassword,
  validateOauthState,
} from "./middleware/auth";

const updateFindingSchema = insertFindingSchema.partial();

const createRepoSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  isPrivate: z.boolean().optional(),
});

const registerSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  await seedStripeProducts();

  app.use(optionalAuth);

  app.post("/api/auth/register", async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });

    const existing = await storage.getUserByEmail(parsed.data.email);
    if (existing) return res.status(409).json({ message: "Email already in use" });

    const user = await storage.createUser({
      fullName: parsed.data.fullName,
      email: parsed.data.email,
      passwordHash: await hashPassword(parsed.data.password),
    });

    await createAuthSession(req, { id: user.id, email: user.email });
    res.status(201).json({ user: { id: user.id, email: user.email, fullName: user.fullName } });
  });

  app.post("/api/auth/login", async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });

    const user = await storage.getUserByEmail(parsed.data.email);
    if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    await createAuthSession(req, { id: user.id, email: user.email });
    res.json({ user: { id: user.id, email: user.email, fullName: user.fullName } });
  });

  app.post("/api/auth/logout", async (req, res) => {
    await clearAuthSession(req, res);
    res.status(204).send();
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    const user = await storage.getUserById(req.auth!.sub);
    if (!user) return res.status(401).json({ message: "User not found" });
    res.json({ id: user.id, email: user.email, fullName: user.fullName });
  });

  app.post("/api/privacy/delete-my-data", requireAuth, async (req, res) => {
    const confirmation = typeof req.body?.confirmation === "string" ? req.body.confirmation : "";
    if (confirmation !== "DELETE") {
      return res.status(400).json({ message: 'Confirmation must be "DELETE"' });
    }

    await storage.deleteUserData(req.auth!.sub);
    await clearAuthSession(req, res);
    return res.status(204).send();
  });

  app.get("/api/auth/github", (req, res) => {
    const clientId = process.env.GITHUB_CLIENT_ID;
    if (!clientId) {
      return res.status(501).json({ message: "GitHub OAuth is not configured" });
    }
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const callbackUrl = process.env.GITHUB_CALLBACK_URL || `${baseUrl}/api/auth/github/callback`;
    const state = Math.random().toString(36).slice(2);
    req.session.githubOauthState = state;
    const authorizeUrl = new URL("https://github.com/login/oauth/authorize");
    authorizeUrl.searchParams.set("client_id", clientId);
    authorizeUrl.searchParams.set("redirect_uri", callbackUrl);
    authorizeUrl.searchParams.set("scope", "read:user user:email");
    authorizeUrl.searchParams.set("state", state);
    res.redirect(authorizeUrl.toString());
  });

  app.get("/api/auth/github/callback", async (req, res) => {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return res.status(501).json({ message: "GitHub OAuth is not configured" });
    }

    const code = req.query.code;
    const state = req.query.state;

    if (!code || typeof code !== "string" || typeof state !== "string" || !validateOauthState(req, state)) {
      return res.status(400).json({ message: "Invalid OAuth callback state" });
    }

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const callbackUrl = process.env.GITHUB_CALLBACK_URL || `${baseUrl}/api/auth/github/callback`;

    try {
      const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: callbackUrl,
        }),
      });

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData?.access_token as string | undefined;
      if (!accessToken) {
        return res.status(401).json({ message: "GitHub token exchange failed" });
      }

      const userRes = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "codescope-oauth",
        },
      });
      const userData = await userRes.json();

      const emailsRes = await fetch("https://api.github.com/user/emails", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "codescope-oauth",
        },
      });
      const emails = (await emailsRes.json()) as Array<{ email: string; primary: boolean; verified: boolean }>;
      const email = emails.find((e) => e.primary && e.verified)?.email || emails.find((e) => e.verified)?.email;

      if (!email) {
        return res.status(400).json({ message: "GitHub account has no verified email" });
      }

      let user = await storage.getUserByEmail(email);
      if (!user) {
        user = await storage.createUser({
          email,
          fullName: userData.name || userData.login || "GitHub User",
          passwordHash: await hashPassword(`${userData.id}:${Date.now()}:${Math.random()}`),
        });
      }

      await createAuthSession(req, { id: user.id, email: user.email });
      delete req.session.githubOauthState;
      const redirectTarget = process.env.FRONTEND_URL || "/";
      return res.redirect(redirectTarget);
    } catch {
      return res.status(500).json({ message: "GitHub OAuth failed" });
    }
  });

  app.get("/api/audits", requireAuth, async (req, res) => {
    const audits = await storage.getAudits(req.auth!.sub);
    const sanitized = audits.map((a) => ({
      ...a,
      remediationPlan: a.paidAt ? a.remediationPlan : null,
      isPaid: !!a.paidAt,
    }));
    res.json(sanitized);
  });

  app.get("/api/audits/:id", requireAuth, async (req, res) => {
    const audit = await storage.getAudit(String(req.params.id), req.auth!.sub);
    if (!audit) return res.status(404).json({ message: "Audit not found" });
    const isPaid = !!audit.paidAt;
    const sanitized = {
      ...audit,
      remediationPlan: isPaid ? audit.remediationPlan : null,
      isPaid,
    };
    res.json(sanitized);
  });

  app.get("/api/audits/:id/findings", requireAuth, async (req, res) => {
    const audit = await storage.getAudit(String(req.params.id), req.auth!.sub);
    if (!audit) return res.status(404).json({ message: "Audit not found" });
    const findings = await storage.getFindingsByAudit(String(req.params.id), req.auth!.sub);
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

  app.post("/api/audits", requireAuth, async (req, res) => {
    const parsed = insertAuditSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const audit = await storage.createAudit({ ...parsed.data, userId: req.auth!.sub });
    res.status(201).json(audit);
  });

  app.post("/api/submit-audit", requireAuth, async (req, res) => {
    const parsed = submitAuditSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });

    const { triggerScan, ...auditPayload } = parsed.data;
    const audit = await storage.createAudit({ ...auditPayload, userId: req.auth!.sub });
    const jobId = audit.id;

    if (triggerScan) {
      const queueResult = enqueueScan(jobId);
      return res.status(202).json({
        jobId,
        auditId: audit.id,
        status: "queued",
        queuePosition: queueResult.position,
      });
    }

    return res.status(202).json({ jobId, auditId: audit.id, status: "queued" });
  });

  app.patch("/api/audits/:id", requireAuth, async (req, res) => {
    const parsed = updateAuditSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const audit = await storage.updateAudit(String(req.params.id), parsed.data, req.auth!.sub);
    if (!audit) return res.status(404).json({ message: "Audit not found" });
    res.json(audit);
  });

  app.delete("/api/audits/:id", requireAuth, async (req, res) => {
    await storage.deleteAudit(String(req.params.id), req.auth!.sub);
    res.status(204).send();
  });

  app.post("/api/audits/:id/findings", requireAuth, async (req, res) => {
    const audit = await storage.getAudit(String(req.params.id), req.auth!.sub);
    if (!audit) return res.status(404).json({ message: "Audit not found" });
    const parsed = insertFindingSchema.safeParse({ ...req.body, auditId: String(req.params.id) });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const finding = await storage.createFinding(parsed.data);
    res.status(201).json(finding);
  });

  app.patch("/api/findings/:id", requireAuth, async (req, res) => {
    const finding = await storage.getFinding(String(req.params.id));
    if (!finding) return res.status(404).json({ message: "Finding not found" });
    const audit = await storage.getAudit(finding.auditId, req.auth!.sub);
    if (!audit) return res.status(404).json({ message: "Finding not found" });

    const parsed = updateFindingSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const updated = await storage.updateFinding(String(req.params.id), parsed.data);
    if (!updated) return res.status(404).json({ message: "Finding not found" });
    res.json(updated);
  });

  app.delete("/api/findings/:id", requireAuth, async (req, res) => {
    const finding = await storage.getFinding(String(req.params.id));
    if (!finding) return res.status(404).json({ message: "Finding not found" });
    const audit = await storage.getAudit(finding.auditId, req.auth!.sub);
    if (!audit) return res.status(404).json({ message: "Finding not found" });
    await storage.deleteFinding(String(req.params.id));
    res.status(204).send();
  });

  app.post("/api/audits/:id/scan", requireAuth, async (req, res) => {
    const audit = await storage.getAudit(String(req.params.id), req.auth!.sub);
    if (!audit) return res.status(404).json({ message: "Audit not found" });
    if (audit.status === "in_progress") {
      return res.status(409).json({ message: "Scan already in progress" });
    }

    const existingFindings = await storage.getFindingsByAudit(audit.id, req.auth!.sub);
    const autoFindings = existingFindings.filter((f) => f.autoDetected);
    for (const f of autoFindings) {
      await storage.deleteFinding(f.id);
    }

    await storage.updateAudit(
      audit.id,
      {
        status: "in_progress",
        securityScore: null,
        stabilityScore: null,
        maintainabilityScore: null,
        scalabilityScore: null,
        cicdScore: null,
        executiveSummary: null,
        remediationPlan: null,
        scanLog: [],
      },
      req.auth!.sub
    );

    const queueResult = enqueueScan(audit.id);
    res.json({
      message: queueResult.queued ? "Scan queued" : "Scan already queued",
      auditId: audit.id,
      queuePosition: queueResult.position,
    });
  });

  app.get("/api/audits/:id/scan-status", requireAuth, async (req, res) => {
    const audit = await storage.getAudit(String(req.params.id), req.auth!.sub);
    if (!audit) return res.status(404).json({ message: "Audit not found" });
    res.json({
      status: audit.status,
      scanLog: audit.scanLog,
      scannedAt: audit.scannedAt,
    });
  });

  app.post("/api/audits/:id/checkout", requireAuth, async (req, res) => {
    try {
      const audit = await storage.getAudit(String(req.params.id), req.auth!.sub);
      if (!audit) return res.status(404).json({ message: "Audit not found" });

      if (audit.paidAt) {
        return res.json({ alreadyPaid: true });
      }

      const stripe = await getUncachableStripeClient();

      const priceResult = await db.execute(
        sql`SELECT pr.id as price_id FROM stripe.products p JOIN stripe.prices pr ON pr.product = p.id WHERE p.active = true AND p.metadata->>'type' = 'expert_audit' LIMIT 1`
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
          userId: req.auth!.sub,
        },
      });

      await storage.updateAudit(
        audit.id,
        {
          stripeSessionId: session.id,
        },
        req.auth!.sub
      );

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Checkout error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/audits/:id/verify-payment", requireAuth, async (req, res) => {
    try {
      const audit = await storage.getAudit(String(req.params.id), req.auth!.sub);
      if (!audit) return res.status(404).json({ message: "Audit not found" });

      if (audit.paidAt) {
        return res.json({ paid: true });
      }

      if (!audit.stripeSessionId) {
        return res.json({ paid: false });
      }

      const stripe = await getUncachableStripeClient();
      const session = await stripe.checkout.sessions.retrieve(audit.stripeSessionId);

      if (session.payment_status === "paid" && session.id) {
        await storage.markAuditPaidIfUnpaid(audit.id, session.id, req.auth!.sub);
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

  app.post("/api/github/create-repo", requireAuth, async (req, res) => {
    const parsed = createRepoSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    try {
      const octokit = await getUncachableGitHubClient();
      const repo = await octokit.repos.createForAuthenticatedUser({
        name: parsed.data.name,
        description: parsed.data.description || "Code audit project created by CodeAudit",
        private: parsed.data.isPrivate ?? false,
        auto_init: true,
      });
      res.json({ url: repo.data.html_url, name: repo.data.full_name });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ message: err.message });
    }
  });

  app.get("/api/github/user", requireAuth, async (_req, res) => {
    try {
      const octokit = await getUncachableGitHubClient();
      const { data } = await octokit.users.getAuthenticated();
      res.json({ login: data.login, avatar: data.avatar_url, name: data.name });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/github/repos", requireAuth, async (_req, res) => {
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
