import { isIP } from 'node:net';
import type { FastifyInstance } from 'fastify';
import { openPassword, sealPassword } from '../pwvault.js';
import { recordNotice } from '../notices.js';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db.js';
import { authenticate, requireSite, requireSuperAdmin } from '../auth.js';

const siteBody = z.object({
  name: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  domains: z.array(z.string().min(1)).default([]),
});
// Optional URL of the site's front end, shown in the admin's live preview. http(s) only.
const previewUrl = z
  .string()
  .trim()
  .refine((u) => u === '' || /^https?:\/\/[^\s]+$/i.test(u), 'Preview URL must start with http:// or https://')
  .transform((u) => u || null)
  .nullish();
const newKey = () => 'cms_' + randomBytes(24).toString('hex');
/** Hosting record: all optional, empty clears it. */
const blank = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);
const host = z.preprocess(blank, z.string().trim().max(253).regex(/^[A-Za-z0-9]([A-Za-z0-9._-]*[A-Za-z0-9])?$/, 'Use letters, digits, dots and dashes only').nullable().optional());
const hostingBody = {
  dnsName: host,
  serverName: host,
  serverPort: z.preprocess(blank, z.coerce.number().int().min(1, 'Port is a number from 1 to 65535').max(65535, 'Port is a number from 1 to 65535').nullable().optional()),
  serverIp: z.preprocess(blank, z.string().trim().max(45).refine((v) => isIP(v) !== 0, 'Enter an IP address such as 203.0.113.10').nullable().optional()),
};
const lower = (d?: string[]) => d?.map((x) => x.trim().toLowerCase().replace(/^www\./, ''));

export default async function (app: FastifyInstance) {
  app.get('/sites', { preHandler: authenticate }, async (req) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user.sub } });
    if (user.isSuperAdmin) {
      const all = await prisma.site.findMany({ orderBy: { createdAt: 'asc' } });
      return all.map((s) => ({ ...s, role: 'ADMIN' }));
    }
    const ms = await prisma.membership.findMany({ where: { userId: user.id }, include: { site: true } });
    const order = { VIEWER: 1, EDITOR: 2, ADMIN: 3 } as const;
    // API keys are only shown to site admins.
    const view = (site: (typeof ms)[number]['site'], role: 'ADMIN' | 'EDITOR' | 'VIEWER') => ({ ...site, apiKey: role === 'ADMIN' ? site.apiKey : undefined, dnsName: role === 'ADMIN' ? site.dnsName : undefined, serverName: role === 'ADMIN' ? site.serverName : undefined, serverPort: role === 'ADMIN' ? site.serverPort : undefined, serverIp: role === 'ADMIN' ? site.serverIp : undefined, role });
    if (user.allSitesRole) {
      // access to the entire CMS: every site, at the better of the two roles
      const all = await prisma.site.findMany({ orderBy: { createdAt: 'asc' } });
      return all.map((s) => { const own = ms.find((m) => m.siteId === s.id)?.role; return view(s, own && order[own] > order[user.allSitesRole!] ? own : user.allSitesRole!); });
    }
    return ms.map((m) => view(m.site, m.role));
  });

  app.post('/sites', { preHandler: requireSuperAdmin }, async (req, reply) => {
    const body = siteBody.parse(req.body);
    const site = await prisma.site.create({ data: { ...body, domains: lower(body.domains)!, apiKey: newKey() } });
    return reply.code(201).send(site);
  });

  app.patch('/sites/:siteId', { preHandler: requireSite('ADMIN') }, async (req) => {
    const { siteId } = req.params as { siteId: string };
    const body = siteBody.partial().extend({ previewUrl, ...hostingBody }).parse(req.body);
    return prisma.site.update({ where: { id: siteId }, data: { ...body, domains: lower(body.domains) } });
  });

  app.post('/sites/:siteId/rotate-key', { preHandler: requireSite('ADMIN') }, async (req) => {
    const { siteId } = req.params as { siteId: string };
    return prisma.site.update({ where: { id: siteId }, data: { apiKey: newKey() } });
  });

  app.delete('/sites/:siteId', { preHandler: requireSuperAdmin }, async (req, reply) => {
    const { siteId } = req.params as { siteId: string };
    await prisma.site.delete({ where: { id: siteId } });
    return reply.code(204).send();
  });

  /** Every account and the sites it can open. Super admin only: it is how new accounts that have no site yet can be found and given one. */
  app.get('/accounts', { preHandler: requireSuperAdmin }, async () => {
    // the built-in account used while sign-in is off is not a person: it is not listed
    const us = await prisma.user.findMany({ where: { email: { not: 'local-admin@localhost' } }, orderBy: { createdAt: 'asc' }, include: { memberships: { include: { site: { select: { id: true, name: true } } } } } });
    return us.map((u) => ({ id: u.id, email: u.email, name: u.name, isSuperAdmin: u.isSuperAdmin, allSitesRole: u.allSitesRole, mustChangePassword: u.mustChangePassword, createdAt: u.createdAt, sites: u.memberships.map((m) => ({ id: m.site.id, name: m.site.name, role: m.role })) }));
  });

  /** Gives an account access to the entire CMS (every website, also ones added later), or takes it away. */
  app.put('/accounts/:id', { preHandler: requireSuperAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const b = z.object({
      allSitesRole: z.enum(['ADMIN', 'EDITOR', 'VIEWER']).nullable().optional(),
      isSuperAdmin: z.boolean().optional(),
      name: z.string().trim().min(1).max(120).optional(),
      email: z.string().trim().email().optional(),
      /** a new password for the person */
      password: z.string().min(8).max(200).optional(),
    }).parse(req.body);
    const u = await prisma.user.findUnique({ where: { id } });
    if (!u) return reply.code(404).send({ error: 'No such account' });
    if (b.isSuperAdmin === false && u.isSuperAdmin && (await prisma.user.count({ where: { isSuperAdmin: true } })) <= 1) return reply.code(400).send({ error: 'There must be at least one admin.' });
    const email = b.email?.toLowerCase();
    if (email && email !== u.email && (await prisma.user.findUnique({ where: { email } }))) return reply.code(409).send({ error: 'Another account already uses that email.' });
    await prisma.user.update({
      where: { id },
      data: {
        ...(b.name && { name: b.name }),
        ...(email && { email }),
        ...(b.allSitesRole !== undefined && { allSitesRole: b.allSitesRole }),
        ...(b.isSuperAdmin !== undefined && { isSuperAdmin: b.isSuperAdmin, ...(b.isSuperAdmin ? { allSitesRole: null } : {}) }),
        ...(b.password && { passwordHash: await bcrypt.hash(b.password, 10), mustChangePassword: false, passwordCopy: sealPassword(b.password) }),
      },
    });
    if (b.password) {
      const actor = await prisma.user.findUnique({ where: { id: req.user.sub }, select: { name: true } });
      await recordNotice('reset-by-admin', { name: b.name ?? u.name, email: email ?? u.email }, actor?.name ?? 'An admin');
    }
    return { ok: true };
  });

  /** Password changes and resets, newest first, for the bell. Admins only. */
  app.get('/account-notices', { preHandler: requireSuperAdmin }, async () => {
    const items = await prisma.accountNotice.findMany({ orderBy: { createdAt: 'desc' }, take: 30 });
    return { items: items.map((n) => ({ id: n.id, kind: n.kind, targetName: n.targetName, targetEmail: n.targetEmail, actorName: n.actorName, createdAt: n.createdAt })) };
  });

  /** The password an admin set for this person, when there is one (a password the person chose themselves is never kept). */
  app.get('/accounts/:id/password', { preHandler: requireSuperAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const u = await prisma.user.findUnique({ where: { id } });
    if (!u) return reply.code(404).send({ error: 'No such account' });
    return { password: openPassword(u.passwordCopy) };
  });

  /** Removes an account for good: they can no longer sign in. Not yourself, and never the last admin. */
  app.delete('/accounts/:id', { preHandler: requireSuperAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (id === req.user.sub) return reply.code(400).send({ error: 'You cannot delete your own account.' });
    const u = await prisma.user.findUnique({ where: { id } });
    if (!u) return reply.code(404).send({ error: 'No such account' });
    if (u.isSuperAdmin && (await prisma.user.count({ where: { isSuperAdmin: true } })) <= 1) return reply.code(400).send({ error: 'There must be at least one admin.' });
    await prisma.user.delete({ where: { id } });
    return reply.code(204).send();
  });

  app.get('/sites/:siteId/members', { preHandler: requireSite('ADMIN') }, async (req) => {
    const { siteId } = req.params as { siteId: string };
    const ms = await prisma.membership.findMany({ where: { siteId }, include: { user: true } });
    return ms.map((m) => ({ userId: m.userId, email: m.user.email, name: m.user.name, role: m.role }));
  });

  app.put('/sites/:siteId/members', { preHandler: requireSite('ADMIN') }, async (req, reply) => {
    const { siteId } = req.params as { siteId: string };
    const body = z.object({ email: z.string().email(), role: z.enum(['ADMIN', 'EDITOR', 'VIEWER']) }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (!user) return reply.code(404).send({ error: 'No user with that email. A super admin must create the account first.' });
    await prisma.membership.upsert({
      where: { userId_siteId: { userId: user.id, siteId } },
      update: { role: body.role },
      create: { userId: user.id, siteId, role: body.role },
    });
    return { ok: true };
  });

  app.delete('/sites/:siteId/members/:userId', { preHandler: requireSite('ADMIN') }, async (req, reply) => {
    const { siteId, userId } = req.params as { siteId: string; userId: string };
    await prisma.membership.deleteMany({ where: { siteId, userId } });
    return reply.code(204).send();
  });
}
