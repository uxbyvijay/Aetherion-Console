import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Passwords an admin sets for someone can be shown again to admins. They are kept encrypted (AES-256-GCM, key made from
 * JWT_SECRET), never as plain text, and only for passwords an admin chose: when the person picks their own password the
 * copy is deleted, so a password people choose for themselves can never be read.
 */
const key = () => createHash('sha256').update('password-copy:' + (process.env.JWT_SECRET ?? '')).digest();

export function sealPassword(password: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([c.update(password, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), body].map((b) => b.toString('base64')).join('.');
}

export function openPassword(sealed: string | null | undefined): string | null {
  if (!sealed) return null;
  try {
    const [iv, tag, body] = sealed.split('.').map((p) => Buffer.from(p, 'base64'));
    const d = createDecipheriv('aes-256-gcm', key(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(body), d.final()]).toString('utf8');
  } catch {
    return null; // the key changed (JWT_SECRET) or the data is damaged: it cannot be shown any more
  }
}
