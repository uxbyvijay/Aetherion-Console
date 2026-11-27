import { useState, type ReactNode } from "react";
import { Reveal, SplitHeading } from "../lib/motion";
import { gateway, morphFaqs } from "../lib/content";
import { edit, mediaUrl, type Sec } from "../lib/cms";

/**
 * Accordion used by the inner pages. `paper` sets it on the light paper sheet.
 * `editKey` is the CMS section's key, so clicking a question or answer in the CMS preview opens its field.
 */
export default function Faq({
  id = "faq",
  title = "FAQ",
  note,
  items,
  paper = false,
  editKey,
}: {
  id?: string;
  title?: string;
  note?: ReactNode;
  items: { q: string; a: string }[];
  paper?: boolean;
  editKey?: string;
}) {
  const [open, setOpen] = useState<number | null>(0);
  const at = (field: string) => (editKey ? { "data-synx-edit": `${editKey}.${field}` } : {});
  return (
    <section className={paper ? "paper" : undefined} id={id}>
      <div className="wrap msection mfaq">
        <div className="mfaq-head">
          <SplitHeading text={title} className="mh2" edit={editKey ? `${editKey}.heading` : undefined} />
          {note && <p className="mfaq-note" {...at("note")}>{note}</p>}
        </div>
        <ol className="mfaq-list">
          {items.map((f, i) => (
            <Reveal as="li" key={i} delay={i * 0.04} className={`mfaq-item ${open === i ? "open" : ""}`}>
              <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
                <span className="mfaq-q" {...at(`items.${i}.q`)}>{f.q}</span>
                <i aria-hidden />
              </button>
              <div className="mfaq-a">
                <div>
                  <p {...at(`items.${i}.a`)}>{f.a}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

/**
 * The message that opens the FAQ: what Morph Space is, beyond an ordinary hosting provider. A full-width panel with a
 * picture behind it; the title's last sentence steps back in tone. `s` is the "gateway" section from the CMS.
 */
export function Gate({ s }: { s?: Sec }) {
  const title: string = s?.title || gateway.title;
  const body: string = s?.text || gateway.text;
  const tagline: string = s?.tagline || gateway.tagline;
  const lines = title.split(". ").map((t, i, all) => (i < all.length - 1 ? t + "." : t));
  const at = (field: string) => (s ? edit(s, field) : {});
  return (
    <section className="wrap gate" id="gateway">
      <div className="gate-card">
        <img
          className="gate-bg"
          src={mediaUrl(s?.image) || "/images/rooftop.jpg"}
          alt=""
          aria-hidden
          loading="lazy"
          decoding="async"
          {...(s ? { "data-synx-image": `${s._key}.image` } : {})}
        />
        <div className="gate-inner">
          <h2 className="gate-title" aria-label={title} {...at("title")}>
            {lines.map((l, i) => (
              <Reveal as="span" key={l} delay={i * 0.14} className={`gate-line ${i === lines.length - 1 ? "accent" : ""}`}>
                {l}
              </Reveal>
            ))}
          </h2>
          <Reveal delay={0.35} className="gate-side">
            <p {...at("text")}>{body}</p>
            <p className="gate-tagline" {...at("tagline")}>{tagline}</p>
            <div className="gate-actions">
              <a href={s?.buttonUrl || "/contact#register"} className="gbtn gbtn-light" {...at("buttonLabel")}>
                {s?.buttonLabel || gateway.buttonLabel}
              </a>
              <a href={s?.secondaryUrl || gateway.secondaryUrl} className="gbtn" {...at("secondaryLabel")}>
                {s?.secondaryLabel || gateway.secondaryLabel}
              </a>
            </div>
          </Reveal>
        </div>
        <span className="gate-horizon" aria-hidden />
      </div>
    </section>
  );
}

/** The FAQ note may end in "Send us a message"; those words become the link to the contact form. */
export const faqNote = (note?: string): ReactNode => {
  const link = "Send us a message";
  if (!note) return undefined;
  const at = note.indexOf(link);
  if (at < 0) return note;
  return (
    <>
      {note.slice(0, at)}
      <a href="/contact#register">{link}</a>
      {note.slice(at + link.length)}
    </>
  );
};

/** What every page ends with, before the call to action: the gateway message and the site FAQ (CMS sections of the same names mirror these). */
export const siteFaqDefaults: Sec[] = [
  { _key: "gateway", _type: "gateway", title: gateway.title, text: gateway.text, tagline: gateway.tagline, buttonLabel: gateway.buttonLabel, buttonUrl: "/contact#register", secondaryLabel: gateway.secondaryLabel, secondaryUrl: gateway.secondaryUrl },
  {
    _key: "faq", _type: "faq", heading: "Frequently asked questions", items: morphFaqs,
    note: "Can't find what you're looking for? Send us a message",
  },
];
