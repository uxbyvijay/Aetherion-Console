import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireSuperAdmin } from '../auth.js';
import { audit } from '../audit.js';
import { GithubError, openPullRequest, pullRequestState, type PrState } from '../github.js';
import { computeChanges, validate } from '../publish.js';

/**
 * Review and "Final Push". Admins only. The console prepares and proposes: it opens a pull request and never merges it.
 * Everything is recomputed on the server from the database and the repository, so the browser cannot add files or change text.
 */
export default async function (app: FastifyInstance) {
  const fail = (message: string, statusCode: number, extra?: object) => Object.assign(new Error(message), { statusCode, ...extra });
  const guard = <T>(fn: () => Promise<T>) => fn().catch((e) => { if (e instanceof GithubError) throw fail(e.message, e.status === 404 || e.status === 400 || e.status === 403 || e.status === 422 ? e.status : 502); throw e; });
  const linkOf = async (siteId: string) => {
    const l = await prisma.githubLink.findUnique({ where: { siteId }, include: { site: { select: { name: true } } } });
    if (!l) throw fail('This website is not connected to a repository yet.', 404);
    return l;
  };

  /** What would go into a pull request: every file that differs from the base branch, with the original and new text. */
  app.get('/sites/:siteId/publish/changes', { preHandler: requireSuperAdmin }, async (req) => {
    const { siteId } = req.params as { siteId: string };
    const l = await linkOf(siteId);
    const changes = await guard(() => computeChanges(siteId, l));
    return { owner: l.owner, repo: l.repo, baseBranch: l.baseBranch, contentDir: l.contentDir, changes, checks: validate(l, changes) };
  });

  /** Final Push: validates the files the admin approved, then opens a pull request. */
  app.post('/sites/:siteId/publish', { preHandler: requireSuperAdmin }, async (req, reply) => {
    const { siteId } = req.params as { siteId: string };
    const b = z.object({
      // the admin confirms the target: it must match the connected repository exactly
      owner: z.string(), repo: z.string(), baseBranch: z.string(),
      paths: z.array(z.string()).min(1, 'Pick at least one change to send.').max(200),
      note: z.string().trim().max(1000).optional(),
    }).parse(req.body);
    const l = await linkOf(siteId);
    if (b.owner !== l.owner || b.repo !== l.repo || b.baseBranch !== l.baseBranch) throw fail('The target does not match the connected repository and branch. Reload and confirm again.', 409);
    const who = await prisma.user.findUnique({ where: { id: req.user.sub }, select: { name: true } });
    const actor = { id: req.user.sub, name: who?.name ?? 'An admin' };

    const all = await guard(() => computeChanges(siteId, l));
    const wanted = new Set(b.paths);
    const unknown = b.paths.filter((p) => !all.some((c) => c.path === p));
    if (unknown.length) throw fail(`These changes no longer exist, reload the list: ${unknown.slice(0, 5).join(', ')}`, 409);
    const picked = all.filter((c) => wanted.has(c.path));

    const checks = validate(l, picked);
    const failed = checks.filter((c) => !c.ok && c.blocking);
    if (failed.length) {
      await audit(actor, 'publish.blocked', failed.map((c) => c.id).join(', '), siteId);
      return reply.code(422).send({ error: 'Validation failed, no pull request was made.', checks });
    }

    const n = (s: string) => picked.filter((c) => c.status === s).length;
    const summary = `${n('added')} added, ${n('modified')} changed, ${n('deleted')} removed`;
    const branch = `aetherion/${l.site.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'site'}-${new Date().toISOString().slice(0, 10)}-${randomBytes(3).toString('hex')}`;
    const title = `Content update from Aetherion Console: ${l.site.name} (${picked.length} file${picked.length === 1 ? '' : 's'})`;
    const body = [
      `Content update for **${l.site.name}**, prepared by ${actor.name} in Aetherion Console.`,
      b.note ? `\n**Purpose:** ${b.note}` : '',
      `\n**Summary:** ${summary}.`,
      '\n**Files:**',
      ...picked.map((c) => `- \`${c.path}\` (${c.status})`),
      `\nOnly files inside \`${l.contentDir}/aetherion/\` are changed. Nothing here was merged automatically: please review, and merge on GitHub when you are happy with it.`,
      '\n_Created by Aetherion Console._',
    ].join('\n');
    const message = `Update ${l.site.name} content from Aetherion Console (${summary})`;

    const pr = await guard(() => openPullRequest({
      owner: l.owner, repo: l.repo, base: l.baseBranch, branch, title, body, message,
      files: new Map(picked.map((c) => [c.path, c.after] as [string, string | null])),
    }));
    const rec = await prisma.publishRecord.create({ data: { siteId, owner: l.owner, repo: l.repo, baseBranch: l.baseBranch, branch: pr.branch, prNumber: pr.number, prUrl: pr.url, title, files: picked.map((c) => ({ path: c.path, status: c.status })), createdBy: actor.name } });
    await audit(actor, 'publish.pull-request', `#${pr.number} ${l.owner}/${l.repo} from ${pr.branch}: ${summary}`, siteId);
    return reply.code(201).send({ id: rec.id, url: pr.url, number: pr.number, branch: pr.branch, checks });
  });

  /** Pull requests made for this website, with where each stands on GitHub (pending, approved, changes requested, merged, closed). */
  app.get('/sites/:siteId/publish/history', { preHandler: requireSuperAdmin }, async (req) => {
    const { siteId } = req.params as { siteId: string };
    const recs = await prisma.publishRecord.findMany({ where: { siteId }, orderBy: { createdAt: 'desc' }, take: 20 });
    return Promise.all(recs.map(async (r) => {
      let state: PrState | null = null;
      try { state = await pullRequestState(r.owner, r.repo, r.prNumber); } catch { /* GitHub unreachable: show the record without a status */ }
      return { id: r.id, title: r.title, url: r.prUrl, number: r.prNumber, branch: r.branch, files: r.files, createdBy: r.createdBy, createdAt: r.createdAt, state };
    }));
  });
}
