/**
 * Sets up the Morph Space site in the CMS: the content structure (morph-schema.ts) and all its content, read straight from
 * the site's own text (apps/morph.space/src/lib/content.ts) so nothing is retyped.
 *
 *   npm run seed:morph -w apps/api          (the API must be running; AUTH_DISABLED in dev)
 *
 * It writes the five pages (home, how-it-works, features, pricing, contact), the header, the footer and the website settings,
 * and uploads the site's pictures once. Safe to run again: types and documents are matched by slug and updated, so running it
 * again puts the pages back to the site's built-in text and replaces whatever an editor changed on them.
 * Env: CMS_URL (default http://localhost:4000), MORPH_SITE (site slug, default morph-space)
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fieldSchema, validateData } from '../src/fields.js';
import { morphTypes } from './morph-schema.js';

const CMS = process.env.CMS_URL ?? 'http://localhost:4000';
const SITE_SLUG = process.env.MORPH_SITE ?? 'morph-space';
const APP = resolve(import.meta.dirname, '../../morph.space');
/** `--dry` checks the structure and every document against the CMS's own rules and writes nothing (no CMS needed). */
const DRY = process.argv.includes('--dry');
/** When the CMS requires sign-in, pass a session token: CMS_TOKEN=<token> (copy it from a signed-in browser). Never commit it. */
const AUTH: Record<string, string> = process.env.CMS_TOKEN ? { authorization: `Bearer ${process.env.CMS_TOKEN}` } : {};

async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(CMS + path, {
    method: init.method ?? (init.body ? 'POST' : 'GET'),
    headers: init.body ? { ...AUTH, 'content-type': 'application/json' } : AUTH,
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} -> ${res.status} ${body.slice(0, 700)}`);
  return (body ? JSON.parse(body) : null) as T;
}

/* ------------------------------------------------------------------ the site's own text */
type Plan = { id: string; name: string; monthly: number | null; specs: string[]; popular?: boolean };
type Topic = { title: string; text: string; message: string };
const content = (await import(pathToFileURL(resolve(APP, 'src/lib/content.ts')).href)) as {
  missionIntro: string[];
  gateway: { title: string; text: string; tagline: string; buttonLabel: string; secondaryLabel: string; secondaryUrl: string };
  positioning: { title: string; summary: string; detail: string };
  creatorPath: { title: string; text: string }[];
  storyChapters: { id: string; title: string; body: string[] }[];
  featureList: { title: string; text: string }[];
  ownership: { stat: string; title: string; text: string }[];
  morphFaqs: { q: string; a: string }[];
  contactTopics: Topic[];
  communityLinks: { title: string; text: string; href: string }[];
  plans: Plan[];
  ANNUAL_SAVING: number;
};

/* ------------------------------------------------------------------ site, types */
type Site = { id: string; slug: string; name: string };
type Type = { id: string; slug: string };
type Entry = { id: string; slug: string | null; contentTypeId: string };

let base = '/sites/dry-run';
let types: Type[] = [];
if (DRY) {
  // every field definition must pass the CMS's field schema
  for (const def of morphTypes) for (const f of def.fields) fieldSchema.parse(f);
  console.log(`Dry run: ${morphTypes.length} types, all fields valid. Nothing is written.`);
} else {
  const sites = await call<Site[]>('/sites');
  const site = sites.find((s) => s.slug === SITE_SLUG);
  if (!site) throw new Error(`No site with the slug "${SITE_SLUG}". Create the Morph Space site in the CMS first, or set MORPH_SITE.`);
  base = `/sites/${site.id}`;
  console.log(`Site: ${site.name} (${site.id})`);

  const existingTypes = await call<Type[]>(`${base}/types`);
  for (const def of morphTypes) {
    const have = existingTypes.find((t) => t.slug === def.slug);
    if (have) await call(`${base}/types/${have.id}`, { method: 'PUT', body: def });
    else await call(`${base}/types`, { body: def });
  }
  types = await call<Type[]>(`${base}/types`);
  console.log(`Structure: ${morphTypes.length} types ready`);
}
const typeId = (slug: string) => types.find((t) => t.slug === slug)!.id;

/* ------------------------------------------------------------------ pictures */
type Media = { originalName: string; url: string };
const media = new Map<string, string>(DRY ? [] : (await call<Media[]>(`${base}/media`)).map((m) => [m.originalName, m.url] as [string, string]));
const mime: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

/** Uploads a file from the site's public folder once and returns its CMS address. "/images/steps.jpg" is stored as "morph-images-steps.jpg". */
async function up(publicPath: string): Promise<string | undefined> {
  const name = 'morph-' + publicPath.replace(/^\//, '').replace(/\//g, '-');
  const have = media.get(name);
  if (have) return have;
  const ext = name.split('.').pop()!.toLowerCase();
  if (!mime[ext]) return undefined;
  if (DRY) return `/uploads/dry/${name}`;
  let bytes: Buffer;
  try { bytes = await readFile(resolve(APP, 'public', publicPath.replace(/^\//, ''))); } catch { console.warn(`  missing file ${publicPath}`); return undefined; }
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(bytes)], { type: mime[ext] }), name);
  const res = await fetch(`${CMS}${base}/media`, { method: 'POST', headers: AUTH, body: form });
  if (!res.ok) { console.warn(`  could not upload ${publicPath}: ${res.status} ${(await res.text()).slice(0, 120)}`); return undefined; }
  const m = (await res.json()) as Media;
  media.set(name, m.url);
  console.log(`  uploaded ${publicPath}`);
  return m.url;
}

/* ------------------------------------------------------------------ entries */
let existing = DRY ? [] : await call<Entry[]>(`${base}/entries`);
const problems: string[] = [];
const dumped: { type: string; slug: string | null; data: Record<string, unknown> }[] = [];
const typeDef = (slug: string) => morphTypes.find((t) => t.slug === slug)!;
async function put(typeSlug: string, slug: string | null, data: Record<string, unknown>, status: 'PUBLISHED' | 'DRAFT' = 'PUBLISHED') {
  if (DRY) {
    dumped.push({ type: typeSlug, slug, data });
    // a page's sections are checked against the section types they name, the rest against the document's own type
    const { sections, ...own } = data as { sections?: { type: string; data: Record<string, unknown> }[] };
    problems.push(...validateData(typeDef(typeSlug).fields, own, `${typeSlug}/${slug ?? ''}: `).errors);
    for (const s of sections ?? []) {
      if (!morphTypes.some((t) => t.slug === s.type && t.kind === 'section')) problems.push(`${slug}: unknown section type ${s.type}`);
      else problems.push(...validateData(typeDef(s.type).fields, s.data, `${slug} › ${s.type}: `).errors);
    }
    return 'checked';
  }
  const tid = typeId(typeSlug);
  const have = existing.find((e) => e.contentTypeId === tid && (slug === null || e.slug === slug));
  const saved = have
    ? await call<Entry>(`${base}/entries/${have.id}`, { method: 'PUT', body: { slug, data, status } })
    : await call<Entry>(`${base}/entries`, { body: { slug, data, status, contentTypeId: tid } });
  if (!have) existing = [...existing, saved];
  return have ? 'updated' : 'added';
}
let n = 0;
const sec = (type: string, data: Record<string, unknown>) => ({ id: `${type}-${++n}`, type, data });
const words = (list: string[]) => list.map((word) => ({ word }));
const paragraphs = (list: string[]) => list.map((text) => ({ text }));

/* ================================================================== pages */
console.log('Pictures');
const [steps, visitor, sensor, vault, rooftop] = await Promise.all(['steps', 'visitor', 'sensor', 'vault', 'rooftop'].map((p) => up(`/images/${p}.jpg`)));

const [visitors, ...chapters] = content.storyChapters;
const reelPictures = [sensor, vault];

/** The gateway message and FAQ that close every page. */
const closing = () => [
  sec('gateway', { title: content.gateway.title, text: content.gateway.text, tagline: content.gateway.tagline, buttonLabel: content.gateway.buttonLabel, buttonUrl: '/contact#register', secondaryLabel: content.gateway.secondaryLabel, secondaryUrl: content.gateway.secondaryUrl, image: rooftop }),
  sec('faq', {
    heading: 'Frequently asked questions',
    note: "Can't find what you're looking for? Send us a message",
    items: content.morphFaqs,
  }),
];

console.log('Pages');
const pages: [string, string, string, number, unknown[]][] = [
  ['home', 'Morph Space', content.positioning.summary, 1, [
    sec('home-hero', {
      title: 'Set up your domain Share your tools',
      subtitle: 'Morph Space is a platform for tools. Pick a domain, set up the tools you need, and share them with the people you work with.',
      domains: ['yourname.com', 'studio.io', 'acme.dev', 'teamspace.app'].map((domain) => ({ domain })),
      primaryLabel: 'Register now', primaryUrl: '/contact#register', secondaryLabel: 'See pricing', secondaryUrl: '/pricing',
    }),
  ]],
  ['how-it-works', 'How it works', 'Morph Space is your private gateway to the Real Time Web, a network built for connected services, devices, and AI agents.', 2, [
    sec('page-hero', {
      title: 'Start with', words: words(['a sensor', 'a dataset', 'a model', 'an idea']), text: content.missionIntro[1],
      primaryLabel: 'Get started', primaryUrl: '/contact#register', secondaryLabel: 'See the steps', secondaryUrl: '#path',
    }),
    sec('scroll-words', { text: content.missionIntro[0], light: true }),
    sec('pinned-steps', { heading: 'Four steps from idea to live service', steps: content.creatorPath, image: steps }),
    sec('statement-media', { heading: visitors.title, paragraphs: paragraphs(visitors.body), image: visitor }),
    sec('reel', { items: chapters.map((c, i) => ({ heading: c.title, body: c.body.join('\n'), image: reelPictures[i % reelPictures.length] })) }),
    ...closing(),
    sec('cta-band', { heading: 'Ready to give your idea a shape?' }),
  ]],
  ['features', 'Features', 'A domain of your own, the Synx developer tools and a network where people, AI agents and machines can use what you build.', 3, [
    sec('page-hero', {
      title: 'Everything your service needs to', words: words(['get found', 'stay yours', 'connect', 'grow']),
      text: 'A domain of your own, the Synx developer tools and a network where people, AI agents and machines can use what you build.',
      primaryLabel: 'Get started', primaryUrl: '/contact#register', secondaryLabel: 'See the features', secondaryUrl: '#features',
    }),
    sec('feature-list', {
      heading: 'Everything to publish on the Real Time Web', intro: 'Six things every Morph Space gives you from day one.',
      items: content.featureList.map((f, i) => ({ title: f.title, text: f.text, icon: ['globe', 'blocks', 'workflow', 'waypoints', 'link', 'bot'][i] })),
    }),
    sec('ownership', { heading: 'More than a private server', items: content.ownership }),
    ...closing(),
    sec('cta-band', { heading: 'Your first service is closer than you think' }),
  ]],
  ['pricing', 'Pricing', "Start free in a shared space, or move to your own private Morph Space when you're ready.", 4, [
    sec('page-hero', {
      title: 'Plans that grow as your space', words: words(['takes shape', 'connects', 'scales']),
      text: "Start free in a shared space, or move to your own private Morph Space when you're ready.",
    }),
    sec('plans', {
      heading: 'Choose your plan', annualSaving: content.ANNUAL_SAVING,
      monthlyLabel: 'Monthly', annualLabel: 'Annual', popularLabel: 'Most popular', ctaLabel: 'Choose plan', contactLabel: 'Contact us',
      plans: content.plans.map((p) => ({ name: p.name, monthly: p.monthly ?? undefined, popular: !!p.popular, specs: p.specs.join('\n') })),
    }),
    ...closing(),
    sec('cta-band', { heading: 'Not sure which plan fits?', text: "Tell us what you need and we'll help you choose.", secondaryLabel: 'Talk to us', secondaryUrl: '/contact' }),
  ]],
  ['contact', 'Contact', 'Ready to register, curious about a plan or keen to work with us? Pick a topic and the Synx team will reply by email.', 5, [
    sec('contact-form', {
      title: "Let's talk about", words: words(['your space', 'your idea', 'partnering', 'the network']),
      intro: 'Ready to register, curious about a plan or keen to work with us? Pick a topic and the Synx team will reply by email.',
      topics: content.contactTopics.map(({ title, text, message }) => ({ title, text, message })),
      submitLabel: 'Send message',
      links: [{ title: 'Plans and pricing', text: 'Compare plans before you write', url: '/pricing' }, ...content.communityLinks.map((l) => ({ title: l.title, text: l.text, url: l.href }))],
    }),
    sec('link-cards', {
      heading: 'Before you write', light: true,
      cards: [
        { title: 'Plans and pricing', text: "Compare plans and see what you'd pay, monthly or annually.", url: '/pricing', icon: 'tag' },
        { title: 'See how it works', text: 'Follow the four steps from an idea to a live service.', url: '/how-it-works', icon: 'play' },
      ],
    }),
    ...closing(),
  ]],
];
for (const [slug, title, description, order, sections] of pages) {
  console.log(`  ${await put('pages', slug, { title, description, order, sections })} page / ${slug}`);
}

/* ================================================================== shared documents */
console.log('Shared');
await put('header', null, {
  logoText: 'Morph Space',
  navigation: [
    { label: 'How it works', url: '/how-it-works' }, { label: 'Features', url: '/features' },
    { label: 'Pricing', url: '/pricing' }, { label: 'Contact', url: '/contact' },
  ],
  loginLabel: 'Login', loginUrl: '#', registerLabel: 'Register now', registerUrl: '/contact#register',
});
await put('footer', null, {
  logoText: 'Morph Space',
  links: [
    { label: 'How it works', url: '/how-it-works' }, { label: 'Features', url: '/features' }, { label: 'Pricing', url: '/pricing' },
    { label: 'Contact', url: '/contact' }, { label: 'Register now', url: '/contact#register' },
  ],
  community: content.communityLinks.map((l) => ({ title: l.title, url: l.href })),
  copyright: 'Synx Tools @ 2026. All rights reserved.',
});
await put('website-settings', null, { siteName: 'Morph Space', themeColor: '#121216' });
if (DRY) {
  if (problems.length) {
    console.error(`${problems.length} problem(s):\n  ` + problems.join('\n  '));
    process.exit(1);
  }
  console.log('All pages and shared documents are valid.');
  // `--dump=<file>` also saves the documents as JSON (to test the site against a stand-in CMS)
  const out = process.argv.find((a) => a.startsWith('--dump='))?.slice(7);
  if (out) {
    const { writeFile } = await import('node:fs/promises');
    await writeFile(out, JSON.stringify(dumped, null, 2));
    console.log(`Saved ${dumped.length} documents to ${out}`);
  }
} else {
  console.log('Done. Open the site preview, or Live preview in the CMS, to see it.');
}
