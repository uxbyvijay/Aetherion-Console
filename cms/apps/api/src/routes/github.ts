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

  /** Recent admin actions for a website (connect, disconnect, and later pushes). */
  app.get('/sites/:siteId/audit', { preHandler: requireSuperAdmin }, async (req) => {
    const { siteId } = req.params as { siteId: string };
    return prisma.auditLog.findMany({ where: { siteId }, orderBy: { createdAt: 'desc' }, take: 50 });
  });
}
