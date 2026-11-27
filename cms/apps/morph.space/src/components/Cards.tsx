import type { ReactNode } from "react";
import { onSpotMove, Reveal, SplitHeading } from "../lib/motion";

/**
 * The inner pages' card language, matched to the home page: one rounded panel per section holding a grid of cards,
 * each card with a small icon tile. Accent words in headings keep the sunrise serif. `paper` sets the section on a
 * light sheet, so pages alternate light and dark.
 */
export function Panel({
  id,
  title,
  dimFrom,
  intro,
  paper = false,
  box = true,
  editKey,
  children,
}: {
  id?: string;
  title?: string;
  dimFrom?: number;
  intro?: ReactNode;
  paper?: boolean;
  /** false: no rounded panel around the content */
  box?: boolean;
  /** CMS section key, for click-to-edit in the CMS preview */
  editKey?: string;
  children: ReactNode;
}) {
  const body = (
    <div className={paper ? "wrap rsec rsheet" : box ? "panel-box rpanel" : ""}>
      {title && (
        <div className="rhead">
          <SplitHeading text={title} className="lh2" dimFrom={dimFrom} edit={editKey ? `${editKey}.heading` : undefined} />
          {intro && (
            <Reveal delay={0.1}>
              <p className="rhead-intro" {...(editKey ? { "data-synx-edit": `${editKey}.intro` } : {})}>{intro}</p>
            </Reveal>
          )}
        </div>
      )}
      {children}
    </div>
  );
  return paper ? (
    <section className="paper rpaper" id={id}>
      {body}
    </section>
  ) : (
    <section className="wrap rsec" id={id}>
      {body}
    </section>
  );
}

/** A card: icon tile, title and text. */
export function Card({
  icon,
  title,
  text,
  wide = false,
  delay = 0,
  at = () => ({}),
}: {
  icon?: ReactNode;
  title: string;
  text?: ReactNode;
  wide?: boolean;
  delay?: number;
  /** CMS edit markers for a field of this card, for click-to-edit in the CMS preview */
  at?: (field: string) => Record<string, string>;
}) {
  return (
    <Reveal delay={delay} className={`rcard-wrap ${wide ? "wide" : ""}`}>
      <article className="rcard" onPointerMove={onSpotMove}>
        <div className="rcard-copy">
          {icon && <span className="rcard-icon" {...at("icon")}>{icon}</span>}
          <h3 {...at("title")}>{title}</h3>
          {text && (typeof text === "string" ? <p {...at("text")}>{text}</p> : text)}
        </div>
      </article>
    </Reveal>
  );
}
