import { readFile } from 'node:fs/promises';
import { createElement, type ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { StaticLab } from '../../components/static-lab';
import { staticEffects, staticRevealDelay } from '../../data/static-lab';

// Vinext supplies next/link at build time; this unit test only checks markup.
vi.mock('next/link', () => ({
  default: (props: ComponentProps<'a'>) => createElement('a', props),
}));

describe('static effects lab', () => {
  it('offers eight distinct, stable recipe IDs including both combined textures', () => {
    expect(staticEffects.map((item) => item.id)).toEqual([
      'S1',
      'S2',
      'S3',
      'S4',
      'S5',
      'S6',
      'S7',
      'S8',
    ]);
    expect(new Set(staticEffects.map((item) => item.name)).size).toBe(8);
  });
  it('simulates the minimum and loading gates concurrently, not sequentially', () => {
    expect(staticRevealDelay(500, 0)).toBe(500);
    expect(staticRevealDelay(500, 100)).toBe(500);
    expect(staticRevealDelay(500, 1500)).toBe(1500);
  });
  it('starts with held static, the actual card, and accessible controls', () => {
    const html = renderToStaticMarkup(createElement(StaticLab));
    expect(html).toContain('HOLDING STATIC');
    expect(html).toMatch(/aria-label="Static effect preview" data-effect="S8"/);
    expect(html).toContain('data-ready="false"');
    expect(html).toContain('data-world-id="portfolio"');
    expect(html).toContain('aria-label="Inspect Alireza Afshan"');
    expect(html.match(/type="range"/g)).toHaveLength(5);
    expect(html).toContain('Copy this recipe');
    for (const effect of staticEffects) expect(html).toContain(effect.name);
  });
  it('contains motion-safe textures scoped to the lab, without the galaxy shell', async () => {
    const css = await readFile('app/static-lab/static-lab.css', 'utf8');
    expect(css).not.toContain('.spore-shell');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('animation-play-state: paused');
    for (const effect of staticEffects.slice(1))
      expect(css).toContain(`[data-effect='${effect.id}']`);
  });
  it('keeps screen textures in equal stacking contexts behind the portrait', async () => {
    const css = await readFile('app/static-lab/static-lab.css', 'utf8');
    expect(css).toMatch(
      /\.static-lab \.preview-orbit-arrival\s*\{[^}]*z-index: 2;/,
    );
    expect(css).toMatch(
      /\.static-lab \.world-preview-screen\s*\{[^}]*z-index: 1;[^}]*isolation: isolate;/,
    );
    expect(css).toMatch(
      /\.static-lab \.world-preview-label,\s*\.static-lab \.world-preview-address\s*\{[^}]*z-index: 0;[^}]*isolation: isolate;/,
    );
    expect(css).toMatch(
      /\[data-effect='S7'\] \.comms-screen-static::after,\s*\.static-lab \[data-effect='S8'\] \.comms-screen-static::after\s*\{[^}]*animation: sl-hold/,
    );
  });
  it('adds a gentler snow-and-hold recipe without claiming an exact Spore match', async () => {
    const css = await readFile('app/static-lab/static-lab.css', 'utf8');
    expect(css).toMatch(
      /\[data-effect='S8'\] \.comms-screen-static\s*\{[^}]*feTurbulence/,
    );
    expect(css).toMatch(
      /\[data-effect='S8'\] \.comms-screen-static::after\s*\{[^}]*opacity: 0\.22;[^}]*animation-duration: calc\(var\(--sl-roll\) \* 0\.28125\)/,
    );
    expect(
      staticEffects.find((item) => item.id === 'S8')?.description,
    ).toContain('Not an exact recreation');
  });
});
