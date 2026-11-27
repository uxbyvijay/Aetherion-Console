import { useEffect, useState } from 'react';
import { api, type Site } from '../api';
import { ask } from '../lib/confirm';

export interface LinkedinStatus {
  setUp: boolean; clientId: string; hasSecret: boolean; connected: boolean; expired: boolean;
  name: string; expiresAt: string | null; urlPattern: string; redirectUri: string;
}

/** Settings › LinkedIn: the LinkedIn app's details, signing in, and the address articles live at. */
export function LinkedinSetup({ site, notice }: { site: Site; notice?: { ok: boolean; message: string } }) {
  const base = `/sites/${site.id}/linkedin`;
  const [st, setSt] = useState<LinkedinStatus | null>(null);
  const [clientId, setClientId] = useState('');
  const [secret, setSecret] = useState('');
  const [pattern, setPattern] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(notice ?? null);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    const s = await api<LinkedinStatus>(base);
    setSt(s); setClientId(s.clientId); setPattern(s.urlPattern); setSecret('');
  };
  useEffect(() => { setSt(null); load().catch((x) => setMsg({ ok: false, message: (x as Error).message })); }, [site.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (notice) setMsg(notice); }, [notice]);

  const changed = !!st && (clientId.trim() !== st.clientId || !!secret || pattern.trim() !== st.urlPattern);

  async function save() {
    setBusy('save'); setMsg(null);
    try {
      const s = await api<LinkedinStatus>(base, { method: 'PUT', body: { clientId: clientId.trim(), ...(secret ? { clientSecret: secret.trim() } : {}), urlPattern: pattern.trim() } });
      setSt(s); setSecret('');
      setMsg({ ok: true, message: 'Saved.' });
    } catch (x) { setMsg({ ok: false, message: (x as Error).message }); }
    setBusy('');
  }
  async function connect() {
    setBusy('connect'); setMsg(null);
    try {
      const r = await api<{ url: string }>(`${base}/connect`, { body: {} });
      window.location.href = r.url; // LinkedIn asks the person to allow it, then sends them back here
    } catch (x) { setMsg({ ok: false, message: (x as Error).message }); setBusy(''); }
  }
  async function disconnect(forget: boolean) {
    const ok = await ask({
      title: forget ? 'Remove the LinkedIn setup?' : 'Disconnect LinkedIn?',
      message: forget ? 'The saved Client ID and Client Secret are deleted. You would have to enter them again.' : 'Articles can no longer be posted until you connect again.',
      confirmLabel: forget ? 'Remove' : 'Disconnect',
    });
    if (!ok) return;
    await api(`${base}${forget ? '?forget=1' : ''}`, { method: 'DELETE' });
    await load(); setMsg(null);
  }
  const copy = async () => { try { await navigator.clipboard.writeText(st!.redirectUri); setCopied(true); setTimeout(() => setCopied(false), 1400); } catch { /* clipboard not available */ } };

  if (!st) return <p className="muted">Loading…</p>;
  const until = st.expiresAt ? new Date(st.expiresAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '';

  return (
    <div className="li-setup">
      {msg && <p className={msg.ok ? 'li-note ok' : 'li-note bad'} role="status">{msg.message}</p>}

      {st.connected && (
        <div className={`li-state${st.expired ? ' warn' : ' ok'}`}>
          <div>
            <b>{st.expired ? 'The connection has expired' : `Connected as ${st.name || 'your LinkedIn account'}`}</b>
            <span className="muted">{st.expired ? 'Connect again to keep posting.' : until ? `Valid until ${until}. LinkedIn asks you to connect again after that.` : ''}</span>
          </div>
          <div className="li-actions">
            {st.expired && <button className="primary" disabled={!!busy} onClick={connect}>Connect again</button>}
            <button disabled={!!busy} onClick={() => disconnect(false)}>Disconnect</button>
          </div>
        </div>
      )}

      {!st.connected && !st.setUp && (
        <ol className="li-steps">
          <li>Open <a href="https://www.linkedin.com/developers/apps" target="_blank" rel="noreferrer">linkedin.com/developers/apps</a> and create an app (it needs a LinkedIn company page to belong to).</li>
          <li>On the app's <b>Products</b> tab, add <b>Share on LinkedIn</b> and <b>Sign In with LinkedIn using OpenID Connect</b>.</li>
          <li>On the <b>Auth</b> tab, add this address under <b>Authorized redirect URLs</b>: <span className="li-copy"><code>{st.redirectUri}</code><button type="button" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button></span></li>
          <li>Copy the <b>Client ID</b> and the <b>Client Secret</b> from the Auth tab into the boxes below.</li>
        </ol>
      )}

      <div className="li-form">
        <label>Client ID<input value={clientId} onChange={(e) => setClientId(e.target.value)} autoComplete="off" spellCheck={false} /></label>
        <label>Client Secret<input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder={st.hasSecret ? '•••••••• saved, type to replace' : ''} autoComplete="new-password" /></label>
        <label className="wide">Address of an article on your website
          <input value={pattern} onChange={(e) => setPattern(e.target.value)} placeholder="https://example.com/news/{slug}" spellCheck={false} />
          <small className="muted">LinkedIn links to this page. Write <code>{'{slug}'}</code> where the article's own name goes, for example <code>https://synx.tools/news/{'{slug}'}</code>. It has to be a public address.</small>
        </label>
      </div>
      <div className="li-actions">
        <button className={st.setUp && !st.connected ? '' : 'primary'} disabled={!!busy || !changed || !clientId.trim() || (!st.hasSecret && !secret)} onClick={save}>{busy === 'save' ? 'Saving…' : 'Save'}</button>
        {st.setUp && !st.connected && <button className="primary" disabled={!!busy || changed} onClick={connect} title={changed ? 'Save your changes first' : undefined}>{busy === 'connect' ? 'Opening LinkedIn…' : 'Connect LinkedIn'}</button>}
        {st.setUp && <button className="link" disabled={!!busy} onClick={() => disconnect(true)}>Remove setup</button>}
      </div>
      <p className="muted li-foot">Nothing is posted on its own. Each post is shown to you first, with its exact text, and goes out only when you confirm it.</p>
    </div>
  );
}
