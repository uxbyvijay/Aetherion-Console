import type { ReactNode } from "react";
import HeroImage from "./HeroImage";

/**
 * A full-screen scene. With `video`, the city picture fills it and the copy sits on top, set low and left like a
 * film title (or centered with `center`). The CMS can swap the picture or give a video (`bgImage`, `bgVideo`).
 */
export function Scene({
  id,
  video = false,
  center = false,
  short = false,
  bgVideo,
  bgImage,
  className = "",
  children,
}: {
  id?: string;
  video?: boolean;
  center?: boolean;
  short?: boolean;
  /** Background from the CMS (see HeroImage). */
  bgVideo?: string;
  bgImage?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={`scene ${video ? "scene--video" : ""} ${center ? "scene--center" : ""} ${short ? "scene--short" : ""} ${className}`}
    >
      {video && <HeroImage className="scene-video" video={bgVideo} image={bgImage} />}
      <div className="wrap scene-inner">{children}</div>
    </section>
  );
}
