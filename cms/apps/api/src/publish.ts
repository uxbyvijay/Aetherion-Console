import { prisma } from './db.js';
import { readTree } from './github.js';

/**
 * Publishing a website's content to GitHub.
 *
 * Content lives in the database. To propose it to the repository the console writes it as plain JSON files inside ONE folder:
 *   <content folder>/aetherion/<content type>/<entry>.json, and <content folder>/aetherion/_schema.json
 * Only that folder is ever written, so nothing else in the repository (code, packages, build files) can change.
 * "What changed" is found by comparing these files with what is on the base branch right now, so every difference is
 * tracked, with the exact files and their before and after text. Only published entries are exported, drafts stay private.
 */
export const EXPORT_DIR = 'aetherion';

export interface Change { path: string; status: 'added' | 'modified' | 'deleted'; before: string | null; after: string | null }
export interface Check { id: string; label: string; ok: boolean; /** true = a Final Push cannot go ahead while this fails */ blocking: boolean; detail?: string }

/** JSON with sorted keys, so the same content always gives the same text and unchanged content never shows up as a change. */
function stable(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, x]) => [k, stable(x)]));
  return v;
}
const text = (v: unknown) => JSON.stringify(stable(v), null, 2) + '\n';
const safe = (s: string) => s.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[.-]+/, '').slice(0, 100) || 'untitled';

export const exportPrefix = (contentDir: string) => `${contentDir.replace(/\/+$/, '')}/${EXPORT_DIR}`;

/** The files the console would write for a website right now. */
export async function buildExport(siteId: string, contentDir: string): Promise<Map<string, string>> {
  const root = exportPrefix(contentDir);
  const types = await prisma.contentType.findMany({ where: { siteId }, orderBy: { slug: 'asc' } });
  const out = new Map<string, string>();
  out.set(`${root}/_schema.json`, text(types.map((t) => ({ name: t.name, slug: t.slug, kind: t.kind, fields: t.fields }))));
  const entries = await prisma.entry.findMany({ where: { siteId, status: 'PUBLISHED' }, include: { contentType: true }, orderBy: { createdAt: 'asc' } });
  for (const e of entries) {
    let path = `${root}/${safe(e.contentType.slug)}/${safe(e.slug ?? e.id)}.json`;
    if (out.has(path)) path = `${root}/${safe(e.contentType.slug)}/${safe(e.slug ?? e.id)}-${e.id.slice(-6)}.json`;
    out.set(path, text({ type: e.contentType.slug, slug: e.slug, publishedAt: e.publishedAt, data: e.data }));
  }
  return out;
}

/** Every difference between what the console would write and what is on the base branch. */
export async function computeChanges(siteId: string, link: { owner: string; repo: string; baseBranch: string; contentDir: string }): Promise<Change[]> {
  const mine = await buildExport(siteId, link.contentDir);
  const theirs = await readTree(link.owner, link.repo, link.baseBranch, exportPrefix(link.contentDir));
  const changes: Change[] = [];
  for (const [path, after] of mine) {
    const before = theirs.get(path) ?? null;
    if (before === null) changes.push({ path, status: 'added', before: null, after });
    else if (before !== after) changes.push({ path, status: 'modified', before, after });
  }
  for (const [path, before] of theirs) if (!mine.has(path)) changes.push({ path, status: 'deleted', before, after: null });
  return changes.sort((a, b) => (a.path < b.path ? -1 : 1));
}

// Things that must never be in a pull request from here.
const SECRETS: [string, RegExp][] = [
  ['a private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['a GitHub token', /\b(ghp|gho|ghs|ghu|github_pat)_[A-Za-z0-9_]{20,}/],
  ['a Groq or OpenAI-style key', /\b(gsk|sk)[-_][A-Za-z0-9_-]{20,}/],
  ['an AWS key', /\bAKIA[0-9A-Z]{16}\b/],
  ['an MCP or CMS key', /\b(synxmcp|cms)_[A-Za-z0-9_-]{20,}/],
  ['a Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ['a password or secret assignment', /\b(password|passwd|secret|api[_-]?key|access[_-]?token)\b["']?\s*[:=]\s*["'][^"'\s]{8,}["']/i],
];
// Files that are never content: a change to one needs a person to look at it first.
const SENSITIVE = /(^|\/)(\.env[^/]*|package(-lock)?\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|dockerfile|docker-compose[^/]*|vercel\.json|next\.config\.[a-z]+|vite\.config\.[a-z]+|tsconfig[^/]*\.json|\.npmrc|[^/]+\.(pem|key|p12|pfx))$|(^|\/)\.(github|git|cursor|claude)\//i;

/** Checks run before any branch is made. A blocking failure stops the push; the admin sees the exact reason. */
export function validate(link: { owner: string; repo: string; baseBranch: string; contentDir: string }, picked: Change[]): Check[] {
  const root = exportPrefix(link.contentDir) + '/';
  const checks: Check[] = [];
  checks.push({ id: 'target', label: `Target is ${link.owner}/${link.repo}, branch ${link.baseBranch}`, ok: true, blocking: true });

  const outside = picked.filter((c) => !c.path.startsWith(root) || c.path.split('/').some((s) => s === '..' || s === '.' || s === '' || s.toLowerCase() === '.git'));
  checks.push({ id: 'scope', label: `Every file is inside ${root}`, ok: !outside.length, blocking: true, detail: outside.length ? `Outside the approved folder: ${outside.map((c) => c.path).join(', ')}` : undefined });

  const sensitive = picked.filter((c) => SENSITIVE.test(c.path));
  checks.push({ id: 'sensitive', label: 'No package, lock, build or secret files are touched', ok: !sensitive.length, blocking: true, detail: sensitive.length ? `These need a person to review them directly in the repository: ${sensitive.map((c) => c.path).join(', ')}` : undefined });

  const badJson = picked.filter((c) => c.after !== null && c.path.endsWith('.json') && (() => { try { JSON.parse(c.after!); return false; } catch { return true; } })());
  checks.push({ id: 'json', label: 'All files are valid JSON', ok: !badJson.length, blocking: true, detail: badJson.length ? badJson.map((c) => c.path).join(', ') : undefined });

  const leaks: string[] = [];
  for (const c of picked) if (c.after) for (const [what, re] of SECRETS) if (re.test(c.after)) leaks.push(`${c.path}: looks like ${what}`);
  checks.push({ id: 'secrets', label: 'No keys, tokens or passwords in the files', ok: !leaks.length, blocking: true, detail: leaks.length ? leaks.join('; ') : undefined });

  const big = picked.filter((c) => (c.after?.length ?? 0) > 500_000);
  const total = picked.reduce((n, c) => n + (c.after?.length ?? 0), 0);
  checks.push({ id: 'size', label: 'Size is reasonable (200 files, 500 KB each, 5 MB in all)', ok: !big.length && picked.length <= 200 && total <= 5_000_000, blocking: true, detail: big.length ? `Too large: ${big.map((c) => c.path).join(', ')}` : picked.length > 200 ? `${picked.length} files is more than 200` : total > 5_000_000 ? 'More than 5 MB in total' : undefined });

  checks.push({ id: 'build', label: 'Lint, type check and build', ok: true, blocking: false, detail: 'Not run here: the pull request only adds data files (JSON) and no code, so the repository\'s own checks run on the pull request on GitHub before anyone merges it.' });
  return checks;
}
