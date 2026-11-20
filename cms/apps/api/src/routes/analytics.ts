import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { authenticate, requireSite, requireSuperAdmin } from '../auth.js';
import { audit } from '../audit.js';
import { decrypt, encrypt } from '../agent/secret.js';
import { AnalyticsError, clearAnalyticsCache, loadReport, parseServiceAccount, type Settings } from '../analytics.js';

/**
 * Visitor numbers per website, from Google Analytics 4. Connecting a website is for super admins; anyone who can open
 * the website can read its numbers. The key never leaves the server: these routes answer with numbers and names only.
 */
export default async function (app: FastifyInstance) {
  const guard = <T>(fn: () => Promise<T>) => fn().catch((e) => { if (e instanceof AnalyticsError) throw Object.assign(new Error(e.message), { statusCode: e.status }); throw e; });
  const days = z.coerce.number().int().refine((n) => [7, 30, 90].includes(n), 'days must be 7, 30 or 90').default(30);
  const actor = async (id: string) => ({ id, name: (await prisma.user.findUnique({ where: { id }, select: { name: true } }))?.name ?? 'An admin' });

  app.get('/sites/:siteId/analytics', { preHandler: requireSite('VIEWER') }, async (req) => {
    const { siteId } = req.params as { siteId: string };
    const me = await prisma.user.findUnique({ where: { id: req.user.sub }, select: { isSuperAdmin: true } });
    const l = await prisma.analyticsLink.findUnique({ where: { siteId } });
    return { configured: !!l, settings: l?.settings ?? {}, hasKey: !!l?.secretEnc, canManage: !!me?.isSuperAdmin };
  });

  app.put('/sites/:siteId/analytics', { preHandler: requireSuperAdmin }, async (req) => {
    const { siteId } = req.params as { siteId: string };
    const b = z.object({
      settings: z.object({ propertyId: z.string().trim().max(20).optional() }),
      secret: z.string().trim().max(20_000).optional(),
    }).parse(req.body);
    const old = await prisma.analyticsLink.findUnique({ where: { siteId } });
    const settings: Settings = { propertyId: b.settings.propertyId };
    if (!settings.propertyId || !/^[0-9]+$/.test(settings.propertyId)) throw Object.assign(new Error('Enter the GA4 property ID: the number from Admin, Property settings.'), { statusCode: 400 });
    // keeping the saved file is allowed when only the property changes
    const secret = b.secret || decrypt(old?.secretEnc);
    if (!secret) throw Object.assign(new Error('Paste the contents of the service account .json file.'), { statusCode: 400 });
    parseServiceAccount(secret);
    // ask Google once before saving, so a wrong property or file is caught here and not on the Analytics page
    await guard(() => loadReport(siteId, 7, settings, secret, true));
    const a = await actor(req.user.sub);
    await prisma.analyticsLink.upsert({
      where: { siteId },
      update: { provider: 'ga4', settings: settings as object, secretEnc: encrypt(secret), connectedBy: a.name },
      create: { siteId, provider: 'ga4', settings: settings as object, secretEnc: encrypt(secret), connectedBy: a.name },
    });
    clearAnalyticsCache(siteId);
    await audit(a, 'analytics.connect', `Google Analytics property ${settings.propertyId}`, siteId);
    return { configured: true, settings, hasKey: true, canManage: true };
  });

  app.delete('/sites/:siteId/analytics', { preHandler: requireSuperAdmin }, async (req, reply) => {
    const { siteId } = req.params as { siteId: string };
    const old = await prisma.analyticsLink.findUnique({ where: { siteId } });
    await prisma.analyticsLink.deleteMany({ where: { siteId } });
    clearAnalyticsCache(siteId);
    if (old) await audit(await actor(req.user.sub), 'analytics.disconnect', 'Google Analytics', siteId);
    return reply.code(204).send();
  });

  app.get('/sites/:siteId/analytics/report', { preHandler: requireSite('VIEWER') }, async (req) => {
    const { siteId } = req.params as { siteId: string };
    const q = z.object({ days, fresh: z.string().optional() }).parse(req.query);
    const l = await prisma.analyticsLink.findUnique({ where: { siteId } });
    if (!l) throw Object.assign(new Error('Analytics is not connected for this website yet.'), { statusCode: 404 });
    const secret = decrypt(l.secretEnc);
    if (!secret) throw Object.assign(new Error('The saved key can no longer be read. Connect analytics again.'), { statusCode: 409 });
    return guard(() => loadReport(siteId, q.days, l.settings as Settings, secret, q.fresh === '1'));
  });

  /** One line per website the person can open, with its totals and a small trend. A website with no analytics yet is listed too. */
  app.get('/analytics/overview', { preHandler: authenticate }, async (req) => {
    const q = z.object({ days }).parse(req.query);
    const me = await prisma.user.findUniqueOrThrow({ where: { id: req.user.sub }, include: { memberships: true } });
    const all = me.isSuperAdmin || !!me.allSitesRole;
    const sites = await prisma.site.findMany({ where: all ? {} : { id: { in: me.memberships.map((m) => m.siteId) } }, orderBy: { createdAt: 'asc' }, include: { analyticsLink: true } });
    return Promise.all(sites.map(async (s) => {
      const head = { siteId: s.id, name: s.name, domain: s.domains[0] ?? null };
      const l = s.analyticsLink;
      if (!l) return { ...head, connected: false as const };
      const secret = decrypt(l.secretEnc);
      if (!secret) return { ...head, connected: true as const, error: 'The saved key can no longer be read. Connect analytics again.' };
      try {
        const r = await loadReport(s.id, q.days, l.settings as Settings, secret);
        return { ...head, connected: true as const, totals: r.totals, previous: r.previous, series: r.series.map((x) => ({ date: x.date, visitors: x.visitors })) };
      } catch (e) {
        return { ...head, connected: true as const, error: e instanceof Error ? e.message : 'Could not load the numbers.' };
      }
    }));
  });
}
