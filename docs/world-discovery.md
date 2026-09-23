# Daily public worlds

The deterministic `Refresh public worlds` GitHub Actions job runs daily at
10:23 UTC (03:23 PDT / 02:23 PST), and can be dispatched manually. GitHub may
delay scheduled jobs. No LLM, DNS credentials, or infrastructure changes are involved.

`data/world-registry.json` is the reviewed public project registry. Its order and
metadata override discovery and preserve the portfolio as the default homeworld.
Add an owned public project here, or opt it in through Deploy Manager's `publicUrl`
configuration: the sanitized `https://deploy.alirezaafshan.com/api/topology`
exposes that field as `apps[].url`. Merely appearing in `city.routes`, DNS,
datastores, or the control plane does not opt a service in. Frame by Frame and
Herald were verified from the public topology and their HTTPS home pages.
Valet is explicitly seeded as a preview until its home page returns 2xx.
On 2026-09-23, twelve Deploy Manager opt-ins (Between Worlds, Bezalel, Cube,
D. melanogaster, Lyrebird, Magic Keys, Morphogenesis, Openwater, please., SOFT
SIGNAL, The Intuition Lab and WorkCiv) were curated into families with registry
addresses after HTTPS checks; the refresh on `main` had been failing since
2026-09-19 against its old eighteen-world cap.

Only single-label HTTPS subdomains of alirezaafshan.com with a root path qualify.
Mail, admin, internal, staging, dev, test, VPN, and API labels are rejected.
`deniedIds` wins immediately over both registry and discovery. To retire a project,
remove its registry entry and publicUrl opt-in; removal otherwise has seven days
of grace. Keep the portfolio entry: the unit checks prevent losing the homeworld.

The refresher probes four URLs at once, with ten-second timeouts and no redirects.
An unhealthy new project stays unpublished unless explicitly `showPending`.
Previously healthy projects survive seven days of failure or source disappearance;
then they leave the rendered catalog and return on recovery. A never-healthy
explicit preview remains a preview. Oyster House is explicitly denied after the
agent runtime was retired and its host repurposed as a private CI runner.
State records the first failure, not every poll, so unchanged runs create no commits.
Source errors and invalid schemas abort without replacing the last-known-good files.
Publication has no eighteen-world cap. Galaxy capacity is bounded separately: one
star per populated family, with six permanent project slots per solar system.
Full catalog, stable-address, orbital-clearance, placement and build checks guard growth.
All discovery happens before deployment, adding no browser requests or polling.

`data/worlds.generated.json` feeds the full `worldCatalog`, system membership and
machine-readable catalogs; galaxy markers are a separate bounded projection.
`data/world-discovery-state.json` stores public URLs, health transitions and permanent
membership addresses, including tombstones for retired or denied projects.
The job validates the full unit suite and build before committing. A conflicting
push fails safely instead of overwriting other work. Catalog changes explicitly
dispatch `Container` because GITHUB_TOKEN pushes do not start push workflows.
That workflow builds and requests the existing signed exact-SHA galaxy rollout.
State-only changes do not deploy. A failed release can be retried by manually
dispatching Container on main; a failed refresh can be rerun from Actions.

Run locally: `node scripts/refresh-worlds.mjs`, then `npm run test:unit` and
`npm run build`. Review the two generated JSON files before committing.

## Stable membership

Every registry project has a `systemId` family and nonnegative integer `orbitSlot`.
The portfolio alone uses `home`/`0`; authored families are `patterns-and-life`,
`curiosity-and-play`, `tools-and-infrastructure` and `ideas-and-inquiry`. New public discoveries receive
the next unallocated `frontier` slot in deterministic project-ID order.

Slots 0–7 belong to the family's root system, 8–15 to `<family>-2`, and so on;
each slot is a lane at a fixed orbit, so systems grow outward.
Empty slots do not collapse; absent systems do not renumber later companions.
Renames, domain changes, discovery ordering and health transitions leave membership
unchanged. Terrain is keyed by immutable project ID rather than display name or URL.
Registry addresses override persisted membership only for intentional curation;
duplicate addresses abort the refresh. Choose an unused slot when moving a project.

Retired and denied project IDs retain their addresses indefinitely. Recovery reuses
the project's address; unrelated newcomers never fill its slot. Keep IDs stable,
and do not clear state tombstones as routine housekeeping.
