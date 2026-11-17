import type { ContentType } from '../api';

/** Articles: a list of documents with a title, such as "Articles and posts" or "Journal articles". These can be shared on LinkedIn. */
export const isArticleType = (t: Pick<ContentType, 'slug' | 'kind' | 'fields'>) =>
  (t.kind ?? 'collection') === 'collection' && /article|post|news|blog|journal/i.test(t.slug) && t.fields.some((f) => f.name === 'title');
