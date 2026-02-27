import { eq } from "drizzle-orm";
import { db } from "./db";
import {
  audits,
  findings,
  type Audit,
  type InsertAudit,
  type Finding,
  type InsertFinding,
} from "@shared/schema";

export interface IStorage {
  getAudits(): Promise<Audit[]>;
  getAudit(id: string): Promise<Audit | undefined>;
  createAudit(audit: InsertAudit): Promise<Audit>;
  updateAudit(id: string, data: Partial<Audit>): Promise<Audit | undefined>;
  deleteAudit(id: string): Promise<void>;
  getFindingsByAudit(auditId: string): Promise<Finding[]>;
  getFinding(id: string): Promise<Finding | undefined>;
  createFinding(finding: InsertFinding): Promise<Finding>;
  updateFinding(id: string, data: Partial<Finding>): Promise<Finding | undefined>;
  deleteFinding(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getAudits(): Promise<Audit[]> {
    return db.select().from(audits).orderBy(audits.createdAt);
  }

  async getAudit(id: string): Promise<Audit | undefined> {
    const [audit] = await db.select().from(audits).where(eq(audits.id, id));
    return audit;
  }

  async createAudit(audit: InsertAudit): Promise<Audit> {
    const [created] = await db.insert(audits).values(audit).returning();
    return created;
  }

  async updateAudit(id: string, data: Partial<Audit>): Promise<Audit | undefined> {
    const [updated] = await db.update(audits).set(data).where(eq(audits.id, id)).returning();
    return updated;
  }

  async deleteAudit(id: string): Promise<void> {
    await db.delete(findings).where(eq(findings.auditId, id));
    await db.delete(audits).where(eq(audits.id, id));
  }

  async getFindingsByAudit(auditId: string): Promise<Finding[]> {
    return db.select().from(findings).where(eq(findings.auditId, auditId));
  }

  async getFinding(id: string): Promise<Finding | undefined> {
    const [finding] = await db.select().from(findings).where(eq(findings.id, id));
    return finding;
  }

  async createFinding(finding: InsertFinding): Promise<Finding> {
    const [created] = await db.insert(findings).values(finding).returning();
    return created;
  }

  async updateFinding(id: string, data: Partial<Finding>): Promise<Finding | undefined> {
    const [updated] = await db.update(findings).set(data).where(eq(findings.id, id)).returning();
    return updated;
  }

  async deleteFinding(id: string): Promise<void> {
    await db.delete(findings).where(eq(findings.id, id));
  }
}

export const storage = new DatabaseStorage();
