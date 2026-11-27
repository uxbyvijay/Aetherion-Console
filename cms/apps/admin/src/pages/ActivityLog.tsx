import { useEffect, useState } from 'react';
import { api, type Site } from '../api';

interface Row { id: string; siteId: string | null; siteName: string | null; actorName: string; action: string; detail: string; createdAt: string }

const LABEL: Record<string, string> = {
  'github.connect': 'Linked a repository',
  'github.disconnect': 'Unlinked a repository',
  'publish.blocked': 'Final Push blocked',
  'publish.pull-request': 'Opened a pull request',
};

/** What admins did in the console: repository links, blocked pushes and pull requests, across every website. Admins only. */
export function ActivityLog({ sites }: { sites: Site[] }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [siteId, setSiteId] = useState('');
  const [err, setErr] = useState('');

  const load = () => {
    setErr('');
    api<Row[]>(`/audit${siteId ? `?siteId=${encodeURIComponent(siteId)}` : ''}`).then(setRows).catch((x) => { setErr((x as Error).message); setRows([]); });
  };
  useEffect(load, [siteId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="set-block">
      <header className="has-action">
        <div><h3>Activity log</h3><p className="muted">Who linked a repository, which pushes were blocked and why, and which pull requests were opened. Nothing secret is ever written here.</p></div>
      </header>
      <div className="log-bar">
        <label>Website
          <select value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            <option value="">All websites</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.domains[0] ?? s.name}</option>)}
          </select>
        </label>
        <button type="button" onClick={load}>Refresh</button>
      </div>
      {err && <p className="err">{err}</p>}
      {!rows && <p className="muted">Loading…</p>}
      {rows && !rows.length && !err && <p className="muted">Nothing yet. Linking a repository or pushing changes will show up here.</p>}
      {rows && rows.length > 0 && (
        <div className="dt-wrap">
          <table className="data-table">
            <thead><tr><th>When</th><th>Who</th><th>Website</th><th>What</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.createdAt).toLocaleString()}</td>
                  <td>{r.actorName}</td>
                  <td>{r.siteName ?? '—'}</td>
                  <td><b>{LABEL[r.action] ?? r.action}</b>{r.detail && <span className="muted"> {r.detail}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
