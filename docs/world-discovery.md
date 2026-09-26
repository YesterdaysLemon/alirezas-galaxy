# Daily public worlds

The `Refresh public worlds` GitHub Actions job runs daily at 10:23 UTC
(03:23 PDT / 02:23 PST), and can be dispatched manually. GitHub may delay
scheduled jobs. Discovery and health are deterministic; placing brand-new worlds
uses Jev (below). No DNS credentials or infrastructure changes are involved.

## Autonomous placement with Jev

A new, healthy, opted-in world with no address is placed without review by Jev
(TypeSafe AI, pinned `jev-1.13.0`), using the `TYPESAFE_API_KEY` repository
secret. Jev only answers typed questions, so one request asks four Choices:

- **family**: each active family (described by its subtitle and current worlds)
  or "none of these";
- **theme**: which curated, not-yet-active theme in `data/families.json` a new
  family would take;
- **kind**: which world type (ocean, garden, desert, ice, colony, gas giant);
- **label**: what the project is, from a short curated list (browser game,
  animated explainer, research journal, walkable museum, working tool…).

A family pick weighted at least 0.45 takes that family's next never-used lane,
if it has one. **Every world lives under a visible star:** a family star opens
one system of eight lanes, so a family with no never-used lane is *full*. A
confident pick of a full family, or a "none of these" weighted at least 0.5,
opens the chosen theme as a new family (its star appears in the galaxy, before
Frontier), up to `maxActive` families, which the galaxy's marker placement is
tested to hold. Anything less certain, a failed call, or a missing key places
the world on the Frontier, whose star shows once it has worlds. The world type
and label are stored in `data/world-terrain.json`; its palette still varies by
the world's own seed, and a label above 0.35 replaces the discovered kind
"Public project" on its comms card. Every decision, with all probabilities and
a request hash but never a key or response body, is appended to
`data/world-classifications.json`. The job commits these with the catalog only
after the unit suite and build pass.

### Settling worlds that are still looking for a home

Two kinds of discovered world are still looking for a home: those on Frontier,
and those past their family's eighth lane, in a sister system the family star
does not open (`<family>-2`, only reachable from the ship menu). Each refresh
re-asks them, but only when the families have changed since they were last
asked (their `rehomeSignature` in the discovery state). A world moves to the
home Jev's answer gives: a family with a free lane, a newly opened family, or,
from a sister system, Frontier. A Frontier world that would only land on
Frontier again stays put. Moving keeps the world's look; only its address
changes. The old address is kept in the world's `formerAddresses` and is never
handed to another world; `nextSlot`, membership validation and a unit test all
respect it. Reviewed registry worlds are never moved automatically, and a unit
test keeps them within their family's first eight lanes.

Discovered worlds placed before labels existed are named once by a label-only
request that cannot move them; an unsure answer is recorded as `label: null`.

Moving a world later is safe: project IDs are unique, so an old
`#system/<old-system>/<world>` link resolves to wherever the world now lives.
A calibration on 2026-09-23 against the thirteen worlds curated that day agreed
on nine; Jev preferred Curiosity & Play for Openwater, Morphogenesis and Between
Worlds (0.83–0.91), and they were moved there before publication. That filled
Curiosity & Play past eight, into a sister system its star never showed; on
2026-09-26 the six worlds there were re-homed by the rule above, opening Worlds
& Games, Places & Maps and Machines & Minds, with Coolimages on Frontier.

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
star per populated family, with eight permanent project slots per solar system.
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
`curiosity-and-play`, `tools-and-infrastructure` and `ideas-and-inquiry`. New public discoveries are placed by
Jev (above), or receive the next unallocated `frontier` slot in deterministic
project-ID order. Active families and the theme pool live in `data/families.json`.

Slots 0–7 belong to the family's root system, 8–15 to `<family>-2`, and so on;
each slot is a lane at a fixed orbit, so systems grow outward. Sister systems are
only an overflow that the refresh drains (above); a family's star opens its root
system, and its label says when a sister system holds more.
Empty slots do not collapse; absent systems do not renumber later companions.
Renames, domain changes, discovery ordering and health transitions leave membership
unchanged. Terrain is keyed by immutable project ID rather than display name or URL.
Registry addresses override persisted membership only for intentional curation;
duplicate addresses abort the refresh. Choose an unused slot when moving a project.

Retired and denied project IDs retain their addresses indefinitely. Recovery reuses
the project's address; unrelated newcomers never fill its slot. Keep IDs stable,
and do not clear state tombstones as routine housekeeping. When moving a reviewed
world by hand, record its old address in its discovery-state `formerAddresses`.
