import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "./db";
import {
  audits,
  findings,
  users,
  stripeWebhookEvents,
  type Audit,
  type InsertAudit,
  type Finding,
  type InsertFinding,
  type InsertUser,
  type User,
} from "@shared/schema";
import { decryptSensitiveJson, decryptSensitiveText, encryptSensitiveJson, encryptSensitiveText } from "./security";

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
  deleteUserData(userId: string): Promise<void>;
  markAuditPaidIfUnpaid(auditId: string, stripeSessionId: string, userId?: string): Promise<boolean>;
  recordStripeWebhookEvent(event: {
    eventId: string;
    eventType: string;
    auditId?: string;
    stripeSessionId?: string;
    status?: string;
  }): Promise<boolean>;
  processPaidCheckoutWebhookEvent(event: {
    eventId: string;
    eventType: string;
    auditId: string;
    stripeSessionId: string;
  }): Promise<boolean>;
}

function decryptAuditRecord(audit: Audit): Audit {
  return {
    ...audit,
    contactEmail: decryptSensitiveText(audit.contactEmail) || audit.contactEmail,
    fileTree: decryptSensitiveJson(audit.fileTree),
    scanLog: decryptSensitiveJson(audit.scanLog),
  };
}

function encryptAuditInsert(audit: InsertAudit & { userId?: string }): InsertAudit & { userId?: string } {
  return {
    ...audit,
    contactEmail: encryptSensitiveText(audit.contactEmail) || audit.contactEmail,
  };
}

function encryptAuditUpdate(data: Partial<Audit>): Partial<Audit> {
  const encrypted: Partial<Audit> = { ...data };

  if (Object.prototype.hasOwnProperty.call(data, "contactEmail")) {
    encrypted.contactEmail = encryptSensitiveText(data.contactEmail) as string;
  }
  if (Object.prototype.hasOwnProperty.call(data, "fileTree")) {
    encrypted.fileTree = encryptSensitiveJson(data.fileTree) as Audit["fileTree"];
  }
  if (Object.prototype.hasOwnProperty.call(data, "scanLog")) {
    encrypted.scanLog = encryptSensitiveJson(data.scanLog) as Audit["scanLog"];
  }

  return encrypted;
}

export class DatabaseStorage implements IStorage {
  async getAudits(userId?: string): Promise<Audit[]> {
    const rows = userId
      ? await db.select().from(audits).where(eq(audits.userId, userId)).orderBy(audits.createdAt)
      : await db.select().from(audits).orderBy(audits.createdAt);

    return rows.map(decryptAuditRecord);
  }

  async getAudit(id: string, userId?: string): Promise<Audit | undefined> {
    const [audit] = userId
      ? await db.select().from(audits).where(and(eq(audits.id, id), eq(audits.userId, userId)))
      : await db.select().from(audits).where(eq(audits.id, id));
    return audit ? decryptAuditRecord(audit) : undefined;
  }

  async createAudit(audit: InsertAudit & { userId?: string }): Promise<Audit> {
    const [created] = await db.insert(audits).values(encryptAuditInsert(audit)).returning();
    return decryptAuditRecord(created);
  }

  async updateAudit(id: string, data: Partial<Audit>, userId?: string): Promise<Audit | undefined> {
    const [updated] = userId
      ? await db
          .update(audits)
          .set(encryptAuditUpdate(data))
          .where(and(eq(audits.id, id), eq(audits.userId, userId)))
          .returning()
      : await db.update(audits).set(encryptAuditUpdate(data)).where(eq(audits.id, id)).returning();
    return updated ? decryptAuditRecord(updated) : undefined;
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

  async deleteUserData(userId: string): Promise<void> {
    const userAudits = await db.select({ id: audits.id }).from(audits).where(eq(audits.userId, userId));

    for (const audit of userAudits) {
      await db.delete(findings).where(eq(findings.auditId, audit.id));
    }

    await db.delete(audits).where(eq(audits.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
  }

  async markAuditPaidIfUnpaid(auditId: string, stripeSessionId: string, userId?: string): Promise<boolean> {
    return db.transaction(async (tx) => {
      const conditions = [eq(audits.id, auditId), isNull(audits.paidAt), or(isNull(audits.stripeSessionId), eq(audits.stripeSessionId, stripeSessionId))];
      if (userId) {
        conditions.push(eq(audits.userId, userId));
      }

      const [updated] = await tx
        .update(audits)
        .set({
          paidAt: new Date(),
          stripeSessionId,
        })
        .where(and(...conditions))
        .returning({ id: audits.id });

      return !!updated;
    });
  }

  async recordStripeWebhookEvent(event: {
    eventId: string;
    eventType: string;
    auditId?: string;
    stripeSessionId?: string;
    status?: string;
  }): Promise<boolean> {
    const inserted = await db
      .insert(stripeWebhookEvents)
      .values({
        eventId: event.eventId,
        eventType: event.eventType,
        auditId: event.auditId,
        stripeSessionId: event.stripeSessionId,
        status: event.status ?? "processed",
      })
      .onConflictDoNothing({ target: stripeWebhookEvents.eventId })
      .returning({ id: stripeWebhookEvents.id });

    return inserted.length > 0;
  }

  async processPaidCheckoutWebhookEvent(event: {
    eventId: string;
    eventType: string;
    auditId: string;
    stripeSessionId: string;
  }): Promise<boolean> {
    return db.transaction(async (tx) => {
      const inserted = await tx
        .insert(stripeWebhookEvents)
        .values({
          eventId: event.eventId,
          eventType: event.eventType,
          auditId: event.auditId,
          stripeSessionId: event.stripeSessionId,
          status: "processed",
        })
        .onConflictDoNothing({ target: stripeWebhookEvents.eventId })
        .returning({ id: stripeWebhookEvents.id });

      if (!inserted.length) {
        return false;
      }

      await tx
        .update(audits)
        .set({
          paidAt: new Date(),
          stripeSessionId: event.stripeSessionId,
        })
        .where(
          and(
            eq(audits.id, event.auditId),
            isNull(audits.paidAt),
            or(isNull(audits.stripeSessionId), eq(audits.stripeSessionId, event.stripeSessionId))
          )
        );

      return true;
    });
  }
}

export const storage = new DatabaseStorage();
