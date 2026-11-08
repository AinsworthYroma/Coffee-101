# Coffee 101

A personal, French-language coffee companion, created as a birthday gift to accompany coffee beans. Designed primarily for iPad and desktop.

## The journey

1. **Préparer** — the landing page: make a satisfying coffee, starting with an automatic bean-to-cup machine that makes espresso only.
2. **Explorer** — discover coffee origins through an interactive Earth globe and an accessible origin list.
3. **Déguster** — learn to describe coffee gently and keep a personal tasting notebook.

## Project documents

- [Product and design brief](docs/PROJECT_BRIEF.md): requirements, visual direction, scope, and implementation sequence.
- [GitHub Copilot instructions](.github/copilot-instructions.md): repository-wide guidance for the coding assistant.

## Current status

Visual prototype built with Vite, React and TypeScript, with a local IndexedDB notebook and optional Supabase email/password authentication. Railway configuration is prepared for static hosting. Run `npm install` and `npm run dev` for development, or `npm run build` and `npm start` for a production build.

The agreed direction is a contemporary coffee atlas: Bauhaus-inspired geometry, a shared espresso-inspired Liquid Ether background, warm fibrous kraft-paper surfaces, an interactive Earth, and shared Gooey Nav navigation.

## Start here

Read the project brief and Copilot instructions before changing code. The owner approved the initial Vite, React and TypeScript foundation; continue in reviewable stages and seek approval for consequential scope or architecture changes.

Discussion and development documentation can be in English. Every user-facing part of the app must be in natural French.

## First visual preview

Requirements: Node.js and npm. Install with `npm install`, then run `npm run dev` and open the URL printed by Vite. Run `npm run build`, `npm test`, and `npm run test:e2e` for the available checks. Playwright requires its Chromium browser (`npx playwright install chromium`).

Alternatively, run `python3 launch.py` to start the development server and open it in a browser. Stop it with Ctrl+C.

## Railway production preparation

This repository is a Vite frontend, not an API. Railway can build the static `dist/` directory with Railpack and run the small Node HTTP server in [server.mjs](server.mjs). The server binds to `0.0.0.0`, serves the SPA and static assets, and exposes `GET /health` for Railway's health check. Unknown asset files return 404. The app's actual views use query strings such as `/?vue=explorer`; arbitrary paths receive the SPA shell but do not select a view. No Dockerfile or production Vite development server is used.

Local production check with Node 24 and npm:

```sh
npm ci
npm run build
npm run test:server
PORT=3000 npm start
```

Open `http://localhost:3000/?vue=explorer`; `http://localhost:3000/health` returns `ok`. `PORT` is optional at runtime locally (default `3000`); Railway supplies it at runtime. It is not secret and is not embedded in the frontend build. The server does not automatically load `.env` files.

For a future Railway service, set the repository root as the root directory, build command to `npm run build`, start command to `npm start`, healthcheck path to `/health`, and healthcheck timeout to 100 seconds in the service settings. Railpack detects Node 24 from `engines.node` and installs from the npm lockfile. The existing [railway.json](railway.json) contains those values for legacy services, but Railway has [deprecated Config as Code](https://docs.railway.com/config-as-code): new services cannot opt in and existing files stop working on December 1, 2026. Do not rely on that file for a new service. See Railway's [build and start commands](https://docs.railway.com/builds/build-and-start-commands) and [healthcheck documentation](https://docs.railway.com/deployments/healthchecks). Generate a Railway domain after reviewing the deployment, then check `/health`, the three query-string views, direct reloads and the images, fonts and equipment models. Railway environment variables are configured in the service's Variables settings; any future Vite `VITE_` variables are public and embedded at build time, not runtime. Use separate Railway services and separate Supabase projects for development, staging and production. Do not put secret keys in frontend variables, source files or logs.

The optional account uses Supabase Auth only. Notes and drafts remain in IndexedDB on the current device, with explicit JSON export/import; signing in does not upload, import, isolate or synchronize them. No database tables, policies or migrations have been created or applied. A private, recoverable remote notebook still needs RLS and conflict-safe synchronization. Do not assume Railway backs up browser data. The shared [.gitignore](.gitignore) excludes local `.env` files and build artifacts; `.env.example` contains no credentials.

Status: production server tested locally; Railway configuration prepared but not deployed; Supabase connectivity, migrations, data access and RLS have not been verified remotely.

GitHub Actions runs `npm ci`, the production build, unit tests and production-server tests on Node 24. Before a future deployment, export the local notebook as a backup and verify the service settings and public build variables. To roll back a deployment, redeploy the last known-good Railway deployment and recheck `/health`, assets and the three views; this does not restore browser data.

## Supabase account setup

The client targets project **Coffee-101** (`uatfivtdbizqljzljmgw`). Copy `.env.example` to `.env.local` and obtain that project's **publishable** key from its Supabase dashboard; never use a secret or `service_role` key in the browser. `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are public and embedded by Vite at **build time**. Set both in Railway Variables before building and redeploy after changing them. The client deliberately rejects missing keys, non-publishable keys and URLs outside this project; the local notebook remains usable without configuration.

For development, enable email/password and email confirmation in Supabase Auth. In [URL configuration](https://supabase.com/docs/guides/auth/redirect-urls), set the Site URL to the intended production origin and allow the exact callback URLs used by each environment. With the default local ports these are `http://localhost:5173/?auth=confirm`, `http://localhost:5173/?auth=recovery`, `http://localhost:3000/?auth=confirm` and `http://localhost:3000/?auth=recovery`; add the equivalent `127.0.0.1` URLs or other ports only when actually used. For production, allow `https://YOUR-RAILWAY-DOMAIN/?auth=confirm` and `https://YOUR-RAILWAY-DOMAIN/?auth=recovery`, replacing the placeholder with the reviewed domain. The app builds these destinations from its current origin and does not accept a user-supplied return URL. It uses the implicit email flow and expects the standard Supabase confirmation/recovery link to return tokens in the fragment; custom [email templates](https://supabase.com/docs/guides/auth/auth-email-templates) must preserve the confirmation URL and redirect. These URLs and settings have **not** been configured remotely.

Supabase's [default email service](https://supabase.com/docs/guides/auth/auth-smtp) is for testing: it only sends to authorized organization team addresses and is rate-limited (currently two messages per hour). Delivery to other users requires a separately configured custom SMTP sender, verified domain and appropriate SPF/DKIM/DMARC and rate limits. Check provider delivery, spam folders and link-scanning behavior before release. No email provider has been purchased or configured here. The automated auth tests mock Supabase responses; a recovery test also exercises the real SDK with a mocked HTTP response. Real sign-up, confirmation, reset and email delivery are unverified.

The SDK persists and refreshes the session in browser storage when available. This is a shared-device consideration: sign out after use. Authentication state is display state, not authorization; any future server data access must independently validate identity and enforce RLS. Authentication does not provide a backup of local notes.

Major headings use [Bricolage Grotesque](https://fonts.google.com/specimen/Bricolage+Grotesque), served locally from Google Fonts' Latin and Latin Extended WOFF2 subsets. The heading weights are 800 for the opening and 700 elsewhere, at optical size 72 and normal width. The [SIL Open Font License 1.1](public/fonts/OFL-Bricolage-Grotesque.txt) is retained with the font files. DM Sans remains the interface font and DM Serif Display remains the logo font; both are served by Google Fonts and licensed under the SIL Open Font License 1.1: [DM Sans](https://github.com/google/fonts/blob/main/ofl/dmsans/OFL.txt), [DM Serif Display](https://github.com/google/fonts/blob/main/ofl/dmserifdisplay/OFL.txt). These two fonts require a network connection; system fallback fonts are provided.

A single locally adapted [React Bits Liquid Ether](https://github.com/DavidHDev/react-bits/tree/4dc7b5b7772e1217c8fb8d2a7aa074302180e5b4/src/ts-default/Backgrounds/LiquidEther) background persists and animates across the three pages, visible through translucent kraft on Explorer and Déguster. It does not follow the pointer or intercept gestures. The footer's “Réduire les animations” preference stops the background and is remembered when local storage is available; system reduced motion also provides a still frame. A textured CSS fallback appears if WebGL is unavailable. The simulation stops when paused, off-screen or hidden, and its `resolution` and `maxDevicePixelRatio` can be adjusted in [CremaBackground](src/CremaBackground.tsx). The transparent canvas exposes stationary grain below it. A previous prolonged review still showed the crema's structure fading after 60–120 seconds; this remains a known limitation. Visual character and performance/battery use, including running the globe and background together, remain subject to review, especially on physical iPads.

The original grain image [grain.webp](public/grain.webp) and kraft fibre texture [kraft.webp](public/kraft.webp) are generated locally by [generate-grain.mjs](scripts/generate-grain.mjs) and [generate-kraft.mjs](scripts/generate-kraft.mjs), without third-party imagery or a third-party asset license. Regenerate either script with Node after installing Playwright's Chromium and its system dependencies.

Explorer renders a real Earth with [Three.js](https://github.com/mrdoob/three.js/blob/dev/LICENSE) (MIT), with adjustable pixel-ratio cap in [ExplorerGlobe](src/ExplorerGlobe.tsx). The map is drawn from [Natural Earth 1:110m Admin 0 countries](https://github.com/nvkelso/natural-earth-vector/blob/9380cca83db5f9aef52d5e762765100745f84b27/geojson/ne_110m_admin_0_countries.geojson), revision `9380cca83db5f9aef52d5e762765100745f84b27`. Natural Earth data is [public domain](https://www.naturalearthdata.com/about/terms-of-use/); attribution is appreciated but not required. The contours are simplified at this scale and are not an authoritative boundary source. The globe rotates slowly and can be dragged; rotation pauses for the footer's reduced-animation preference or system reduced motion, and while the globe is off-screen or the tab is hidden. A plane map remains available if WebGL fails.

Explorer presents three sourced regional introductions for South America, East Africa and Asia, with matching globe markers and accessible text controls. The markers are indicative regional anchors, rounded to the nearest degree near Belo Horizonte, Nairobi and Medan, not farms or geographic centroids; their reference city coordinates were checked using the [Open-Meteo geocoding API](https://open-meteo.com/en/docs/geocoding-api). Details and sources are maintained separately in [origins.ts](src/origins.ts). Altitudes and tasting descriptions are explicitly limited to cited study areas or lots, not continental averages or guarantees. Explorer links to a separate guide to coffee processing, with direct section links and cited studies. The guide remains under Explorer rather than adding a navigation tab; returning keeps the globe and selected region mounted and restores the atlas reading position where possible.

The regional photographs are hosted locally and cropped for display; each depicts a particular place, not a representative image of an entire region. Credits and license links also appear in the atlas:

| Photograph | Author and source | License |
| --- | --- | --- |
| Fazenda Da Lagoa, Minas Gerais, Brazil | [Knase](https://commons.wikimedia.org/wiki/File:Fazenda_Da_Lagoa.jpg) | [CC BY 3.0 DE](https://creativecommons.org/licenses/by/3.0/de/) |
| Coffee and banana cultivation, Uganda | [Kateregga1](https://commons.wikimedia.org/wiki/File:Coffee_and_banana_plantation_in_Uganda.jpg) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| Coffee plantation on Mount Gumitir, Indonesia | [Okkisafire](https://commons.wikimedia.org/wiki/File:Coffee_plantation_on_Gumitir.jpg) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |

Explorer's regional Spotlight surface and processing gallery are local adaptations of [React Bits Spotlight Card](https://github.com/DavidHDev/react-bits/tree/4dc7b5b7772e1217c8fb8d2a7aa074302180e5b4/src/ts-default/Components/SpotlightCard) and [Accordion Gallery](https://github.com/DavidHDev/react-bits/tree/4dc7b5b7772e1217c8fb8d2a7aa074302180e5b4/src/ts-default/Components/AccordionGallery), at the revision and license below. Upstream offers JavaScript or TypeScript, each with CSS or Tailwind variants. The TypeScript/CSS Spotlight uses React and browser APIs; the upstream gallery also uses GSAP. These adaptations replace the original effects and GSAP animation with scoped React/CSS behavior, accessible independent buttons and guide links, reduced-motion handling, and responsive layouts; neither GSAP nor Tailwind was added. The five schematic illustrations in [ProcessingGallery](src/ProcessingGallery.tsx) are original Coffee 101 artwork, not photographs or third-party assets. Their descriptions and guide sections use the existing sourced [processing data](src/processing.ts); fermentation is identified as a condition that can accompany different treatments. The decorative line uses the globe's projected marker coordinates and is hidden when behind the globe, on narrow layouts, or when reaching the marker would cross the globe's face. The selected region, gallery panel, globe and reading position are kept while visiting the guide.

Shared navigation uses the locally adapted [React Bits Gooey Nav](https://github.com/DavidHDev/react-bits/tree/4dc7b5b7772e1217c8fb8d2a7aa074302180e5b4/src/ts-default/Components/GooeyNav), with real links and browser history. The upstream TypeScript and CSS sources use React and browser WebGL2; no additional runtime dependency was required. Liquid Ether was modified to remove pointer input, seed a static composition, suspend and clean up rendering, handle WebGL failure, and tune the display shader's color conversion, opacity and highlights. Gooey Nav was adapted for controlled navigation, French labeling, WebGL fallback, cleanup and dynamic reduced-motion preferences.

These React Bits components come from revision `4dc7b5b7772e1217c8fb8d2a7aa074302180e5b4`, copyright 2026 David Haz, under **MIT + Commons Clause License Condition v1.0**, not standard MIT. The [full license](src/vendor/react-bits/LICENSE.md) permits use within an application but restricts selling, sublicensing or redistributing the components themselves, alone or bundled. Icons use [Lucide](https://github.com/lucide-icons/lucide/blob/main/LICENSE) (ISC).

## Préparation interactive

Le sélecteur conserve l'intention orbitale du [Circular Carousel React Bits](https://github.com/DavidHDev/react-bits/tree/4dc7b5b7772e1217c8fb8d2a7aa074302180e5b4/src/ts-default/Components/CircularCarousel), mais sa couche d'images DOM est remplacée par une scène Three.js partagée : objets isolés, rotation lente du seul objet central et navigation manuelle. Les quatre accès DOM restent disponibles si le module ne charge pas ; des rendus transparents des mêmes objets servent de secours sans WebGL. La scène s'arrête hors écran et lorsque l'onglet est masqué, respecte le mouvement réduit et libère ses ressources. Les transitions des fiches utilisent CSS sans nouvelle dépendance.

Les fiches utilisent une adaptation de [Option Wheel](https://github.com/DavidHDev/react-bits/tree/4dc7b5b7772e1217c8fb8d2a7aa074302180e5b4/src/ts-default/Components/OptionWheel) pour la torréfaction et [Specular Button](https://github.com/DavidHDev/react-bits/tree/4dc7b5b7772e1217c8fb8d2a7aa074302180e5b4/src/ts-default/Components/SpecularButton) pour le profil, de la même révision et sous la licence React Bits indiquée ci-dessus. La mécanique de la roue a été remplacée localement par une trajectoire circulaire DOM à pivot partagé, bornée et contrôlée, avec validation après recentrage ; les libellés restent droits. Le geste tactile sur la roue la fait tourner, tandis que le défilement normal reste disponible hors de celle-ci. Les boutons forment un groupe radio avec événements de reflet limités au bouton. Aucun paquet supplémentaire. Les reflets WebGL sont décoratifs ; les états restent lisibles sans WebGL et en mouvement réduit.

Les modèles locaux et leurs crédits sont également indiqués dans l'interface. Les GLB sont distribués sous CC BY 4.0 ; les rendus fixes sont produits à partir des mêmes modèles :

| Visuel | Auteur et source | Licence et modifications |
| --- | --- | --- |
| Machine automatique | [idehn_3d](https://sketchfab.com/3d-models/4e2f800066d64fee9a4129d6c3850992) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) ; éclairage, cadrage et matériau vert remplacé dans le rendu. Modèle générique, pas celui du destinataire. |
| AeroPress Original | Illustration procédurale originale Coffee 101 | Sans textures officielles ; proportions approximatives, modèle non destiné à la fabrication. |
| Porte-filtre | [keshavV20](https://sketchfab.com/3d-models/coffee-machine-3d-model-8178f0abb4214672961cc650cf880e9a) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) ; éclairage et cadrage adaptés. |
| Filtre électrique | [Fredrik Johansen](https://sketchfab.com/3d-models/coffee-maker-9ccda2fddba846e6ba97eb774b8a09c6) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) ; éclairage et cadrage adaptés. Représente la fiche filtre électrique / V60, pas un dripper V60. |

Les trois GLB pèsent environ 25 Mo au total (automatique 10,58 Mo, porte-filtre 10,90 Mo, filtre 4,14 Mo) ; les quatre secours PNG totalisent environ 332 Ko. Les ressources sont chargées à l'approche du sélecteur et selon les méthodes visibles. Sur Chromium en rendu logiciel, la scène initiale présente environ 244 000 triangles et 32 appels de dessin avec les trois objets visibles. Dans cet environnement, avec Liquid Ether actif, seulement cinq images ont été rendues en 5,6 secondes : la fluidité et la consommation restent à vérifier sur iPad réel. L'[étude](docs/ETUDE-SELECTEUR-3D.md) détaille les candidats et leurs limites.

Les valeurs sont des points de départ, pas des résultats garantis. Les variantes ci-dessous sont des propositions du projet inspirées des sources générales, et non des recettes validées par leurs auteurs. Les températures et changements selon la torréfaction restent des pistes à tester selon le café et le matériel.

| Méthode | Base et variantes | Sources et limites |
| --- | --- | --- |
| Automatique | Espresso par la commande habituelle ; aucune dose, température ou mouture imposée. | [SCA](https://sca.coffee/research/coffee-standards). Modèle inconnu : suivre sa notice ; les choix servent surtout à orienter la dégustation. |
| AeroPress | Original, montage classique et filtre papier ; 200 ml, 14 g rond ou 12 g expressif ; 90–96 °C selon torréfaction, 93 °C si inconnue. | [AeroPress](https://aeropress.com/pages/how-to-use). Variantes de dose et température proposées ici ; café filtré, pas un espresso. |
| Porte-filtre | Dose selon panier de 14 à 22 g ; masse en tasse environ 2 ou 2,2 fois la dose, 25–35 s indicatives. | [Barista Hustle](https://www.baristahustle.com/espresso-recipes-understanding-yield/). La torréfaction ne fixe pas de température sans connaître la machine ; ratio et temps à ajuster. |
| Filtre électrique | 250–750 ml, 65 g/l rond ou 60 g/l expressif, cycle de la machine. | [SCA](https://sca.coffee/research/coffee-standards). Vérifier le volume minimal et la capacité ; température non supposée réglable. |
| V60 manuel | Même plage d'eau et doses que le filtre ; mouillage puis versement progressif, 90–96 °C selon torréfaction, 93 °C si inconnue. | [SCA](https://sca.coffee/research/coffee-standards), [Hario](https://www.hario-usa.com/pages/recipes-and-guides). Vérifier la capacité du cône ; les variantes sont des points de départ. |

Le moteur déterministe est dans [recipes.ts](src/recipes.ts). Les réglages des fiches restent en mémoire pendant la navigation de la session. Une proposition transférée vers Déguster conserve ses paramètres, étapes et hypothèses ; les paramètres effectivement utilisés restent distincts. Un brouillon existant n'est pas écrasé par une nouvelle proposition.

Le carnet conserve brouillons et fiches dans IndexedDB sur le navigateur et l'appareil utilisés, sans synchronisation. L'ancien brouillon texte et le carnet provisoire sont migrés sans effacer les données d'origine. L'export JSON permet une sauvegarde ; l'import valide le fichier et, après confirmation, remplace le carnet entier, brouillons compris. Les erreurs de stockage sont signalées et les suppressions demandent confirmation. Utiliser un seul onglet pour modifier le carnet : la coordination entre onglets n'est pas encore assurée. La préférence d'animation utilise le stockage local lorsqu'il est disponible.

La roue utilise actuellement un vocabulaire original provisoire, pas la hiérarchie exhaustive de la roue de référence ; les droits nécessaires à une reproduction et traduction intégrales restent à vérifier. Les performances et gestes sur iPad réel restent à vérifier ; la structure du fond crema peut toujours s'atténuer après une longue durée. Personal details are isolated in `src/config/gift.ts` and intentionally left empty.
