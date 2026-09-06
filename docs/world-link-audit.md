# Public world link audit

Checked 2026-09-06 UTC (2026-09-05 Pacific). This is a dated audit, not continuous uptime monitoring.

## Corrections

- Conspiracy: retired GitHub Pages URL returned 404. The public deployment at `https://conspiracy.alirezaafshan.com` returned 200 and declares that canonical URL.
- Codex Continuity: retired ChatGPT Sites URL returned 404. `https://continuity.alirezaafshan.com` returned 200 and declares that canonical URL. Its published icon is `/icon.svg`.
- Application Builder: its ChatGPT Sites URL returned 404. No replacement appeared in the domain's complete DNS inventory, the public deployment inventory, Cloudflare Pages projects, or its public repository. Removed from the website catalog rather than presenting a source repository as a deployed website. The plugin source remains at https://github.com/YesterdaysLemon/job-application-batch-builder.
- Agar Protocol: updated from the old `agar-mark-01.svg` to the deployed page's `agar-mark-02.svg`.
- Deploy Manager: replaced the approximate arrow with the deployed `/favicon.svg`.
- ChatJimmy: added its published `/favicon.ico`.
- Oyster House: added `https://agent.alirezaafshan.com`, which serves a public sleeping page. Its catalog status is `sleeping`, not a claim that the agent runtime is active. No private repository or internal UI link is exposed.

All other existing destination URLs returned 200 with the expected page identity. Portfolio, C. elegans, Android Hell, Microduck, and Learn2Design icons match their live page declarations and return image content. C. elegans intentionally publishes its icon as a data URL.

Proof Bonsai, Aquarium, Bird of the Day, and Conspiracy declare no favicon. Their conventional `/favicon.ico` endpoints either return 404 or HTML rather than an image. Keep the existing fallback glyphs; do not hotlink an error page or invent a brand favicon.

## Recent-work coverage

- Reviewed recent task metadata, current public repository metadata, the complete `alirezaafshan.com` DNS inventory, Cloudflare Pages/custom Worker domains, and https://deploy.alirezaafshan.com/api/topology.
- Pocket Pal, Frame by Frame, and Cosmic Courier have public source repositories, but their current handoff says no website deployment; GitHub deployment lists were also empty. They are not added as live websites.
- The incremental technology game documents a local-only preview and no deployment.
- The Fluoddity-study work is the already-listed Agar Protocol deployment.
- Oyster House's publicly accessible sleeping page was the only additional first-party hostname found. DNS presence alone was not treated as proof of a functioning app.

## Recheck

Run `node scripts/audit-world-links.mjs` for read-only HTTP checks of both current catalogs. It reports the final URL, status, title, canonical declaration, and declared icon responses. An optional `--output outputs/report.json` retains a dated local receipt. A 200 response is only an HTTP/identity check, not full application-functionality verification. Missing or HTML-valued favicons must not be treated as valid image assets.

The URL catalog is shared by the interactive worlds, `sites.json`, `llms.txt`, and structured data, so corrections propagate to all four surfaces. No destination application, DNS record, repository metadata, or deployment was changed by this audit.
