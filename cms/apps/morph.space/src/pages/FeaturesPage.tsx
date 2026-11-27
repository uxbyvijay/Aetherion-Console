import CtaBand from "../components/CtaBand";
import Faq, { faqNote, Gate, siteFaqDefaults } from "../components/Faq";
import { Scene } from "../components/Scene";
import { RollText } from "../components/Morph";
import { StickyList } from "../components/Cinema";
import LucideIcon from "../components/LucideIcon";
import { asWords, edit, mediaUrl, Sections, useSections, wordsOf, type Sec } from "../lib/cms";
import { featureList, ownership as ownershipPoints } from "../lib/content";
import { Reveal, SplitHeading } from "../lib/motion";

/** The icon each built-in feature shows, in order. The CMS picks one by name. */
const featureIcons = ["globe", "blocks", "workflow", "waypoints", "link", "bot"];

/** What the page shows when the CMS has nothing for it. The CMS "Features" page mirrors these. */
const defaults: Sec[] = [
  {
    _key: "hero", _type: "page-hero", title: "Everything your service needs to", words: asWords(["get found", "stay yours", "connect", "grow"]),
    text: "A domain of your own, the Synx developer tools and a network where people, AI agents and machines can use what you build.",
    primaryLabel: "Get started", primaryUrl: "/contact#register", secondaryLabel: "See the features", secondaryUrl: "#features",
  },
  {
    _key: "tour", _type: "feature-list", heading: "Everything to publish on the Real Time Web", intro: "Six things every Morph Space gives you from day one.",
    items: featureList.map((f, i) => ({ title: f.title, text: f.text, icon: featureIcons[i] })),
  },
  { _key: "own", _type: "ownership", heading: "More than a private server", items: ownershipPoints },
  ...siteFaqDefaults,
  { _key: "cta", _type: "cta-band", heading: "Your first service is closer than you think" },
];

/** Full-screen city scene with the headline, like the other pages. */
function Hero({ s }: { s: Sec }) {
  return (
    <Scene video bgVideo={mediaUrl(s.backgroundVideo)} bgImage={mediaUrl(s.backgroundImage)} id="top" className="scene--hero">
      <h1 className="scene-title scene-title--hero fade-up" {...edit(s, "title")}>
        {s.title}
        <br />
        <RollText words={wordsOf(s.words, ["get found"])} />
      </h1>
      <p className="scene-sub fade-up" style={{ animationDelay: "0.3s" }} {...edit(s, "text")}>
        {s.text}
      </p>
      <div className="scene-actions fade-up" style={{ animationDelay: "0.45s" }}>
        <a href={s.primaryUrl || "/contact#register"} className="gbtn gbtn-light" {...edit(s, "primaryLabel")}>{s.primaryLabel || "Get started"}</a>
        <a href={s.secondaryUrl || "#features"} className="gbtn" {...edit(s, "secondaryLabel")}>{s.secondaryLabel || "See the features"}</a>
      </div>
    </Scene>
  );
}

/** Features: a big sticky heading beside large rows, each lighting up as it crosses the middle of the screen. */
function Tour({ s }: { s: Sec }) {
  const items: { title?: string; text?: string; icon?: string }[] = s.items ?? [];
  return (
    <StickyList
      id="features"
      title={s.heading ?? ""}
      dimFrom={3}
      intro={s.intro || undefined}
      editKey={s._key}
      items={items.map((f, i) => ({
        icon: <LucideIcon name={f.icon} fallback={featureIcons[i % featureIcons.length]} size={30} strokeWidth={1.5} />,
        title: f.title ?? "",
        text: f.text ?? "",
      }))}
    />
  );
}

/** Ownership as one big statement on a light sheet. */
function Ownership({ s }: { s: Sec }) {
  const items: { stat?: string; title?: string; text?: string }[] = s.items ?? [];
  return (
    <section className="paper" id="ownership">
      <div className="wrap lsection own">
        <SplitHeading text={s.heading ?? ""} className="lh2" dimFrom={3} edit={`${s._key}.heading`} />
        <div className="own-grid">
          {items.map((o, i) => (
            <Reveal key={i} delay={i * 0.08} className="own-item">
              <span className="own-stat" {...edit(s, `items.${i}.stat`)}>{o.stat}</span>
              <b {...edit(s, `items.${i}.title`)}>{o.title}</b>
              <p {...edit(s, `items.${i}.text`)}>{o.text}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function FeaturesPage() {
  const list = useSections(defaults);
  return (
    <main className="inner live">
      <Sections
        list={list}
        registry={{
          "page-hero": (s) => <Hero s={s} />,
          "feature-list": (s) => <Tour s={s} />,
          "feature-tour": (s) => <Tour s={s} />, // the name an older version of this page used
          ownership: (s) => <Ownership s={s} />,
          gateway: (s) => <Gate s={s} />,
          faq: (s) => <Faq id="faq" title={s.heading} items={s.items ?? []} paper={!!s.light} note={faqNote(s.note)} editKey={s._key} />,
          "cta-band": (s) => <CtaBand s={s} />,
        }}
      />
    </main>
  );
}
