# Coffee 101 — Coding assistant instructions

Read `docs/PROJECT_BRIEF.md` and `README.md` before proposing or implementing changes. The brief is the source of truth for the agreed product and design direction.

## Product constraints

- This is a personal birthday-gift coffee companion for a beginner, not an ecommerce site or professional cupping dashboard.
- All user-facing content, including accessibility labels and errors, must be natural French. Development discussion may be English.
- Prioritize iPad portrait/landscape and desktop; keep iPhone functional as a secondary target.
- Three connected pages: Préparer (landing), Explorer (globe), Déguster (guided tasting/notebook). The globe is not the homepage.
- The dad currently has an automatic bean-to-cup machine making espresso only. Make that the default preparation journey; other methods are secondary learning material. His exact machine model is unknown. Do not invent machine capabilities or model-specific instructions.
- Préparer uses a shared Three.js equipment selector retaining the adapted React Bits Circular Carousel's orbital intent, not a grid or category filters. Each equipment view opens one of four guides: automatic espresso, AeroPress, portafilter espresso, and filter coffee with electric/V60 modes. Provide transparent static fallbacks, accessible DOM controls, reduced motion and off-screen/hidden suspension. Keep adaptive recipe logic and sources separate from presentation; preserve choices and never silently overwrite a tasting draft.
- Recipe guides use the locally adapted React Bits Option Wheel for roast and Specular Buttons as an exclusive radio group for the desired profile. Keep them controlled by the recipe choices, accessible without animation or WebGL, and preserve the other choices when changing either setting.

## Design constraints

Use Bauhaus-inspired geometry as the core language, with warm fibrous kraft-paper reading surfaces, selective light labels and restrained glassmorphism for navigation/globe controls. A single persistent espresso-inspired React Bits Liquid Ether background and a stationary fine granular layer connect all three pages; shared React Bits Gooey Nav links them. Animate the fluid across all three pages and show it beneath translucent kraft on Explorer and Déguster. Keep reading and form surfaces solid or nearly opaque. Use espresso, roast, caramel, crema and kraft without decorative green; keep globe geography legible. The logo is a simple tilted coffee bean with a single curved groove and light/dark variants.

Do not add particle swarms, unrelated visual effects, mouse/touch-driven fluid forces, global pointer tracking, or scroll-jacking. The footer must provide a “Réduire les animations” background preference, persisted when local storage is available, without a floating background control. The background must also offer a static system reduced-motion state, textured WebGL fallback, off-screen/hidden suspension, and cleanup. Maintain broad caramel crema over time without resets or bursts; check it at prolonged intervals and after navigation and returning from a hidden tab. Risograph/paper-cutout and other optional treatments are not approved requirements. The current palette and typography remain subject to visual review.

Support touch and keyboard with visible focus, clear labels, readable contrast, and no hover-only functionality. Respect reduced motion. The real Three.js Earth supports dragging and slow continuous rotation, without a command bar or selection-based recentering. Resume rotation immediately after dragging unless reduced motion is active; suspend it off-screen or when hidden, clean up its resources, and provide a non-WebGL map. The footer's reduced-animation preference is the only user-facing pause. Keep an accessible origin list and do not invent unverified origin content.

## Architecture and data

- The approved foundation is Vite, React and TypeScript; use idb for future IndexedDB persistence, Vitest/Testing Library and Playwright for tests, and the existing Three.js globe. Static hosting is planned; seek approval for consequential stack or scope changes.
- Do not introduce accounts, a backend, cloud sync, analytics, or unnecessary services by default.
- Keep educational content, provenance, gift configuration, and rendering logic separate.
- Persist tasting entries and unfinished drafts locally; clearly communicate device/browser limits and save failures.
- Include validated export/import with an explicit conflict policy. Never silently overwrite notes or drafts. Confirm destructive deletion.
- Do not invent personal details, geographic precision, sensory guarantees, or unsupported coffee guidance. Track sources and asset/data licenses.
- Use an original descriptor interface; do not copy proprietary flavor-wheel artwork.

## Workflow and validation

Inspect the repository first. Work in reviewable stages and avoid unrelated edits; seek approval before consequential changes outside the approved direction.

Test touch/keyboard journeys, iPad portrait and landscape, desktop, secondary phone layouts, reduced motion, globe fallback, note CRUD, draft preservation, invalid imports, unavailable storage, and failed-save feedback.

Report what was changed, how it was validated, and any remaining limitations. Do not claim that tests passed or that features exist unless verified.
