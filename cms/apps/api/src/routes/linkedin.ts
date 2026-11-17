import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireSite } from '../auth.js';
import { actorOf, recordChange } from '../activity.js';
import { authorizeUrl, createPost, disconnect, draftFor, finishConnect, isArticleType, LinkedinError, saveSetup, status } from '../agent/linkedin.js';

const setup = z.object({
  clientId: z.string().trim().min(5, 'That Client ID looks too short.').max(100),
  clientSecret: z.string().trim().min(5, 'That Client Secret looks too short.').max(200).optional(),
  urlPattern: z.string().trim().max(300).refine((u) => u === '' || (/^https?:\/\/[^\s]+$/i.test(u) && u.includes('{slug}')), 'The address must start with https:// and contain {slug}, for example https://example.com/news/{slug}').optional(),
});

const adminOrigin = () => (process.env.ADMIN_ORIGIN?.split(',')[0] || 'http://localhost:5173').trim().replace(/\/$/, '');

/** Post an article to LinkedIn: the connection (Settings), the draft of the post, and the post itself. */
export default async function (app: FastifyInstance) {
  app.get('/sites/:siteId/linkedin', { preHandler: requireSite('VIEWER') }, async (req) => status((req.params as { siteId: string }).siteId));

  app.put('/sites/:siteId/linkedin', { preHandler: requireSite('EDITOR') }, async (req, reply) => {
    const { siteId } = req.params as { siteId: string };
    const b = setup.parse(req.body);
    const cur = await status(siteId);
    if (!cur.hasSecret && !b.clientSecret) return reply.code(400).send({ error: 'Add the Client Secret too.' });
    await saveSetup(siteId, b);
    app.log.info({ linkedin: { site: siteId } }, 'LinkedIn app details saved');
    return status(siteId);
  });

  app.post('/sites/:siteId/linkedin/connect', { preHandler: requireSite('EDITOR') }, async (req, reply) => {
    const r = await authorizeUrl((req.params as { siteId: string }).siteId);
    return 'error' in r ? reply.code(400).send(r) : r;
  });

  app.delete('/sites/:siteId/linkedin', { preHandler: requireSite('EDITOR') }, async (req, reply) => {
    const { forget } = req.query as { forget?: string };
    await disconnect((req.params as { siteId: string }).siteId, forget === '1');
    return reply.code(204).send();
  });

  // LinkedIn sends the person back here after they allow the app. No sign-in header can come with this request, so the signed state proves it is ours.
  app.get('/linkedin/callback', async (req, reply) => {
    const q = req.query as { code?: string; state?: string; error?: string; error_description?: string };
    const back = (ok: boolean, why = '') => reply.redirect(`${adminOrigin()}/?linkedin=${ok ? 'connected' : 'failed'}${why ? `&reason=${encodeURIComponent(why.slice(0, 200))}` : ''}`);
    if (q.error) return back(false, q.error === 'user_cancelled_authorize' || q.error === 'access_denied' ? 'You did not allow the connection.' : q.error_description || q.error);
    if (!q.code || !q.state) return back(false, 'LinkedIn did not send the sign-in details.');
    const r = await finishConnect(q.code, q.state);
    if ('error' in r) return back(false, r.error);
    app.log.info({ linkedin: { site: r.siteId } }, 'LinkedIn connected');
    return back(true);
  });

  /** What would be posted for this article, and anything that stops it. Posts nothing. */
  app.post('/sites/:siteId/entries/:id/linkedin/draft', { preHandler: requireSite('EDITOR') }, async (req, reply) => {
    const { siteId, id } = req.params as { siteId: string; id: string };
    const entry = await prisma.entry.findFirst({ where: { id, siteId }, include: { contentType: true } });
    if (!entry) return reply.code(404).send({ error: 'Not found' });
    if (!isArticleType(entry.contentType)) return reply.code(400).send({ error: 'Only articles can be posted to LinkedIn.' });
    return draftFor(siteId, entry);
  });

  /** Posts to LinkedIn. The person has already seen and confirmed this exact text in the CMS; `confirmed` says so. */
  app.post('/sites/:siteId/entries/:id/linkedin/post', { preHandler: requireSite('EDITOR') }, async (req, reply) => {
    const { siteId, id } = req.params as { siteId: string; id: string };
    const b = z.object({ text: z.string().trim().min(1).max(3000), confirmed: z.literal(true) }).parse(req.body);
    const entry = await prisma.entry.findFirst({ where: { id, siteId }, include: { contentType: true } });
    if (!entry) return reply.code(404).send({ error: 'Not found' });
    if (!isArticleType(entry.contentType)) return reply.code(400).send({ error: 'Only articles can be posted to LinkedIn.' });
    const draft = await draftFor(siteId, entry);
    if (draft.problems.length) return reply.code(409).send({ error: draft.problems[0] });
    try {
      const done = await createPost(siteId, { text: b.text, url: draft.url, title: draft.title, description: draft.description });
      app.log.info({ linkedin: { site: siteId, article: entry.slug, via: 'CMS, confirmed by the user' } }, 'posted to LinkedIn');
      // keep the post's address on the article when it has a place for it
      const hasField = (entry.contentType.fields as { name: string }[]).some((f) => f.name === 'linkedinUrl');
      if (hasField && done.url) {
        const updated = await prisma.entry.update({ where: { id }, data: { data: { ...(entry.data as object), linkedinUrl: done.url } } });
        await recordChange({ entry: updated, before: entry, action: 'edited', actor: await actorOf(req) });
      }
      return done;
    } catch (e) {
      if (e instanceof LinkedinError) return reply.code(502).send({ error: e.message });
      throw e;
    }
  });
}
