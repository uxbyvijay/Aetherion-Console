/**
 * Reading what a person attaches in the assistant, in the browser: text files as they are, Word (.docx) files as their
 * text, images shrunk to a size the AI can take. Nothing is uploaded anywhere except to the AI with the message.
 */
export interface Attachment { name: string; kind: 'text' | 'image'; text?: string; mime?: string; data?: string; preview?: string; /** the file as chosen, kept so it can be saved to the media library */ file?: File; /** where it was saved in the media library, once it was */ url?: string }

const TEXT_LIMIT = 40_000;
const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|html?|xml|ya?ml|svg|css|js|ts|log)$/i;
const IMAGE_MIME = /^image\/(png|jpeg|webp|gif)$/;

const clip = (t: string) => (t.length > TEXT_LIMIT ? t.slice(0, TEXT_LIMIT) + '\n[…the rest of the file was left out]' : t);

/** Text of a .docx: a zip file whose word/document.xml holds the paragraphs. */
async function docxText(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(buf.buffer);
  // the end-of-central-directory record is near the end of the file
  let end = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
  if (end < 0) throw new Error('not a Word file');
  const count = view.getUint16(end + 10, true);
  let p = view.getUint32(end + 16, true);
  for (let n = 0; n < count; n++) {
    if (view.getUint32(p, true) !== 0x02014b50) break;
    const method = view.getUint16(p + 10, true);
    const size = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extra = view.getUint16(p + 30, true);
    const comment = view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    const name = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extra + comment;
    if (name !== 'word/document.xml') continue;
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const raw = buf.subarray(start, start + size);
    let xml: string;
    if (method === 0) xml = new TextDecoder().decode(raw);
    else {
      const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      xml = await new Response(stream).text();
    }
    const text = xml
      // a table: one line per row, cells split by " | " (the assistant turns it into a table block)
      .replace(/<w:tc>[\s\S]*?<\/w:tc>/g, (cell) => cell.replace(/<\/w:p>/g, ' ') + ' | ')
      .replace(/<\/w:tr>/g, '\n')
      .replace(/ \| \n/g, '\n')
      .replace(/<\/w:p>/g, '\n')
      .replace(/<w:tab\/>/g, '\t')
      .replace(/<w:br[^>]*\/>/g, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return text;
  }
  throw new Error('no text found');
}

/** An image scaled down so the longest side is at most 1280px, as JPEG (PNG keeps transparency), as base64. */
async function shrink(file: File): Promise<{ mime: string; data: string; preview: string }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error('unreadable')); i.src = url; });
    const k = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * k));
    c.height = Math.max(1, Math.round(img.naturalHeight * k));
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    const png = file.type === 'image/png' || file.type === 'image/gif' || file.type === 'image/webp';
    const mime = png ? 'image/png' : 'image/jpeg';
    const dataUrl = c.toDataURL(mime, 0.85);
    return { mime, data: dataUrl.split(',')[1], preview: dataUrl };
  } finally { URL.revokeObjectURL(url); }
}

/** Reads one file into something the assistant can use, or says why it cannot. */
export async function readAttachment(file: File): Promise<Attachment> {
  const name = file.name;
  if (/\.docx$/i.test(name)) {
    if (file.size > 10_000_000) throw new Error(`“${name}” is too large (up to 10 MB).`);
    try { return { name, kind: 'text', text: clip(await docxText(file)) }; } catch { throw new Error(`I could not read the text in “${name}”. Try saving it again as .docx.`); }
  }
  if (/\.doc$/i.test(name)) throw new Error(`“${name}” is an old Word format. Save it as .docx (File › Save as) and attach that.`);
  if (/\.pdf$/i.test(name)) throw new Error(`PDF files are not supported yet. Copy the text out, or export it as .docx or .txt.`);
  if (IMAGE_MIME.test(file.type)) {
    if (file.size > 12_000_000) throw new Error(`“${name}” is too large (up to 12 MB).`);
    try { const r = await shrink(file); return { name, kind: 'image', file, ...r }; } catch { throw new Error(`I could not open “${name}” as an image.`); }
  }
  if (file.type === 'image/svg+xml' || TEXT_EXT.test(name) || file.type.startsWith('text/')) {
    if (file.size > 400_000) throw new Error(`“${name}” is too large (up to 400 KB for text files).`);
    const text = await file.text();
    if (text.includes('\u0000')) throw new Error(`“${name}” is not a text file.`);
    return { name, kind: 'text', text: clip(text) };
  }
  if (file.type.startsWith('image/')) throw new Error(`“${name}” is an image format the AI cannot read. Use PNG, JPG, WebP, GIF or SVG.`);
  throw new Error(`“${name}” is not a supported file. Attach images, SVG icons, Word (.docx), text, Markdown, CSV, JSON or HTML.`);
}
