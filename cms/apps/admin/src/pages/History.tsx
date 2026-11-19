import { useCallback, useEffect, useState } from 'react';
import { restoreVersion, versionWhen } from '../lib/versions';
import { api, type Entry, type Site } from '../api';

interface Change { kind: string; where: string; field?: string; from?: string; to?: string }
interface Version {
  id: string; action: string; summary: string; status: string; actorName: string; source: string; createdAt: string; title: string;
  changes: Change[]; changeCount: number;
}
const SHOWN = 3; // changes listed before "Show more"
const LABEL: Record<string, string> = { created: 'Created', edited: 'Edited', published: 'Published', unpublished: 'Unpublished', deleted: 'Deleted', restored: 'Restored' };

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
/** "Today", "Yesterday", or the date */
const dayLabel = (iso: string) => {
  const diff = Math.round((startOfDay(new Date()) - startOfDay(new Date(iso))) / 86_400_000);
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};
const clock = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

function ChangeItem({ c }: { c: Change }) {
  if (c.kind === 'add' || c.kind === 'remove') {
    return <li className="vh-ch"><span className="vh-name">{c.kind === 'add' ? 'Added' : 'Removed'} {c.where}</span></li>;
  }
  const show = (v?: string) => (v ? v : <em>empty</em>);
  const both = (c.from ?? '') + (c.to ?? '');
  const short = (c.from ?? '').length <= 40 && (c.to ?? '').length <= 40 && !both.includes('\n');
  return (
    <li className="vh-ch">
      <span className="vh-name">{c.field ?? c.where}{c.field && <span className="vh-where"> in {c.where}</span>}</span>
      {short
        ? <span className="vh-diff"><del>{show(c.from)}</del><span aria-hidden> → </span><ins>{show(c.to)}</ins></span>
        : <span className="vh-diff stack"><del>{show(c.from)}</del><ins>{show(c.to)}</ins></span>}
    </li>
  );
}

/** One line that says what a version changed, for example "Changed order and parent". */
function summaryOf(v: Version): string {
  if (!v.changes.length) return v.summary || (v.action === 'created' ? 'First version' : 'Saved with no field changes');
  const names = [...new Set(v.changes.map((c) => c.field ?? c.where))];
  const list = names.length <= 3 ? names.join(', ') : names.slice(0, 3).join(', ') + ` and ${names.length - 3} more`;
  return `Changed ${list}`;
}

/** Version history of one document, in a panel on the right: who changed it, when, what changed, and a way to go back. */
export function History({ site, entryId, name, canEdit, onClose, onRestored }: {
  site: Site; entryId: string; name: string; canEdit: boolean; onClose: () => void; onRestored: (e: Entry) => void;
}) {
  const [rows, setRows] = useState<Version[] | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [more, setMore] = useState<Record<string, boolean>>({});
  const base = `/sites/${site.id}/entries/${entryId}/versions`;

  const load = useCallback(() => api<Version[]>(base).then(setRows).catch((e) => setErr((e as Error).message)), [base]);
  useEffect(() => { setRows(null); setErr(''); setMore({}); load(); }, [load]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('.dialog.confirm')) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function restore(v: Version) {
    setErr('');
    try {
      const e = await restoreVersion(site.id, entryId, v.id, v.createdAt, v.actorName);
      if (!e) return; // they said no
      setBusy(v.id);
      onRestored(e);
      await load();
    } catch (x) { setErr((x as Error).message); }
    setBusy('');
  }

  // newest first, grouped by day
  const groups: { label: string; items: { v: Version; first: boolean }[] }[] = [];
  rows?.forEach((v, i) => {
    const label = dayLabel(v.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push({ v, first: i === 0 });
    else groups.push({ label, items: [{ v, first: i === 0 }] });
  });

  return (
    <aside className="versions-panel vh" aria-label="Version history">
      <header className="vh-head">
        <div className="vh-title"><h2>Version history</h2><p>{name}</p></div>
        <button className="vp-close" onClick={onClose} aria-label="Close version history">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </header>
      <p className="vh-sub">Every save is kept. The latest 60 are listed.</p>
      {err && <p className="err vp-err">{err}</p>}

      <div className="vh-scroll">
        {!rows && <p className="muted vh-empty">Loading…</p>}
        {rows && !rows.length && <p className="muted vh-empty">No history yet. It starts with the next save.</p>}
        {groups.map((g) => (
          <section key={g.label}>
            <h3 className="vh-day">{g.label}</h3>
            <ol className="vh-list">
              {g.items.map(({ v, first }) => {
                const open = !!more[v.id];
                return (
                  <li key={v.id} className={`vh-row${first ? ' current' : ''}`}>
                    <div className="vh-top">
                      <span className="vh-who">{v.actorName}{v.source === 'ai' && <span className="vh-ai"> (AI)</span>}</span>
                      <time title={versionWhen(v.createdAt)}>{clock(v.createdAt)}</time>
                    </div>
                    <div className="vh-meta">{LABEL[v.action] ?? v.action}{(LABEL[v.action] ?? v.action) !== (v.status === 'PUBLISHED' ? 'Published' : 'Draft') && <> · {v.status === 'PUBLISHED' ? 'Published' : 'Draft'}</>}{first && <> · <b>Current</b></>}</div>
                    {v.changes.length > 0 ? (
                      <>
                        <ul className="vh-changes">{(open ? v.changes : v.changes.slice(0, SHOWN)).map((c, k) => <ChangeItem key={k} c={c} />)}</ul>
                        {open && v.changeCount > v.changes.length && <p className="vh-more">and {v.changeCount - v.changes.length} more</p>}
                      </>
                    ) : (
                      <p className="vh-sum">{summaryOf(v)}</p>
                    )}
                    {(v.changes.length > SHOWN || (!first && canEdit)) && (
                      <div className="vh-actions">
                        {v.changes.length > SHOWN && <button type="button" className="vh-link" aria-expanded={open} onClick={() => setMore((m) => ({ ...m, [v.id]: !m[v.id] }))}>{open ? 'Show fewer' : `Show ${v.changes.length - SHOWN} more change${v.changes.length - SHOWN === 1 ? '' : 's'}`}</button>}
                        {!first && canEdit && <button type="button" className="vh-link" disabled={!!busy} onClick={() => restore(v)}>{busy === v.id ? 'Restoring…' : 'Restore this version'}</button>}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </aside>
  );
}
