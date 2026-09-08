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
An eighteen-world cap plus actual placement/unit/build checks blocks overflow.
All discovery happens before deployment, adding no browser requests or polling.

`data/worlds.generated.json` feeds both the galaxy and machine-readable catalogs.
`data/world-discovery-state.json` stores only public URLs and health transition state.
The job validates the full unit suite and build before committing. A conflicting
push fails safely instead of overwriting other work. Catalog changes explicitly
dispatch `Container` because GITHUB_TOKEN pushes do not start push workflows.
That workflow builds and requests the existing signed exact-SHA galaxy rollout.
State-only changes do not deploy. A failed release can be retried by manually
dispatching Container on main; a failed refresh can be rerun from Actions.

Run locally: `node scripts/refresh-worlds.mjs`, then `npm run test:unit` and
`npm run build`. Review the two generated JSON files before committing.
