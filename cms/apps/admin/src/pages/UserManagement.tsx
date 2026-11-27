import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { api, type Account, type Role, type User } from '../api';
import { ask } from '../lib/confirm';
import { PasswordInput, generatePassword } from '../lib/password';
import { initialsOf } from '../lib/people';

type Choice = 'ADMIN' | Role;
const ROLE_NAME: Record<Choice, string> = { ADMIN: 'Admin', EDITOR: 'Editor', VIEWER: 'Viewer' };
const roleOf = (a: Account): Choice => (a.isSuperAdmin ? 'ADMIN' : a.allSitesRole ?? 'EDITOR');

type Screen = { t: 'list' } | { t: 'new' } | { t: 'edit'; id: string };
type Sort = { by: 'name' | 'email' | 'role' | 'added'; dir: 1 | -1 };

const Icon = ({ children }: { children: ReactNode }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{children}</svg>
);

/** Admin only: everyone with an account, in a table, with add, edit, reset password and delete. */
export function UserManagement({ me }: { me: User }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [screen, setScreen] = useState<Screen>({ t: 'list' });
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>({ by: 'added', dir: -1 });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);

  const load = async () => setAccounts(await api<Account[]>('/accounts'));
  useEffect(() => { load().catch((x: Error) => setErr(x.message)).finally(() => setLoaded(true)); }, []);
  const run = async (fn: () => Promise<unknown>) => { setErr(''); try { await fn(); } catch (x) { setErr((x as Error).message); } };

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = accounts.filter((a) => !needle || a.name.toLowerCase().includes(needle) || a.email.toLowerCase().includes(needle) || ROLE_NAME[roleOf(a)].toLowerCase().includes(needle));
    const key = (a: Account) => (sort.by === 'name' ? a.name.toLowerCase() : sort.by === 'email' ? a.email.toLowerCase() : sort.by === 'role' ? ROLE_NAME[roleOf(a)] : a.createdAt ?? '');
    return [...list].sort((x, y) => (key(x) < key(y) ? -1 : key(x) > key(y) ? 1 : 0) * sort.dir);
  }, [accounts, q, sort]);

  const head = (by: Sort['by'], label: string) => (
    <th aria-sort={sort.by === by ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="th-sort" onClick={() => setSort((s) => ({ by, dir: s.by === by ? (s.dir === 1 ? -1 : 1) : 1 }))}>
        {label}<span aria-hidden>{sort.by === by ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}</span>
      </button>
    </th>
  );

  async function remove(a: Account) {
    if (!(await ask({ title: `Delete ${a.name || a.email}?`, message: 'The account is removed and they can no longer sign in. This cannot be undone.', confirmLabel: 'Delete user' }))) return;
    await api(`/accounts/${a.id}`, { method: 'DELETE' });
    setMsg(`${a.name || a.email} was deleted.`);
    await load();
  }

  /* ------------------------------------------------------------ add and edit: a popup over the list */
  const editing = screen.t === 'edit' ? accounts.find((a) => a.id === screen.id) : undefined;
  const dialog = screen.t !== 'list' && (screen.t === 'new' || editing) ? (
    <UserForm key={editing?.id ?? 'new'} account={editing} me={me} err={err}
      onBack={() => { setScreen({ t: 'list' }); setErr(''); }}
      onSaved={async (text) => { setMsg(text); setScreen({ t: 'list' }); await load(); }}
      setErr={setErr} />
  ) : null;

  return (
    <>
    <section className="set-block users-block">
      <header className="users-head">
        <div>
          <h3>Users <span className="users-count">{accounts.length}</span></h3>
          <p className="muted">Admins manage settings and users, editors change content, viewers can only look.</p>
        </div>
        <div className="users-bar">
          <label className="users-search">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input type="search" placeholder="Search users" aria-label="Search users" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <button className="primary add-new" onClick={() => { setScreen({ t: 'new' }); setMsg(''); setErr(''); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>Add new
          </button>
        </div>
      </header>

      {err && screen.t === 'list' && <p className="err">{err}</p>}
      {msg && <p className="ok" role="status">{msg}</p>}

      <div className="dt-wrap">
        <table className="data-table">
          <thead>
            <tr>
              {head('name', 'User')}{head('role', 'Role')}
              <th>Status</th>
              {head('added', 'Added')}
              <th className="dt-actions"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td>
                  <div className="dt-user">
                    <span className="dt-avatar" aria-hidden>{initialsOf(a.name)}</span>
                    <span className="dt-who"><b>{a.name}{a.id === me.id && <span className="dt-you">you</span>}</b><small>{a.email}</small></span>
                  </div>
                </td>
                <td><span className={`role-badge ${roleOf(a).toLowerCase()}`}>{ROLE_NAME[roleOf(a)]}</span></td>
                <td><span className="status ok"><i />Active</span></td>
                <td className="dt-actions">
                  <button type="button" className="icon-btn" title="Edit" aria-label={`Edit ${a.name}`} onClick={() => { setScreen({ t: 'edit', id: a.id }); setMsg(''); setErr(''); }}>
                    <Icon><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></Icon>
                  </button>
                  {a.id !== me.id && (
                    <button type="button" className="icon-btn danger" title="Delete" aria-label={`Delete ${a.name}`} onClick={() => run(() => remove(a))}>
                      <Icon><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M6 6l1 14h10l1-14" /><path d="M10 11v6M14 11v6" /></Icon>
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {loaded && !rows.length && <tr><td colSpan={5} className="muted dt-empty">{q ? `No users match "${q.trim()}".` : 'No users yet.'}</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
    {dialog}
    </>
  );
}

/** Add a user, or change a user's name, email and role, in a popup over the list. */
function UserForm({ account, me, err, setErr, onBack, onSaved }: {
  account?: Account; me: User; err: string; setErr: (m: string) => void; onBack: () => void;
  onSaved: (message: string) => void | Promise<void>;
}) {
  const [name, setName] = useState(account?.name ?? '');
  const [email, setEmail] = useState(account?.email ?? '');
  const [role, setRole] = useState<Choice>(account ? roleOf(account) : 'EDITOR');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedCurrent, setCopiedCurrent] = useState(false);
  /** the password an admin set for this person (undefined while loading, null when there is none to show) */
  const [current, setCurrent] = useState<string | null | undefined>(account ? undefined : null);
  useEffect(() => {
    if (!account) return;
    api<{ password: string | null }>(`/accounts/${account.id}/password`).then((r) => setCurrent(r.password)).catch(() => setCurrent(null));
  }, [account?.id]);
  const self = !!account && account.id === me.id;

  // Reset password: its own small popup over the Edit popup
  const [reset, setReset] = useState(false);
  const [rpw, setRpw] = useState('');
  const [rconfirm, setRconfirm] = useState('');
  const [rbusy, setRbusy] = useState(false);
  const [rerr, setRerr] = useState('');
  const [rdone, setRdone] = useState('');
  const openReset = () => { const p = generatePassword(); setRpw(p); setRconfirm(p); setRerr(''); setRdone(''); setReset(true); };
  async function saveReset(e: FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!account) return;
    if (rpw.length < 8) { setRerr('Use at least 8 characters.'); return; }
    if (rpw !== rconfirm) { setRerr('The two passwords are not the same.'); return; }
    setRbusy(true); setRerr('');
    try {
      await api(`/accounts/${account.id}`, { method: 'PUT', body: { password: rpw } });
      setCurrent(rpw);
      setRdone('The password was changed.');
      setReset(false);
    } catch (x) { setRerr((x as Error).message); }
    setRbusy(false);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const roleBody = role === 'ADMIN' ? { isSuperAdmin: true } : { isSuperAdmin: false, allSitesRole: role };
      if (!account) {
        await api('/auth/register', { body: { name: name.trim(), email: email.trim(), password, ...(role === 'ADMIN' ? { superAdmin: true } : { allSitesRole: role }) } });
        await onSaved(`${name.trim()} can now sign in as ${role === 'ADMIN' ? 'an admin' : role === 'EDITOR' ? 'an editor' : 'a viewer'}.`);
      } else {
        if (self && role !== 'ADMIN' && !(await ask({ title: 'Change your own role?', message: 'You will lose access to user management and settings.', confirmLabel: 'Change my role' }))) { setBusy(false); return; }
        await api(`/accounts/${account.id}`, { method: 'PUT', body: { name: name.trim(), email: email.trim(), ...roleBody } });
        await onSaved(`${name.trim()} was updated.`);
      }
    } catch (x) { setErr((x as Error).message); }
    setBusy(false);
  }

  return (
    <>
    <div className="overlay" onClick={onBack}>
      <form className="dialog add-user" role="dialog" aria-modal="true" aria-labelledby="user-form-title" onClick={(e) => e.stopPropagation()} onSubmit={submit}
        onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onBack(); } }}>
        <h3 id="user-form-title">{account ? `Edit ${account.name}` : 'Add a user'}</h3>
        {!account && <p className="muted">Share the password with them yourself. If Google sign-in is set up, they can also use their Google account with the same email.</p>}
        <label>Name<input value={name} onChange={(e) => setName(e.target.value)} autoFocus required /></label>
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Role
          <select value={role} onChange={(e) => setRole(e.target.value as Choice)}>
            <option value="ADMIN">Admin</option>
            <option value="EDITOR">Editor</option>
            <option value="VIEWER">Viewer</option>
          </select>
        </label>
        {account && (
          <label>Current password
            {current === undefined ? <span className="muted">Loading…</span> : current ? (
              <span className="pw-row">
                <PasswordInput value={current} onChange={() => {}} readOnly autoComplete="off" />
                <button type="button" onClick={() => { navigator.clipboard?.writeText(current).catch(() => {}); setCopiedCurrent(true); setTimeout(() => setCopiedCurrent(false), 1500); }}>{copiedCurrent ? 'Copied' : 'Copy'}</button>
              </span>
            ) : <span className="muted">Not available. This person chose their own password, so it stays private. Use Reset password to set a new one.</span>}
          </label>
        )}
        {!account && (
          <>
            <label>New password
              <PasswordInput placeholder="8 or more characters" minLength={8} value={password} onChange={setPassword} required />
            </label>
            <label>Confirm password
              <PasswordInput placeholder="Type it again" value={confirm} onChange={setConfirm} required />
            </label>
            {confirm && password !== confirm && <p className="err">The two passwords are not the same.</p>}
          </>
        )}
        {rdone && <p className="ok" role="status">{rdone}</p>}
        {err && <p className="err">{err}</p>}
        <div className="confirm-actions form-actions">
          {account
            ? <button type="button" className="link" onClick={openReset}>Reset password</button>
            : <button type="button" className="link" disabled={!password} onClick={() => { navigator.clipboard?.writeText(password).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? 'Copied' : 'Copy password'}</button>}
          <button type="button" onClick={onBack}>Cancel</button>
          <button className="primary" disabled={busy || !name.trim() || !email.trim() || (!account && (password.length < 8 || password !== confirm))}>{busy ? 'Saving…' : account ? 'Save changes' : 'Create user'}</button>
        </div>
      </form>
    </div>
    {reset && (
      <div className="overlay" onClick={() => setReset(false)}>
        <form className="dialog add-user" role="dialog" aria-modal="true" aria-labelledby="reset-pw-title" onClick={(e) => e.stopPropagation()} onSubmit={saveReset}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setReset(false); } }}>
          <h3 id="reset-pw-title">Reset password</h3>
          <p className="muted">Choose a new password for {account?.name}. Change the one filled in if you like.</p>
          <label>New password
            <PasswordInput placeholder="8 or more characters" minLength={8} value={rpw} onChange={setRpw} autoFocus required />
          </label>
          <label>Confirm password
            <PasswordInput placeholder="Type it again" value={rconfirm} onChange={setRconfirm} required />
          </label>
          {rconfirm && rpw !== rconfirm && <p className="err">The two passwords are not the same.</p>}
          {rerr && <p className="err">{rerr}</p>}
          <div className="confirm-actions form-actions">
            <button type="button" className="link" disabled={!rpw} onClick={() => { navigator.clipboard?.writeText(rpw).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? 'Copied' : 'Copy password'}</button>
            <button type="button" onClick={() => setReset(false)}>Cancel</button>
            <button className="primary" disabled={rbusy || rpw.length < 8 || rpw !== rconfirm}>{rbusy ? 'Saving…' : 'Set password'}</button>
          </div>
        </form>
      </div>
    )}
    </>
  );
}
