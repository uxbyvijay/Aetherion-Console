import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireSuperAdmin } from '../auth.js';
import { audit } from '../audit.js';
import { GithubError, checkBranchName, checkRepoPath, getRepo, githubConfigured, listBranches, listFiles, listRepos, whoami } from '../github.js';

/**
 * GitHub connection. Admins only. The token never leaves the server: these routes answer with repository names,
 * branches and file names, and whether GitHub is set up, but never the token itself.
 */
export default async function (app: FastifyInstance) {
  // GithubError carries its own status and a message that is safe to show
  const guard = <T>(fn: () => Promise<T>) => fn().catch((e) => { if (e instanceof GithubError) throw Object.assign(new Error(e.message), { statusCode: e.status === 502 ? 502 : e.status }); throw e; });
  const actor = async (id: string) => ({ id, name: (await prisma.user.findUnique({ where: { id }, select: { name: true } }))?.name ?? 'An admin' });

  app.get('/github/status', { preHandler: requireSuperAdmin }, async () => {
    if (!githubConfigured()) return { configured: false as const };
    try { return { configured: true as const, login: (await whoami()).login }; }
    catch (e) { return { configured: true as const, login: null, error: (e as Error).message }; }
  });

  app.get('/github/repos', { preHandler: requireSuperAdmin }, async () => guard(listRepos));

  /** Branches of a repository in the allowed list, so the connect form can offer them before a site is linked. Other repositories are refused. */
  app.get('/github/repos/:owner/:repo/branches', { preHandler: requireSuperAdmin }, async (req) => {
    const { owner, repo } = req.params as { owner: string; repo: string };
    const known = await guard(listRepos);
    const hit = known.find((r) => r.owner.toLowerCase() === owner.toLowerCase() && r.name.toLowerCase() === repo.toLowerCase());
    if (!hit) throw Object.assign(new Error('That repository is not available to this console.'), { statusCode: 404 });
    return guard(() => listBranches(hit.owner, hit.name));
  });

  app.get('/sites/:siteId/github', { preHandler: requireSuperAdmin }, async (req) => {
    const { siteId } = req.params as { siteId: string };
    return (await prisma.githubLink.findUnique({ where: { siteId } })) ?? null;
  });

  /** Connects a website to one repository. Nothing else in the CMS touches GitHub except through this link. */
  app.put('/sites/:siteId/github', { preHandler: requireSuperAdmin }, async (req) => {
    const { siteId } = req.params as { siteId: string };
    const b = z.object({
      owner: z.string().trim().min(1),
      repo: z.string().trim().min(1),
      baseBranch: z.string().trim().min(1).default('main'),
      contentDir: z.string().trim().min(1).default('content'),
    }).parse(req.body);
    checkBranchName(b.baseBranch);
    const contentDir = b.contentDir.replace(/\/+$/, '');
    checkRepoPath(contentDir);
    const repo = await guard(() => getRepo(b.owner, b.repo));
    if (!repo.canPush) throw Object.assign(new Error('The GitHub token cannot write to that repository.'), { statusCode: 403 });
    const branches = await guard(() => listBranches(repo.owner, repo.name));
    if (!branches.some((x) => x.name === b.baseBranch)) throw Object.assign(new Error(`The branch "${b.baseBranch}" does not exist in ${repo.fullName}.`), { statusCode: 400 });
    const a = await actor(req.user.sub);
    const link = await prisma.githubLink.upsert({
      where: { siteId },
      update: { owner: repo.owner, repo: repo.name, baseBranch: b.baseBranch, contentDir, connectedBy: a.name },
      create: { siteId, owner: repo.owner, repo: repo.name, baseBranch: b.baseBranch, contentDir, connectedBy: a.name },
    });
    await audit(a, 'github.connect', `${repo.fullName} (base ${b.baseBranch}, folder ${contentDir})`, siteId);
    return link;
  });

  app.delete('/sites/:siteId/github', { preHandler: requireSuperAdmin }, async (req, reply) => {
    const { siteId } = req.params as { siteId: string };
    const old = await prisma.githubLink.findUnique({ where: { siteId } });
    await prisma.githubLink.deleteMany({ where: { siteId } });
    if (old) await audit(await actor(req.user.sub), 'github.disconnect', `${old.owner}/${old.repo}`, siteId);
    return reply.code(204).send();
  });

  // Branches and files are always read from the repository linked to the site, never from one named in the request.
  const linkOf = async (siteId: string) => {
    const l = await prisma.githubLink.findUnique({ where: { siteId } });
    if (!l) throw Object.assign(new Error('This website is not connected to a repository yet.'), { statusCode: 404 });
    return l;
  };
  app.get('/sites/:siteId/github/branches', { preHandler: requireSuperAdmin }, async (req) => {
    const l = await linkOf((req.params as { siteId: string }).siteId);
    return guard(() => listBranches(l.owner, l.repo));
  });
  app.get('/sites/:siteId/github/files', { preHandler: requireSuperAdmin }, async (req) => {
    const l = await linkOf((req.params as { siteId: string }).siteId);
    const q = z.object({ ref: z.string().optional(), dir: z.string().optional() }).parse(req.query);
    return guard(() => listFiles(l.owner, l.repo, q.ref ?? l.baseBranch, q.dir ?? ''));
  });

  /** Recent admin actions across every website (or one), newest first, with the website's name. */
  app.get('/audit', { preHandler: requireSuperAdmin }, async (req) => {
    const q = z.object({ siteId: z.string().optional(), limit: z.coerce.number().int().min(1).max(500).default(100) }).parse(req.query);
    const rows = await prisma.auditLog.findMany({ where: q.siteId ? { siteId: q.siteId } : {}, orderBy: { createdAt: 'desc' }, take: q.limit });
    const sites = await prisma.site.findMany({ select: { id: true, name: true } });
    const names = new Map(sites.map((s) => [s.id, s.name]));
    return rows.map((r) => ({ ...r, siteName: r.siteId ? names.get(r.siteId) ?? null : null }));
  });

  /** Recent admin actions for a website (connect, disconnect, and later pushes). */
  app.get('/sites/:siteId/audit', { preHandler: requireSuperAdmin }, async (req) => {
    const { siteId } = req.params as { siteId: string };
    return prisma.auditLog.findMany({ where: { siteId }, orderBy: { createdAt: 'desc' }, take: 50 });
  });
}
