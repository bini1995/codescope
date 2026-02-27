import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const audits = pgTable("audits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  repoUrl: text("repo_url").notNull(),
  repoName: text("repo_name").notNull(),
  ownerName: text("owner_name").notNull(),
  stack: text("stack").notNull(),
  deploymentTarget: text("deployment_target"),
  contactEmail: text("contact_email").notNull(),
  contactName: text("contact_name").notNull(),
  status: text("status").notNull().default("pending"),
  biggestConcern: text("biggest_concern"),
  securityScore: integer("security_score"),
  stabilityScore: integer("stability_score"),
  maintainabilityScore: integer("maintainability_score"),
  scalabilityScore: integer("scalability_score"),
  cicdScore: integer("cicd_score"),
  executiveSummary: text("executive_summary"),
  remediationPlan: jsonb("remediation_plan"),
  repoMeta: jsonb("repo_meta"),
  fileTree: jsonb("file_tree"),
  scanLog: jsonb("scan_log"),
  scannedAt: timestamp("scanned_at"),
  paidAt: timestamp("paid_at"),
  stripeSessionId: text("stripe_session_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const findings = pgTable("findings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  auditId: varchar("audit_id").notNull().references(() => audits.id),
  category: text("category").notNull(),
  severity: text("severity").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  filePath: text("file_path"),
  lineStart: integer("line_start"),
  lineEnd: integer("line_end"),
  codeSnippet: text("code_snippet"),
  businessImpact: text("business_impact").notNull(),
  fixSteps: text("fix_steps").notNull(),
  effort: text("effort").notNull(),
  status: text("status").notNull().default("open"),
  autoDetected: boolean("auto_detected").default(false),
});

export const insertAuditSchema = createInsertSchema(audits).omit({
  id: true,
  createdAt: true,
  securityScore: true,
  stabilityScore: true,
  maintainabilityScore: true,
  scalabilityScore: true,
  cicdScore: true,
  executiveSummary: true,
  remediationPlan: true,
  repoMeta: true,
  fileTree: true,
  scanLog: true,
  scannedAt: true,
  paidAt: true,
  stripeSessionId: true,
});

export const insertFindingSchema = createInsertSchema(findings).omit({
  id: true,
});

export type Audit = typeof audits.$inferSelect;
export type InsertAudit = z.infer<typeof insertAuditSchema>;
export type Finding = typeof findings.$inferSelect;
export type InsertFinding = z.infer<typeof insertFindingSchema>;

export type RepoMeta = {
  languages: Record<string, number>;
  stars: number;
  forks: number;
  openIssues: number;
  defaultBranch: string;
  lastPush: string;
  isPrivate: boolean;
  description: string | null;
  size: number;
};

export type FileTreeItem = {
  path: string;
  type: "file" | "dir";
  size?: number;
};

export type ScanLogEntry = {
  step: string;
  status: "ok" | "warn" | "error";
  message: string;
  timestamp: string;
};
