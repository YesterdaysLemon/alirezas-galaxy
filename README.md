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

## Run on a VPS

The production image is a self-contained Vinext Node server. Build and run it
with Docker Compose:

```bash
docker compose up -d --build
```

It listens on port `3000` by default. Set `GALAXY_PORT` to publish a different
host port, then place your deploy manager or reverse proxy in front of it. The
container runs unprivileged, with a read-only filesystem and a built-in health
check.

Pushes to `main` build and publish `ghcr.io/yesterdayslemon/alirezas-galaxy`
through the Container workflow; pull requests build the same image without
publishing it. Once the guarded `DEPLOY_ENABLED` repository variable is armed,
the same successful workflow requests a signed rollout from the VPS deploy
manager. The manager builds the exact commit, tests it as a candidate on a
spare loopback port, and only replaces the healthy production container.

The staged root/portfolio handoff is documented in
[`docs/vps-migration.md`](docs/vps-migration.md). Its setup script keeps the
current portfolio live on port `3000`, starts the galaxy on `3070`, validates
both, and changes only the Caddy hostname mapping. The pre-cutover Caddyfile is
retained for immediate routing rollback.

## What is in the base

- Owned project destinations, with the portfolio selected by default
- A distant-galaxy web ring for friends, collaborations, and interesting sites
- Favicon or project-glyph callouts that follow the currently previewed world
- Hover-to-preview browsing with screen-sized mouse and touch targets
- Click-to-zoom world details with Launch shown only after confirmation
- A Spore communications-style portrait bay, message screen, and reply controls
- Heavier pointer/touch drag, long inertial spin, and wheel zoom
- A four-revolution portrait Easter egg
- Five spiral arms whose attached worlds keep drifting after selection
- Working reset and galactic-drift controls in the joined lower dock
- Keyboard-accessible HTML navigation alongside the WebGL scene
- Transparent chrome passes through clicks; mobile controls keep 44 px targets
- Reduced-motion support and a non-WebGL-safe interface layer

## Performance shape

The scene uses one compact galaxy buffer rendered in a crisp pass and a mist
pass, one buffer for the distant field, two shared buffers for particle-built
background galaxies, capped device pixel ratio, adaptive particle counts, and
throttled screen-space picking against the world markers. Rendering pauses when the page
is hidden or offscreen.

## Personalize it

`data/world-comms.ts` holds short, authored project introductions and opt-in
public repository links. Unlisted projects use their catalog description;
projects without a source URL show only the open-world reply. The console UI
lives in `components/world-comms.tsx` and `app/world-comms.css`.

Destinations live in `data/worlds.ts`. Add one catalog object for a new website;
its orbit, spiral arm, color, and marker size are generated deterministically
when omitted, and any of those values can still be art-directed per world. The
first slice uses the public GitHub avatar as its portrait texture. Before the
final release, replace that URL with optimized 256 px WebP or AVIF selfie crops;
`public/selfies/README.md` records the asset contract.

The portfolio destination targets `portfolio.alirezaafshan.com`; the galaxy
is the root site at `alirezaafshan.com`.

Neighboring websites live in `data/webring.ts`. Add a name, URL, description,
and kind (`friend`, `collaboration`, or `inspiration`), plus an optional icon.
`data/galaxies.ts` gives owned projects five arms and neighbors three, using
the same deterministic world placement and interaction code for both scenes.
Tap the signal in the distant galaxy to fly there; the current galaxy recedes
and becomes the return destination. Drag rotates the foreground galaxy,
wheel/pinch zooms, and browser Back retraces the trip. Each neighbor is a star
with the same preview/inspect/launch flow, opening its website in a new tab.
Both catalogs are also available separately in `sites.json` and `llms.txt`.

To run the browser checks against an already-running local preview, set
`PLAYWRIGHT_BASE_URL=http://localhost:3000` and run
`npm run test:e2e -- --workers=1`. Without that variable, the suite starts its
own development server.

## References

- [Spore manual: the Galaxy screen as the saved-world selector](https://shared.steamstatic.com/store_item_assets/steam/apps/17390/manuals/manual.pdf?t=1642702281)
- [Three.js BufferGeometry](https://threejs.org/docs/pages/BufferGeometry.html)
- [Three.js Raycaster](https://threejs.org/docs/pages/Raycaster.html)

## License

MIT
