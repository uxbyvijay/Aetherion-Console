import type { FastifyInstance } from 'fastify';
import { sealPassword } from '../pwvault.js';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db.js';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { authDisabled, authenticate, requireSuperAdmin } from '../auth.js';
import { mailConfigured, sendResetCode } from '../mailer.js';
import { recordNotice } from '../notices.js';

const codeDigest = (salt: string, code: string) => createHash('sha256').update(`${salt}:${code}:${process.env.JWT_SECRET ?? ''}`).digest('hex');

const publicUser = (u: { id: string; email: string; name: string; isSuperAdmin: boolean; allSitesRole?: string | null; mustChangePassword?: boolean }) => ({
  id: u.id, email: u.email, name: u.name, isSuperAdmin: u.isSuperAdmin, allSitesRole: u.allSitesRole ?? null, mustChangePassword: !!u.mustChangePassword,
});
const GOOGLE_CLIENT_ID = () => process.env.GOOGLE_CLIENT_ID?.trim() || '';

export default async function (app: FastifyInstance) {
  app.get('/auth/status', async () => ({ needsSetup: !authDisabled && (await prisma.user.count()) === 0, authDisabled, googleClientId: GOOGLE_CLIENT_ID() || null }));

  // The first user becomes super admin; afterwards only a super admin can create users.
  app.post('/auth/register', async (req, reply) => {
    const body = z.object({ email: z.string().email(), name: z.string().min(1), password: z.string().min(8), allSitesRole: z.enum(['ADMIN', 'EDITOR', 'VIEWER']).optional(), superAdmin: z.boolean().optional(), mustChangePassword: z.boolean().optional() }).parse(req.body);
    const first = (await prisma.user.count()) === 0;
    if (!first) {
      await requireSuperAdmin(req, reply);
      if (reply.sent) return;
    }
    const email = body.email.toLowerCase();
    if (await prisma.user.findUnique({ where: { email } })) return reply.code(409).send({ error: 'Email already in use' });
    const user = await prisma.user.create({
      data: { email, name: body.name, passwordHash: await bcrypt.hash(body.password, 10), passwordCopy: first ? null : sealPassword(body.password), isSuperAdmin: first || !!body.superAdmin, allSitesRole: first || body.superAdmin ? null : body.allSitesRole ?? null, mustChangePassword: !first && !!body.mustChangePassword },
    });
    return reply.code(201).send(publicUser(user));
  });

  // Forgot password, step 1: email a 6-digit code. The answer is the same whether or not the email has an account.
  app.post('/auth/forgot', async (req) => {
    const { email } = z.object({ email: z.string().trim().min(3) }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    const configured = mailConfigured();
    if (!user || user.email.endsWith('@localhost')) return { ok: true, emailConfigured: configured };
    const last = await prisma.passwordReset.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } });
    if (last && Date.now() - last.createdAt.getTime() < 60_000) return { ok: true, emailConfigured: configured, wait: true };
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const salt = randomBytes(8).toString('hex');
    await prisma.passwordReset.deleteMany({ where: { userId: user.id } });
    await prisma.passwordReset.create({ data: { userId: user.id, codeHash: `${salt}:${codeDigest(salt, code)}`, expiresAt: new Date(Date.now() + 15 * 60_000) } });
    try { await sendResetCode(user.email, code); } catch (err) { console.error('mail: could not send the reset code:', (err as Error).message); }
    return { ok: true, emailConfigured: configured };
  });

  // Forgot password, step 2: the code from the email plus a new password.
  app.post('/auth/reset', async (req, reply) => {
    const b = z.object({ email: z.string().trim().min(3), code: z.string().trim().regex(/^\d{6}$/), password: z.string().min(8).max(200) }).parse(req.body);
    const bad = () => reply.code(400).send({ error: 'That code is not right or has expired. Ask for a new one.' });
    const user = await prisma.user.findUnique({ where: { email: b.email.toLowerCase() } });
    if (!user) return bad();
    const r = await prisma.passwordReset.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } });
    if (!r || r.expiresAt < new Date() || r.attempts >= 5) return bad();
    const [salt, digest] = r.codeHash.split(':');
    const good = timingSafeEqual(Buffer.from(codeDigest(salt, b.code)), Buffer.from(digest));
    if (!good) { await prisma.passwordReset.update({ where: { id: r.id }, data: { attempts: { increment: 1 } } }); return bad(); }
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(b.password, 10), mustChangePassword: false, passwordCopy: null } });
    await prisma.passwordReset.deleteMany({ where: { userId: user.id } });
    await recordNotice('reset-by-code', user, user.name);
    return { ok: true };
  });

  app.post('/auth/login', async (req, reply) => {
    const body = z.object({ email: z.string(), password: z.string() }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      return reply.code(401).send({ error: 'Invalid email or password' });
    }
    return { token: app.jwt.sign({ sub: user.id }, { expiresIn: '7d' }), user: publicUser(user) };
  });

  // Sign in with Google: only for accounts a super admin already made (matched by their verified Google email)
  app.post('/auth/google', async (req, reply) => {
    const clientId = GOOGLE_CLIENT_ID();
    if (!clientId) return reply.code(400).send({ error: 'Sign in with Google is not set up.' });
    const { credential } = z.object({ credential: z.string().min(20) }).parse(req.body);
    const res = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential), { signal: AbortSignal.timeout(15_000) }).catch(() => null);
    if (!res || !res.ok) return reply.code(401).send({ error: 'Google did not accept the sign-in. Try again.' });
    const g = (await res.json()) as { aud?: string; email?: string; email_verified?: string | boolean; exp?: string };
    if (g.aud !== clientId || !g.email || !(g.email_verified === true || g.email_verified === 'true')) return reply.code(401).send({ error: 'This Google sign-in cannot be used here.' });
    const user = await prisma.user.findUnique({ where: { email: g.email.toLowerCase() } });
    if (!user) return reply.code(403).send({ error: 'There is no account for ' + g.email + '. Ask a super admin to create one with this email.' });
    return { token: app.jwt.sign({ sub: user.id }, { expiresIn: '7d' }), user: publicUser(user) };
  });

  // Choose a new password. After a temporary one the current password is not asked again: the person has just signed in with it.
  app.post('/auth/change-password', { preHandler: authenticate }, async (req, reply) => {
    const b = z.object({ password: z.string().min(8).max(200), current: z.string().optional() }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });
    if (!user.mustChangePassword && !(b.current && (await bcrypt.compare(b.current, user.passwordHash)))) return reply.code(400).send({ error: 'The current password is not right.' });
    if (await bcrypt.compare(b.password, user.passwordHash)) return reply.code(400).send({ error: 'Choose a password you have not used for this account.' });
    const saved = await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(b.password, 10), mustChangePassword: false, passwordCopy: null } });
    await recordNotice('changed-by-user', saved, saved.name);
    return publicUser(saved);
  });

  app.get('/auth/me', { preHandler: authenticate }, async (req, reply) => {
    const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });
    return publicUser(user);
  });

  app.get('/users', { preHandler: requireSuperAdmin }, async () =>
    (await prisma.user.findMany({ orderBy: { createdAt: 'asc' } })).map(publicUser));
}
