import { useEffect, useState } from 'react';
import { api, type Site } from '../api';
import type { LinkedinStatus } from './LinkedinSetup';

interface Draft { text: string; url: string; title: string; description: string; problems: string[]; postedUrl: string }
const MAX = 3000;

/**
 * Post an article to LinkedIn. The person sees and can change the exact text, and nothing leaves until they press the button.
 * `initialText` is a post the AI assistant wrote.
 */
export function LinkedinPost({ site, entryId, initialText, onClose, onPosted, openSettings }: {
  site: Site; entryId: string; initialText?: string; onClose: () => void; onPosted: (url: string) => void; openSettings: () => void;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [who, setWho] = useState('');
  const [text, setText] = useState(initialText ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    api<Draft>(`/sites/${site.id}/entries/${entryId}/linkedin/draft`, { body: {} })
      .then((d) => { setDraft(d); if (!initialText) setText(d.text); })
      .catch((x) => setErr((x as Error).message));
    api<LinkedinStatus>(`/sites/${site.id}/linkedin`).then((s) => setWho(s.name)).catch(() => {});
  }, [site.id, entryId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  async function post() {
    setBusy(true); setErr('');
    try {
      const r = await api<{ url: string }>(`/sites/${site.id}/entries/${entryId}/linkedin/post`, { body: { text: text.trim(), confirmed: true } });
      setDone(r.url || ' ');
      onPosted(r.url);
    } catch (x) { setErr((x as Error).message); }
    setBusy(false);
  }

  const problems = draft?.problems ?? [];
  const over = text.length > MAX;

  return (
    <div className="overlay" onClick={() => { if (!busy) onClose(); }}>
      <div className="dialog li-dialog" role="dialog" aria-label="Post to LinkedIn" onClick={(e) => e.stopPropagation()}>
        <header className="dialog-head">
          <h3>Post to LinkedIn</h3>
          <button className="link" onClick={onClose} aria-label="Close" disabled={busy}>✕</button>
        </header>

        {done !== null ? (
          <div className="li-body">
            <p className="li-note ok">Posted to LinkedIn.</p>
            {done.trim() && <p><a href={done} target="_blank" rel="noreferrer">View the post on LinkedIn</a></p>}
            <div className="li-actions"><button className="primary" onClick={onClose}>Done</button></div>
          </div>
        ) : !draft && !err ? (
          <div className="li-body"><p className="muted">Getting the post ready…</p></div>
        ) : (
          <div className="li-body">
            {problems.length > 0 && (
              <div className="li-problems" role="alert">
                <b>Not ready to post</b>
                <ul>{problems.map((p) => <li key={p}>{p}</li>)}</ul>
                {problems.some((p) => /Settings/.test(p)) && <button onClick={() => { onClose(); openSettings(); }}>Open LinkedIn settings</button>}
              </div>
            )}
            {draft && (
              <>
                {draft.postedUrl && <p className="li-note warn">This article was already posted: <a href={draft.postedUrl} target="_blank" rel="noreferrer">view that post</a>. Posting again makes a second post.</p>}
                <label className="lbl" htmlFor="li-text">Post text</label>
                <textarea id="li-text" rows={9} value={text} onChange={(e) => setText(e.target.value)} disabled={busy} />
                <p className={`li-count${over ? ' bad' : ''}`}>{text.length} / {MAX}</p>
                {draft.url && (
                  <div className="li-card" aria-label="The link LinkedIn will show under your text">
                    <b>{draft.title}</b>
                    <span className="muted">{draft.url}</span>
                  </div>
                )}
                <p className="muted li-foot">{who ? <>This is posted publicly on LinkedIn as <b>{who}</b>.</> : 'This is posted publicly on LinkedIn.'} It is not published to your website, and you cannot take it back from here.</p>
              </>
            )}
            {err && <p className="li-note bad" role="alert">{err}</p>}
            <div className="li-actions">
              <button onClick={onClose} disabled={busy}>Cancel</button>
              <button className="primary" disabled={busy || !draft || problems.length > 0 || !text.trim() || over} onClick={post}>{busy ? 'Posting…' : 'Post to LinkedIn'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
