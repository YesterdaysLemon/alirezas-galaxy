# Project solar systems

The original five-arm galaxy remains the home view. Its family stars lead to **Patterns & Life**, **Curiosity & Play**, and **Tools & Infrastructure**, using the same Three.js scene, camera, renderer and animation loop. The portfolio remains a direct homeworld. Changes are local until publication is explicitly authorized.

## The journey

- Enter a family star. The camera continuously zooms through dust in the existing canvas; there is no separate main-menu gateway or system page load. Open the **Systems** chart to change systems without returning to the galaxy.
- Hover a planet or its instrument-strip button for the original portrait/name/domain preview without navigating. Click the card, planet, or strip button to approach it. Left/right arrows select neighboring worlds.
- Drag to orbit the view. Scroll, pinch, or use the +/− controls to zoom.
- Use **Visit** to open the real project website in a new tab. The uninhabited Nacre has no launch link.
- Escape closes an open system chart first; otherwise it returns from a planet to its system, then to the galaxy. The Galaxy button returns directly. Browser Back/Forward restores both system and planet selections.
- Orbital positions hold while hovering or inspecting a planet so the attached card, controls and composition remain stable. Surface rotation continues until paused. The pause control freezes ambient scene motion; reduced motion skips camera animation once the real system resources are ready.
- Share `/#system/patterns-and-life` or `/#system/patterns-and-life/plato`. Unknown or malformed system/planet addresses return safely to the galaxy.

The galaxy's camera position, orientation and visibility are saved on entry and restored on return, including after switching systems or cancelling an entry. Patterns & Life has five project worlds plus Nacre, five moons and two asteroid belts. Curiosity & Play has six projects; Tools & Infrastructure has three. The system chart exposes populated companion systems as the catalog grows.

## Art direction

| World          | Procedural interpretation                   | Destination                    |
| -------------- | ------------------------------------------- | ------------------------------ |
| C. elegans Lab | Amber dunes and mineral seams               | worm.alirezaafshan.com         |
| Plato          | Slate-blue folds and pale ridges            | plato.alirezaafshan.com        |
| Proof Bonsai   | Moss-green continents and pale valleys      | proof-bonsai.alirezaafshan.com |
| Aquarium       | Deep oceans, turquoise shallows and islands | fish.alirezaafshan.com         |
| Agar Protocol  | Violet crust and pale colonies              | agar.alirezaafshan.com         |
| Nacre          | Banded clouds, broad rings and cold moons   | Scenic world only              |

The fictional world styles are authored recipes combined with immutable identity seeds. Sculpted relief, mineral ridges, ocean shelves, colony contours and banded clouds distinguish worlds; other systems have their own palettes and stars. Geographic patterns are not scientific models of their linked projects. No Spore game assets are included. The reference guides the tilted orbital plane, exaggerated scale, luminous star, colored orbital curves, close approach and compact metal/teal instruments.

Reference study: [Space Stage gameplay around 16:04](https://www.youtube.com/watch?v=N7gomaqVtxE&t=964s), [Maxis's Spherical Worlds paper](https://www.cs.cmu.edu/~ajw/s2007/0251-SphericalWorlds.pdf), [the accompanying slides](https://www.cs.cmu.edu/~ajw/s2007/0251-SphericalWorlds-slides.pdf), and [official Spore controls](https://www.spore.com/comm/tutorials/controls). Terrain and chrome here were independently implemented. This is not a claim to replicate Spore's terrain engine or its complete planet-surface gameplay.

## Rendering and growth

The resource cache retains at most the active/recent detailed system and the latest destination intent, not the whole catalog. Family-star hover and keyboard focus start preparation before entry. A worker generates 768×384 spherical texture maps and displaced surface geometry, transferring buffers rather than copying them; browsers without workers use abortable, cooperatively scheduled work. GPU textures and materials are warmed incrementally on the existing renderer. Superseded preparation is cancelled and abandoned resources are disposed.

The flight begins at the actual family star and keeps approaching while resources prepare. Once ready, camera, group and clipping distances change units together without changing the projected view, then volumetric dust clears. Star points account for group scale too, avoiding oversized squares before the unit change. The original galaxy camera and visibility are restored on return. Moons and rings stay inside nonintersecting orbital envelopes, and asteroid belts use instanced meshes. Terrain is not generated each frame. Existing pixel-ratio limits and hidden-tab suspension remain in force.

The metal/glass instruments use independently authored, inline WebP nine-slice skins rather than expensive first-paint gradient and inset-shadow stacks. Their source recipes live in `scripts/generate-solar-chrome.mjs`; regenerate with `node scripts/generate-solar-chrome.mjs` using local Edge, then run `npx oxfmt app/solar-chrome.css`. Keep the generated stylesheet imported after `app/solar-system.css`. Cached software-drawn planet miniatures reuse the terrain recipes without adding another WebGL renderer.

`data/worlds.ts` exposes the complete public catalog; `data/galaxies.ts` projects it into the portfolio and at most four family stars. `data/solar-systems.ts` derives system and planet metadata from that catalog, with immutable project IDs selecting terrain. Names, URLs, descriptions and publication status are not copied into a second project registry.

Each project has a permanent family `systemId` and family-wide `orbitSlot`. Six slots form a system: 0–5 use `<family>`, 6–11 use `<family>-2`, and so on. Removing a member leaves a gap rather than moving its neighbors. Entire empty companions disappear from the chart without renumbering later systems. New discoveries receive Frontier slots; catalog size no longer depends on a galaxy marker cap. The discovery state retains retired addresses so recovery and future growth do not reshuffle worlds. See [daily discovery](world-discovery.md) for public eligibility and curation.

The no-JavaScript and unavailable-WebGL catalog exposes every real project and web-ring link, not merely the visible family markers.

## Local validation

Unit checks cover public eligibility, growth beyond eighteen projects, bounded galaxy markers, stable addresses across reorder/rename/domain changes and retirement, route parsing, scenic-link exclusion, orbital envelopes and deterministic terrain. Browser checks cover same-canvas round trips, every family's project links, keyboard selection, direct planet URLs, interrupted entry, cross-system history, clickable planet hover cards, landscape inspector clearance, narrow layouts and reduced motion. The existing suite also covers galaxy controls, web-ring travel and world communications.

Use the actual browser to inspect planet materials, rings, moon geometry, labels, camera framing and controls at desktop, portrait and landscape sizes. Passing build and unit tests alone do not establish visual quality or physical-device performance.
