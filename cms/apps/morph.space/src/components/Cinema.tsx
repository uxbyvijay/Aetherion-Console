import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  AnimatePresence,
  motion,
  useInView,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";
import { SplitHeading } from "../lib/motion";

/**
 * Cinematic, scroll-driven sections for the inner pages (Motion). Every one has a static fallback for visitors who
 * prefer reduced motion. Colour stays at one accent per section.
 *
 * `editKey` is the CMS section's key: with it, clicking a heading, text or picture in the CMS preview opens its field.
 */

const ease = [0.22, 1, 0.36, 1] as const;

/** Click-to-edit markers for a field of the CMS section (nothing on the live site, or without a key). */
const marks = (key?: string) => ({
  text: (field: string): Record<string, string> => (key ? { "data-synx-edit": `${key}.${field}` } : {}),
  image: (field: string): Record<string, string> => (key ? { "data-synx-image": `${key}.${field}` } : {}),
});

type Step = { title: string; text: string };

/** One bar of the step progress: fills while its step is on screen. */
function Bar({ progress, i, n, label, on }: { progress: MotionValue<number>; i: number; n: number; label: string; on: boolean }) {
  const fill = useTransform(progress, [i / n, (i + 1) / n], [0, 1], { clamp: true });
  return (
    <li className={`pin-bar ${on ? "on" : ""}`}>
      <span className="pin-bar-track">
        <motion.span className="pin-bar-fill" style={{ scaleX: fill }} />
      </span>
      <span className="pin-bar-label">{label}</span>
    </li>
  );
}

/** Steps pinned to a full-screen picture: it slowly pushes in while each step takes the screen in turn. */
export function PinnedSteps({
  id,
  title,
  dimFrom,
  steps,
  image,
  editKey,
}: {
  id?: string;
  title: string;
  dimFrom?: number;
  steps: Step[];
  image: string;
  editKey?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const scale = useTransform(scrollYProgress, [0, 1], [1.18, 1]);
  const [active, setActive] = useState(0);
  const n = steps.length;
  const m = marks(editKey);
  useMotionValueEvent(scrollYProgress, "change", (v) => setActive(Math.min(n - 1, Math.max(0, Math.floor(v * n * 0.999)))));

  if (reduce) {
    return (
      <section className="wrap rsec pin-static" id={id}>
        <SplitHeading text={title} className="lh2" dimFrom={dimFrom} edit={editKey ? `${editKey}.heading` : undefined} />
        <ol className="pin-static-list">
          {steps.map((s, i) => (
            <li key={i}>
              <h3 {...m.text(`steps.${i}.title`)}>{s.title}</h3>
              <p {...m.text(`steps.${i}.text`)}>{s.text}</p>
            </li>
          ))}
        </ol>
      </section>
    );
  }

  const at = Math.min(active, n - 1);
  const s = steps[at];
  return (
    <section className="pin" id={id} ref={ref} style={{ height: `${100 + n * 70}svh` }}>
      <div className="pin-stage">
        <motion.img className="pin-bg" src={image} alt="" aria-hidden style={{ scale }} {...m.image("image")} />
        <span className="pin-shade" aria-hidden />
        <div className="wrap pin-inner">
          <SplitHeading text={title} className="pin-head" dimFrom={dimFrom} edit={editKey ? `${editKey}.heading` : undefined} />
          <div className="pin-step" aria-live="polite">
            <AnimatePresence mode="wait">
              <motion.div
                key={s.title + at}
                initial={{ opacity: 0, y: 70, filter: "blur(10px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -50, filter: "blur(8px)" }}
                transition={{ duration: 0.6, ease }}
              >
                <h3 className="pin-title" {...m.text(`steps.${at}.title`)}>{s.title}</h3>
                <p className="pin-text" {...m.text(`steps.${at}.text`)}>{s.text}</p>
              </motion.div>
            </AnimatePresence>
          </div>
          <ol className="pin-bars">
            {steps.map((st, i) => (
              <Bar key={i} progress={scrollYProgress} i={i} n={n} label={st.title} on={i === at} />
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function Word({ progress, range, children }: { progress: MotionValue<number>; range: [number, number]; children: string }) {
  const opacity = useTransform(progress, range, [0.14, 1]);
  return (
    <motion.span className="sw-word" style={{ opacity }}>
      {children}{" "}
    </motion.span>
  );
}

/** A statement that lights up word by word as it scrolls through the screen. */
export function ScrollWords({ id, text, paper = false, editKey }: { id?: string; text: string; paper?: boolean; editKey?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.4"] });
  const words = text.split(" ");
  return (
    <section className={paper ? "paper sw-paper" : ""} id={id}>
      <div className="wrap sw">
        <p ref={ref} className="sw-text" {...marks(editKey).text("text")}>
          {reduce
            ? text
            : words.map((w, i) => (
                <Word key={i} progress={scrollYProgress} range={[i / words.length, (i + 1) / words.length]}>
                  {w}
                </Word>
              ))}
        </p>
      </div>
    </section>
  );
}

/**
 * A statement with its photo: image on one side, heading and text together on the other, read top to bottom.
 * The photo drifts slightly slower than the page.
 */
export function BigStatement({
  id,
  title,
  dimFrom,
  body,
  image,
  flip = false,
  editKey,
}: {
  id?: string;
  title: string;
  dimFrom?: number;
  body: string[];
  image: string;
  flip?: boolean;
  editKey?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-6%", "6%"]);
  const m = marks(editKey);
  return (
    <section className={`wrap big ${flip ? "big--flip" : ""}`} id={id} ref={ref}>
      <motion.div
        className="big-media"
        initial={{ opacity: 0, scale: 0.96 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, margin: "-10% 0px" }}
        transition={{ duration: 1, ease }}
      >
        <motion.img src={image} alt="" aria-hidden loading="lazy" decoding="async" style={{ y }} {...m.image("image")} />
      </motion.div>
      <div className="big-copy">
        <SplitHeading text={title} className="big-title" dimFrom={dimFrom} edit={editKey ? `${editKey}.heading` : undefined} />
        <motion.div
          className="big-body"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10% 0px" }}
          transition={{ duration: 0.8, ease, delay: 0.1 }}
        >
          {body.map((p, i) => (
            <p key={i} {...m.text(`paragraphs.${i}.text`)}>{p}</p>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

export type ReelItem = { id: string; title: string; body: string[]; image: string };

/** Chapters as a pinned horizontal reel: scrolling down slides the panels sideways, each with its own picture. */
export function Reel({ id, items, editKey }: { id?: string; items: ReelItem[]; editKey?: string }) {
  const ref = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [dist, setDist] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const x = useTransform(scrollYProgress, (v) => -v * dist);
  const bar = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const m = marks(editKey);

  useLayoutEffect(() => {
    if (reduce) return;
    const measure = () => setDist(Math.max(0, (track.current?.scrollWidth ?? 0) - window.innerWidth));
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [reduce, items.length]);

  const panels = items.map((c, i) => (
    <article key={c.id} id={c.id} className="reel-panel">
      <div className="reel-img" aria-hidden>
        <img src={c.image} alt="" loading="lazy" decoding="async" {...m.image(`items.${i}.image`)} />
      </div>
      <div className="reel-copy">
        <h3 className="reel-title" {...m.text(`items.${i}.title`)}>{c.title}</h3>
        {c.body.map((p, j) => (
          <p key={j} {...m.text(`items.${i}.body`)}>{p}</p>
        ))}
      </div>
    </article>
  ));

  if (reduce) {
    return (
      <section className="wrap rsec reel-static" id={id}>
        {panels}
      </section>
    );
  }

  return (
    <section className="reel" id={id} ref={ref} style={{ height: `calc(100svh + ${dist}px)` }}>
      <div className="reel-stage">
        <motion.div className="reel-track" ref={track} style={{ x }}>
          {panels}
        </motion.div>
        <div className="wrap reel-progress" aria-hidden>
          <motion.span style={{ scaleX: bar }} />
        </div>
      </div>
    </section>
  );
}

/** One feature row: lights up while it crosses the middle of the screen. */
function FeatureRow({ icon, title, text, editPath }: { icon: ReactNode; title: string; text: string; editPath?: (field: string) => Record<string, string> }) {
  const ref = useRef<HTMLLIElement>(null);
  const centred = useInView(ref, { margin: "-48% 0px -48% 0px" });
  return (
    <motion.li
      ref={ref}
      className={`frow ${centred ? "on" : ""}`}
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={{ duration: 0.8, ease }}
    >
      <span className="frow-icon" aria-hidden {...(editPath ? editPath("icon") : {})}>
        {icon}
      </span>
      <div>
        <h3 {...(editPath ? editPath("title") : {})}>{title}</h3>
        <p {...(editPath ? editPath("text") : {})}>{text}</p>
      </div>
    </motion.li>
  );
}

/** A big sticky heading beside large feature rows. */
export function StickyList({
  id,
  title,
  dimFrom,
  intro,
  items,
  editKey,
}: {
  id?: string;
  title: string;
  dimFrom?: number;
  intro?: string;
  items: { icon: ReactNode; title: string; text: string }[];
  editKey?: string;
}) {
  const m = marks(editKey);
  return (
    <section className="wrap slist" id={id}>
      <div className="slist-head">
        <SplitHeading text={title} className="slist-title" dimFrom={dimFrom} edit={editKey ? `${editKey}.heading` : undefined} />
        {intro && <p className="slist-intro" {...m.text("intro")}>{intro}</p>}
      </div>
      <ol className="slist-rows">
        {items.map((it, i) => (
          <FeatureRow key={i} {...it} editPath={editKey ? (field) => m.text(`items.${i}.${field}`) : undefined} />
        ))}
      </ol>
    </section>
  );
}
