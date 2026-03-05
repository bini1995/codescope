import { insertAuditSchema } from "@shared/schema";
import { z } from "zod";

export const updateAuditSchema = insertAuditSchema.partial().extend({
  securityScore: z.number().min(0).max(10).nullable().optional(),
  stabilityScore: z.number().min(0).max(10).nullable().optional(),
  maintainabilityScore: z.number().min(0).max(10).nullable().optional(),
  scalabilityScore: z.number().min(0).max(10).nullable().optional(),
  cicdScore: z.number().min(0).max(10).nullable().optional(),
  executiveSummary: z.string().nullable().optional(),
  remediationPlan: z.any().optional(),
});

export const submitAuditSchema = insertAuditSchema.extend({
  triggerScan: z.boolean().optional().default(true),
});
