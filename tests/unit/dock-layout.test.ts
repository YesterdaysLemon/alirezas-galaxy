import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GalaxyIndex } from '../../components/galaxy-index';
import { dockOutline } from '../../components/dock-housing';

describe('paired galaxy dock', () => {
  const markup = renderToStaticMarkup(createElement(GalaxyIndex));
  const controls = markup.split('class="dock-buttons"')[1].split('</div>')[0];
  const capsule = markup.split('class="dock-console"')[1].split('</div>')[0];

  it('keeps both real buttons together outside the text capsule', () => {
    expect(controls.match(/<button\b/g)).toHaveLength(2);
    expect(controls).toContain('aria-label="Spin the galaxy faster"');
    expect(controls).toContain('aria-label="Show next footer transmission"');
    expect(capsule).not.toContain('<button');
    expect(capsule).toContain('id="dock-transmission"');
  });

  it('keeps the decorative chrome passive and the tuner connected to its text', () => {
    expect(markup).toContain('class="dock-chrome" aria-hidden="true"');
    expect(markup).not.toContain('class="dock-chrome-rail"');
    expect(controls.match(/<rect\b/g)).toHaveLength(5); // next-world stop + four windows
    expect(capsule).toContain('class="dock-text"');
    expect(controls).toContain('aria-controls="dock-transmission"');
    expect(controls).toContain('data-icon="spore-main-menu-spiral"');
    expect(controls).toContain('data-icon="next-world"');
    expect(controls).toContain('data-icon="cycle-transmission"');
    expect(capsule).toContain('aria-live="polite"');
  });
  it('uses a concentric 33px socket and a centered 38px text bay at every width', () => {
    for (const width of [254, 312, 542]) {
      const outline = dockOutline(width);
      expect(outline).toContain('M33 0');
      expect(outline).toContain('H33 A33 33 0 0 1 33 0 Z');
      expect(outline).toContain(`H${width - 19} A19 19 0 0 1 ${width - 19} 66`);
    }
  });
  it('keeps equal face gaps and six-pixel cradles without overlapping circular hit areas', () => {
    const centers = Math.hypot(81 - 33, 44 - 33);
    expect(centers - 27 - 16).toBeCloseTo(6, 0);
    expect(centers).toBeGreaterThanOrEqual(27 + 22);
    expect(103 - (81 + 16)).toBe(6); // small face -> pill
    expect(33 - 27).toBe(6); // large cradle
    expect(22 - 16).toBe(6); // small cradle
    expect(19 - 13).toBe(6); // concentric pill end
    const outline = dockOutline(278);
    expect(outline).toContain('81 22');
    expect(outline).toContain('66 H33 A33'); // no scallops along the base
    expect([33 + 27, 44 + 16, 47 + 13]).toEqual([60, 60, 60]);
  });
});
