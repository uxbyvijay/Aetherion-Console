/**
 * The content structure of the Morph Space website (apps/morph.space, the design in Desktop/Project/New/morph-ui-designs).
 *
 *   pages          one document per address: home, how-it-works, features, pricing, contact
 *   sections       the blocks a page is built from (kind "section"), in the order an editor stacks them
 *   header / footer / website-settings   shared, one document each
 *
 * Every field here is one the site reads (see the `defaults` next to each page in apps/morph.space/src). The site shows
 * its built-in text for any page, section or field the CMS leaves empty.
 */
import type { Field } from '../src/fields.js';
import type { TypeDef } from './skalle-schema.js';

type F = Field;
const text = (name: string, label?: string, extra: Partial<F> = {}): F => ({ name, label, type: 'text', ...extra });
const area = (name: string, label?: string, extra: Partial<F> = {}): F => ({ name, label, type: 'textarea', ...extra });
const num = (name: string, label?: string, extra: Partial<F> = {}): F => ({ name, label, type: 'number', ...extra });
const bool = (name: string, label?: string, extra: Partial<F> = {}): F => ({ name, label, type: 'boolean', ...extra });
const img = (name: string, label?: string, extra: Partial<F> = {}): F => ({ name, label, type: 'image', ...extra });
const video = (name: string, label?: string, extra: Partial<F> = {}): F => ({ name, label, type: 'video', ...extra });
const icon = (name: string, label?: string, extra: Partial<F> = {}): F => ({ name, label, type: 'icon', ...extra });
const color = (name: string, label: string, group: string): F => ({ name, label, type: 'color', group });
const pick = (name: string, options: string[], label?: string, extra: Partial<F> = {}): F => ({ name, label, type: 'select', options, ...extra });
const list = (name: string, label: string, fields: NonNullable<F['fields']>, extra: Partial<F> = {}): F => ({ name, label, type: 'array', fields, ...extra });
const links = (name: string, label: string, extra: Partial<F> = {}) =>
  list(name, label, [
    { name: 'label', label: 'Label', type: 'text' },
    { name: 'url', label: 'Link', type: 'text' },
  ], extra);

/** The icons the feature list and the link cards can show (drawn with Lucide on the site). */
export const MORPH_ICONS = ['globe', 'blocks', 'workflow', 'waypoints', 'link', 'bot', 'tag', 'play', 'shield', 'key', 'network', 'sparkles'];

/** Background picture or video of a hero (the sharp city photo shows when both are empty). */
const background = (): F[] => [
  img('backgroundImage', 'Background picture (empty: the city photo)', { group: 'Background' }),
  video('backgroundVideo', 'Background video (replaces the picture)', { group: 'Background' }),
];
const buttons = (): F[] => [
  text('primaryLabel', 'Main button', { group: 'Buttons' }),
  text('primaryUrl', 'Main button link', { group: 'Buttons' }),
  text('secondaryLabel', 'Second button', { group: 'Buttons' }),
  text('secondaryUrl', 'Second button link', { group: 'Buttons' }),
];

export const morphTypes: TypeDef[] = [
  // ---------------------------------------------------------------- pages
  {
    name: 'Pages',
    slug: 'pages',
    kind: 'page',
    fields: [text('title', 'Page title', { required: true }), area('description', 'Search and share description'), num('order', 'Order in the menu')],
  },

  // ---------------------------------------------------------------- sections: heroes
  {
    name: 'Home hero',
    slug: 'home-hero',
    kind: 'section',
    fields: [
      area('title', 'Title (the last words, from the fifth word on, step back in tone)', { required: true, group: 'Copy' }),
      area('subtitle', 'Text under the title', { group: 'Copy' }),
      list('domains', 'Example addresses typed in the address bar', [{ name: 'domain', label: 'Address', type: 'text' }], { group: 'Copy' }),
      icon('domainIcon', 'Icon in the address bar', { group: 'Copy' }),
      ...buttons(),
      ...background(),
    ],
  },
  {
    name: 'Page hero',
    slug: 'page-hero',
    kind: 'section',
    fields: [
      text('title', 'Title (the rolling words go on a new line under it)', { required: true, group: 'Copy' }),
      list('words', 'Rolling words', [{ name: 'word', label: 'Word', type: 'text' }], { group: 'Copy' }),
      area('text', 'Text under the title', { group: 'Copy' }),
      ...buttons(),
      ...background(),
    ],
  },

  // ---------------------------------------------------------------- sections: cinematic blocks
  {
    name: 'Scroll statement',
    slug: 'scroll-words',
    kind: 'section',
    fields: [
      area('text', 'Statement (its words light up one by one as you scroll)', { required: true }),
      bool('light', 'Set on a light sheet'),
    ],
  },
  {
    name: 'Pinned steps',
    slug: 'pinned-steps',
    kind: 'section',
    fields: [
      text('heading', 'Heading (the last words step back in tone)', { required: true }),
      list('steps', 'Steps (each takes the screen in turn)', [
        { name: 'title', label: 'Title', type: 'text' },
        { name: 'text', label: 'Text', type: 'textarea' },
      ]),
      img('image', 'Picture behind the steps'),
    ],
  },
  {
    name: 'Statement with picture',
    slug: 'statement-media',
    kind: 'section',
    fields: [
      text('heading', 'Heading (the last words step back in tone)', { required: true }),
      list('paragraphs', 'Paragraphs', [{ name: 'text', label: 'Text', type: 'textarea' }]),
      img('image', 'Picture'),
      bool('flip', 'Picture on the right'),
    ],
  },
  {
    name: 'Picture reel',
    slug: 'reel',
    kind: 'section',
    fields: [
      list('items', 'Panels (they slide sideways as you scroll)', [
        { name: 'heading', label: 'Heading', type: 'text' },
        { name: 'body', label: 'Text (one paragraph per line)', type: 'textarea' },
        { name: 'image', label: 'Picture', type: 'image' },
      ]),
    ],
  },
  {
    name: 'Feature list',
    slug: 'feature-list',
    kind: 'section',
    fields: [
      text('heading', 'Heading (the last words step back in tone)', { required: true }),
      area('intro', 'Short intro'),
      list('items', 'Features', [
        { name: 'title', label: 'Title', type: 'text' },
        { name: 'text', label: 'Text', type: 'textarea' },
        { name: 'icon', label: 'Icon', type: 'select', options: MORPH_ICONS },
      ]),
    ],
  },
  {
    name: 'Ownership',
    slug: 'ownership',
    kind: 'section',
    fields: [
      text('heading', 'Heading (the last words step back in tone)', { required: true }),
      list('items', 'Points', [
        { name: 'stat', label: 'Big word', type: 'text' },
        { name: 'title', label: 'Title', type: 'text' },
        { name: 'text', label: 'Text', type: 'textarea' },
      ]),
    ],
  },
  {
    name: 'Link cards',
    slug: 'link-cards',
    kind: 'section',
    fields: [
      text('heading', 'Heading'),
      bool('light', 'Set on a light sheet'),
      list('cards', 'Cards', [
        { name: 'title', label: 'Title', type: 'text' },
        { name: 'text', label: 'Text', type: 'textarea' },
        { name: 'url', label: 'Link', type: 'text' },
        { name: 'icon', label: 'Icon', type: 'select', options: MORPH_ICONS },
      ]),
    ],
  },

  // ---------------------------------------------------------------- sections: pricing, contact
  {
    name: 'Plans',
    slug: 'plans',
    kind: 'section',
    fields: [
      text('heading', 'Heading', { required: true, group: 'Copy' }),
      num('annualSaving', 'Percent saved when paying yearly', { group: 'Copy' }),
      text('monthlyLabel', 'Monthly switch', { group: 'Labels' }),
      text('annualLabel', 'Annual switch', { group: 'Labels' }),
      text('popularLabel', 'Badge on the popular plan', { group: 'Labels' }),
      text('ctaLabel', 'Plan button', { group: 'Labels' }),
      text('contactLabel', 'Button of a plan without a price', { group: 'Labels' }),
      icon('specIcon', 'Icon before each feature', { group: 'Labels' }),
      list('plans', 'Plans (prices are in US dollars per month; empty = "Contact us"; 0 = free)', [
        { name: 'name', label: 'Name', type: 'text' },
        { name: 'monthly', label: 'US dollars per month', type: 'number' },
        { name: 'popular', label: 'Most popular', type: 'boolean' },
        { name: 'specs', label: 'Features (one per line)', type: 'textarea' },
      ]),
    ],
  },
  {
    name: 'Contact form',
    slug: 'contact-form',
    kind: 'section',
    fields: [
      text('title', 'Title (the rolling words go on a new line under it)', { required: true, group: 'Copy' }),
      list('words', 'Rolling words', [{ name: 'word', label: 'Word', type: 'text' }], { group: 'Copy' }),
      area('intro', 'Text under the title', { group: 'Copy' }),
      list('topics', 'Topics (the "What is this about?" list; each asks its own extra fields)', [
        { name: 'title', label: 'Name', type: 'text' },
        { name: 'text', label: 'Short description', type: 'text' },
        { name: 'message', label: 'Prompt in the message box', type: 'text' },
      ], { group: 'Form' }),
      text('submitLabel', 'Send button', { group: 'Form' }),
      list('links', 'Links under the text', [
        { name: 'title', label: 'Title', type: 'text' },
        { name: 'text', label: 'Text', type: 'text' },
        { name: 'url', label: 'Link', type: 'text' },
      ], { group: 'Links' }),
      ...background(),
    ],
  },

  // ---------------------------------------------------------------- sections: shared endings
  {
    name: 'Gateway message',
    slug: 'gateway',
    kind: 'section',
    fields: [
      text('title', 'Title (a full stop ends each line; the last line steps back in tone)', { required: true }),
      area('text', 'Text'),
      text('tagline', 'Bold line'),
      text('buttonLabel', 'Button'),
      text('buttonUrl', 'Button link'),
      text('secondaryLabel', 'Second button'),
      text('secondaryUrl', 'Second button link'),
      img('image', 'Picture behind the message'),
    ],
  },
  {
    name: 'FAQ',
    slug: 'faq',
    kind: 'section',
    fields: [
      text('heading', 'Heading', { required: true }),
      text('note', 'Note under the heading (the words "Send us a message" become a link)'),
      bool('light', 'Set on a light sheet'),
      list('items', 'Questions', [
        { name: 'q', label: 'Question', type: 'text' },
        { name: 'a', label: 'Answer', type: 'textarea' },
      ]),
    ],
  },
  {
    name: 'Call to action band',
    slug: 'cta-band',
    kind: 'section',
    fields: [text('heading', 'Heading', { required: true }), area('text', 'Text'), ...buttons()],
  },

  // ---------------------------------------------------------------- shared documents
  {
    name: 'Header',
    slug: 'header',
    kind: 'singleton',
    fields: [
      text('logoText', 'Name beside the logo'),
      img('logoImage', 'Logo picture (empty: the Morph Space mark)'),
      links('navigation', 'Menu (the first three go left of the logo, the fourth right)'),
      text('loginLabel', 'Login button'),
      text('loginUrl', 'Login link'),
      text('registerLabel', 'Register button'),
      text('registerUrl', 'Register link'),
    ],
  },
  {
    name: 'Footer',
    slug: 'footer',
    kind: 'singleton',
    fields: [
      text('logoText', 'Name beside the logo'),
      img('logoImage', 'Logo picture'),
      links('links', 'Links'),
      list('community', 'Community links', [
        { name: 'title', label: 'Title', type: 'text' },
        { name: 'url', label: 'Link', type: 'text' },
      ]),
      text('copyright', 'Copyright line'),
    ],
  },
  {
    name: 'Website settings',
    slug: 'website-settings',
    kind: 'singleton',
    fields: [
      text('siteName', 'Site name', { group: 'Site' }),
      color('themeColor', 'Browser bar colour', 'Site'),
      img('shareImage', 'Share picture', { group: 'Site' }),
      img('favicon', 'Browser tab icon', { group: 'Site' }),
      color('brandColor', 'Brand colour (buttons, selected states)', 'Colours'),
      color('brandDark', 'Brand, dark', 'Colours'),
      color('brandLight', 'Brand, light', 'Colours'),
      color('backgroundColor', 'Page background', 'Colours'),
      color('surfaceColor', 'Cards and panels', 'Colours'),
      color('textColor', 'Text', 'Colours'),
      color('mutedColor', 'Soft text', 'Colours'),
      color('accentColor', 'Accent', 'Colours'),
      color('paperColor', 'Light sheet', 'Colours'),
      color('paperInk', 'Text on the light sheet', 'Colours'),
    ],
  },
];
