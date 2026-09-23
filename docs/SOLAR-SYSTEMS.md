# Project solar systems

The original five-arm galaxy remains the home view. Its family stars lead to **Patterns & Life**, **Curiosity & Play**, and **Tools & Infrastructure**, using the same Three.js scene, camera, renderer and animation loop. The portfolio remains a direct homeworld. Changes are local until publication is explicitly authorized.

## The journey

- Enter a family star. The camera dives at a constant zoom rate (log distance) into the spiral arm around that star; the system resolves only once you are inside the arm, then a light haze clears. There is no separate main-menu gateway or system page load. Open the ship menu (the spiral) to hop to another system: the camera pulls back into the galaxy and dives again.
- The HUD changes mode like Spore's space stage (original art, laid out after real footage): the galaxy canopy and dock step aside and the ship's own HUD hugs the bottom edge, leaving the top of the screen to space. On the left, the helm: a system tab with the galaxy-map button over the radar, a gold zoom rocker on the radar's rim, and the menu spiral and pause on a thin rail. The radar shows the live system from above (forward is up, square-root radial scale), the ship's blip and a sweep; hover a dot to send the ship, click to approach. The spiral opens the ship menu: random world and the star systems. On the right, a worlds tray of planet sockets, a readout tab of real facts only (kind, live/preview/scenic, moons, rings) and a portrait of whatever the scout is looking at.
- A small scout saucer flies to whichever world you hover or select and beams down onto it. Hover a planet or its socket for the original portrait/name/domain preview without navigating. Click the card, planet, or socket to approach it; its transmission opens in the same comms casing as the galaxy. Left/right arrows select neighboring worlds.
- Drag to orbit the view. Scroll, pinch, or use the +/− rocker to zoom. Zoom is continuous, as in Spore: it steers toward whatever is under the pointer, glides down onto a world when you zoom in over it, releases back to the system past its close-up, and leaves for the galaxy only when you keep zooming out once the widest view has settled (momentum that reaches the edge stops there). Worlds carry no standing labels; hovering one shows its card.
- Use **Visit** to open the real project website in a new tab. The uninhabited Nacre has no launch link.
- Escape returns from a planet to its system, then to the galaxy. The system tab's galaxy button returns directly. Browser Back/Forward restores both system and planet selections.
- Orbital positions hold while hovering or inspecting a planet so the attached card, controls and composition remain stable. Surface rotation continues until paused. The pause control freezes ambient scene motion; reduced motion skips camera animation once the real system resources are ready.
- Share `/#system/patterns-and-life` or `/#system/patterns-and-life/plato`. Unknown or malformed system/planet addresses return safely to the galaxy.

The galaxy's camera position, orientation and visibility are saved on entry and restored on return, including after switching systems or cancelling an entry. Patterns & Life has five project worlds plus Nacre, five moons and two asteroid belts. Curiosity & Play has six projects; Tools & Infrastructure has three; Frontier, where new discoveries land, begins with Dodeca & Point. The system chart exposes populated companion systems as the catalog grows.

## Art direction

| World          | Procedural interpretation                   | Destination                    |
| -------------- | ------------------------------------------- | ------------------------------ |
| C. elegans Lab | Amber dunes and mineral seams               | worm.alirezaafshan.com         |
| Plato          | Slate-blue folds and pale ridges            | plato.alirezaafshan.com        |
| Proof Bonsai   | Moss-green continents and pale valleys      | proof-bonsai.alirezaafshan.com |
| Aquarium       | Deep oceans, turquoise shallows and islands | fish.alirezaafshan.com         |
| Agar Protocol  | Violet crust and pale colonies              | agar.alirezaafshan.com         |
| Nacre          | Banded clouds, broad rings and cold moons   | Scenic world only              |

The fictional world styles are authored recipes combined with immutable identity seeds. Sculpted relief, mineral ridges, ocean shelves, colony contours and banded clouds distinguish worlds; other systems have their own palettes and stars. Geographic patterns are not scientific models of their linked projects. No Spore game assets are included. The reference guides the tilted orbital plane, exaggerated scale, luminous star, short colored orbit trails, close approach, the edge-hugging HUD, and the player's own small ship.

Reference study: [Space Stage gameplay around 16:04](https://www.youtube.com/watch?v=N7gomaqVtxE&t=964s), [Maxis's Spherical Worlds paper](https://www.cs.cmu.edu/~ajw/s2007/0251-SphericalWorlds.pdf), [the accompanying slides](https://www.cs.cmu.edu/~ajw/s2007/0251-SphericalWorlds-slides.pdf), and [official Spore controls](https://www.spore.com/comm/tutorials/controls). Terrain and chrome here were independently implemented. This is not a claim to replicate Spore's terrain engine or its complete planet-surface gameplay.

## Rendering and growth

The resource cache retains at most the active/recent detailed system and the latest destination intent, not the whole catalog. Family-star hover and keyboard focus start preparation before entry. A worker generates 768×384 spherical texture maps and displaced surface geometry, transferring buffers rather than copying them; browsers without workers use abortable, cooperatively scheduled work. GPU textures and materials are warmed incrementally on the existing renderer. Superseded preparation is cancelled and abandoned resources are disposed.

The flight begins at the actual family star and keeps approaching while resources prepare. Once ready, camera, group and clipping distances change units together without changing the projected view, then volumetric dust clears. Star points account for group scale too, avoiding oversized squares before the unit change. The original galaxy camera and visibility are restored on return. Moons and rings stay inside nonintersecting orbital envelopes, and asteroid belts use instanced meshes. Terrain is not generated each frame. Existing pixel-ratio limits and hidden-tab suspension remain in force.

`GALAXY_UNIT` (0.0011 galaxy units per system unit) makes a whole system roughly as large as the arm is thick. The dive interpolates log distance and direction about the destination star, fades the galaxy markers and core glare early, and hands off units at the overview pose. The local sky (stars, nebulae and a galactic band whose bright core faces the real galaxy center) exists only after the handoff and fades in as the haze clears.

The scanner console mounts after arrival, so its first paint never competes with the cold flight; the radar is a small 2D canvas the scene redraws each frame. Planet transmissions reuse the galaxy comms casing. Orbits show only a short comet trail behind each world, as in Spore: brightest where it meets the world, gone a quarter-turn behind and absent ahead, drawn as an fwidth-based core with a soft glow, and hidden in that world's own close-up. The camera eases heading, tilt and log-distance about an eased subject (never Cartesian position), so turns swing around the subject instead of cutting across the system; flights between worlds rise with the ground they still cover. Near clipping follows the zoom, and a resize keeps the reader's zoom and heading. The scout saucer is lit by its star with only a little reflected gloss, so its far side falls into shade like the worlds. The galaxy core's glow billboards fade by camera distance, so the dive never clips them.

## Planet surfaces and the planet lab

One sampler per world type drives textures, relief, portraits and console icons: ocean and garden worlds get continents, coasts, climate belts, ridge-line mountain ranges and polar caps; desert worlds get dune seas and dark mineral canyons; `folds` worlds are frozen, with pressure ridges and open leads; `culture` worlds are colony worlds of concentric, faintly luminous growths; gas giants have sheared bands and a storm oval. `sea` is the measured fraction of surface below sea level for that world. Portraits choose a balanced face; ringed icons draw the far half of the ring behind the world.

Run `npm run dev` and open `/planet-lab` to tune any world: type, seed, palette, atmosphere, sea, continents, ice, clouds, relief and detail, with a live 3D preview using the game's own materials plus the portrait and socket icon. Drafts persist in that browser only. **Copy recipe** produces the `authoredTerrain` entry to paste into `data/solar-systems.ts`. The lab is excluded from release images by `.dockerignore` and a Dockerfile guard.

`data/worlds.ts` exposes the complete public catalog; `data/galaxies.ts` projects it into the portfolio and at most four family stars. `data/solar-systems.ts` derives system and planet metadata from that catalog, with immutable project IDs selecting terrain. Names, URLs, descriptions and publication status are not copied into a second project registry.

Each project has a permanent family `systemId` and family-wide `orbitSlot`. Six slots form a system: 0–5 use `<family>`, 6–11 use `<family>-2`, and so on. Removing a member leaves a gap rather than moving its neighbors. Entire empty companions disappear from the chart without renumbering later systems. New discoveries receive Frontier slots; catalog size no longer depends on a galaxy marker cap. The discovery state retains retired addresses so recovery and future growth do not reshuffle worlds. See [daily discovery](world-discovery.md) for public eligibility and curation.

The no-JavaScript and unavailable-WebGL catalog exposes every real project and web-ring link, not merely the visible family markers.

## Local validation

Unit checks cover public eligibility, growth beyond eighteen projects, bounded galaxy markers, stable addresses across reorder/rename/domain changes and retirement, route parsing, scenic-link exclusion, orbital envelopes and deterministic terrain. Browser checks cover same-canvas round trips, every family's project links, keyboard selection, direct planet URLs, interrupted entry, cross-system history, clickable planet hover cards, landscape comms clearance, the ship HUD and menu, zoom onto a world and back, narrow layouts and reduced motion. The existing suite also covers galaxy controls, web-ring travel and world communications.

Use the actual browser to inspect planet materials, rings, moon geometry, orbit trails, camera framing and controls at desktop, portrait and landscape sizes. Passing build and unit tests alone do not establish visual quality or physical-device performance.
