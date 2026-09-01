# Alireza's Galaxy

A fast, tactile orbital index for the websites in Alireza Afshan's corner of
the internet. Drag the galaxy, choose a world, inspect it, and deliberately
launch it. Spin the disk hard enough and the center answers back.

This first slice recreates the interaction grammar of Spore's main menu from
scratch: an oversized luminous disk, tiny radial world markers, a fixed blue
glass menu, and almost no page chrome. It does not use Spore assets or branding.

## Run locally

```bash
npm install
npm run dev
```

## What is in the base

- Seven real destinations, with the portfolio selected by default
- Favicon or project-glyph planet faces in the selected-world view
- Click-to-select worlds with a separate, oversized launch confirmation
- Heavier pointer/touch drag, long inertial spin, and wheel zoom
- A four-revolution portrait Easter egg
- Five spiral arms that keep drifting after a world has been selected
- Working reset and galactic-drift controls in the joined lower dock
- Keyboard-accessible HTML navigation alongside the WebGL scene
- Reduced-motion support and a non-WebGL-safe interface layer

## Performance shape

The scene uses one compact galaxy buffer rendered in a crisp pass and a mist
pass, one buffer for the distant field, shared low-poly planet geometry, capped
device pixel ratio, adaptive particle counts, and throttled raycasting against
only seven markers. Rendering pauses when the page is hidden or offscreen.

## Personalize it

Destinations live in `data/worlds.ts`. Add one catalog object for a new website;
its orbit, spiral arm, color, and marker size are generated deterministically
when omitted, and any of those values can still be art-directed per world. The
first slice uses the public GitHub avatar as its portrait texture. Before the
final release, replace that URL with optimized 256 px WebP or AVIF selfie crops;
`public/selfies/README.md` records the asset contract.

The portfolio destination intentionally targets `portfolio.alirezaafshan.com`
for the planned domain handoff in which this galaxy becomes the root site.

## References

- [Spore manual: the Galaxy screen as the saved-world selector](https://shared.steamstatic.com/store_item_assets/steam/apps/17390/manuals/manual.pdf?t=1642702281)
- [Three.js BufferGeometry](https://threejs.org/docs/pages/BufferGeometry.html)
- [Three.js Raycaster](https://threejs.org/docs/pages/Raycaster.html)

## License

MIT
