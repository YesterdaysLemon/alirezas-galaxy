import type { SolarSystem } from '../../data/solar-systems';
import type { SolarBody } from './bodies';
import type { SolarShip } from './ship';

/** What the radar shows this frame. */
export type RadarFrame = {
  system: SolarSystem;
  bodies: readonly SolarBody[];
  /** The view's heading: forward is always up on the scope. */
  heading: number;
  hovered: number | null;
  selected: number | null;
  ship: Pick<SolarShip, 'root' | 'velocity' | 'size'> | null;
};

/** A live top-down scope of the system, drawn into the HUD's radar canvas. */
export class SolarRadar {
  private canvas: HTMLCanvasElement | null = null;
  private context: CanvasRenderingContext2D | null = null;
  /** Device pixels per CSS pixel on the scope. */
  private px = 1;
  private sweep = 0;
  /** The ship blip's eased heading, radians clockwise from up. */
  private shipHeading = 0;
  /** Orbits, belts and the star: they never move, so they are drawn once. */
  private backdrop: HTMLCanvasElement | null = null;
  private backdropKey = '';
  private readonly point = { x: 0, y: 0 };

  /** The HUD's scope canvas, when it is mounted. */
  attach(canvas: HTMLCanvasElement | null) {
    if (canvas === this.canvas) return;
    this.canvas = canvas;
    this.context = canvas?.getContext('2d') ?? null;
  }

  /** Re-read the scope's CSS size after a layout change. */
  measure() {
    if (this.canvas)
      this.px = this.canvas.width / Math.max(1, this.canvas.clientWidth);
  }

  /** Radar distance: square-root radial scale keeps inner worlds apart. */
  private reach(system: SolarSystem, distance: number, radius: number) {
    return Math.sqrt(Math.min(1, distance / system.extent)) * radius * 0.9;
  }

  /** Radar coordinates, written into a shared point. */
  private project(frame: RadarFrame, x: number, z: number, radius: number) {
    const distance = Math.hypot(x, z) || 1;
    const k = this.reach(frame.system, distance, radius) / distance;
    const sin = Math.sin(frame.heading),
      cos = Math.cos(frame.heading);
    this.point.x = radius + (x * cos - z * sin) * k;
    this.point.y = radius + (x * sin + z * cos) * k;
    return this.point;
  }

  private drawBackdrop(frame: RadarFrame, size: number) {
    const { system, bodies } = frame;
    const px = this.px;
    const key = `${system.id}/${bodies.length}/${size}/${px}`;
    if (this.backdrop && this.backdropKey === key) return this.backdrop;
    const canvas = (this.backdrop ??= document.createElement('canvas'));
    canvas.width = canvas.height = size;
    this.backdropKey = key;
    const g = canvas.getContext('2d');
    if (!g) return canvas;
    const r = size / 2;
    g.clearRect(0, 0, size, size);
    g.lineWidth = px;
    g.strokeStyle = 'rgba(150,215,235,0.2)';
    for (const body of bodies) {
      g.beginPath();
      g.arc(r, r, this.reach(system, body.recipe.orbit, r), 0, Math.PI * 2);
      g.stroke();
    }
    for (const belt of system.belts) {
      const kuiper = belt.kind === 'kuiper';
      g.beginPath();
      g.arc(
        r,
        r,
        this.reach(system, (belt.inner + belt.outer) / 2, r),
        0,
        Math.PI * 2,
      );
      g.setLineDash(kuiper ? [px, px * 3.5] : [px * 1.5, px * 2.5]);
      g.strokeStyle = kuiper
        ? 'rgba(170,215,240,0.3)'
        : 'rgba(210,190,160,0.32)';
      g.stroke();
    }
    g.setLineDash([]);
    const star = g.createRadialGradient(r, r, 0, r, r, r * 0.12);
    star.addColorStop(0, '#fffbe8');
    star.addColorStop(0.4, system.star.color);
    star.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = star;
    g.fillRect(r * 0.85, r * 0.85, r * 0.3, r * 0.3);
    return canvas;
  }

  draw(frame: RadarFrame, dt: number, animate: boolean) {
    const canvas = this.canvas;
    const g = this.context;
    if (!canvas || !g || !canvas.isConnected) return;
    const size = canvas.width;
    const r = size / 2;
    const px = this.px;
    g.clearRect(0, 0, size, size);
    g.save();
    g.beginPath();
    g.arc(r, r, r - px, 0, Math.PI * 2);
    g.clip();
    if (animate) this.sweep = (this.sweep + dt * 1.1) % (Math.PI * 2);
    const sweep = g.createConicGradient(this.sweep - Math.PI / 2, r, r);
    sweep.addColorStop(0, 'rgba(120,255,190,0.22)');
    sweep.addColorStop(0.1, 'rgba(120,255,190,0)');
    sweep.addColorStop(1, 'rgba(120,255,190,0)');
    g.fillStyle = sweep;
    g.fillRect(0, 0, size, size);
    g.drawImage(this.drawBackdrop(frame, size), 0, 0);
    g.lineWidth = px;
    for (let index = 0; index < frame.bodies.length; index++) {
      const body = frame.bodies[index];
      const p = this.project(
        frame,
        body.root.position.x,
        body.root.position.z,
        r,
      );
      const dot = Math.max(
        2.4 * px,
        Math.min(6 * px, body.recipe.radius * 2.2 * px),
      );
      if (index === frame.hovered || index === frame.selected) {
        g.beginPath();
        g.arc(p.x, p.y, dot + 4 * px, 0, Math.PI * 2);
        g.strokeStyle = index === frame.selected ? '#ffe16a' : '#b7f58e';
        g.lineWidth = 1.5 * px;
        g.stroke();
        g.lineWidth = px;
      }
      g.beginPath();
      g.arc(p.x, p.y, dot, 0, Math.PI * 2);
      g.fillStyle = body.recipe.atmosphere;
      g.fill();
    }
    if (frame.ship) this.drawShip(g, frame, dt, r);
    g.restore();
  }

  private drawShip(
    g: CanvasRenderingContext2D,
    frame: RadarFrame,
    dt: number,
    r: number,
  ) {
    const ship = frame.ship!;
    const px = this.px;
    const p = this.project(
      frame,
      ship.root.position.x,
      ship.root.position.z,
      r,
    );
    // The blip points along the ship's course, eased so it turns, not snaps.
    const v = ship.velocity;
    if (Math.hypot(v.x, v.z) > ship.size * 0.4) {
      const sin = Math.sin(frame.heading),
        cos = Math.cos(frame.heading);
      const course = Math.atan2(
        v.x * cos - v.z * sin,
        -(v.x * sin + v.z * cos),
      );
      const turn = Math.atan2(
        Math.sin(course - this.shipHeading),
        Math.cos(course - this.shipHeading),
      );
      this.shipHeading += turn * Math.min(1, dt * 10);
    }
    g.save();
    g.translate(p.x, p.y);
    g.rotate(this.shipHeading);
    g.fillStyle = '#e9fbff';
    g.beginPath();
    g.moveTo(0, -4.5 * px);
    g.lineTo(3.5 * px, 3.5 * px);
    g.lineTo(0, 1.8 * px);
    g.lineTo(-3.5 * px, 3.5 * px);
    g.closePath();
    g.fill();
    g.restore();
  }

  /** The world under a point on the radar, if any. */
  pick(frame: RadarFrame, clientX: number, clientY: number) {
    const canvas = this.canvas;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const r = rect.width / 2;
    let closest: number | null = null,
      best = 14;
    frame.bodies.forEach((body, index) => {
      const p = this.project(
        frame,
        body.root.position.x,
        body.root.position.z,
        r,
      );
      const d = Math.hypot(
        p.x - (clientX - rect.left),
        p.y - (clientY - rect.top),
      );
      if (d < best) {
        best = d;
        closest = index;
      }
    });
    return closest;
  }
}
