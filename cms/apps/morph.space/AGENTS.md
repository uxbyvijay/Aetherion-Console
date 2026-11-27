# Morph Space site

React + TypeScript + CSS, bundled with Vite. No Next.js, no Tailwind. Three libraries only: Motion (`motion/react`) for the scroll-driven sections, Lenis for smooth scrolling (`src/lib/smooth.ts`, started in `mountPage()`), Lucide (`lucide-react`) for icons. Every Motion section needs a reduced-motion fallback.

- Inner pages are cinematic: full-screen pinned sections in `src/components/Cinema.tsx` (PinnedSteps, ScrollWords, BigStatement, Reel, StickyList). Headings use one typeface; accent words only step back in tone (no gradient serif mid-sentence). Colour is kept for the hero's rolling word. No fake product UI, no step numbers. Each photo in `public/images/` is used once; `city.jpg` belongs to the heroes only.
- The palette is neutral greys; brand purple (`--brand`) is only for primary actions and selected states (Register now, billing toggle, selected plan, Most popular badge) and the call-to-action band. No purple text tints, borders, glows or backgrounds elsewhere. The nav has no Ctrl K button (the shortcut still opens the palette).
- Five pages, each an HTML entry listed in `vite.config.ts`: `index.html` → `src/main.tsx` (home), `pricing.html`, `how-it-works.html`, `features.html` and `contact.html`, each loading `src/<slug>.tsx`.
- Every entry calls `mountPage()` from `src/lib/mount.tsx`, which loads the page from the CMS, then wraps it in the nav, footer and Ctrl K palette.
- Page bodies are in `src/home/`, `src/pricing/` and `src/pages/` (How it works, Features, Contact). Reusable sections (Register form, icons) are in `src/sections/`.
- **CMS:** every page is a list of sections from the Aetherion Console (`src/lib/cms.tsx`). Each page file has a `defaults` list (the text that ships with the site, mirrored by `apps/api/seed/morph-seed.ts`) and a `registry` that maps a section type to the component that draws it. Put `{...edit(s, "field")}` (or the `editKey` prop on the Cinema blocks) on anything an editor should be able to click in Live preview. Add a section type in `apps/api/seed/morph-schema.ts` too, and run `npm run seed:morph -w apps/api -- --dry` to check.
- All styles live in `src/styles.css` (tokens at the top).
- Copy, plans and prices live in `src/lib/content.ts`; price maths and the currency picker's rates in `src/lib/pricing.ts`. Animation helpers are in `src/lib/motion.tsx`.
- `npm run dev` to develop (port 5180), `npm run build` to typecheck and build into `dist/`. Local only here; the live site is the separate morph-ui-designs project on Vercel.
