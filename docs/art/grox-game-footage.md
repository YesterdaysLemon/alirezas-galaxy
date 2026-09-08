# Grox 404: original-game reference and motion

This 404 screen uses original Spore gameplay footage for the portrait, not
an AI-animated still. The earlier generated interpretation remains unchanged in
`public/not-found/grox-portrait.png` as a video-error fallback.

## Sources

- Full communications-screen reference: [Steam screenshot](https://steamcommunity.com/sharedfiles/filedetails/?id=297289141).
- [Original screenshot image](https://images.steamusercontent.com/ugc/572274571167746581/C68975CB153640F96157292D7F724512C217A19C/).
- Game animation recording: SPEX-TRAY, [Grox communication animations, higher-quality version](https://www.youtube.com/watch?v=sm_daUty4Ak).
- The higher-quality URL is linked by the creator in the description of the
  [public original recording](https://www.youtube.com/watch?v=Z0SiZbQePHc).
- Selected interval: **1:46–1:54**, the angry animation. Downloaded through normal
  public access without account cookies or authentication workarounds.

The video metadata did not provide an explicit reuse license. Attribution is
recorded here; this is **not** a claim of permission, public-domain status, or
affiliation with Spore/EA/Maxis or the recording's creator. The project owner
approved publication of this version; third-party reuse permission remains
unverified. The footage and extracted poster are not licensed under the
repository's MIT license.

## Prepared assets

- `public/not-found/grox-angry.mp4`: 8 seconds, 416×520, 30 fps, H.264/yuv420p,
  silent (no audio track), fast-start MP4, approximately 655 KiB.
- `public/not-found/grox-angry-poster.jpg`: a frame at 0.7 seconds from that clip.
- Raw source segment: 1080×1920, 60 fps. Kept outside the website checkout.
- Crop: `1040:1300:20:324` (width:height:x:y), removing the recording's labels
  and most of its existing frame while retaining the game portrait/room.

Preparation command, with a local source segment:

```powershell
ffmpeg -i grox-angry-hq-source.mkv -an -vf "crop=1040:1300:20:324,scale=416:520:flags=lanczos,fps=30" -c:v libx264 -crf 22 -preset slow -pix_fmt yuv420p -movflags +faststart grox-angry.mp4
ffmpeg -ss 0.7 -i grox-angry.mp4 -frames:v 1 -q:v 3 grox-angry-poster.jpg
```

## Interface and motion decisions

The screenshot's layout, rather than the previous site's conventions, is the
primary reference: narrow tall portrait left, broad dialogue pane right,
magenta empire tab over the dialogue, full-width response tray beneath both,
dark cyan scanlines, amber text, blue/olive replies, and an amber Goodbye button.
Chrome is independently authored CSS and semantic HTML, not the screenshot
used as a flat interactive background. The small title icons use native emoji;
they are not extracted game UI icons. This is reference-led, not a verified
pixel-identical recreation.

The existing Three.js galaxy runs in a non-interactive encounter mode. A red
star at local coordinates `(2.2, 0.65, 1.5)` is near the galactic core. The camera
holds for 350 ms, approaches for 1850 ms, and settles for 180 ms before opening
the native modal. The parked galaxy stops continuous rendering. Reduced motion
skips travel and defaults to a still portrait. There is no portrait playback
button; hidden-page playback always pauses. A 4.5-second fallback
and an Open transmission button prevent unavailable WebGL from blocking exits.

Unknown paths still return HTTP 404. The leave reply, Goodbye, and Escape close
the transmission and reverse the camera approach over 1.5 seconds. At completion
the same canvas becomes the interactive main galaxy and the URL becomes
`/#galaxy`, without a document reload. Early exits reverse from the current
camera pose; reduced motion skips the zoom. Modified link clicks retain normal
browser navigation. Publication of this version was approved on 2026-09-08.
