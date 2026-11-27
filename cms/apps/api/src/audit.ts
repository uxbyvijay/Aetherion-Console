import { prisma } from './db.js';

/** Writes one line to the audit log. Never throws, and never put a secret in `detail`. */
export async function audit(actor: { id?: string; name: string }, action: string, detail = '', siteId?: string) {
  try {
    await prisma.auditLog.create({ data: { actorId: actor.id, actorName: actor.name, action, detail: detail.slice(0, 500), siteId } });
  } catch (err) {
    console.error('audit: could not write', (err as Error).message);
  }
}
