<!-- al-stack:project:start -->

## Al-stack project

Project: website-overhaul. Profile: web. Status: experimental.

Alireza's Galaxy: a tactile Three.js index with explorable project solar systems

`al-stack.toml` records this project's setup and dependencies. Work from the checkout selected for the task; other branches/worktrees are optional history. Use `al-stack register .` once when starting work here. Local registration does not change the project's lifecycle.

Project commands:

- dev: `npm run dev`
- check: `npm run lint && npm run test:unit && npm run build`

Project skills (load when relevant):

- `frontend-quality`: `.agents/skills/frontend-quality/SKILL.md`. Claude's copy is mirrored in `.claude/skills`.

Edit project guidance outside this managed section. Use `al-stack configure` for its fields and `al-stack check .` for setup checks. Run the actual project checks for behavioral validation.
<!-- al-stack:project:end -->

# Galaxy and solar systems

Preserve the approved luminous five-arm galaxy, organic blue menu canopy, attached world communications, and utility dock. Project solar systems extend this experience with original Space Stage-inspired art and controls. Use `frontend-quality` for visual work and validate desktop, narrow, and landscape views in a browser.

`components/galaxy-index.tsx` owns the single Three.js scene, renderer, camera, input routing, and visibility-aware animation loop. `lib/solar-system-scene.ts` retains at most the active/recent system and the latest destination intent; `lib/planet-preparation.ts` prepares terrain in a worker with an abortable cooperative fallback. Entry continuously approaches the actual family star, changes units without changing the projection, and clears in-scene dust. Preserve the original galaxy camera and visibility state until return. Keep stars, planets, moons, rings and instanced asteroid belts in this same engine. Respect reduced motion and the pause control.

Enter systems through family stars, not a separate main-menu gateway. Planet previews reuse `WorldPreview`; hovering holds orbital positions and allows crossing into the attached card without navigating. Keep previews clear of the planet comms in landscape layouts. Inside a system the HUD changes mode like Spore's space stage, in original art: the canopy retracts (random world, galaxy), the dock steps aside, a star nameplate sits top center, and a scanner console runs along the bottom (live radar scope drawn by the scene, readout of real data only, worlds/stars/flight tabs). A selected world still opens the galaxy comms casing (`world-detail` classes). Mount gradient-heavy chrome only after arrival (the console does), never during the cold flight. Do not invent stats (no fake health, energy or T-scores).

`GALAXY_UNIT` keeps a whole system about as large as a spiral arm is thick, so it resolves only after the log-distance dive enters the arm; do not enlarge it to shorten the flight. The in-system sky's galactic band faces the real galaxy center; the galaxy's core glow sprites fade by camera distance so they never clip during the dive. `lib/solar-ship.ts` is the original scout saucer that follows the hovered or selected world. Orbit lines are constant-width hairlines that part around their world and hide in its own close-up. Planet radii are bounded by the moon-envelope unit test; frame the camera rather than inflating worlds.

`lib/planet-textures.ts` owns one surface sampler per world type (ocean, garden, desert, ice `folds`, colony `culture`, gas) used by 3D textures, relief, comms portraits and console icons; ringed icons draw the far ring half behind the world. Optional `surface` tuning on a recipe (sea fraction, continents, ice, clouds, relief, detail) is edited in the local-only planet lab at `/planet-lab` (`npm run dev`, then open it); copy its recipe into `authoredTerrain` in `data/solar-systems.ts`. Terrain preparation runs on a small worker pool.

`data/worlds.ts` exposes the full public `worldCatalog`; `data/galaxies.ts` projects it into a direct portfolio homeworld and bounded family stars. `data/solar-systems.ts` builds systems from permanent `systemId`/`orbitSlot` membership and supplies identity-seeded terrain recipes, not duplicate project metadata. Six project slots form each system; companion systems preserve their addresses when members disappear. Nacre is scenic and has no website link. Do not invent live destinations or present the terrain as scientific simulation.

Start locally with `npm run dev -- --port 5182` and use `http://localhost:5182/` (Vinext binds localhost on this Windows host). Systems and planets accept `/#system/<system-id>[/<project-id>]`. Checks: `npm run lint`, `npx tsc --noEmit --incremental false`, `npm run test:unit`, `npm run build`, and `npm run test:e2e`. To test an existing dev server, set `PLAYWRIGHT_BASE_URL=http://localhost:5182`; local Playwright uses Edge. Run shell commands separately in PowerShell 5.

Public eligibility is independent of galaxy marker capacity. The discovery script retains HTTPS/public opt-in, denials and health grace, assigns new discoveries permanent Frontier addresses, and retains retired address tombstones. Never compact slots or reuse retired addresses. See `docs/SOLAR-SYSTEMS.md` and `docs/world-discovery.md`. Pushes to main trigger production: publishing, merging and deployment require explicit authorization. Use `vps-operations` for authorized Deploy Manager work and `credentials-access` when service authentication is needed.
