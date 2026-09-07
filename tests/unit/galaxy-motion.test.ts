import { readFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WorldPreview, WorldComms } from '../../components/world-comms';
import { destinations } from '../../data/worlds';

const motionCss = await readFile('app/galaxy-motion.css', 'utf8');
const galaxySource = await readFile('components/galaxy-index.tsx', 'utf8');

describe('selected galaxy motion integration', () => {
  it('mounts the preview screw on its folding plate, not the stationary wrapper', async () => {
    const chromeCss = await readFile('app/world-comms.css', 'utf8');
    expect(chromeCss).toContain('.world-preview-address::after');
    expect(motionCss).toContain('.world-preview-address::after');
    expect(chromeCss).not.toContain('.world-preview-screen::after');
    expect(motionCss).not.toContain('.world-preview-screen::after');
  });
  it('starts static during opening, not after the hinges settle', () => {
    const staticMotion = motionCss.slice(
      motionCss.indexOf('@keyframes galaxy-static-resolve'),
    );
    expect(staticMotion).toMatch(/0%\s*\{\s*opacity: 0\.55/);
    expect(staticMotion).toMatch(/84%,\s*100%\s*\{\s*opacity: 0/);
  });
  it('keeps preview arrival and hover artwork inside one stable button', () => {
    const markup = renderToStaticMarkup(
      createElement(WorldPreview, {
        world: destinations[0],
        previewRef: { current: null },
        hint: false,
        onInspect: () => undefined,
      }),
    );
    expect(markup.match(/<button\b/g)).toHaveLength(1);
    expect(markup).toContain('class="preview-motion"');
    expect(markup).toContain('class="preview-orbit-arrival"');
    expect(markup.match(/class="comms-screen-static"/g)).toHaveLength(3);
    expect(markup).toContain('aria-label="Inspect Alireza Afshan"');
  });
  it('retains passive hints and the real modal close control', () => {
    const hint = renderToStaticMarkup(
      createElement(WorldPreview, {
        world: destinations[0],
        previewRef: { current: null },
        hint: true,
        onInspect: () => undefined,
      }),
    );
    expect(hint).toContain('aria-hidden="true"');
    expect(hint).toContain('tabindex="-1"');
    const panel = renderToStaticMarkup(
      createElement(WorldComms, {
        world: destinations[0],
        detailRef: { current: null },
        onClose: () => undefined,
      }),
    );
    expect(panel).toContain('aria-label="Close world details"');
    expect(panel).toContain('class="world-close-symbol" aria-hidden="true"');
    expect(panel.match(/<a\b/g)).toHaveLength(2);
    expect(panel.match(/target="_blank"/g)).toHaveLength(2);
  });
  it('keeps outgoing cards inert and hidden even when React rerenders their props', () => {
    const preview = renderToStaticMarkup(
      createElement(WorldPreview, {
        world: destinations[0],
        previewRef: { current: null },
        hint: false,
        leaving: true,
        onInspect: () => undefined,
      }),
    );
    const detail = renderToStaticMarkup(
      createElement(WorldComms, {
        world: destinations[0],
        detailRef: { current: null },
        leaving: true,
        onClose: () => undefined,
      }),
    );
    for (const markup of [preview, detail]) {
      expect(markup).toContain('aria-hidden="true"');
      expect(markup).toContain('inert=""');
      expect(markup).toContain('data-phase="leaving"');
    }
  });
  it('does not replace the renderer-owned root transforms or footer spin', () => {
    expect(motionCss).not.toMatch(
      /\.spore-shell\s+\.(?:world-preview|world-detail|dock-orb)\s*\{[^}]*\btransform:/,
    );
    expect(galaxySource).toContain('<CommsPresence');
    expect(galaxySource).toContain('className="dock-flywheel"');
    expect(galaxySource).toContain('dockGalaxyIconRef.current.style.transform');
    expect(galaxySource).toContain(
      'previewElement.style.transform = `translate3d(${previewX}px',
    );
  });
  it('provides a motion-free path without hiding readable content', () => {
    const reduced = motionCss.slice(
      motionCss.indexOf('@media (prefers-reduced-motion: reduce)'),
    );
    expect(reduced).toContain('animation: none !important');
    expect(reduced).toContain('transition: none !important');
    expect(reduced).toContain('.spore-shell .comms-screen-static');
    expect(reduced).not.toMatch(/\.world-preview-name-text[^}]*opacity:\s*0/);
  });
});
