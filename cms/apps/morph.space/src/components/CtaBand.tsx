import { edit, type Sec } from "../lib/cms";
import { Reveal } from "../lib/motion";

const DEFAULT_TEXT = "Pick a plan, claim your domain and publish your first Morphic Service. Start free and grow when you need to.";

/**
 * Closing call to action shared by the inner pages: a brand-purple band with a dot pattern.
 * `s` is the section from the CMS; its fields win over the props.
 */
export default function CtaBand({
  s,
  title = "Ready to give your idea a shape?",
  text = DEFAULT_TEXT,
  primary = { label: "Get started", href: "/contact#register" },
  secondary = { label: "See pricing", href: "/pricing" },
}: {
  s?: Sec;
  title?: string;
  text?: string;
  primary?: { label: string; href: string };
  secondary?: { label: string; href: string };
}) {
  const heading = s?.heading || title;
  const body = s ? s.text || text : text;
  const a = { label: s?.primaryLabel || primary.label, href: s?.primaryUrl || primary.href };
  const b = { label: s?.secondaryLabel || secondary.label, href: s?.secondaryUrl || secondary.href };
  const at = (field: string) => (s ? edit(s, field) : {});
  return (
    <section className="wrap rsec rsec--cta">
      <Reveal className="cta-band rcta">
        <span className="art rcta-art" aria-hidden />
        <div className="rcta-copy">
          <h2 {...at("heading")}>{heading}</h2>
          <p {...at("text")}>{body}</p>
        </div>
        <div className="cta-band-actions">
          <a href={a.href} className="gbtn gbtn-light" {...at("primaryLabel")}>{a.label}</a>
          <a href={b.href} className="gbtn gbtn-dark" {...at("secondaryLabel")}>{b.label}</a>
        </div>
      </Reveal>
    </section>
  );
}
