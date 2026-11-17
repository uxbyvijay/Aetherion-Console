import { createHmac, timingSafeEqual } from 'node:crypto';
import { prisma } from '../db.js';
import { decrypt, encrypt } from './secret.js';

/**
 * Posting an article to LinkedIn.
 *
 * One LinkedIn connection per site, kept in the Connector table (kind "linkedin") like the AI keys are: the app's Client ID in
 * plain view, the Client Secret and the access token encrypted. Nothing is ever posted without a person confirming the exact
 * text first, in the CMS, in the AI assistant's panel, or in their AI app when it goes through MCP.
 */
const NAME = 'linkedin';
const API_VERSION = process.env.LINKEDIN_VERSION || '202504';
const SCOPES = 'openid profile w_member_social';
export const MAX_POST = 3000;

interface Meta { clientId?: string; name?: string; expiresAt?: string; urlPattern?: string }
interface Secret { clientSecret?: string; accessToken?: string }

/** Article-like types: a list of documents that has a title, such as "Articles and posts" or "Journal articles". */
export const isArticleType = (t: { slug: string; kind?: string; fields?: unknown }) =>
  (t.kind ?? 'collection') === 'collection' && /article|post|news|blog|journal/i.test(t.slug) && Array.isArray(t.fields) && (t.fields as { name: string }[]).some((f) => f.name === 'title');

const parse = <T,>(s?: string | null): T => { try { return (s ? JSON.parse(s) : {}) as T; } catch { return {} as T; } };

async function load(siteId: string) {
  const row = await prisma.connector.findUnique({ where: { siteId_name: { siteId, name: NAME } } });
  const meta = parse<Meta>(row?.description);
  const secret = parse<Secret>(decrypt(row?.tokenEnc));
  return { row, meta, secret, authorUrn: row?.url?.startsWith('urn:li:') ? row.url : '' };
}

async function store(siteId: string, patch: { meta?: Meta; secret?: Secret; authorUrn?: string }) {
  const cur = await load(siteId);
  const meta = { ...cur.meta, ...patch.meta };
  const secret = { ...cur.secret, ...patch.secret };
  const data = { kind: 'linkedin', url: patch.authorUrn ?? cur.authorUrn ?? '', description: JSON.stringify(meta), tokenEnc: encrypt(JSON.stringify(secret)) };
  if (cur.row) await prisma.connector.update({ where: { id: cur.row.id }, data });
  else await prisma.connector.create({ data: { siteId, name: NAME, ...data } });
}

const publicBase = () => (process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 4000}`).replace(/\/$/, '');
export const redirectUri = () => `${publicBase()}/linkedin/callback`;

export async function status(siteId: string) {
  const { meta, secret, authorUrn } = await load(siteId);
  const expiresAt = meta.expiresAt ? new Date(meta.expiresAt) : null;
  const connected = !!secret.accessToken && !!authorUrn;
  return {
    setUp: !!meta.clientId && !!secret.clientSecret,
    clientId: meta.clientId ?? '',
    hasSecret: !!secret.clientSecret,
    connected,
    expired: connected && !!expiresAt && expiresAt.getTime() < Date.now(),
    name: meta.name ?? '',
    expiresAt: meta.expiresAt ?? null,
    urlPattern: meta.urlPattern ?? '',
    redirectUri: redirectUri(),
  };
}

export async function saveSetup(siteId: string, b: { clientId: string; clientSecret?: string; urlPattern?: string }) {
  await store(siteId, { meta: { clientId: b.clientId, ...(b.urlPattern !== undefined && { urlPattern: b.urlPattern }) }, ...(b.clientSecret ? { secret: { clientSecret: b.clientSecret } } : {}) });
}

/** Forget the signed-in LinkedIn account but keep the app details; or forget everything. */
export async function disconnect(siteId: string, forgetApp = false) {
  if (forgetApp) { await prisma.connector.deleteMany({ where: { siteId, name: NAME, kind: 'linkedin' } }); return; }
  const cur = await load(siteId);
  if (!cur.row) return;
  await prisma.connector.update({
    where: { id: cur.row.id },
    data: { url: '', description: JSON.stringify({ ...cur.meta, name: undefined, expiresAt: undefined }), tokenEnc: encrypt(JSON.stringify({ clientSecret: cur.secret.clientSecret })) },
  });
}

/* ---------------------------------------------------------------- connecting (OAuth) */
const secretKey = () => process.env.CONNECTOR_KEY || process.env.JWT_SECRET || 'dev';
const sign = (payload: string) => createHmac('sha256', secretKey()).update('linkedin-state:' + payload).digest('base64url');

export async function authorizeUrl(siteId: string): Promise<{ url: string } | { error: string }> {
  const { meta, secret } = await load(siteId);
  if (!meta.clientId || !secret.clientSecret) return { error: 'Save the LinkedIn Client ID and Client Secret first.' };
  const payload = Buffer.from(JSON.stringify({ siteId, exp: Date.now() + 15 * 60_000 })).toString('base64url');
  const q = new URLSearchParams({ response_type: 'code', client_id: meta.clientId, redirect_uri: redirectUri(), state: `${payload}.${sign(payload)}`, scope: SCOPES });
  return { url: `https://www.linkedin.com/oauth/v2/authorization?${q}` };
}

/** Finishes the sign-in LinkedIn sent the person back from. Returns the site it was for, or what went wrong. */
export async function finishConnect(code: string, state: string): Promise<{ siteId: string } | { error: string }> {
  const [payload, mac] = state.split('.');
  const good = payload && mac && (() => { const a = Buffer.from(sign(payload)); const b = Buffer.from(mac); return a.length === b.length && timingSafeEqual(a, b); })();
  if (!good) return { error: 'This sign-in link is not valid. Start again from Settings.' };
  const { siteId, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { siteId: string; exp: number };
  if (Date.now() > exp) return { error: 'This sign-in took too long. Start again from Settings.' };
  const { meta, secret } = await load(siteId);
  if (!meta.clientId || !secret.clientSecret) return { error: 'The LinkedIn app details are missing.' };

  const tok = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri(), client_id: meta.clientId, client_secret: secret.clientSecret }),
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  if (!tok || !tok.ok) return { error: 'LinkedIn did not accept the sign-in. Check the Client ID, the Client Secret and that the redirect address is listed in your LinkedIn app.' };
  const t = (await tok.json()) as { access_token?: string; expires_in?: number };
  if (!t.access_token) return { error: 'LinkedIn did not send an access token.' };

  const me = await fetch('https://api.linkedin.com/v2/userinfo', { headers: { authorization: `Bearer ${t.access_token}` }, signal: AbortSignal.timeout(20_000) }).catch(() => null);
  if (!me || !me.ok) return { error: 'Signed in, but LinkedIn would not say who you are. Turn on "Sign In with LinkedIn using OpenID Connect" in your LinkedIn app.' };
  const p = (await me.json()) as { sub?: string; name?: string };
  if (!p.sub) return { error: 'LinkedIn did not return your profile.' };

  await store(siteId, {
    meta: { name: p.name ?? '', expiresAt: new Date(Date.now() + (t.expires_in ?? 60 * 24 * 3600) * 1000).toISOString() },
    secret: { accessToken: t.access_token },
    authorUrn: `urn:li:person:${p.sub}`,
  });
  return { siteId };
}

/* ---------------------------------------------------------------- drafting and posting */
type Doc = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const DESCRIPTION_FIELDS = ['summary', 'excerpt', 'dek', 'description'];

/** The live address of an article on the site, from the address pattern saved in Settings ("https://example.com/news/{slug}"). */
export async function articleUrl(siteId: string, slug: string | null): Promise<string> {
  const { meta } = await load(siteId);
  if (!slug || !meta.urlPattern) return '';
  return meta.urlPattern.replace('{slug}', encodeURIComponent(slug));
}

export interface LinkedinDraft { text: string; url: string; title: string; description: string; problems: string[]; postedUrl: string }

/** What would be posted for this article, and anything that stops it. Nothing is sent. */
export async function draftFor(siteId: string, entry: { slug: string | null; status: string; data: unknown }): Promise<LinkedinDraft> {
  const d = entry.data as Doc;
  const title = str(d.title);
  // the first of these that says something different from the title
  const description = DESCRIPTION_FIELDS.map((f) => str(d[f])).find((v) => v && v.toLowerCase() !== title.toLowerCase()) ?? '';
  const url = await articleUrl(siteId, entry.slug);
  const s = await status(siteId);
  const problems: string[] = [];
  if (!s.connected) problems.push('LinkedIn is not connected yet. Connect it under Settings › LinkedIn.');
  else if (s.expired) problems.push('The LinkedIn connection has expired. Connect it again under Settings › LinkedIn.');
  if (entry.status !== 'PUBLISHED') problems.push('Publish the article first. LinkedIn links to the live page.');
  if (!url) problems.push('Add the article address under Settings › LinkedIn (for example https://example.com/news/{slug}), so the post can link to it.');
  else if (/^https?:\/\/(localhost|127\.|\[::1\])/i.test(url)) problems.push('The article address points to this computer. LinkedIn can only show a public page, so use the live address under Settings › LinkedIn.');
  if (!title) problems.push('The article has no title.');
  return { text: [title, description].filter(Boolean).join('\n\n').slice(0, MAX_POST), url, title, description, problems, postedUrl: str(d.linkedinUrl) };
}

/** LinkedIn reads some characters in a post as formatting; this makes the text show as typed, and keeps #hashtags working. */
export function escapeCommentary(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/[|{}@[\]()<>*_~]/g, (c) => '\\' + c)
    .replace(/(^|[\s])#([\p{L}\p{N}_]+)/gu, (_m, pre, tag) => `${pre}{hashtag|\\#|${tag}}`);
}

export class LinkedinError extends Error {}

/** Posts to the connected account. Only call this after a person has confirmed this exact text. */
export async function createPost(siteId: string, p: { text: string; url: string; title: string; description?: string }): Promise<{ urn: string; url: string }> {
  const { secret, authorUrn } = await load(siteId);
  const st = await status(siteId);
  if (!secret.accessToken || !authorUrn) throw new LinkedinError('LinkedIn is not connected. Connect it under Settings › LinkedIn.');
  if (st.expired) throw new LinkedinError('The LinkedIn connection has expired. Connect it again under Settings › LinkedIn.');
  const text = p.text.trim();
  if (!text) throw new LinkedinError('There is no text to post.');
  if (text.length > MAX_POST) throw new LinkedinError(`LinkedIn posts can be up to ${MAX_POST} characters; this one is ${text.length}.`);

  const res = await fetch('https://api.linkedin.com/rest/posts', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${secret.accessToken}`,
      'content-type': 'application/json',
      'linkedin-version': API_VERSION,
      'x-restli-protocol-version': '2.0.0',
    },
    body: JSON.stringify({
      author: authorUrn,
      commentary: escapeCommentary(text),
      visibility: 'PUBLIC',
      distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
      content: p.url ? { article: { source: p.url, title: p.title.slice(0, 200), ...(p.description ? { description: p.description.slice(0, 250) } : {}) } } : undefined,
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    }),
    signal: AbortSignal.timeout(30_000),
  }).catch(() => null);
  if (!res) throw new LinkedinError('Could not reach LinkedIn. Check the internet connection and try again.');
  if (res.status === 201 || res.status === 200) {
    const urn = res.headers.get('x-restli-id') || res.headers.get('x-linkedin-id') || '';
    return { urn, url: urn ? `https://www.linkedin.com/feed/update/${urn}` : '' };
  }
  if (res.status === 401) throw new LinkedinError('LinkedIn no longer accepts the connection. Connect it again under Settings › LinkedIn.');
  if (res.status === 403) throw new LinkedinError('LinkedIn says this app may not post. In your LinkedIn app, add the product "Share on LinkedIn" so the permission w_member_social is available, then connect again.');
  if (res.status === 422) throw new LinkedinError('LinkedIn refused the post. A post with exactly the same text may already exist; change the text a little and try again.');
  if (res.status === 429) throw new LinkedinError('LinkedIn says too many posts were made. Try again later.');
  throw new LinkedinError(`LinkedIn answered ${res.status}. Try again in a moment.`);
}

/* ---------------------------------------------------------------- a token for the AI tools' two steps */
const tokenSign = (entryId: string, updatedAt: Date, text: string, exp: number) =>
  createHmac('sha256', secretKey()).update(`linkedin|${entryId}|${updatedAt.toISOString()}|${text}|${exp}`).digest('base64url');
export const postToken = (entry: { id: string; updatedAt: Date }, text: string) => { const exp = Date.now() + 10 * 60_000; return `${exp}.${tokenSign(entry.id, entry.updatedAt, text, exp)}`; };
export function postTokenValid(entry: { id: string; updatedAt: Date }, text: string, token: string): boolean {
  const [expS, mac] = token.split('.');
  const exp = Number(expS);
  if (!exp || !mac || Date.now() > exp) return false;
  const a = Buffer.from(tokenSign(entry.id, entry.updatedAt, text, exp));
  const b = Buffer.from(mac);
  return a.length === b.length && timingSafeEqual(a, b);
}
