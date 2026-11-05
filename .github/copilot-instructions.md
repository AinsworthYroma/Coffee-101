# Coffee 101 — Coding assistant instructions

Read `docs/PROJECT_BRIEF.md` and `README.md` before proposing or implementing changes. The brief is the source of truth for the agreed product and design direction.

## Product constraints

- This is a personal birthday-gift coffee companion for a beginner, not an ecommerce site or professional cupping dashboard.
- All user-facing content, including accessibility labels and errors, must be natural French. Development discussion may be English.
- Prioritize iPad portrait/landscape and desktop; keep iPhone functional as a secondary target.
- Three connected pages: Préparer (landing), Explorer (globe), Déguster (guided tasting/notebook). The globe is not the homepage.
- The dad currently has an automatic bean-to-cup machine making espresso only. Make that the default preparation journey; other methods are secondary learning material. His exact machine model is unknown. Do not invent machine capabilities or model-specific instructions.

## Design constraints

Use Bauhaus-inspired geometry as the core language, topographic accents for origins, selective glassmorphism for navigation/globe controls, and at most one restrained liquid-morph signature transition. Keep reading and form surfaces solid or nearly opaque.

Do not add unrelated visual effects, shader backgrounds, mouse-following interactions, scroll-jacking, or perpetual decorative motion. Risograph/paper-cutout and other optional treatments are not approved requirements. Palette and typography still need final selection.

Support touch and keyboard with visible focus, clear labels, readable contrast, and no hover-only functionality. Respect reduced motion. Give origin content an accessible list and a non-3D fallback.

## Architecture and data

- No stack has been chosen. First propose the lean architecture and tradeoffs; wait for owner approval before scaffolding or installing dependencies.
- Do not introduce accounts, a backend, cloud sync, analytics, or unnecessary services by default.
- Keep educational content, provenance, gift configuration, and rendering logic separate.
- Persist tasting entries and unfinished drafts locally; clearly communicate device/browser limits and save failures.
- Include validated export/import with an explicit conflict policy. Never silently overwrite notes or drafts. Confirm destructive deletion.
- Do not invent personal details, geographic precision, sensory guarantees, or unsupported coffee guidance. Track sources and asset/data licenses.
- Use an original descriptor interface; do not copy proprietary flavor-wheel artwork.

## Workflow and validation

Inspect the repository first. Summarize the plan and consequential unknowns, then wait for implementation approval. After approval, work in reviewable stages and avoid unrelated edits.

Test touch/keyboard journeys, iPad portrait and landscape, desktop, secondary phone layouts, reduced motion, globe fallback, note CRUD, draft preservation, invalid imports, unavailable storage, and failed-save feedback.

Report what was changed, how it was validated, and any remaining limitations. Do not claim that tests passed or that features exist unless verified.
