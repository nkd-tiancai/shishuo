import { db } from "./db";

export async function logAudit(opts: {
  userId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}) {
  let json: string | null = null;
  if (opts.metadata) {
    try { json = JSON.stringify(opts.metadata); }
    catch { json = JSON.stringify({ error: "metadata serialization failed" }); }
  }

  // 审计日志不阻塞主操作（fail-open）
  try {
    await db.auditLog.create({
      data: {
        userId: opts.userId,
        action: opts.action,
        resourceType: opts.resourceType,
        resourceId: opts.resourceId ?? null,
        metadata: json,
        ip: opts.ip ?? null,
      },
    });
  } catch (e) {
    console.error("audit log write failed:", e);
  }
}
