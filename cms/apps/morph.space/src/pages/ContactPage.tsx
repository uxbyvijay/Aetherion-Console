import Register from "../sections/Register";
import Faq, { faqNote, Gate, siteFaqDefaults } from "../components/Faq";
import { RollText } from "../components/Morph";
import { Card, Panel } from "../components/Cards";
import LucideIcon from "../components/LucideIcon";
import { asWords, edit, mediaUrl, Sections, useSections, wordsOf, type Sec } from "../lib/cms";
import { communityLinks, contactTopics, type ContactTopic } from "../lib/content";
import { useHashScroll } from "../lib/motion";

/** What the page shows when the CMS has nothing for it. The CMS "Contact" page mirrors these. */
const defaults: Sec[] = [
  {
    _key: "form", _type: "contact-form", title: "Let's talk about", words: asWords(["your space", "your idea", "partnering", "the network"]),
    intro: "Ready to register, curious about a plan or keen to work with us? Pick a topic and the Synx team will reply by email.",
    topics: contactTopics.map(({ title, text, message }) => ({ title, text, message })),
    submitLabel: "Send message",
    links: [
      { title: "Plans and pricing", text: "Compare plans before you write", url: "/pricing" },
      ...communityLinks.map((l) => ({ title: l.title, text: l.text, url: l.href })),
    ],
  },
  {
    _key: "reach", _type: "link-cards", heading: "Before you write", light: true,
    cards: [
      { title: "Plans and pricing", text: "Compare plans and see what you'd pay, monthly or annually.", url: "/pricing", icon: "tag" },
      { title: "See how it works", text: "Follow the four steps from an idea to a live service.", url: "/how-it-works", icon: "play" },
    ],
  },
  ...siteFaqDefaults,
];

/**
 * Topics from the CMS give the name, blurb and message prompt. The extra form fields each topic asks for (company,
 * website, resume upload...) are part of the form's design, so they stay with the site, matched by topic name.
 */
const topicsFrom = (s: Sec): ContactTopic[] =>
  ((s.topics ?? []) as Partial<ContactTopic>[]).map((t, i) => {
    const built = contactTopics.find((c) => c.title === t.title) ?? contactTopics[i];
    return { title: t.title ?? "", text: t.text ?? "", message: t.message ?? "", fields: built?.fields ?? [] };
  });

/** Contact: the city scene with the headline on the left, the form as a console on the right. */
function Form({ s }: { s: Sec }) {
  return (
    <Register
      topics={topicsFrom(s)}
      title={
        <h1 className="scene-title contact-title fade-up" {...edit(s, "title")}>
          {s.title}
          <br />
          <RollText words={wordsOf(s.words, ["your space"])} />
        </h1>
      }
      intro={s.intro ?? ""}
      links={((s.links ?? []) as { title?: string; text?: string; url?: string }[]).map((l) => ({ title: l.title ?? "", text: l.text ?? "", href: l.url ?? "#", external: /^https?:/.test(l.url ?? "") }))}
      submitLabel={s.submitLabel || undefined}
      at={(field) => edit(s, field)}
      bgVideo={mediaUrl(s.backgroundVideo)}
      bgImage={mediaUrl(s.backgroundImage)}
    />
  );
}

/** Two or three big links to read before writing, on a light sheet. */
function LinkCards({ s }: { s: Sec }) {
  const cards: { title?: string; text?: string; url?: string; icon?: string }[] = s.cards ?? [];
  return (
    <Panel paper={!!s.light} id={s._key} title={s.heading || undefined} dimFrom={2} editKey={s._key}>
      <div className="rgrid rgrid--links">
        {cards.map((c, i) => (
          <a key={i} href={c.url || "#"} className="rlink">
            <Card
              delay={i * 0.06}
              icon={<LucideIcon name={c.icon} fallback="tag" size={22} strokeWidth={1.6} />}
              title={c.title ?? ""}
              text={c.text}
              at={(field) => edit(s, `cards.${i}.${field}`)}
            />
          </a>
        ))}
      </div>
    </Panel>
  );
}

export default function ContactPage() {
  useHashScroll();
  const list = useSections(defaults);
  return (
    <main className="inner live">
      <Sections
        list={list}
        registry={{
          "contact-form": (s) => <Form s={s} />,
          "link-cards": (s) => <LinkCards s={s} />,
          gateway: (s) => <Gate s={s} />,
          faq: (s) => <Faq id="faq" title={s.heading} items={s.items ?? []} paper={!!s.light} note={faqNote(s.note)} editKey={s._key} />,
        }}
      />
    </main>
  );
}
