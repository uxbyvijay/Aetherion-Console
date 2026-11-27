import { prisma } from './db.js';

/** A note for admins that a password was reset or changed. Never blocks the change itself. */
export async function recordNotice(kind: 'reset-by-code' | 'changed-by-user' | 'reset-by-admin', target: { name: string; email: string }, actorName: string) {
  try {
    await prisma.accountNotice.create({ data: { kind, targetName: target.name, targetEmail: target.email, actorName } });
    const old = await prisma.accountNotice.findMany({ orderBy: { createdAt: 'desc' }, skip: 100, select: { id: true } });
    if (old.length) await prisma.accountNotice.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
  } catch (err) {
    console.error('notices: could not record a password change', (err as Error).message);
  }
}
