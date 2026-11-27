import { useEffect, useState } from 'react';
import { api, type Site } from '../api';
import { ask } from '../lib/confirm';

interface Change { path: string; status: 'added' | 'modified' | 'deleted'; before: string | null; after: string | null }
interface Check { id: string; label: string; ok: boolean; blocking: boolean; detail?: string }
interface Review { owner: string; repo: string; baseBranch: string; contentDir: string; changes: Change[]; checks: Check[] }
interface PrRec { id: string; title: string; url: string; number: number; branch: string; createdBy: string; createdAt: string; state: string | null; files: { path: string; status: string }[] }

const STATE: Record<string, string> = { pending: 'Pending review', approved: 'Approved', changes_requested: 'Changes requested', merged: 'Merged', closed: 'Closed' };

/** Review what changed since the repository's last version, then send the approved files as a pull request. Merging stays on GitHub. */
export function PublishPanel({ site }: { site: Site }) {
  const [review, setReview] = useState<Review | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<PrRec[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [failed, setFailed] = useState<Check[] | null>(null);
  const [done, setDone] = useState<{ url: string; number: number } | null>(null);

  const load = async () => {
    setBusy(true); setErr(''); setFailed(null);
    try {
      const r = await api<Review>(`/sites/${site.id}/publish/changes`);
      setReview(r);
      setPicked(new Set(r.changes.filter((c) => c.status !== 'deleted').map((c) => c.path)));
    } catch (x) { setErr((x as Error).message); setReview(null); }
    try { setHistory(await api<PrRec[]>(`/sites/${site.id}/publish/history`)); } catch { /* shown without history */ }
    setBusy(false);
  };
  useEffect(() => { setDone(null); setNote(''); load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [site.id]);

  // While a pull request is open, check its status again when the person returns to this tab and every minute, so a merge on GitHub shows up without a reload.
  const hasOpen = history.some((h) => h.state === 'pending' || h.state === 'approved' || h.state === 'changes_requested');
  useEffect(() => {
    if (!hasOpen) return;
    const refresh = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const h = await api<PrRec[]>(`/sites/${site.id}/publish/history`);
        setHistory(h);
        if (!h.some((x) => x.state === 'pending' || x.state === 'approved' || x.state === 'changes_requested')) load(); // it was merged or closed: the list of changes is different now
      } catch { /* keep what is shown */ }
    };
    const t = setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(t); window.removeEventListener('focus', refresh); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasOpen, site.id]);

  const toggle = (p: string) => setPicked((s) => { const n = new Set(s); if (n.has(p)) n.delete(p); else n.add(p); return n; });
  const sel = review?.changes.filter((c) => picked.has(c.path)) ?? [];
  const count = (s: string) => sel.filter((c) => c.status === s).length;
  const open = history.find((h) => h.state === 'pending' || h.state === 'approved' || h.state === 'changes_requested');

  const push = async () => {
    if (!review || !sel.length) return;
    const ok = await ask({
      title: 'Send these changes as a pull request?',
      message: `Repository: ${review.owner}/${review.repo}\nBase branch: ${review.baseBranch}\nFiles: ${count('added')} added, ${count('modified')} changed, ${count('deleted')} removed\n\nA new branch and a pull request are made. Nothing goes live: a person must review and merge it on GitHub.`,
      confirmLabel: 'Final Push',
    });
    if (!ok) return;
    setBusy(true); setErr(''); setFailed(null);
    try {
      const r = await api<{ url: string; number: number }>(`/sites/${site.id}/publish`, { method: 'POST', body: { owner: review.owner, repo: review.repo, baseBranch: review.baseBranch, paths: sel.map((c) => c.path), note: note.trim() || undefined } });
      setDone(r); setNote('');
      await load();
    } catch (x) {
      setErr((x as Error).message);
      try { const res = (x as Error & { checks?: Check[] }).checks; if (res) setFailed(res); } catch { /* none */ }
    }
    setBusy(false);
  };

  return (
    <div className="pub-box">
      {err && <p className="error">{err}</p>}
      {done && <p className="pub-done">Pull request #{done.number} is open: <a href={done.url} target="_blank" rel="noreferrer">{done.url}</a>. A person now reviews and merges it on GitHub.</p>}

      {history.length > 0 && (
        <div className="pub-history">
          <h4>Pull requests</h4>
          <ul>
            {history.map((h) => (
              <li key={h.id}>
                <span className={`pub-state ${h.state ?? 'unknown'}`}>{h.state ? STATE[h.state] : 'Status unavailable'}</span>
                <a href={h.url} target="_blank" rel="noreferrer">#{h.number} {h.title}</a>
                <span className="muted"> {h.files.length} file{h.files.length === 1 ? '' : 's'}, {h.createdBy}, {new Date(h.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}


      {!review && busy && <p className="muted">Comparing with {site.name}'s repository…</p>}
      {review && (
        <>
          <p className="muted">Compared with <b>{review.owner}/{review.repo}</b> ({review.baseBranch}). Only files inside <code>{review.contentDir}/aetherion/</code> are ever written. Drafts are not included.</p>
          {review.changes.length === 0
            ? <p><b>Nothing to send.</b> The repository already has everything that is published here.</p>
            : (
              <>
                <div className="pub-bar">
                  <span>{sel.length} of {review.changes.length} selected: {count('added')} added, {count('modified')} changed, {count('deleted')} removed</span>
                  <button type="button" className="link" onClick={() => setPicked(new Set(review.changes.map((c) => c.path)))}>All</button>
                  <button type="button" className="link" onClick={() => setPicked(new Set())}>None</button>
                </div>
                <details className="more pub-changes" open={!open} key={open ? 'open-pr' : 'no-pr'}>
                  <summary>{open ? `${review.changes.length} change${review.changes.length === 1 ? '' : 's'} not in the repository yet` : 'Review the files'}</summary>
                <ul className="pub-list">
                  {review.changes.map((c) => (
                    <li key={c.path}>
                      <label><input type="checkbox" checked={picked.has(c.path)} onChange={() => toggle(c.path)} /> <span className={`pub-tag ${c.status}`}>{c.status === 'added' ? 'New' : c.status === 'modified' ? 'Changed' : 'Removed'}</span> <code>{c.path}</code></label>
                      <details className="more">
                        <summary>Show {c.status === 'modified' ? 'before and after' : c.status === 'added' ? 'content' : 'removed content'}</summary>
                        <div className={c.status === 'modified' ? 'pub-diff two' : 'pub-diff'}>
                          {c.before !== null && <pre>{c.before}</pre>}
                          {c.after !== null && <pre>{c.after}</pre>}
                        </div>
                      </details>
                    </li>
                  ))}
                </ul>
                {review.changes.some((c) => c.status === 'deleted') && <p className="muted">Removed files are not selected by default: pick them only if you want them deleted from the repository.</p>}
                <ul className="pub-checks">
                  {(failed ?? review.checks).map((c) => <li key={c.id} className={c.ok ? 'ok' : c.blocking ? 'bad' : 'info'}><b>{c.ok ? 'Passed' : c.blocking ? 'Failed' : 'Note'}:</b> {c.label}{c.detail && <span className="muted"> {c.detail}</span>}</li>)}
                </ul>
                </details>
                {!open && <label>What is this update for? (optional, shown in the pull request) <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="e.g. New pricing page copy" /></label>}
                {open && <p className="muted">Pull request <a href={open.url} target="_blank" rel="noreferrer">#{open.number}</a> is still open. Merge or close it on GitHub, then press Refresh to push again.</p>}
                <div className="row-actions">
                  <button className="primary" disabled={busy || !sel.length || !!open} onClick={push}>Final Push</button>
                  <button disabled={busy} onClick={load}>Refresh</button>
                </div>
              </>
            )}
          {review.changes.length === 0 && <div className="row-actions"><button disabled={busy} onClick={load}>Refresh</button></div>}
        </>
      )}
    </div>
  );
}
