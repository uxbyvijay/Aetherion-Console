import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ContactForm } from "@/components/ContactForm";
import { edit, type Sec } from "@/lib/cms";

/** A new line breaks the title; a word between stars is set in italic. */
function Title({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => (
        <span key={i} className="block">
          {line.split(/(\*[^*]+\*)/).map((part, j) => (part.startsWith("*") && part.endsWith("*") && part.length > 2 ? <em key={j} className="italic">{part.slice(1, -1)}</em> : part))}
        </span>
      ))}
    </>
  );
}

/** Same layout as the live site's homepage hero (copy over a full-bleed picture); the words and the picture come from the CMS. */
function Hero({ s }: { s: Sec }) {
  return (
    <section className="hero-home">
      <div className="hero-home-copy">
        <p className="hero-home-kicker">{s.kicker}</p>
        <h1 {...edit("title", s._key)}>
          <Title text={s.title ?? ""} />
        </h1>
        <p className="hero-home-lede" {...edit("lede", s._key)}>{s.lede}</p>
        {s.ctaUrl ? (
          <Link href={s.ctaUrl} className="hero-home-cta">
            {s.ctaLabel}
          </Link>
        ) : null}
      </div>
      <div className="hero-home-media">
        {s.image ? <Image src={s.image} alt={s.imageAlt ?? ""} fill priority sizes="100vw" className="hero-home-img" /> : null}
        <div className="hero-home-shade" />
      </div>
    </section>
  );
}

function ContactIntro({ s }: { s: Sec }) {
  return (
    <>
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--accent)]">{s.kicker}</p>
      <h1 className="font-serif mt-3 text-[2rem] leading-tight tracking-tight text-[var(--ink)] md:text-[2.6rem]" {...edit("title", s._key)}>{s.title}</h1>
      <p className="mt-4 max-w-[36rem] text-[16px] leading-7 text-[var(--muted)]" {...edit("lede", s._key)}>{s.lede}</p>
    </>
  );
}

function UnderRevision({ s }: { s: Sec }) {
  return (
    <section className="flex min-h-[calc(100dvh-3.5rem-env(safe-area-inset-top))] items-center justify-center bg-[var(--bg)] px-6">
      <div className="w-full max-w-[920px] text-center">
        <p className="font-mono text-[11px] tracking-[0.22em] text-[var(--accent)]">{s.kicker}</p>
        <h1 className="font-serif mt-6 text-[clamp(3.5rem,14vw,8.5rem)] leading-[0.9] tracking-[-0.04em] text-[var(--ink)]" {...edit("title", s._key)}>{s.title}</h1>
        <p className="mx-auto mt-8 max-w-[24rem] text-[16px] leading-relaxed text-[var(--muted)] sm:text-[18px]">{s.text}</p>
      </div>
    </section>
  );
}

/** The designed pages (home, contact, under the hood): their sections in order. */
export function renderSections(sections: Sec[], kind: "home" | "contact" | "hood"): ReactNode {
  const parts = sections.map((s) => {
    switch (s._type) {
      case "landing-hero": return <div key={s._key} data-synx-key={s._key}><Hero s={s} /></div>;
      case "under-revision": return <div key={s._key} data-synx-key={s._key}><UnderRevision s={s} /></div>;
      case "page-intro": return <div key={s._key} data-synx-key={s._key}><ContactIntro s={s} /></div>;
      case "contact-form": return <div key={s._key} data-synx-key={s._key}><ContactForm /></div>;
      default: return null;
    }
  });
  if (kind === "contact") return <main className="mx-auto max-w-[720px] px-4 py-12 sm:py-16 md:px-6">{parts}</main>;
  return <main className="bg-[var(--bg)] text-[var(--text)]">{parts}</main>;
}


