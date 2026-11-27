/**
 * "Open this item": used by the assistant after it creates a draft. The Structure screen picks it up, whether it was
 * already on screen or is only opened because of this request.
 */
let pending: { id: string; typeSlug: string } | null = null;
export const requestOpen = (id: string, typeSlug: string) => {
  pending = { id, typeSlug };
  window.dispatchEvent(new Event('cms:open-entry'));
};
export const takeOpen = () => { const p = pending; pending = null; return p; };
