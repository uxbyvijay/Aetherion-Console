import Lenis from "lenis";

/**
 * Smooth scrolling for every page (Lenis). It drives the native scroll position, so Motion's useScroll and sticky
 * sections keep working. Off when the visitor prefers reduced motion; paused while the Ctrl K menu locks the page.
 */
export function startSmoothScroll() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const lenis = new Lenis({
    duration: 1.15,
    easing: (t) => 1 - Math.pow(1 - t, 4),
    anchors: { offset: -80 },
    // let inner scroll areas (menus, tables) scroll on their own
    prevent: (node) => !!node.closest(".cmdk, .table-scroll, [data-lenis-prevent]"),
  });

  // the command palette locks the page by adding .no-scroll to <html>
  const root = document.documentElement;
  new MutationObserver(() => (root.classList.contains("no-scroll") ? lenis.stop() : lenis.start())).observe(root, {
    attributes: true,
    attributeFilter: ["class"],
  });

  const raf = (time: number) => {
    lenis.raf(time);
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);
}
