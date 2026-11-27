import { useState, type InputHTMLAttributes } from 'react';

/** A password box with an eye to show what was typed. */
export function PasswordInput({ value, onChange, placeholder, autoComplete, ...rest }: {
  value: string; onChange: (v: string) => void; placeholder?: string; autoComplete?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>) {
  const [shown, setShown] = useState(false);
  return (
    <span className="pw">
      <input {...rest} type={shown ? 'text' : 'password'} value={value} placeholder={placeholder} autoComplete={autoComplete ?? 'new-password'} onChange={(e) => onChange(e.target.value)} />
      <button type="button" className="pw-eye" aria-label={shown ? 'Hide the password' : 'Show the password'} aria-pressed={shown} title={shown ? 'Hide' : 'Show'} onClick={() => setShown((s) => !s)}>
        {shown ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 3l18 18" /><path d="M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 8.5 4.2 9.5 6-.4.8-1.2 1.9-2.3 3M6.5 7.6C4.6 8.9 3.3 10.7 2.5 12c1 1.8 4.5 6 9.5 6 1.5 0 2.8-.4 4-.9" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" /><circle cx="12" cy="12" r="3" /></svg>
        )}
      </button>
    </span>
  );
}

/** A temporary password that is easy to read out: no look-alike characters (0/O, 1/l/I). */
export function generatePassword(length = 12): string {
  const set = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => set[b % set.length]).join('');
}
