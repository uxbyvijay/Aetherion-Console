import { createSign } from 'node:crypto';

/**
 * Visitor numbers for a website, read from Google Analytics 4. The CMS stores no visitor data of its own: it asks Google,
 * signing in as a service account whose file is kept encrypted on the server, and answers the browser with plain numbers.
 */
export interface Row { label: string; value: number }
export interface Totals { visitors: number; pageviews: number; bounceRate: number | null; visitDuration: number | null }
export interface Report {
  from: string;
  to: string;
  days: number;
  totals: Totals;
  /** the period of the same length just before, for the change shown beside each total */
  previous: Totals | null;
  series: { date: string; visitors: number; pageviews: number }[];
  pages: Row[];
  sources: Row[];
  countries: Row[];
  devices: Row[];
}
export interface Settings { propertyId?: string }

export class AnalyticsError extends Error {
  /** the same number under the name the web server looks for, so the message reaches the screen from anywhere it is thrown */
  statusCode: number;
  constructor(message: string, public status = 424) { super(message); this.statusCode = status; } // 424: the other side failed. A 5xx would be hidden as "Internal error" by the web server
}

const day = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
export function periods(days: number, now = new Date()) {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const from = addDays(today, -(days - 1));
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(days - 1));
  return { from: day(from), to: day(today), prevFrom: day(prevFrom), prevTo: day(prevTo) };
}

const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const nonEmpty = (s: unknown, fallback: string) => (typeof s === 'string' && s.trim() && s !== '(not set)' && s !== '(none)' ? (s === '(direct)' ? 'Direct' : s) : fallback);
/** Names filled in, "(direct)" shown as a word, the same name added together, largest first. */
function tidy(rows: Row[]): Row[] {
  const by = new Map<string, number>();
  for (const r of rows) by.set(r.label, (by.get(r.label) ?? 0) + r.value);
  return [...by].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function http(url: string, init: RequestInit & { what: string }) {
  let r: Response | undefined;
  // Google sometimes answers 500/502/503/504 for a moment (often just after a project, API or user was created): try again a couple of times before giving up.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try { r = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) }); }
    catch { throw new AnalyticsError(`Could not reach ${init.what}. Check the internet connection.`); }
    if (![500, 502, 503, 504].includes(r.status)) break;
    if (attempt < 2) await wait(1500 * (attempt + 1));
  }
  if (!r) throw new AnalyticsError(`Could not reach ${init.what}.`);
  if (r.ok) return r.json() as Promise<any>;
  let detail = '';
  try { const j: any = await r.json(); detail = String(j?.error?.message ?? j?.error_description ?? j?.error ?? j?.message ?? '').slice(0, 200); } catch { /* no body */ }
  if (r.status === 400 && /invalid[_ ]grant|invalid[_ ]client|signature|account not found/i.test(detail)) throw new AnalyticsError(`Google did not accept that service account file${detail ? ` (${detail})` : ''}. Make a new key and paste it again.`, 400);
  if (r.status === 401 || r.status === 403) throw new AnalyticsError(`${init.what} did not allow this service account${detail ? ` (${detail})` : ''}. In Google Analytics, add its email address as a Viewer of the property, and check that the Analytics Data API is turned on for the Google Cloud project.`, 400);
  if (r.status === 404) throw new AnalyticsError(`${init.what} does not know this property${detail ? ` (${detail})` : ''}. Check the property ID.`, 400);
  if (r.status === 429) throw new AnalyticsError(`${init.what} says too many requests. Try again in a minute.`, 429);
  if (r.status >= 500) throw new AnalyticsError(`${init.what} is temporarily unavailable (${r.status}). This often clears within a few minutes, especially right after the Google Cloud project, the Data API or the Analytics access was set up. Try again shortly.`);
  throw new AnalyticsError(`${init.what} answered with an error (${r.status})${detail ? `: ${detail.replace(/[. ]+$/, '')}` : ''}.`);
}

interface Ga4Row { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] }
export interface Ga4Raw { totals: Ga4Row[]; series: Ga4Row[]; pages: Ga4Row[]; sources: Ga4Row[]; countries: Ga4Row[]; devices: Ga4Row[] }

export function ga4Report(days: number, raw: Ga4Raw, p: ReturnType<typeof periods>): Report {
  const m = (r: Ga4Row | undefined, i: number) => num(r?.metricValues?.[i]?.value);
  const tot = (tag: string): Totals | null => {
    const r = raw.totals.find((x) => x.dimensionValues?.[0]?.value === tag);
    return r ? { visitors: m(r, 0), pageviews: m(r, 1), bounceRate: Math.round(m(r, 2) * 1000) / 10, visitDuration: Math.round(m(r, 3)) } : null;
  };
  const list = (rows: Ga4Row[], fallback: string): Row[] => tidy(rows.map((r) => ({ label: nonEmpty(r.dimensionValues?.[0]?.value, fallback), value: m(r, 0) })));
  const date = (v?: string) => (v && /^\d{8}$/.test(v) ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}` : String(v));
  return {
    from: p.from, to: p.to, days,
    totals: tot('date_range_0') ?? { visitors: 0, pageviews: 0, bounceRate: null, visitDuration: null },
    // Google leaves out a period that has no data at all: show it as zero so the change reads "No change", not "no earlier period"
    previous: tot('date_range_1') ?? { visitors: 0, pageviews: 0, bounceRate: null, visitDuration: null },
    series: fill(p.from, p.to, raw.series.map((r) => ({ date: date(r.dimensionValues?.[0]?.value), visitors: m(r, 0), pageviews: m(r, 1) }))),
    pages: list(raw.pages, '(unknown)'), sources: list(raw.sources, 'Direct / None'), countries: list(raw.countries, 'Unknown'), devices: list(raw.devices, 'Unknown'),
  };
}

interface ServiceAccount { client_email: string; private_key: string }
export function parseServiceAccount(text: string): ServiceAccount {
  let j: any;
  try { j = JSON.parse(text); } catch { throw new AnalyticsError('That is not a service account file. Paste the whole contents of the .json file.', 400); }
  if (!j || typeof j.client_email !== 'string' || typeof j.private_key !== 'string' || !j.private_key.includes('PRIVATE KEY')) throw new AnalyticsError('That file has no client_email and private_key. Use a Google service account key (JSON).', 400);
  return { client_email: j.client_email, private_key: j.private_key };
}

const tokens = new Map<string, { token: string; until: number }>();
async function googleToken(sa: ServiceAccount): Promise<string> {
  const hit = tokens.get(sa.client_email);
  if (hit && hit.until > Date.now() + 60_000) return hit.token;
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const aud = 'https://oauth2.googleapis.com/token';
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/analytics.readonly', aud, iat: now, exp: now + 3300 })}`;
  let sig: string;
  try { sig = createSign('RSA-SHA256').update(unsigned).sign(sa.private_key, 'base64url'); }
  catch { throw new AnalyticsError('The private key in that service account file could not be read.', 400); }
  const j = await http(aud, { what: 'Google', method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${sig}` }).toString() });
  tokens.set(sa.client_email, { token: j.access_token, until: Date.now() + num(j.expires_in || 3300) * 1000 });
  return j.access_token as string;
}

async function ga4(days: number, s: Settings, secret: string): Promise<Report> {
  if (!s.propertyId || !/^\d+$/.test(s.propertyId)) throw new AnalyticsError('Enter the GA4 property ID: the number from Admin, Property settings.', 400);
  const token = await googleToken(parseServiceAccount(secret));
  const p = periods(days);
  const run = async (body: Record<string, unknown>): Promise<Ga4Row[]> => {
    const j = await http(`https://analyticsdata.googleapis.com/v1beta/properties/${s.propertyId}:runReport`, { what: 'Google Analytics', method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return (j.rows ?? []) as Ga4Row[];
  };
  const range = [{ startDate: p.from, endDate: p.to }];
  const top = (dimension: string, metric: string) => run({ dateRanges: range, dimensions: [{ name: dimension }], metrics: [{ name: metric }], orderBys: [{ metric: { metricName: metric }, desc: true }], limit: 10 });
  const [totals, series, pages, sources, countries, devices] = await Promise.all([
    run({ dateRanges: [{ startDate: p.from, endDate: p.to }, { startDate: p.prevFrom, endDate: p.prevTo }], metrics: ['activeUsers', 'screenPageViews', 'bounceRate', 'averageSessionDuration'].map((name) => ({ name })) }),
    run({ dateRanges: range, dimensions: [{ name: 'date' }], metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }], orderBys: [{ dimension: { dimensionName: 'date' } }], limit: 400 }),
    top('pagePath', 'screenPageViews'), top('sessionSource', 'activeUsers'), top('country', 'activeUsers'), top('deviceCategory', 'activeUsers'),
  ]);
  return ga4Report(days, { totals, series, pages, sources, countries, devices }, p);
}

/** One entry for every day of the range, so a quiet day shows as zero and the line keeps its shape. */
function fill(from: string, to: string, rows: { date: string; visitors: number; pageviews: number }[]) {
  const by = new Map(rows.map((r) => [r.date, r]));
  const out: { date: string; visitors: number; pageviews: number }[] = [];
  for (let d = new Date(from + 'T00:00:00Z'); day(d) <= to; d = addDays(d, 1)) out.push(by.get(day(d)) ?? { date: day(d), visitors: 0, pageviews: 0 });
  return out;
}

// One entry point, with a short memory so a busy page does not hammer Google (its daily limits are small).
const cache = new Map<string, { at: number; report: Report }>();
const TTL = 5 * 60_000;
export const clearAnalyticsCache = (siteId: string) => { for (const k of cache.keys()) if (k.startsWith(siteId + ':')) cache.delete(k); };

export async function loadReport(siteId: string, days: number, settings: Settings, secret: string, fresh = false): Promise<Report> {
  const k = `${siteId}:${days}`;
  const hit = cache.get(k);
  if (!fresh && hit && Date.now() - hit.at < TTL) return hit.report;
  const report = await ga4(days, settings, secret);
  cache.set(k, { at: Date.now(), report });
  return report;
}
