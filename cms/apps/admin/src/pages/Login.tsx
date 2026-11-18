import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, setToken, type User } from '../api';
import { PasswordInput } from '../lib/password';

declare global {
  interface Window { google?: { accounts: { id: { initialize: (o: { client_id: string; callback: (r: { credential: string }) => void }) => void; renderButton: (el: HTMLElement, o: Record<string, unknown>) => void } } } }
}

/** Google's own sign-in button. It only appears when the API has a Google client id. */
function GoogleButton({ clientId, onCredential }: { clientId: string; onCredential: (credential: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const cb = useRef(onCredential);
  cb.current = onCredential;
  useEffect(() => {
    const draw = () => {
      if (!window.google || !box.current) return;
      window.google.accounts.id.initialize({ client_id: clientId, callback: (r) => cb.current(r.credential) });
      // as wide as the Sign in button above it (Google allows 200 to 400 pixels)
      const width = Math.min(400, Math.max(200, Math.round(box.current.clientWidth)));
      window.google.accounts.id.renderButton(box.current, { theme: 'filled_black', size: 'large', text: 'continue_with', shape: 'rectangular', logo_alignment: 'center', width });
    };
    if (window.google) { draw(); return; }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = draw;
    document.head.appendChild(s);
  }, [clientId]);
  // What you see is our own button. Google's real button sits invisibly on top of it, so the click still goes to Google.
  return (
    <div className="google-btn">
      <span className="google-face" aria-hidden>
        <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" /><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" /><path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z" /><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" /></svg>
        Continue with Google
      </span>
      <div ref={box} className="google-hit" />
    </div>
  );
}

/** Forgot password: the person asks for a 6-digit code by email, then types it with a new password. */
function ForgotPassword({ start, onBack, onDone }: { start: string; onBack: () => void; onDone: (email: string) => void }) {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState(start);
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');

  async function send(e?: FormEvent) {
    e?.preventDefault();
    setErr(''); setInfo(''); setBusy(true);
    try {
      const r = await api<{ ok: boolean; emailConfigured: boolean; wait?: boolean }>('/auth/forgot', { body: { email: email.trim() } });
      if (!r.emailConfigured) setErr('Email is not set up on the server yet, so no code can be sent. Ask an admin to reset your password for you.');
      else { setStep('code'); setInfo(r.wait ? 'A code was sent a moment ago. Check your email, or wait a minute and ask again.' : `We sent a 6-digit code to ${email.trim()}. It works for 15 minutes.`); }
    } catch (x) { setErr((x as Error).message); }
    setBusy(false);
  }

  async function reset(e: FormEvent) {
    e.preventDefault();
    if (pw.length < 8) { setErr('Use at least 8 characters.'); return; }
    if (pw !== again) { setErr('The two passwords are not the same.'); return; }
    setErr(''); setBusy(true);
    try {
      await api('/auth/reset', { body: { email: email.trim(), code: code.trim(), password: pw } });
      onDone(email.trim());
    } catch (x) { setErr((x as Error).message); }
    setBusy(false);
  }

  return step === 'email' ? (
    <form className="card login" onSubmit={send}>
      <h1>Forgot your password?</h1>
      <p className="muted">Enter your email and we send you a 6-digit code.</p>
      <input type="email" placeholder="Email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required />
      {err && <p className="err">{err}</p>}
      <button className="primary" disabled={busy || !email.trim()}>{busy ? 'Sending…' : 'Send code'}</button>
      <button type="button" className="link login-forgot center" onClick={() => { setErr(''); setStep('code'); }}>I already have a code</button>
      <button type="button" className="link login-forgot center" onClick={onBack}>Back to sign in</button>
    </form>
  ) : (
    <form className="card login" onSubmit={reset}>
      <h1>Enter your code</h1>
      {info && <p className="muted">{info}</p>}
      {!start && !email && <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />}
      <input className="code-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value.replace(/D/g, ''))} autoFocus required />
      <PasswordInput placeholder="New password (8 or more characters)" minLength={8} value={pw} onChange={setPw} required />
      <PasswordInput placeholder="Confirm new password" value={again} onChange={setAgain} required />
      {again && pw !== again && <p className="err">The two passwords are not the same.</p>}
      {err && <p className="err">{err}</p>}
      <button className="primary" disabled={busy || code.length !== 6 || pw.length < 8 || pw !== again}>{busy ? 'Saving…' : 'Reset password'}</button>
      <button type="button" className="link login-forgot center" disabled={busy || !email.trim()} onClick={() => send()}>Send a new code</button>
      <button type="button" className="link login-forgot center" onClick={onBack}>Back to sign in</button>
    </form>
  );
}

export function Login({ onDone }: { onDone: (u: User) => void }) {
  const [setup, setSetup] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [notice, setNotice] = useState('');
  const [googleId, setGoogleId] = useState<string | null>(null);
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState('');

  useEffect(() => {
    api<{ needsSetup: boolean; googleClientId?: string | null }>('/auth/status')
      .then((s) => { setSetup(s.needsSetup); setGoogleId(s.googleClientId ?? null); })
      .catch((x: Error) => setErr(x.message === 'Failed to fetch' ? 'Cannot reach the API. Is it running on port 4000?' : x.message));
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      const email = f.email.trim();
      if (setup) await api('/auth/register', { body: { ...f, email } });
      const r = await api<{ token: string; user: User }>('/auth/login', { body: { email, password: f.password } });
      setToken(r.token);
      onDone(r.user);
    } catch (x) { setErr((x as Error).message); }
  }

  async function google(credential: string) {
    setErr('');
    try {
      const r = await api<{ token: string; user: User }>('/auth/google', { body: { credential } });
      setToken(r.token);
      onDone(r.user);
    } catch (x) { setErr((x as Error).message); }
  }

  if (forgot) {
    return <ForgotPassword start={f.email} onBack={() => setForgot(false)} onDone={(email) => { setF({ ...f, email, password: '' }); setNotice('Your password was changed. Sign in with the new one.'); setForgot(false); }} />;
  }

  return (
    <form className="card login" onSubmit={submit}>
      <h1>Aetherion Console</h1>
      <p className="muted">{setup ? 'Create the first admin account.' : 'Sign in to continue.'}</p>
      {setup && <input placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />}
      <input type="email" placeholder="Email" autoComplete="username" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
      <PasswordInput placeholder="Password" autoComplete={setup ? 'new-password' : 'current-password'} minLength={setup ? 8 : undefined} value={f.password} onChange={(v) => setF({ ...f, password: v })} required />
      {!setup && <button type="button" className="link login-forgot" onClick={() => { setErr(''); setForgot(true); }}>Forgot password?</button>}
      {notice && !err && <p className="ok" role="status">{notice}</p>}
      {err && <p className="err">{err}</p>}
      <button className="primary">{setup ? 'Create account' : 'Sign in'}</button>
      {googleId && !setup && (
        <>
          <div className="login-or"><span>or</span></div>
          <GoogleButton clientId={googleId} onCredential={google} />
        </>
      )}
    </form>
  );
}
