/**
 * Server-side GitHub client. The token comes from GITHUB_TOKEN in the server environment and is never stored,
 * logged or sent to the browser. This file only reads: branch, commit and pull-request calls come in the next step,
 * and there is no merge call anywhere, on purpose.
 */
const API = 'https://api.github.com';
const NAME = /^[A-Za-z0-9_.-]{1,100}$/;
const BRANCH = /^[A-Za-z0-9._\/-]{1,200}$/;

import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';

/**
 * Two ways to sign in, both server-side only:
 *  - a GitHub App installed on the organisation (preferred): GITHUB_APP_ID, GITHUB_INSTALLATION_ID and the private key in
 *    GITHUB_APP_PRIVATE_KEY_PATH (a .pem file outside the repository) or GITHUB_APP_PRIVATE_KEY. Tokens last one hour and are renewed here.
 *  - a fine-grained token in GITHUB_TOKEN.
 */
const installId = () => process.env.GITHUB_APP_INSTALLATION_ID ?? process.env.GITHUB_INSTALLATION_ID;
const appKey = () => {
  const inline = process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (inline) return inline;
  const p = process.env.GITHUB_APP_PRIVATE_KEY_PATH;
  if (!p) return null;
  try { return readFileSync(p, 'utf8'); } catch { throw new GithubError('The GitHub App private key file could not be read.', 503); }
};
const appConfigured = () => !!(process.env.GITHUB_APP_ID && installId() && (process.env.GITHUB_APP_PRIVATE_KEY || process.env.GITHUB_APP_PRIVATE_KEY_PATH));
export const githubConfigured = () => appConfigured() || !!process.env.GITHUB_TOKEN;
const b64 = (v: string | Buffer) => Buffer.from(v).toString('base64url');
function appJwt() {
  const key = appKey();
  if (!key) throw new GithubError('GitHub is not connected: the App private key is missing.', 503);
  const now = Math.floor(Date.now() / 1000);
  const head = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = b64(JSON.stringify({ iat: now - 30, exp: now + 540, iss: process.env.GITHUB_APP_ID }));
  const sig = createSign('RSA-SHA256').update(head + '.' + body).sign(key);
  return head + '.' + body + '.' + b64(sig);
}
let cached: { token: string; until: number } | null = null;
async function bearer(): Promise<string> {
  if (!appConfigured()) {
    if (!process.env.GITHUB_TOKEN) throw new GithubError('GitHub is not connected: set up the GitHub App or GITHUB_TOKEN in the server settings.', 503);
    return process.env.GITHUB_TOKEN;
  }
  if (cached && cached.until > Date.now() + 60_000) return cached.token;
  const res = await fetch(API + `/app/installations/${installId()}/access_tokens`, {
    method: 'POST', headers: { authorization: `Bearer ${appJwt()}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'cms-console' },
  }).catch(() => { throw new GithubError('Could not reach GitHub.'); });
  if (!res.ok) throw new GithubError(res.status === 401 ? 'GitHub did not accept the App credentials (check the App ID and private key).' : res.status === 404 ? 'The GitHub App installation was not found (check the installation id).' : `GitHub answered ${res.status}.`);
  const j = await res.json() as { token: string; expires_at: string };
  cached = { token: j.token, until: Date.parse(j.expires_at) };
  return j.token;
}
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
  const token = await bearer();
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
const repoInfo = (r: any): RepoInfo => ({ owner: r.owner.login, name: r.name, fullName: r.full_name, private: !!r.private, defaultBranch: r.default_branch, description: r.description ?? null, pushedAt: r.pushed_at ?? null, canPush: appConfigured() || !!r.permissions?.push });

export async function whoami() {
  if (appConfigured()) {
    const res = await fetch(API + `/app/installations/${installId()}`, { headers: { authorization: `Bearer ${appJwt()}`, accept: 'application/vnd.github+json', 'user-agent': 'cms-console' } }).catch(() => { throw new GithubError('Could not reach GitHub.'); });
    if (!res.ok) throw new GithubError('GitHub did not accept the App credentials.');
    await bearer();
    return { login: ((await res.json()) as any).account?.login as string };
  }
  const u = await gh<any>('/user');
  return { login: u.login as string };
}
export async function listRepos(): Promise<RepoInfo[]> {
  const rs = appConfigured()
    ? (await gh<{ repositories: any[] }>('/installation/repositories?per_page=100')).repositories
    : await gh<any[]>('/user/repos?per_page=100&sort=pushed&affiliation=owner,organization_member,collaborator');
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
