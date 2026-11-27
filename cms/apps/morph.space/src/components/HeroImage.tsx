import { useEffect, useRef } from "react";

const CITY = "/images/city.jpg";

/**
 * The picture behind a hero. By default the sharp city photo; the CMS can give another picture, or a looping video
 * (muted and inline so it can autoplay, paused while off-screen, left on its first frame for people who prefer
 * reduced motion). A light grade and a soft shade on top keep the text readable.
 *
 * `video` and `image` come from the CMS: a video replaces the picture (the image shows until it plays).
 */
export default function HeroImage({ className = "", video, image }: { className?: string; video?: string; image?: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      v.addEventListener("loadeddata", () => v.pause(), { once: true });
      return;
    }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) v.play().catch(() => {});
      else v.pause();
    });
    io.observe(v);
    return () => io.disconnect();
  }, [video]);

  return (
    <div className={`hero-video hero-image ${className}`} aria-hidden>
      {video ? (
        <video ref={ref} src={video} muted loop playsInline autoPlay preload="auto" poster={image || CITY} />
      ) : (
        <img src={image || CITY} alt="" decoding="async" />
      )}
      <span className="hero-video-tint" />
      <span className="hero-video-shade" />
    </div>
  );
}
