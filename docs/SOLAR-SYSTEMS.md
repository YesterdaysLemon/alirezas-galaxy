# Patterns & Life — first solar system

The original galaxy remains the home view. Its **Patterns & Life** control enters one solar system in the same Three.js scene, camera, renderer, and animation loop. This is a local first pass, not a deployed replacement or a completed migration of the project catalog.

## The journey

- Enter **Patterns & Life** from the galaxy, or open `/#system/patterns-and-life`.
- Click a planet or its instrument-strip button to approach it. Left/right arrows select neighboring worlds.
- Drag to orbit the view. Scroll, pinch, or use the +/− controls to zoom.
- Use **Visit** to open the real project website in a new tab. The uninhabited Nacre has no launch link.
- Escape returns from a planet to the system, then to the galaxy. The Galaxy button returns directly. Browser Back/Forward and a direct system URL also work.
- Orbital positions hold while inspecting a planet so its controls and composition remain stable. Surface rotation continues until paused. The pause control freezes ambient scene motion; reduced motion also makes camera changes immediate.

The galaxy's camera position, orientation, visibility and interaction state are saved on entry and restored on return. This first system has five project worlds, an outer gas giant, five moons, and two asteroid belts.

## Art direction

| World | Procedural interpretation | Destination |
| --- | --- | --- |
| C. elegans Lab | Amber dunes and mineral seams | worm.alirezaafshan.com |
| Plato | Slate-blue folds, pale ridges, subtle 13-second expansion | plato.alirezaafshan.com |
| Proof Bonsai | Moss-green continents and pale valleys | proof-bonsai.alirezaafshan.com |
| Aquarium | Deep oceans, turquoise shallows and islands | fish.alirezaafshan.com |
| Agar Protocol | Violet crust and pale colonies | agar.alirezaafshan.com |
| Nacre | Banded clouds, broad rings and cold moons | Scenic world only |

The fictional world styles are authored recipes combined with stable seeds. Their geographic patterns are not scientific models of their linked projects. No Spore game assets are included. The reference influenced the tilted orbital plane, exaggerated scale, warm central star, visible orbital curves, close approach, and blue beveled navigation chrome.

Reference study: [Space Stage gameplay around 16:04](https://www.youtube.com/watch?v=N7gomaqVtxE&t=964s), [Maxis's Spherical Worlds paper](https://www.cs.cmu.edu/~ajw/s2007/0251-SphericalWorlds.pdf), [the accompanying slides](https://www.cs.cmu.edu/~ajw/s2007/0251-SphericalWorlds-slides.pdf), and [official Spore controls](https://www.spore.com/comm/tutorials/controls). Terrain and chrome here were independently implemented. This is not a claim to replicate Spore's terrain engine or its complete planet-surface gameplay.

## Rendering and growth

The system group is created on its first visit and reused. It contains six textured planet surfaces with clouds/atmosphere layers, a procedural sun, simple moons and rings. Each planet gets a 512×256 color, bump and cloud texture sampled in 3D to avoid a longitude seam. The 720 asteroids use two instanced meshes. Planet surfaces are generated once, not rebuilt each frame. The existing pixel-ratio limits and hidden-tab suspension remain in force. The system owns and disposes its geometries, textures and materials.

The existing galaxy still uses `data/worlds.generated.json`. Its discovery script and capacity guard have not been changed by this first pass. Later work can add a system catalog and stable membership mapping, keeping public eligibility separate from the number of visible galaxy markers and loading only the selected system. This first system's curated membership demonstrates that navigation; it does not automatically regroup every existing or newly discovered site.

## Local validation

`tests/unit/solar-system.test.ts` checks stable identities, HTTPS destinations, scenic-link exclusion, orbital envelopes, deterministic terrain and seam continuity. `tests/e2e/solar-system.spec.ts` exercises the same-canvas round trip, project links, keyboard selection, the scenic giant, direct URLs, browser history, narrow layouts and reduced motion. The existing suite also covers the galaxy controls, web-ring travel and world communications.

Use the actual browser to inspect planet materials, rings, moon geometry, labels, camera framing and controls at desktop, portrait and landscape sizes. Passing build and unit tests alone do not establish visual quality or physical-device performance.
