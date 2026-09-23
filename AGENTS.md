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

Enter systems through family stars, not a separate main-menu gateway. Planet previews reuse `WorldPreview`; hovering holds orbital positions and allows crossing into the attached card without navigating. Keep previews clear of the inspector in landscape layouts. Solar metal/glass skins are original generated nine-slice artwork: edit `scripts/generate-solar-chrome.mjs`, regenerate with Node and local Edge, then format `app/solar-chrome.css`. Import the generated skins after `app/solar-system.css`; layered live gradients and inset shadows previously caused cold-flight GPU raster stalls.

`data/worlds.ts` exposes the full public `worldCatalog`; `data/galaxies.ts` projects it into a direct portfolio homeworld and bounded family stars. `data/solar-systems.ts` builds systems from permanent `systemId`/`orbitSlot` membership and supplies identity-seeded terrain recipes, not duplicate project metadata. Six project slots form each system; companion systems preserve their addresses when members disappear. Nacre is scenic and has no website link. Do not invent live destinations or present the terrain as scientific simulation.

Start locally with `npm run dev -- --port 5182` and use `http://localhost:5182/` (Vinext binds localhost on this Windows host). Systems and planets accept `/#system/<system-id>[/<project-id>]`. Checks: `npm run lint`, `npx tsc --noEmit --incremental false`, `npm run test:unit`, `npm run build`, and `npm run test:e2e`. To test an existing dev server, set `PLAYWRIGHT_BASE_URL=http://localhost:5182`; local Playwright uses Edge. Run shell commands separately in PowerShell 5.

Public eligibility is independent of galaxy marker capacity. The discovery script retains HTTPS/public opt-in, denials and health grace, assigns new discoveries permanent Frontier addresses, and retains retired address tombstones. Never compact slots or reuse retired addresses. See `docs/SOLAR-SYSTEMS.md` and `docs/world-discovery.md`. Pushes to main trigger production: publishing, merging and deployment require explicit authorization. Use `vps-operations` for authorized Deploy Manager work and `credentials-access` when service authentication is needed.
