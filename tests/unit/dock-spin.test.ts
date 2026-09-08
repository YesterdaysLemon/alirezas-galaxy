import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { DockHover, DockSpin } from '../../lib/dock-spin';

describe('galaxy dock flywheel', () => {
  it('mirrors full click kicks, then rejoins the live angle with no held offset', () => {
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

describe('kick-and-coast dock hover', () => {
  it('starts with a hard third-turn, then slows forward into the live angle', () => {
    const hover = new DockHover();
    expect(hover.step(1)).toBe(0);
    hover.nudge(1);
    const kick = hover.step(0.1);
    expect(kick).toBeCloseTo((2 * Math.PI) / 3);
    let previous = kick;
    let previousDelta = kick;
    for (let frame = 0; frame < 14; frame++) {
      const next = hover.step(0.1);
      const delta = next - previous;
      expect(delta).toBeGreaterThan(0);
      expect(delta).toBeLessThan(previousDelta);
      previous = next;
      previousDelta = delta;
    }
    expect(previous).toBeCloseTo(2 * Math.PI, 2);
    expect(hover.step(0.11)).toBe(0);
    expect(hover.step(5)).toBe(0);
  });

  it('stays bounded and continuous when retriggered or handed to a click', () => {
    const hover = new DockHover();
    hover.nudge(1);
    hover.step(0.45);
    const pose = hover.angle;
    hover.nudge(-1);
    expect(hover.step(0)).toBe(pose);
    for (let frame = 0; frame < 90; frame++) {
      const previous = hover.angle;
      const next = hover.step(1 / 120);
      expect(next).toBeLessThanOrEqual(previous);
      expect(Math.abs(next)).toBeLessThanOrEqual(2 * Math.PI);
    }
    const click = new DockSpin();
    click.angle += hover.angle;
    hover.reset();
    const handedPose = click.angle;
    click.kick(-1);
    expect(click.angle).toBe(handedPose);
    expect(hover.angle).toBe(0);
    expect(click.step(5)).toBe(0);
  });

  it('is frame-rate independent and respects reduced motion', () => {
    const a = new DockHover();
    const b = new DockHover();
    a.nudge(-1);
    b.nudge(-1);
    a.step(0.5);
    for (let frame = 0; frame < 60; frame++) b.step(1 / 120);
    expect(a.angle).toBeCloseTo(b.angle, 10);
    expect(a.step(0.1, true)).toBe(0);
    expect(a.step(0.1)).toBe(0);
  });
});
