# X / Twitter Player Card recipe

Use this reference when a user wants their game or website to open within an X card. Recheck current platform behavior and official requirements before making compatibility or policy claims.

## Evidence and limits

The [official Player Card sample](https://github.com/xdevplatform/cards-player-samples/blob/main/player/page.html) shows an HTTPS iframe URL and explicit dimensions. It demonstrates a video card; it does not establish that arbitrary games are an officially supported product category. Historical documentation URLs can redirect to unrelated pages. Do not quote an old mirror as current policy or infer universal support from another person's post.

The [X Card Validator](https://cards-dev.x.com/validator) can establish crawler acceptance. A report that the player tag was found or the card loaded is not proof of activation inside a published post. Record those outcomes separately.

## Metadata pattern

Place these tags in the initial HTML of the URL the user will share. Substitute the real origin, content, dimensions, and images. Keep normal Open Graph tags alongside them for clients using an image preview.

```html
<link rel="canonical" href="https://example.com/" />
<meta property="og:type" content="website" />
<meta property="og:url" content="https://example.com/" />
<meta property="og:title" content="Experience title" />
<meta property="og:description" content="A concrete description of the experience." />
<meta property="og:image" content="https://example.com/social-preview.png" />
<meta property="og:image:alt" content="Description of the preview image." />

<meta name="twitter:card" content="player" />
<meta name="twitter:title" content="Experience title" />
<meta name="twitter:description" content="A concrete description of the experience." />
<meta name="twitter:image" content="https://example.com/player-preview.png" />
<meta name="twitter:image:alt" content="Description of the player poster." />
<meta name="twitter:player" content="https://example.com/embed" />
<meta name="twitter:player:width" content="480" />
<meta name="twitter:player:height" content="480" />
```

Use only an account identity supplied or verified for this project if adding `twitter:site`. Do not add `twitter:player:stream` with a URL serving HTML; that field concerns media. Keep the player independently reachable and useful if opened directly.

Some framework player descriptors require a media stream. For an HTML player, use the framework's supported custom metadata fields and verify the raw output instead of filling a required stream field with the app URL.

For a static app, the server can map `/embed` to the existing built HTML when the app selects compact mode from the pathname. Use a separate build entry only when useful. With SSR, use the framework's route and metadata facilities. Verify raw production-style responses, not just a development server's SPA fallback.

## Frame and route delivery

A starting allowlist for an X-only player is:

```http
Content-Security-Policy: frame-ancestors 'self' https://x.com https://*.x.com https://twitter.com https://*.twitter.com
```

Adapt it to the actual frame ancestry and destination. Merge with the existing security design; do not replace unrelated CSP directives. Multiple CSP headers all constrain the page. `default-src` is not a substitute for `frame-ancestors`, and adding an HTML meta policy cannot fix frame ancestry. See the [frame-ancestors documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors).

Check the embed response for conflicting X-Frame-Options and upstream policies. Avoid weakening the entire site's framing policy to fix one route. Where an allowlist is used, an unrelated parent should fail to frame it.

For Nginx, an exact location can serve the built player HTML. Keep framing headers scoped to that response; adding location-level `add_header` directives can suppress inherited headers, so verify the complete response. Behind TLS termination, an absolute redirect can incorrectly use internal HTTP. For an alternate spelling of the route, `absolute_redirect off; return 308 /embed$is_args$args;` preserves the query in a relative Location. These are Nginx considerations, not a required server migration. Inspect every redirect hop at the public URL.

Serve the poster as a real image with correct content type, matching aspect ratio, and a useful scene before activation. Avoid authentication, bot challenges, mixed content, and asset paths that resolve to the SPA fallback instead of a missing-file response.

## Acceptance and caching

- Inspect raw share HTML and the player/image responses. The helper in this skill is a convenient first pass.
- Exercise the experience in a compact sandboxed iframe, including the permissions needed to open the full site. Do not grant broad permissions merely to make a test pass. A local iframe still cannot reproduce every X client restriction.
- After an authorized deployment, try the actual card validator or composer preview where available. The validator UI may provide diagnostics without a visual preview. Report its exact result.
- If cached metadata is suspected, try one fresh, harmless versioned share URL after confirming the underlying resources are correct. A query parameter is a diagnostic attempt, not a guaranteed cache purge; keep the canonical URL stable unless the content identity changed.
- Verify real activation in the intended X client when a post exists or posting has been authorized. Preparing a card does not authorize posting. If this check cannot be done, finish the authorized work and state that actual in-post playback remains unverified.

If current platform restrictions reject the interactive player, retain a polished image preview linking to the complete experience. Explain the observed limitation; do not label a rejected or untested player as working everywhere.
