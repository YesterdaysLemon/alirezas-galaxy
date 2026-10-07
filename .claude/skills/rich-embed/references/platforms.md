# Pick the destination mechanism

Documentation checked on 2026-10-07. These are starting points, not permanent compatibility promises. Recheck the requested platform and distinguish documented mechanisms from an implementation tested in its current client.

| Destination | Appropriate approach | What to establish |
| --- | --- | --- |
| The user's own website, portfolio, or another host allowing HTML iframes | Embed the compact public route directly. | The parent permits the frame, the child permits the actual parent origins, and the sandbox/permissions allow the intended controls. A user-controlled host is usually the most direct route to a fully interactive embed. |
| X / Twitter | Player Card metadata on a public share URL, pointing to the compact experience. | Treat a game inside the player as experimental and verify client playback separately from metadata acceptance. Read [x-player-card.md](x-player-card.md). |
| itch.io | Package an HTML/CSS/JavaScript build for its HTML5 project player. | itch.io documents uploaded HTML projects running in an iframe. Use relative assets and test the packaged build. Its separate purchase/download widget is not the playable game. [HTML5 guide](https://itch.io/docs/creators/html5), [widget guide](https://itch.io/docs/creators/widget). |
| Notion | Try the public embed URL in an Embed block. | Notion supports external embeds and uses Iframely for many domains, but that is not proof that every custom domain works. Check the exact URL, parent origins, and desktop/mobile behavior; authenticated external embeds have limitations. [Notion embed guide](https://www.notion.com/help/embed-and-connect-other-apps). |
| Bluesky website link cards | Supply Open Graph title, description, and image. | The documented external-card format is a URL, title, description, and optional thumbnail. It is a link preview, not an arbitrary app runtime. [Official post/card guide](https://github.com/bluesky-social/bsky-docs/blob/main/docs/advanced-guides/posts.md#website-card-embeds). |
| Slack ordinary link sharing | Supply Open Graph and Twitter metadata for classic unfurling. | Rich app unfurls are a separate Slack integration. A metadata preview does not imply execution of the website's JavaScript. [Slack unfurling guide](https://docs.slack.dev/messaging/unfurling-links-in-messages/). |
| Discord interactive experience | A Discord Activity is a separate integration using its Embedded App SDK. | Discord documents Activities as web apps in iframes. Do not promise that pasting an ordinary website link creates an Activity, or create an app integration without task scope. [Activities overview](https://docs.discord.com/developers/activities/overview). |

For other social feeds, messaging apps, document tools, or site builders, determine whether the destination accepts an arbitrary iframe, a supported-provider embed, media only, or image-and-text metadata. An oEmbed endpoint can advertise HTML, but consumers decide which providers and content they accept; adding one does not make every service run the app.

When recommending targets, separate the cost of adding metadata or an iframe from packaging a build or developing a platform app. A small game, visual toy, simulation, or audio player often has a useful compact core. A large editor or account-dependent dashboard may need a limited demo or a preview linking to the full site. These are design judgments; inspect the actual experience before choosing.

## Direct iframe starting point

Adapt the ratio, title, and permitted features to the experience:

```html
<iframe
  src="https://example.com/embed"
  title="Try the interactive experience"
  width="480"
  height="480"
  loading="lazy"
  style="width:100%;max-width:480px;aspect-ratio:1;height:auto;border:0"
></iframe>
```

This minimal snippet is for a trusted experience on a host the user controls. Apply the host's sandbox policy when appropriate and grant only needed capabilities. Test loading and interaction in the real parent page. Do not paste this snippet into a destination that expects a plain embed URL, such as Notion's Embed block.
