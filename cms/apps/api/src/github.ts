/**
 * Server-side GitHub client. The token comes from GITHUB_TOKEN in the server environment and is never stored,
 * logged or sent to the browser. This file only reads: branch, commit and pull-request calls come in the next step,
 * and there is no merge call anywhere, on purpose.
 */
const API = 'https://api.github.com';
const NAME = /^[A-Za-z0-9_.-]{1,100}$/;
const BRANCH = /^[A-Za-z0-9._\/-]{1,200}$/;

export const githubConfigured = () => !!process.env.GITHUB_TOKEN;
/** Only repositories of these owners (comma separated user/org logins) can be connected. Empty = any the token can reach. */
const allowedOwners = () => (process.env.GITHUB_ALLOWED_OWNERS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

export class GithubError extends Error {
  constructor(message: string, public status = 502) { super(message); }
}

export function checkRepoName(owner: string, repo: string) {
  if (!NAME.test(owner) || !NAME.test(repo) || repo === '.' || repo === '..') throw new GithubError('That is not a valid repository name.', 400);
  const allow = allowedOwners();
  if (allow.length && !allow.includes(owner.toLowerCase())) throw new GithubError(`Repositories of "${owner}" are not allowed here.`, 403);
}
export function checkBranchName(b: string) {
  if (!BRANCH.test(b) || b.includes('..') || b.startsWith('/') || b.endsWith('/') || b.endsWith('.lock')) throw new GithubError('That is not a valid branch name.', 400);
}
/** A path inside the repository: no traversal, no hidden/git folders, no absolute paths. */
export function checkRepoPath(p: string) {
  const bad = !p || p.length > 300 || p.startsWith('/') || p.includes('\\') || p.includes('\0') || p.split('/').some((s) => s === '' || s === '.' || s === '..' || s.toLowerCase() === '.git');
  if (bad) throw new GithubError('That is not a valid path.', 400);
}

async function gh<T>(path: string): Promise<T> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new GithubError('GitHub is not connected: set GITHUB_TOKEN in the server settings.', 503);
  const res = await fetch(API + path, {
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'cms-console' },
  }).catch(() => { throw new GithubError('Could not reach GitHub.'); });
  if (res.status === 401) throw new GithubError('GitHub did not accept the token. It may have expired or been revoked.', 502);
  if (res.status === 403 || res.status === 429) throw new GithubError('GitHub refused the request (permissions or rate limit).', 502);
  if (res.status === 404) throw new GithubError('Not found on GitHub, or the token has no access to it.', 404);
  if (!res.ok) throw new GithubError(`GitHub answered ${res.status}.`);
  return res.json() as Promise<T>;
}

export interface RepoInfo { owner: string; name: string; fullName: string; private: boolean; defaultBranch: string; description: string | null; pushedAt: string | null; canPush: boolean }
const repoInfo = (r: any): RepoInfo => ({ owner: r.owner.login, name: r.name, fullName: r.full_name, private: !!r.private, defaultBranch: r.default_branch, description: r.description ?? null, pushedAt: r.pushed_at ?? null, canPush: !!r.permissions?.push });

export async function whoami() {
  const u = await gh<any>('/user');
  return { login: u.login as string };
}
export async function listRepos(): Promise<RepoInfo[]> {
  const rs = await gh<any[]>('/user/repos?per_page=100&sort=pushed&affiliation=owner,organization_member,collaborator');
  const allow = allowedOwners();
  return rs.map(repoInfo).filter((r) => !allow.length || allow.includes(r.owner.toLowerCase()));
}
export async function getRepo(owner: string, repo: string) {
  checkRepoName(owner, repo);
  return repoInfo(await gh<any>(`/repos/${owner}/${repo}`));
}
export async function listBranches(owner: string, repo: string) {
  checkRepoName(owner, repo);
  const bs = await gh<any[]>(`/repos/${owner}/${repo}/branches?per_page=100`);
  return bs.map((b) => ({ name: b.name as string, protected: !!b.protected }));
}
/** Files and folders directly inside a folder of the repository (not recursive). */
export async function listFiles(owner: string, repo: string, ref: string, dir = '') {
  checkRepoName(owner, repo); checkBranchName(ref);
  if (dir) checkRepoPath(dir);
  const items = await gh<any>(`/repos/${owner}/${repo}/contents/${dir.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(ref)}`);
  if (!Array.isArray(items)) throw new GithubError('That path is a file, not a folder.', 400);
  return items.map((i) => ({ name: i.name as string, path: i.path as string, type: i.type as string, size: i.size as number }));
}
