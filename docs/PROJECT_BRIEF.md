# Coffee 101 — Product and design brief

## 1. Purpose and audience

Create a thoughtful, visually distinctive website/web app for the owner's dad, accompanying coffee beans given for his birthday. He is a coffee beginner, particularly when it comes to tasting vocabulary and describing his preferences. The app should feel like a personal companion, not an encyclopedia, shop, professional scoring tool, or generic dashboard.

His current equipment is an automatic bean-to-cup machine that makes espresso only. The exact model is unknown. Do not assume access to manual espresso controls or prescribe model-specific maintenance, grinder adjustments, or settings without verified manufacturer guidance.

All user-facing content must be natural French, including navigation, instructions, fields, placeholders, validation, confirmations, empty states, and accessibility labels. Project discussion and code documentation may be in English.

## 2. Devices and interaction

- Primary: iPad in landscape and portrait, plus desktop/laptop.
- Secondary: iPhone; maintain a functional, readable layout without allowing narrow-screen design to dictate the larger-screen experience.
- All interactions must work with touch and keyboard, not only a mouse.
- No hover-only content or essential hover interactions.
- Use comfortable touch targets, visible focus, clear labels, and readable type.
- Keep forms usable with the iPad on-screen keyboard open.
- Respect reduced-motion preferences; nonessential effects must not be necessary to understand or use the app.
- Use one persistent autonomous Liquid Ether background animated across the three pages, visible through translucent warm kraft on Explorer and Déguster, with a separate stationary granular layer and more opaque reading and form surfaces. Do not use mouse/touch-driven fluid forces or global pointer tracking. Provide a footer display preference to reduce background animations, remembered when local storage is available, plus a static system reduced-motion state, textured WebGL fallback, suspension off-screen or when hidden, and cleanup. Do not use a floating background pause control or scroll-jacking.

## 3. Information architecture

Three connected pages: Préparer → Explorer → Déguster. These are working French labels. The globe belongs on the second page, never as the landing page.

### Page 1: Préparer

The landing page welcomes the user, optionally includes a birthday dedication, and clearly explains the three-part journey. Primary action: Préparer mon café. Secondary links: Explorer les origines and Noter ma dégustation.

The main method selector retains the adapted React Bits Circular Carousel's orbital intent, replacing its image layer with one shared Three.js scene of isolated equipment. Present exactly four unique methods, with the automatic bean-to-cup machine first. Rotate only the central object slowly; do not autoplay method selection. A deliberate tap or click opens the corresponding detailed guide; provide previous/next controls, keyboard access and transparent static renders for WebGL fallback. Preserve selection, scroll and focus when returning from a guide. Stop rendering when hidden or off-screen and respect reduced motion.

Content should cover choosing beans, storage/freshness, water, available machine adjustments where supported, a simple preparation sequence, and understanding the resulting cup. Separate generally applicable guidance from model-dependent instructions. Never apply a manual espresso recipe as though an automatic machine exposes the same controls.

Provide four approachable guides: automatic bean-to-cup espresso, AeroPress, espresso with a portafilter, and filter coffee with distinct electric-machine and manual V60 modes. Each guide adapts its starting recipe to roast and desired profile where supported, explains its assumptions and sources, and offers a tasting proposal without silently replacing an existing draft. Unknown equipment settings must not be presented as adjustable controls.

Use the locally adapted React Bits Option Wheel for roast and two Specular Buttons as an exclusive profile radio group. Both reflect the existing recipe choices, work with keyboard and touch, and remain understandable without motion or WebGL. Preserve the remaining settings when either choice changes.

Each guide should explain equipment, the principle of the method, relevant grind guidance, a sourced starting recipe where appropriate, steps, adjustable variables, and common problems. Offer optional detail rather than long compulsory reading. Use dose/water calculators only for methods where they make sense; do not impose one universal calculator. Recipes are starting points, not guarantees or universal rules.

Explain basics in plain French: whole beans versus ground coffee, freshness and storage, water, roast, grind size, dose, water quantity, and extraction. Explain jargon inline and keep deeper material optional.

### Page 2: Explorer

The interactive Earth globe is the signature exploratory experience, not a decorative object. Support touch and desktop dragging, with slow continuous rotation that resumes immediately on release. The footer's reduced-animation preference is the only user-facing pause, alongside system reduced motion; suspend rotation during dragging, off-screen and while hidden. Selecting a region must not recenter or pause the globe. Do not add a globe command bar. Prevent the globe from trapping ordinary page navigation. The current atlas contains three sourced regional introductions and indicative markers; do not invent further origins or geographic precision.

Provide a searchable/selectable origin list and a usable non-3D fallback, both exposing the same educational content. A user must never need to manipulate the globe to find an origin.

Use a regional Spotlight panel, globe and introduction/region controls in three columns on desktop and landscape iPad. Before selection, show a compact invitation; keep essential sourced details visible on selection. Adapt coherently for portrait iPad. A decorative connector follows the actual visible projected marker only when it can be drawn without crossing the globe or text. Keep controls, geographic highlights, and text distinct and legible. Keep automatic rotation slow and unobtrusive.

Start with a manageable curated selection, potentially Ethiopia, Kenya, Colombia, Brazil, Guatemala, Costa Rica, Peru, Indonesia, India, and Vietnam. This is a proposed seed list, not exhaustive coverage. Verify content and geographic data before publication. Distinguish countries from producing regions; never invent regional coordinates or precision.

Origin details should include country/region where known, a short introduction, relevant growing conditions, varieties/species and processing where supported, qualified possible sensory tendencies, and an action to start a tasting with that origin preselected. Explain the coffee-growing belt, arabica/robusta, washed/natural/honey processing, and the distinction between origin, process, and roast in optional beginner-friendly sections.

Keep the atlas concise. Below it, an accessible visual accordion introduces washed, natural, honey/pulped natural, wet-hulled and fermentation conditions, distinguishing fermentation from processing types. Detailed explanations belong in a separate accessible guide reached from Explorer, not a fourth main navigation tab. Direct links open the relevant section; returning preserves the atlas, gallery panel, reading position and globe state. Preparation guides and recipes remain in Préparer.

Never imply that every coffee from a country has the same taste. Explain that the specific region, variety, processing, roast, and preparation affect the cup. Use topographic contours as decoration unless actual elevation data supports the visualization.

### Page 3: Déguster

Create a reassuring guided tasting flow and a personal notebook, not a competition cupping form. Users should be able to skip nonessential fields and choose Je ne sais pas.

Suggested steps:
1. Identify the coffee: name, roaster, origin if known, date, preparation method, and optional recipe details.
2. Smell: gentle prompts such as Que sens-tu avant de goûter ? and Cela te rappelle-t-il quelque chose ?
3. Taste: accessible descriptions of acidity, bitterness, perceived sweetness, body/texture, and finish. Distinguish acidity from bitterness and perceived sweetness from added sugar.
4. Describe: start with broad families such as Fruité, Floral, Chocolaté / cacao, Fruits à coque, Caramélisé, Épicé, and Grillé; allow optional refinement, Autre, Je ne sais pas, and free text. Use an original interface rather than reproducing a proprietary flavor-wheel graphic.
5. Personal appreciation: Est-ce que ce café te plaît ?, Aurais-tu envie d'en reprendre ?, and an optional simple personal rating. Preference is separate from technical description.
6. Notes: impressions, what to change next time, and personal associations.
7. Save and revisit: readable entry summaries, reopen/edit/delete, visible saving status, and confirmation before destructive deletion.

Labels must accompany flavor symbols. Do not require users to identify every aroma or use expert language.

## 4. Connected journeys and persistence

- From a preparation guide, start a tasting with the method preselected.
- From an origin, start a tasting with the origin preselected.
- Saved entries link back to the related method and origin where available.
- Preserve unfinished tasting drafts across page navigation; do not silently overwrite drafts when following a new prefilled link.
- No account or backend is required for the initial version.
- Persist notes locally and explain in French that notes are browser/device-specific and do not automatically sync.
- Include export/import for backup and transfer, with validation and an explicit conflict/overwrite policy.
- Handle unavailable storage, invalid imported data, and failed saves without falsely claiming success.
- Keep educational content, personal configuration, and UI components separate.

## 5. Personal gift configuration

Provide an easy-to-edit configuration/content file for the dad's first name, an optional birthday dedication, and the actual gifted coffees. These details are not yet known. Use clearly marked placeholders in development and graceful omission in the UI; never invent names, birthday dates, coffee labels, or personal facts.

## 6. Agreed art direction: a contemporary coffee atlas

Aim for a coherent, editorial, tactile experience with precise digital touches. Avoid a generic brown coffee template, ecommerce styling, rigid dashboard grids, excessive cards/borders, tiny text, and visual effects without purpose.

### Core techniques

1. Bauhaus-inspired geometry: the main visual language. Use deliberate circles, semicircles, lines, and abstract cup/bean forms to support page composition, illustrations, and labeled flavor categories. Do not scatter unrelated shapes as filler.
2. Topographic lines: supporting motif for origins, regional illustrations, and restrained globe-adjacent decoration. Do not cover the globe with distracting patterns or imply false terrain data.
3. Warm kraft-paper surfaces: muted tan and ochre, fine stationary fibres and gentle tonal variation, with lighter label surfaces selectively for reading. Pair these with espresso and crema, and keep text and controls crisp. Restrained glassmorphism can be used for navigation and selected globe controls. Test text contrast against every underlying state.
4. Liquid Ether: a single persistent espresso/crema-inspired background replaces the earlier bean swarm and connects all three pages. Animate it autonomously throughout, beneath translucent kraft on Explorer and Déguster. Retain broad golden caramel crema over time without resets or bursts. A fine, dense, stationary granular layer sits beneath the fluid and also textures the reading surfaces, with a shared intensity token. Shared Gooey Nav provides the navigation transition. Reading and form surfaces remain solid or nearly opaque. Supply static reduced-motion and textured WebGL alternatives, and no pointer-driven fluid interaction. Review the initial state, prolonged states and returns from navigation and a hidden tab.

The palette pairs warm kraft, espresso near-black, roasted brown, caramel, crema and light labels, without decorative green. Keep the globe's ocean and land distinct and legible. Preserve Bricolage Grotesque headings and readable body typography. The logo uses a simple tilted coffee-bean silhouette with one curved groove and light/dark variants.

### Optional, not committed

Risograph OR paper-cutout illustration can be explored as one coherent supporting treatment. They are alternatives, not an instruction to stack both. Clay 3D would be an alternative illustration direction. A small holographic birthday detail or a brief introductory title reveal could be considered only if it strengthens the composition.

Do not add ASCII art, pixel art, neon glow, particle swarms, glitches, vaporwave grids, ray-marched fractals, dithering, or unrelated effects simply to demonstrate effects. The globe remains the main interactive visual feature. Do not turn the app into a shader showcase.

## 7. Content and asset integrity

Use reputable references for educational claims and recipes; maintain a source record alongside content. Verify consequential or machine-specific guidance with appropriate authoritative/manufacturer material. Track dataset and asset provenance, licenses, and required attribution. Do not copy proprietary graphics or imply official certification.

No invented regional facts, exact coordinates, sensory promises, or placeholder content presented as researched material. Favor a small verified dataset over broad unreliable coverage.

## 8. Scope and implementation sequence

The owner approved Vite, React and TypeScript, local IndexedDB through idb when persistence is implemented, Vitest/Testing Library, Playwright, a Three.js Earth globe, and static hosting. The current foundation has an interactive globe and three sourced regional introductions but is not the completed MVP. Keep future changes in reviewable stages and obtain approval for consequential scope or architecture changes.

Implementation stages:
1. Design tokens, navigation, accessible layouts, and French content structure.
2. Automatic-machine-first preparation page and secondary brewing guides.
3. Tasting flow, draft persistence, notebook CRUD, and validated export/import.
4. Curated origin content, accessible list, interactive globe, and non-3D fallback.
5. Connect all journeys, integrate gift configuration, and add restrained visual polish.
6. Validate iPad portrait/landscape, desktop, secondary phone layouts, keyboard/touch, reduced motion, text contrast, storage failures, imports, and draft preservation.

The MVP includes all three pages, a real interactive globe with accessible fallback, machine-first preparation, a usable tasting notebook, local persistence, and export/import. Optional later work includes cloud sync, accounts, advanced tasting comparisons, broader origin coverage, and decorative enhancements. Do not add these to the MVP by default.

## 9. Open decisions

- Exact automatic-machine model.
- Dad's name, birthday message, and gifted coffee details.
- Final palette, typography, and whether any optional illustration texture is used.
- Globe/data sources, asset licenses, and specific deployment target.

Unknown personal details should not block planning; isolate them in configuration. Unknown machine capabilities must not become invented advice.

## 10. Acceptance criteria

The dad can immediately find a guide relevant to his current machine, discover other preparation methods without being overwhelmed, explore origins with or without 3D, describe a cup without expert vocabulary, save and revisit notes, and back them up. All main journeys work on iPad without a mouse. All user-facing text is French. The design feels unified, readable, personal, and deliberate rather than effect-heavy.
