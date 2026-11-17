import { useState, type FormEvent } from 'react';
import { api, type User } from '../api';
import { PasswordInput } from '../lib/password';

/**
 * Choose a new password. Shown on its own, and cannot be closed, the first time someone signs in with a password an
 * admin made for them (`forced`); otherwise it is opened from the profile menu and asks for the current password too.
 */
export function ChangePassword({ forced, onDone, onClose, onSignOut }: { forced?: boolean; onDone: (u: User) => void; onClose?: () => void; onSignOut?: () => void }) {
  const [current, setCurrent] = useState('');
  const [pw, setPw] = useState('');
  const [again, setAgain] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const problem = pw.length < 8 ? 'Use at least 8 characters.' : pw !== again ? 'The two passwords are not the same.' : '';

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (problem) { setErr(problem); return; }
    setBusy(true); setErr('');
    try { onDone(await api<User>('/auth/change-password', { body: { password: pw, ...(forced ? {} : { current }) } })); }
    catch (x) { setErr((x as Error).message); }
    setBusy(false);
  }

  return (
    <div className="overlay" onClick={forced ? undefined : onClose}>
      <form className="dialog pw-dialog" role="dialog" aria-modal="true" aria-labelledby="pw-title" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3 id="pw-title">{forced ? 'Choose your own password' : 'Change your password'}</h3>
        <p className="muted">{forced ? 'You signed in with a temporary password. Choose a password only you know to continue.' : 'Enter your current password, then the new one.'}</p>
        {!forced && <label>Current password<PasswordInput value={current} onChange={setCurrent} autoComplete="current-password" required /></label>}
        <label>New password<PasswordInput value={pw} onChange={setPw} placeholder="8 or more characters" autoFocus required /></label>
        <label>New password again<PasswordInput value={again} onChange={setAgain} required /></label>
        {err && <p className="err">{err}</p>}
        <div className="confirm-actions">
          {forced ? (onSignOut && <button type="button" onClick={onSignOut}>Sign out</button>) : <button type="button" onClick={onClose}>Cancel</button>}
          <button className="primary" disabled={busy || !pw || !again}>{busy ? 'Saving…' : 'Save password'}</button>
        </div>
      </form>
    </div>
  );
}
