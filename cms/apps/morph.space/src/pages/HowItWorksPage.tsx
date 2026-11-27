import CtaBand from "../components/CtaBand";
import Faq, { faqNote, Gate, siteFaqDefaults } from "../components/Faq";
import { Scene } from "../components/Scene";
import { RollText } from "../components/Morph";
import { BigStatement, PinnedSteps, Reel, ScrollWords } from "../components/Cinema";
import { asWords, edit, mediaUrl, Sections, slugify, useSections, wordsOf, type Sec } from "../lib/cms";
import { creatorPath, missionIntro, storyChapters } from "../lib/content";

/** Pictures each block uses until the CMS gives its own (each photo is used once on the site). */
const IMG = { steps: "/images/steps.jpg", visitor: "/images/visitor.jpg", sensor: "/images/sensor.jpg", vault: "/images/vault.jpg" };
const reelImages = [IMG.sensor, IMG.vault];

const [visitors, ...rest] = storyChapters;

/** What the page shows when the CMS has nothing for it. The CMS "How it works" page mirrors these. */
const defaults: Sec[] = [
  {
    _key: "hero", _type: "page-hero", title: "Start with", words: asWords(["a sensor", "a dataset", "a model", "an idea"]),
    text: missionIntro[1], primaryLabel: "Get started", primaryUrl: "/contact#register", secondaryLabel: "See the steps", secondaryUrl: "#path",
  },
  { _key: "mission", _type: "scroll-words", text: missionIntro[0], light: true },
  { _key: "path", _type: "pinned-steps", heading: "Four steps from idea to live service", steps: creatorPath },
  { _key: "visitors", _type: "statement-media", heading: visitors.title, paragraphs: visitors.body.map((text) => ({ text })) },
  {
    _key: "story", _type: "reel",
    items: rest.map((c) => ({ heading: c.title, body: c.body.join("\n") })),
  },
  ...siteFaqDefaults,
  { _key: "cta", _type: "cta-band", heading: "Ready to give your idea a shape?" },
];

/** Full-screen city scene with the headline. */
function Hero({ s }: { s: Sec }) {
  return (
    <Scene video bgVideo={mediaUrl(s.backgroundVideo)} bgImage={mediaUrl(s.backgroundImage)} id="top" className="scene--hero">
      <h1 className="scene-title scene-title--hero fade-up" {...edit(s, "title")}>
        {s.title}
        <br />
        <RollText words={wordsOf(s.words, ["a sensor"])} />
      </h1>
      <p className="scene-sub fade-up" style={{ animationDelay: "0.3s" }} {...edit(s, "text")}>
        {s.text}
      </p>
      <div className="scene-actions fade-up" style={{ animationDelay: "0.45s" }}>
        <a href={s.primaryUrl || "/contact#register"} className="gbtn gbtn-light" {...edit(s, "primaryLabel")}>{s.primaryLabel || "Get started"}</a>
        <a href={s.secondaryUrl || "#path"} className="gbtn" {...edit(s, "secondaryLabel")}>{s.secondaryLabel || "See the steps"}</a>
      </div>
    </Scene>
  );
}

const paragraphsOf = (s: Sec): string[] => ((s.paragraphs ?? []) as { text?: string }[]).map((p) => p.text ?? "").filter(Boolean);

export default function HowItWorksPage() {
  const list = useSections(defaults);
  // each reel / statement block that has no picture of its own takes the next built-in one
  return (
    <main className="inner live">
      <Sections
        list={list}
        registry={{
          "page-hero": (s) => <Hero s={s} />,
          "scroll-words": (s) => <ScrollWords paper={!!s.light} id={s._key === "mission" ? "rtw" : undefined} text={s.text ?? ""} editKey={s._key} />,
          "pinned-steps": (s) => (
            <PinnedSteps
              id="path"
              title={s.heading ?? ""}
              dimFrom={3}
              steps={(s.steps?.length ? s.steps : creatorPath) as { title: string; text: string }[]}
              image={mediaUrl(s.image) || IMG.steps}
              editKey={s._key}
            />
          ),
          "statement-media": (s, nth) => (
            <BigStatement
              id={slugify(s.heading ?? "") || undefined}
              title={s.heading ?? ""}
              dimFrom={3}
              body={paragraphsOf(s)}
              image={mediaUrl(s.image) || (nth === 0 ? IMG.visitor : IMG.vault)}
              flip={!!s.flip}
              editKey={s._key}
            />
          ),
          reel: (s) => (
            <Reel
              id="story"
              editKey={s._key}
              items={((s.items ?? []) as { heading?: string; body?: string; image?: string }[]).map((c, i) => ({
                id: slugify(c.heading ?? "") || `panel-${i}`,
                title: c.heading ?? "",
                body: (c.body ?? "").split("\n").map((x) => x.trim()).filter(Boolean),
                image: mediaUrl(c.image) || reelImages[i % reelImages.length],
              }))}
            />
          ),
          // sections an older version of this page used: shown in the new look until the page is re-saved
          walkthrough: (s) => (
            <PinnedSteps id="path" title={s.heading ?? ""} dimFrom={3} steps={(s.steps?.length ? s.steps : creatorPath) as { title: string; text: string }[]} image={IMG.steps} editKey={s._key} />
          ),
          statement: (s) => <ScrollWords text={s.text || s.heading || ""} editKey={s._key} />,
          chapter: (s, nth) => (
            <BigStatement title={s.heading ?? ""} dimFrom={3} body={paragraphsOf(s)} image={reelImages[nth % reelImages.length]} flip={nth % 2 === 1} editKey={s._key} />
          ),
          gateway: (s) => <Gate s={s} />,
          faq: (s) => <Faq id="faq" title={s.heading} items={s.items ?? []} paper={!!s.light} note={faqNote(s.note)} editKey={s._key} />,
          "cta-band": (s) => <CtaBand s={s} />,
        }}
      />
    </main>
  );
}
