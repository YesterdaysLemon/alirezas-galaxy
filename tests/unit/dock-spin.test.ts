import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { DockSpin } from '../../lib/dock-spin';

describe('galaxy dock flywheel', () => {
  it('mirrors hover and press, then rejoins the live angle with no held offset', () => {
    const hover = new DockSpin();
    const press = new DockSpin();
    hover.kick(1);
    press.kick(-1);
    expect(hover.step(0.1)).toBeGreaterThan(0);
    expect(press.step(0.1)).toBeCloseTo(-hover.angle);
    hover.step(5);
    press.step(5);
    expect(hover.angle).toBe(0);
    expect(press.angle).toBe(0);
  });

  it('slows down independently of frame rate', () => {
    const a = new DockSpin();
    const b = new DockSpin();
    a.kick(1);
    b.kick(1);
    const first = a.step(0.1);
    const second = a.step(0.1) - first;
    expect(second).toBeLessThan(first);
    for (let frame = 0; frame < 24; frame++) b.step(1 / 120);
    expect(a.angle).toBeCloseTo(b.angle, 10);
  });

  it('reverses mid-flight without snapping and suppresses reduced-motion kicks', () => {
    const spin = new DockSpin();
    spin.kick(1);
    const angle = spin.step(0.2);
    spin.kick(-1);
    expect(spin.angle).toBe(angle);
    expect(spin.step(0.01)).toBeLessThan(angle);
    expect(spin.step(0.01, true)).toBe(0);
    spin.kick(1);
    spin.reset();
    expect(spin.step(0.1)).toBe(0);
  });

  it('provides matching five- and three-arm assets', async () => {
    for (const [file, arms] of [
      ['spiral-galaxy.svg', 5],
      ['spiral-galaxy-3.svg', 3],
    ] as const) {
      const svg = await readFile(`public/${file}`, 'utf8');
      expect(svg.match(/<path\b/g)).toHaveLength(arms);
      expect(svg).toContain('viewBox="0 0 256 256"');
      expect(svg).toContain('fill="#d6f5ff"');
    }
  });

  it('composes the temporary phase with the live renderer angle, not a CSS hover twist', async () => {
    const source = await readFile('components/galaxy-index.tsx', 'utf8');
    const css = await readFile('app/galaxy-motion.css', 'utf8');
    expect(source).toContain('${-galaxy.rotation.y + dockPhase}rad');
    expect(source.replace(/\s+/g, ' ')).toContain(
      "galaxyId === 'webring' ? '/spiral-galaxy-3.svg' : '/spiral-galaxy.svg'",
    );
    expect(css).not.toContain('transform: rotate(150deg)');
  });
});
