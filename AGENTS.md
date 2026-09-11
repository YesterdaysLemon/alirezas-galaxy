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

Preserve the approved luminous five-arm galaxy, organic blue menu canopy, attached world communications, and utility dock. The first solar system is a local extension of this experience, with original Space Stage-inspired art and controls. Use `frontend-quality` for visual work and validate desktop, narrow, and landscape views in a browser.

`components/galaxy-index.tsx` owns the single Three.js scene, renderer, camera, input routing, and visibility-aware animation loop. `lib/solar-system-scene.ts` creates one lazy, reusable local system group, preserves the galaxy camera and visibility state, and disposes its resources with the renderer. Keep stars, planets, moons, rings and instanced asteroid belts in this same engine. Respect reduced motion and the pause control.

`data/solar-systems.ts` holds the stable project IDs, public URLs, seeds, and authored terrain recipes for Patterns & Life. `lib/planet-textures.ts` generates original spherical terrain textures from deterministic 3D noise. The worlds are fictional visual interpretations of real projects. Nacre is a scenic gas giant and has no website link. Do not invent live destinations or present the terrain as scientific simulation.

Start locally with `npm run dev -- --port 5182` and use `http://localhost:5182/` (Vinext binds localhost on this Windows host). The system also accepts `/#system/patterns-and-life`. Checks: `npm run lint`, `npx tsc --noEmit --incremental false`, `npm run test:unit`, `npm run build`, and `npm run test:e2e`. To test an existing dev server, set `PLAYWRIGHT_BASE_URL=http://localhost:5182`; local Playwright uses Edge. Run shell commands separately in PowerShell 5.

The first pass adds one curated system. It does not change the generated public catalog, automated discovery workflow, publication eligibility, or existing capacity guard. See `docs/SOLAR-SYSTEMS.md`. Publishing and deployment still require authorization for that work; use `vps-operations` for the existing Deploy Manager infrastructure and `credentials-access` when service authentication is needed.
