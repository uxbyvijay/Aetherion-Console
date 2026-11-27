import type { ContentType } from '../api';

/** Shortens a text to a single line for a list row. */
export const clip = (s: string) => { const t = s.replace(/\s+/g, ' ').trim(); return t.length > 70 ? t.slice(0, 69) + '…' : t; };

const has = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';
// Fields that name a thing: they make the best title. Small tags ("/01", "PLT") and labels come after them.
const NAMING = /^(title|heading|headline|name|siteName|brand|question|term|label|text|quote)$/i;

/**
 * A short title for a section or page: a field that names it (title, heading, name...) if it has text, else its first text field,
 * else its first long text, else the first line of its first list.
 */
export function firstText(t: ContentType | undefined, d: Record<string, unknown>): string {
  const fields = t?.fields ?? [];
  for (const f of fields) if ((f.type === 'text' || f.type === 'textarea') && NAMING.test(f.name) && has(d[f.name])) return clip(d[f.name] as string);
  for (const f of fields) if (f.type === 'text' && has(d[f.name])) return clip(d[f.name] as string);
  for (const f of fields) if (f.type === 'textarea' && has(d[f.name])) return clip(d[f.name] as string);
  for (const f of fields) {
    const first = f.type === 'array' && Array.isArray(d[f.name]) ? (d[f.name] as Record<string, unknown>[])[0] : undefined;
    for (const sf of f.fields ?? []) if ((sf.type === 'text' || sf.type === 'textarea') && has(first?.[sf.name])) return clip(first![sf.name] as string);
  }
  return '';
}
