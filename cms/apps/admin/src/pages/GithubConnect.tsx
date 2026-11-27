import { useEffect, useState } from 'react';
import { api, type Site } from '../api';
import { ask } from '../lib/confirm';
import { PublishPanel } from './PublishPanel';

interface Status { configured: boolean; login?: string | null; error?: string }
interface Repo { owner: string; name: string; fullName: string; private: boolean; defaultBranch: string; canPush: boolean }
interface Link { owner: string; repo: string; baseBranch: string; contentDir: string; connectedBy: string }
interface Branch { name: string; protected: boolean }
interface Audit { id: string; actorName: string; action: string; detail: string; createdAt: string }

/** Connects one website to one GitHub repository. The access token stays on the server; this page never sees it. */
export function GithubConnect({ site }: { site: Site }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [link, setLink] = useState<Link | null | undefined>(undefined);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [files, setFiles] = useState<string[] | null>(null);
  const [log, setLog] = useState<Audit[]>([]);
  const [repo, setRepo] = useState('');
  const [branch, setBranch] = useState('main');
  const [dir, setDir] = useState('content');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = async () => {
    setErr('');
    try {
      const st = await api<Status>('/github/status');
      setStatus(st);
      const l = await api<Link | null>(`/sites/${site.id}/github`);
      setLink(l);
      if (l) { setRepo(`${l.owner}/${l.repo}`); setBranch(l.baseBranch); setDir(l.contentDir); }
      if (st.configured && st.login) setRepos(await api<Repo[]>('/github/repos'));
      setLog(await api<Audit[]>(`/sites/${site.id}/audit`));
    } catch (x) { setErr((x as Error).message); }
  };
  useEffect(() => { setLink(undefined); setEditing(false); setFiles(null); load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [site.id]);

  // the branches of the repository picked in the form
  useEffect(() => {
    const r = repos.find((x) => x.fullName === repo);
    if (!r || !editing) return;
    let stale = false;
    setBranches([{ name: r.defaultBranch, protected: false }]);
    const same = !!link && `${link.owner}/${link.repo}` === r.fullName;
    setBranch(same ? link!.baseBranch : r.defaultBranch);
    api<Branch[]>(`/github/repos/${r.owner}/${r.name}/branches`)
      .then((bs) => { if (!stale && bs.length) setBranches(bs); })
      .catch((x) => { if (!stale) setErr((x as Error).message); });
    return () => { stale = true; };
  }, [repo, repos, editing, link]);

  const act = async (fn: () => Promise<unknown>) => { setBusy(true); setErr(''); try { await fn(); } catch (x) { setErr((x as Error).message); } setBusy(false); };

  if (!status || link === undefined) return <p className="muted">{err || 'Loading…'}</p>;
  if (!status.configured) {
    return (
      <div className="gh-box">
        <p><b>GitHub is not connected to this server yet.</b></p>
        <p className="muted">Add a GitHub access token to the server settings (<code>GITHUB_TOKEN</code> in <code>apps/api/.env</code>), then restart the API. The token stays on the server and is never shown here. Use a token that can read and write repository contents and pull requests, and nothing else.</p>
      </div>
    );
  }
  if (!status.login) return <p className="error">{status.error ?? 'GitHub did not accept the token.'}</p>;

  const picked = repos.find((r) => r.fullName === repo);
  const showForm = !link || editing;
  return (
    <div className="gh-box">
      {err && <p className="error">{err}</p>}
      <p className="muted">Signed in to GitHub as <b>{status.login}</b>. Nothing is ever merged from here: changes go to a pull request that a person reviews on GitHub.</p>

      {!showForm && link && (
        <>
          <dl className="gh-facts">
            <dt>Repository</dt><dd>{link.owner}/{link.repo}</dd>
            <dt>Base branch</dt><dd>{link.baseBranch}</dd>
            <dt>Content folder</dt><dd>{link.contentDir}/</dd>
            <dt>Connected by</dt><dd>{link.connectedBy}</dd>
          </dl>
          <div className="row-actions">
            <button onClick={() => act(async () => {
              const bs = await api<Branch[]>(`/sites/${site.id}/github/branches`);
              setBranches(bs);
              const fs = await api<{ name: string; type: string }[]>(`/sites/${site.id}/github/files`);
              setFiles(fs.map((f) => (f.type === 'dir' ? f.name + '/' : f.name)));
            })} disabled={busy}>Check the repository</button>
            <button onClick={() => setEditing(true)} disabled={busy}>Change</button>
            <button className="link delete-link always" disabled={busy} onClick={() => act(async () => {
              if (await ask({ title: 'Disconnect this repository?', message: 'The website stays as it is. It just stops being linked to GitHub.', confirmLabel: 'Disconnect' })) {
                await api(`/sites/${site.id}/github`, { method: 'DELETE' });
                setLink(null); setFiles(null); await load();
              }
            })}>Disconnect</button>
          </div>
          {branches.length > 0 && <p className="muted">{branches.length} branch{branches.length === 1 ? '' : 'es'}: {branches.map((b) => b.name + (b.protected ? ' (protected)' : '')).join(', ')}</p>}
          {files && <p className="muted">Top level: {files.join('  ') || 'empty'}</p>}
        </>
      )}

      {showForm && (
        <form className="gh-form" onSubmit={(e) => {
          e.preventDefault();
          act(async () => {
            const [owner, name] = repo.split('/');
            const l = await api<Link>(`/sites/${site.id}/github`, { method: 'PUT', body: { owner, repo: name, baseBranch: branch.trim(), contentDir: dir.trim() } });
            setLink(l); setEditing(false); await load();
          });
        }}>
          <label>Repository
            <select value={repo} onChange={(e) => setRepo(e.target.value)} required>
              <option value="">Choose a repository…</option>
              {repos.map((r) => <option key={r.fullName} value={r.fullName} disabled={!r.canPush}>{r.fullName}{r.private ? ' (private)' : ''}{r.canPush ? '' : ' – no write access'}</option>)}
            </select>
          </label>
          <label>Base branch
            <select value={branch} onChange={(e) => setBranch(e.target.value)} required>
              {!branches.some((b) => b.name === branch) && <option value={branch}>{branch}</option>}
              {branches.filter((b) => !b.name.startsWith('aetherion/')).map((b) => <option key={b.name} value={b.name}>{b.name}{b.name === picked?.defaultBranch ? ' (default)' : ''}{b.protected ? ' (protected)' : ''}</option>)}
            </select>
          </label>
          <label>Content folder <input value={dir} onChange={(e) => setDir(e.target.value)} placeholder="content" required /></label>
          <p className="muted">The console only ever writes inside this folder of the repository.</p>
          <div className="row-actions">
            <button className="primary" type="submit" disabled={busy || !repo}>{link ? 'Save' : 'Connect'}</button>
            {link && <button type="button" onClick={() => { setEditing(false); setRepo(`${link.owner}/${link.repo}`); setBranch(link.baseBranch); setDir(link.contentDir); }}>Cancel</button>}
          </div>
        </form>
      )}

      {link && !showForm && (
        <section className="pub-section">
          <h4>Changes and Final Push</h4>
          <PublishPanel site={site} />
        </section>
      )}

      {log.length > 0 && (
        <details className="more">
          <summary>Recent activity</summary>
          <ul className="gh-log">{log.map((a) => <li key={a.id}><b>{a.action}</b> {a.detail} <span className="muted">{a.actorName}, {new Date(a.createdAt).toLocaleString()}</span></li>)}</ul>
        </details>
      )}
    </div>
  );
}
