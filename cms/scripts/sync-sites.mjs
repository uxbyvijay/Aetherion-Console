#!/usr/bin/env node
/**
 * Brings the site previews in cms/apps up to date with the real site repositories.
 *
 *   npm run sync:sites                 show what would change (nothing is written)
 *   npm run sync:sites -- --apply      write the changes
 *   npm run sync:sites -- --site rtw   only one site (rtw, synx-tools, skalle, morph-space)
 *
 * Each preview is a copy of its repository, adapted to read its content from the CMS. A plain copy would wipe those adaptations, so:
 *  - changes since the last sync (the commit in apps/<site>/.repo-sync.json) are merged three ways into the preview's copy of each file;
 *  - new or changed files under public/ (pictures, icons) are copied as they are;
 *  - a file that cannot be merged cleanly, or has no copy in the preview (for example a Next.js page that the preview builds
 *    from CMS content), is listed with the commit that changed it, for a person to port. Nothing is half-written.
 * The repositories are only read: they are fetched from GitHub (Synx-Tools) into .sync-cache, so there is nothing to pull first.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const cms = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ORG = 'https://github.com/Synx-Tools';
const cache = join(cms, '.sync-cache'); // read-only copies of the four repositories, fetched from GitHub (not your own clones)
const SITES = {
  rtw: { repo: 'therealwebpoc', app: 'apps/realtimeweb.org' },
  'synx-tools': { repo: 'Synx', app: 'apps/synx.tools' },
  skalle: { repo: 'skalleaiLP', app: 'apps/skalle.ai' },
  'morph-space': { repo: 'morph-space', app: 'apps/morph.space' },
};
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const only = args.includes('--site') ? args[args.indexOf('--site') + 1] : null;

const git = (repo, ...a) => execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
const gitBuf = (repo, ...a) => execFileSync('git', ['-C', repo, ...a], { maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
const IGNORE = /(^|\/)(node_modules|\.git|\.next|dist|\.vite)(\/|$)/;
const SKIP = /(^|\/)(package(-lock)?\.json|tsconfig[^/]*\.json|vite\.config\.[a-z]+|next\.config\.[a-z]+|next-env\.d\.ts|\.gitignore|\.env[^/]*|AGENTS\.md|CLAUDE\.md|README\.md|index\.html)$/i;
const isText = (b) => !b.includes(0);
const toLF = (s) => s.replace(/\r\n/g, '\n');

function walk(dir, base = dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    const rel = relative(base, p).split(sep).join('/');
    if (IGNORE.test(rel)) continue;
    if (e.isDirectory()) walk(p, base, out); else out.push(rel);
  }
  return out;
}

/** Which file of the preview holds the copy of a repository file? Same path, or the same name in a similar place. */
function counterpart(repoFile, appFiles) {
  const strip = (f) => f.replace(/^(src|app)\//, '').replace(/(^|\/)lab\//, '$1');
  const exact = appFiles.find((f) => f === repoFile);
  if (exact) return exact;
  const key = strip(repoFile);
  const same = appFiles.filter((f) => strip(f) === key || strip(f) === 'components/' + key || 'components/' + strip(f) === key);
  if (same.length === 1) return same[0];
  const sameName = appFiles.filter((f) => basename(f) === basename(repoFile) && !/\.(png|jpe?g|webp|svg|gif|ico|mp4|webm|woff2?)$/i.test(f));
  return sameName.length === 1 ? sameName[0] : null;
}

const report = [];
for (const [name, cfg] of Object.entries(SITES)) {
  if (only && only !== name) continue;
  const repo = join(cache, cfg.repo + '.git');
  try {
    if (!existsSync(repo)) { mkdirSync(cache, { recursive: true }); execFileSync('git', ['clone', '--bare', '--quiet', `${ORG}/${cfg.repo}.git`, repo], { stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } }); }
    else execFileSync('git', ['-C', repo, 'fetch', '--quiet', '--prune', 'origin', '+refs/heads/*:refs/heads/*'], { stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
  } catch (e) { report.push(`${name}: could not reach ${ORG}/${cfg.repo} on GitHub (${String(e.stderr || e.message).trim().split(/\r?\n/)[0]})`); continue; }
  const app = join(cms, cfg.app);
  const manifest = join(app, '.repo-sync.json');
  if (!existsSync(join(repo, 'HEAD'))) { report.push(`${name}: repository not found at ${repo}`); continue; }
  const head = git(repo, 'rev-parse', 'HEAD').trim();
  let base = existsSync(manifest) ? JSON.parse(readFileSync(manifest, 'utf8')).commit : null;
  let guessed = false;
  if (!base) {
    // never synced: assume the preview was made from the last commit before the preview's own first commit
    const first = execFileSync('git', ['-C', cms, 'log', '--diff-filter=A', '--format=%aI', '--', join(cfg.app, 'package.json')], { encoding: 'utf8' }).trim().split('\n').pop();
    base = first ? git(repo, 'rev-list', '-1', `--before=${first}`, 'HEAD').trim() : '';
    guessed = true;
  }
  if (!base) { report.push(`${name}: could not work out which repository commit the preview was made from. Create ${relative(cms, manifest)} with {"commit": "<sha>"}.`); continue; }
  if (base === head) { console.log(`${name}: up to date (${head.slice(0, 7)})`); continue; }

  const lines = git(repo, 'diff', '--name-status', '--no-renames', base, head).trim().split('\n').filter(Boolean).map((l) => { const [s, ...f] = l.split('\t'); return { s: s[0], f: f.join('\t') }; });
  const appFiles = walk(app);
  const whyLast = (f) => git(repo, 'log', '-1', '--format=%h %s', `${base}..${head}`, '--', f).trim();
  const writes = []; // { path, data }
  const ok = [], review = [];

  for (const { s, f } of lines) {
    if (IGNORE.test(f) || SKIP.test(f)) continue;
    if (s === 'D') { if (/^public\//.test(f)) review.push(`${f}: removed in the repository (${whyLast(f)}); delete it from ${cfg.app}/public if it is no longer used`); continue; }
    const theirs = gitBuf(repo, 'show', `${head}:${f}`);
    // pictures, icons, fonts: copied as they are
    if (/^public\//.test(f)) {
      const dest = join(app, f);
      if (!existsSync(dest) || !gitBuf(repo, 'show', `${head}:${f}`).equals(readFileSync(dest))) { writes.push({ path: dest, data: theirs }); ok.push(`${f} (copied)`); }
      continue;
    }
    const c = counterpart(f, appFiles);
    if (!c) { if (/\.(tsx?|css|mdx?|json)$/.test(f)) review.push(`${f}: no copy in the preview, port it by hand (${whyLast(f)})`); continue; }
    const ours = readFileSync(join(app, c));
    if (!isText(theirs) || !isText(ours)) { writes.push({ path: join(app, c), data: theirs }); ok.push(`${c} (copied)`); continue; }
    let baseText = '';
    if (s !== 'A') { try { baseText = toLF(gitBuf(repo, 'show', `${base}:${f}`).toString('utf8')); } catch { baseText = ''; } }
    const eol = ours.toString('utf8').includes('\r\n') ? '\r\n' : '\n';
    const dir = mkdtempSync(join(tmpdir(), 'sync-'));
    try {
      writeFileSync(join(dir, 'ours'), toLF(ours.toString('utf8')));
      writeFileSync(join(dir, 'base'), baseText);
      writeFileSync(join(dir, 'theirs'), toLF(theirs.toString('utf8')));
      const r = spawnSync('git', ['merge-file', '-p', join(dir, 'ours'), join(dir, 'base'), join(dir, 'theirs')], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
      const before = toLF(ours.toString('utf8'));
      if (r.status === 0) {
        if (r.stdout !== before) { writes.push({ path: join(app, c), data: Buffer.from(eol === '\r\n' ? r.stdout.replace(/\n/g, '\r\n') : r.stdout, 'utf8') }); ok.push(`${c} (merged)`); }
      } else {
        review.push(`${c}: changed in the repository and in the preview, they overlap (${whyLast(f)})`);
      }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }

  console.log(`\n${name}: ${base.slice(0, 7)}${guessed ? ' (assumed)' : ''} -> ${head.slice(0, 7)}  ${cfg.repo}`);
  for (const o of ok) console.log(`  ${apply ? 'updated' : 'would update'}: ${o}`);
  for (const r of review) console.log(`  REVIEW: ${r}`);
  if (!ok.length && !review.length) console.log('  nothing to bring over');
  if (apply) {
    for (const w of writes) { mkdirSync(dirname(w.path), { recursive: true }); writeFileSync(w.path, w.data); }
    // the files that still need a person are not hidden by moving the marker: keep it at the old commit when any are left
    if (!review.length) writeFileSync(manifest, JSON.stringify({ repo: cfg.repo, commit: head, syncedAt: new Date().toISOString() }, null, 2) + '\n');
    else console.log(`  marker kept at ${base.slice(0, 7)} until the REVIEW items are handled (then run again, or set the commit in ${relative(cms, manifest)})`);
  }
}
for (const r of report) console.log(r);
if (!apply) console.log('\nNothing was written. Run with --apply to write these changes.');
