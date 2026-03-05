import { scanRepository } from "./scanner";

const pendingAuditIds: string[] = [];
const queuedAuditIds = new Set<string>();
let workerActive = false;

async function runWorker(): Promise<void> {
  if (workerActive) return;
  workerActive = true;

  while (pendingAuditIds.length > 0) {
    const auditId = pendingAuditIds.shift();
    if (!auditId) continue;

    try {
      await scanRepository(auditId);
    } catch (err) {
      console.error(`Queued scan failed for audit ${auditId}:`, err);
    } finally {
      queuedAuditIds.delete(auditId);
    }
  }

  workerActive = false;
}

export function enqueueScan(auditId: string): { queued: boolean; position: number } {
  if (queuedAuditIds.has(auditId)) {
    return { queued: false, position: pendingAuditIds.indexOf(auditId) + 1 };
  }

  pendingAuditIds.push(auditId);
  queuedAuditIds.add(auditId);

  void runWorker();

  return { queued: true, position: pendingAuditIds.length };
}
