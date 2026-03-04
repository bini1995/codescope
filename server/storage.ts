import { and, eq } from "drizzle-orm";
import { db } from "./db";
import {
  audits,
  findings,
  users,
  type Audit,
  type InsertAudit,
  type Finding,
  type InsertFinding,
  type InsertUser,
  type User,
} from "@shared/schema";

export interface IStorage {
  getAudits(userId?: string): Promise<Audit[]>;
  getAudit(id: string, userId?: string): Promise<Audit | undefined>;
  createAudit(audit: InsertAudit & { userId?: string }): Promise<Audit>;
  updateAudit(id: string, data: Partial<Audit>, userId?: string): Promise<Audit | undefined>;
  deleteAudit(id: string, userId?: string): Promise<void>;
  getFindingsByAudit(auditId: string, userId?: string): Promise<Finding[]>;
  getFinding(id: string): Promise<Finding | undefined>;
  createFinding(finding: InsertFinding): Promise<Finding>;
  updateFinding(id: string, data: Partial<Finding>): Promise<Finding | undefined>;
  deleteFinding(id: string): Promise<void>;
  createUser(user: InsertUser): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getAudits(userId?: string): Promise<Audit[]> {
    if (!userId) {
      return db.select().from(audits).orderBy(audits.createdAt);
    }

    return db.select().from(audits).where(eq(audits.userId, userId)).orderBy(audits.createdAt);
  }

  async getAudit(id: string, userId?: string): Promise<Audit | undefined> {
    const [audit] = userId
      ? await db.select().from(audits).where(and(eq(audits.id, id), eq(audits.userId, userId)))
      : await db.select().from(audits).where(eq(audits.id, id));
    return audit;
  }

  async createAudit(audit: InsertAudit & { userId?: string }): Promise<Audit> {
    const [created] = await db.insert(audits).values(audit).returning();
    return created;
  }

  async updateAudit(id: string, data: Partial<Audit>, userId?: string): Promise<Audit | undefined> {
    const [updated] = userId
      ? await db
          .update(audits)
          .set(data)
          .where(and(eq(audits.id, id), eq(audits.userId, userId)))
          .returning()
      : await db.update(audits).set(data).where(eq(audits.id, id)).returning();
    return updated;
  }

  async deleteAudit(id: string, userId?: string): Promise<void> {
    const existing = await this.getAudit(id, userId);
    if (!existing) return;
    await db.delete(findings).where(eq(findings.auditId, id));
    await db.delete(audits).where(eq(audits.id, id));
  }

  async getFindingsByAudit(auditId: string, userId?: string): Promise<Finding[]> {
    const audit = await this.getAudit(auditId, userId);
    if (!audit) return [];
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

  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
}

export const storage = new DatabaseStorage();
