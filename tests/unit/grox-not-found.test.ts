import { readFile } from 'node:fs/promises';
import { createElement, type AnchorHTMLAttributes } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: (props: AnchorHTMLAttributes<HTMLAnchorElement>) =>
    createElement('a', props),
}));

import {
  GroxNotFound,
  GROX_TRANSMISSIONS,
} from '../../components/grox-not-found';

describe('Grox missing-sector transmission', () => {
  it('starts with a galaxy approach and keeps the native modal closed until arrival', () => {
    const html = renderToStaticMarkup(createElement(GroxNotFound));
    expect(html).toMatch(/<dialog class="grox-dialog"/);
    expect(html).not.toMatch(/<dialog[^>]*\bopen=/);
    expect(html).toContain('data-grox-encounter="true"');
    expect(html).toContain('data-arrived="false"');
    expect(html).toContain('Open transmission');
    expect(html).toContain('<noscript>');
    expect(html).toContain('aria-labelledby="grox-title"');
    expect(html).toContain('aria-describedby="grox-warning"');
    expect(html).toContain('The Grox Empire');
    expect(html).toContain(GROX_TRANSMISSIONS.arrival.headline);
    expect(html).toContain('404 · Coordinates not found');
    expect(html).toContain('data-ready="false"');
    expect(html).toContain('VISUAL SIGNAL LOST');
  });

  it('provides same-window exits and a non-submitting peace reply', () => {
    const html = renderToStaticMarkup(createElement(GroxNotFound));
    expect(html.match(/href="\/#galaxy"/g)).toHaveLength(3);
    expect(html).not.toContain('target="_blank"');
    expect(html).toContain('End transmission and return to the galaxy');
    expect(html).toContain('<button type="button"');
    expect(html).toContain('We come in peace.');
    expect(html).toContain('aria-live="polite"');
    expect(GROX_TRANSMISSIONS.peace.hostility).toBeLessThan(
      GROX_TRANSMISSIONS.arrival.hostility,
    );
    expect(GROX_TRANSMISSIONS.peace.headline).not.toBe(
      GROX_TRANSMISSIONS.arrival.headline,
    );
  });

  it('uses a local original-game video while preserving the generated fallback', async () => {
    const html = renderToStaticMarkup(createElement(GroxNotFound));
    expect(html).toContain('src="/not-found/grox-angry.mp4"');
    expect(html).toContain('poster="/not-found/grox-angry-poster.jpg"');
    expect(html).toContain('width="416" height="520"');
    expect(html).toContain('playsInline=""');
    expect(html).toContain('loop=""');
    expect(html).not.toContain('<iframe');
    expect(html).not.toContain('Pause portrait');
    expect(html).not.toContain('Play portrait');
    expect(html).not.toContain('grox-pause');
    const clip = await readFile('public/not-found/grox-angry.mp4');
    expect(Array.from(clip.subarray(4, 8))).toEqual([102, 116, 121, 112]);
    expect(clip.byteLength).toBeLessThan(1_000_000);
    const png = await readFile('public/not-found/grox-portrait.png');
    expect(Array.from(png.subarray(0, 8))).toEqual([
      137, 80, 78, 71, 13, 10, 26, 10,
    ]);
    const header = new DataView(png.buffer, png.byteOffset, png.byteLength);
    expect(header.getUint32(16)).toBe(1254);
    expect(header.getUint32(20)).toBe(1254);
  });

  it('routes normal exits through the animated scene instead of a document navigation', async () => {
    const component = await readFile('components/grox-not-found.tsx', 'utf8');
    const scene = await readFile('components/galaxy-index.tsx', 'utf8');
    expect(component).not.toContain('window.location.assign');
    expect(component).toContain('groxLeaving={leaving}');
    expect(component).toContain('onGroxReturn={onReturn}');
    expect(component).toContain('window.history.replaceState');
    expect(scene).toContain('groxRetreating && retreat.returned');
    expect(scene).toContain('if (groxEncounter && !groxReturned)');
  });

  it('keeps the 404 takeover scrollable and provides a reduced-motion override', async () => {
    // These are stylesheet contracts, not claims of browser interaction QA.
    const css = await readFile('app/grox-not-found.css', 'utf8');
    expect(css).toContain('overflow: auto');
    expect(css).toContain('100dvh');
    expect(css).toContain('@media (max-width: 700px)');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('animation: none !important');
    expect(css).toContain('min-height: 44px');
    expect(css).toContain('grid-column: 1 / -1');
  });
});
