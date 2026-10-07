---
name: rich-embed
description: Build playable website or game embeds and rich social link cards. Use for X/Twitter Player Cards, compact iframe views, Open Graph previews, rich splash cards, or making an existing site shareable across platforms. This concerns sharing the user's site outward, not inserting someone else's social post into it.
---

# Rich Embed

Make a site's core experience travel well: a compact interactive view where the destination supports one, and a useful image-and-text preview elsewhere. Keep the full website usable. This is a reusable capability for existing projects and website-building workflows, not a hosting product or a requirement to redesign every site.

## Choose the surface

Inspect the selected project, its current metadata, rendering/build system, deployment configuration, and requested destination. Distinguish the **share URL** crawled for metadata, the **embed URL** loaded in a frame, and the **preview image**. The share URL is usually the normal page; `/embed` is a useful convention, not a required route name.

- For X/Twitter, read [references/x-player-card.md](references/x-player-card.md). An interactive game in a Player Card is experimental; do not present a historical video-card sample or a successful crawler check as a guarantee of current game support.
- For another destination or a compatibility question, read [references/platforms.md](references/platforms.md) and check its current official documentation. An Open Graph card, an oEmbed response, an iframe, and a platform app are different mechanisms.
- For a website builder, inspect whether it supports raw initial HTML metadata, a public embed route, and the required response headers. If a necessary capability is unavailable, implement the supported preview and explain the exact limitation. Do not switch hosts automatically.

Use the existing `frontend-quality` skill for interface changes and relevant project setup instructions. Creating an embed does not authorize a social post, account integration, publication, or changes to another site. Honor authorization already established for this task; do not ask again for the same authorized action. Use `vps-operations` for an authorized deployment on Alireza's infrastructure and `credentials-access` when authentication is needed.

## Build the compact experience

Reuse the app's real scene, state, or game logic. Give the embedded view only the controls needed for its core loop, plus an accessible way to open the full experience. Start from a meaningful view; avoid filling a small frame with navigation or a marketing splash screen. Choose the aspect ratio for the experience. Fit cameras and controls to the actual remaining canvas width and height; phone-width breakpoints alone can crop a short card. Adapt presentation without silently changing a simulation's model.

Use the simplest route the existing stack can deliver intentionally: a shared HTML entry with compact mode, a separate entry sharing the same engine, or a framework route. A second bundle or duplicate app is not inherently required. When useful, carry the selected preset, world, or conditions into the full-site link; distinguish restoring that selection from restoring a complete simulation state.

Make the frame work at narrow widths, with touch and keyboard input. Preserve accessible names, focus, legible contrast, and useful loading/error states. Use a user gesture for audio and other browser-gated actions. Account for blocked third-party storage or authentication when the app depends on them. Do not add logins, trackers, or SDKs just to make a public toy embeddable.

For animated or GPU-heavy experiences, bound pixel ratio and rendering cost. Suspend expensive work when hidden or outside the viewport, including renderer loops, workers, simulation timers, and tours that operate independently. Keep visibility/activity separate from deliberate user pause so returning onscreen preserves the user's choice. Respect reduced motion. Use a compact quality preset only when it helps this app.

## Make the share URL crawlable

Put the relevant Open Graph and Twitter card tags in the initial HTTP HTML, using the framework's server/static metadata path. Client-only updates after JavaScript executes are insufficient evidence that a crawler can see the card. Preserve independent metadata for credits, articles, and other unrelated routes; avoid duplicate or conflicting card tags.

Use public absolute HTTPS URLs for production player and image resources. Provide honest titles, descriptions, image dimensions, and alt text. Capture a real, readable view of the experience when appropriate. A landscape Open Graph image and a differently shaped player poster can coexist. Never invent an account handle or treat the HTML app as a video stream.

Configure framing on the embed response for the intended parent origins. `frame-ancestors` belongs in an HTTP Content-Security-Policy header, not an HTML meta tag. Inspect all effective policies, inherited headers, and X-Frame-Options at the CDN/proxy as well as the app. Keep broader site protections intact. Set the allowlist for the actual destination. If unrestricted public embedding is intended, make that choice explicitly in the project design.

## Verify the actual delivery path

Use proportional project checks and browser QA. For an interactive embed, verify:

1. The share URL returns the expected raw metadata without authentication or a bot challenge; player and image requests return the expected types and HTTPS redirects. Check the effective framing headers and missing-asset behavior.
2. The compact view fits its target and a narrow viewport, and works inside an actual iframe. Exercise the core loop, touch/keyboard controls, opening the full experience, and the normal website. For heavy animation, observe that hidden/offscreen work really stops and resumes correctly.
3. When publication is authorized, verify the deployed bytes/version and final public headers through the existing pipeline. Then use the destination's available validator or preview. Test in the actual destination client when accessible and authorized; report any untested step precisely.

The standard-library helper [scripts/inspect_embed.py](scripts/inspect_embed.py) performs a read-only HTTP inspection. Run it against a public share URL, or an explicit local preview:

```powershell
python <skill-directory>/scripts/inspect_embed.py https://example.com/ --resources
```

It reports raw metadata, relevant headers, redirect hops, and optional player/image responses. Resource inspection follows the URLs exactly as declared: production absolute URLs in a local build still fetch production. Check local resources explicitly when verifying unpublished work. Exit 1 indicates a reported request or HTTP failure; exit 0 is not card validation. It does not execute JavaScript, interpret the complete CSP, validate image dimensions, or certify platform support. `--user-agent` can select a crawler identity; a simulated user agent is not the actual platform crawler. Run a browser check as well.

## Leave it reusable

Document the chosen share/embed URLs, parent origins, image source, and relevant checks in the project's existing instructions. Give the user the share URL and, if useful, a copyable iframe snippet with an accessible title and only the permissions the experience needs.

Distinguish **implemented locally**, **deployed**, **accepted by a card validator**, and **played successfully in the destination**. Include the destination/client and date for observed platform behavior. Keep future work within the current request instead of enabling every platform or publishing posts as a side effect.
