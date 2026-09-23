import type { SolarSystem, PlanetRecipe } from '../data/solar-systems';
import { renderPlanetPortrait } from './planet-textures';

const planetPortraits = new Map<string, HTMLCanvasElement>();

/** A cached, lit portrait from the same surface sampler as the 3D world. */
export function portraitCanvas(planet: PlanetRecipe, size: number) {
  const key = `${size}/${JSON.stringify([
    planet.id,
    planet.seed,
    planet.terrain,
    planet.colors,
    planet.atmosphere,
    planet.surface,
  ])}`;
  let canvas = planetPortraits.get(key);
  if (!canvas) {
    if (planetPortraits.size > 160) planetPortraits.clear();
    canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    canvas
      .getContext('2d')
      ?.putImageData(renderPlanetPortrait(planet, size), 0, 0);
    planetPortraits.set(key, canvas);
  }
  return canvas;
}

/** Draws a world (and any ring system, split behind and in front) or a star. */
export function drawPlanetMark(
  canvas: HTMLCanvasElement,
  planet: PlanetRecipe | undefined,
  color: string,
) {
  const g = canvas.getContext('2d');
  if (!g) return;
  const size = canvas.width;
  const c = size / 2;
  g.clearRect(0, 0, size, size);
  if (!planet) {
    const glow = g.createRadialGradient(c * 0.9, c * 0.85, 0, c, c, c);
    glow.addColorStop(0, '#fffdf0');
    glow.addColorStop(0.35, color);
    glow.addColorStop(0.62, `${color}99`);
    glow.addColorStop(1, `${color}00`);
    g.fillStyle = glow;
    g.fillRect(0, 0, size, size);
    return;
  }
  const body = planet.rings ? Math.round(size * 0.58) : size;
  const ring = (from: number, to: number) => {
    g.save();
    g.translate(c, c);
    g.rotate(-0.38);
    g.lineCap = 'butt';
    for (const [radius, width, alpha] of [
      [0.47, 0.075, 0.85],
      [0.37, 0.05, 0.6],
    ] as const) {
      g.beginPath();
      g.ellipse(0, 0, size * radius, size * radius * 0.3, 0, from, to);
      g.strokeStyle = planet.colors[3];
      g.globalAlpha = alpha;
      g.lineWidth = size * width;
      g.stroke();
    }
    g.restore();
  };
  // Canvas angles run clockwise from +x: π..2π is the far (upper) half.
  if (planet.rings) ring(Math.PI, Math.PI * 2);
  g.drawImage(portraitCanvas(planet, body), c - body / 2, c - body / 2);
  if (planet.rings) ring(0, Math.PI);
}

/**
 * A family star's thumbnail, drawn from the live system: the star in its own
 * colour, tilted orbit rings, and each world's real portrait at its orbital
 * phase, in front of or behind the star. It grows with the system.
 */
export function drawSystemMark(canvas: HTMLCanvasElement, system: SolarSystem) {
  const g = canvas.getContext('2d');
  if (!g) return;
  const size = canvas.width;
  const c = size / 2;
  const tilt = 0.42;
  g.clearRect(0, 0, size, size);
  const sky = g.createRadialGradient(c, c * 0.9, 0, c, c, c * 1.1);
  sky.addColorStop(0, `${system.nebula[1]}`);
  sky.addColorStop(0.55, `${system.nebula[0]}`);
  sky.addColorStop(1, '#040912');
  g.fillStyle = sky;
  g.fillRect(0, 0, size, size);
  // Square-root radial scale, like the radar, so inner worlds stay apart.
  const outer = Math.max(...system.planets.map((planet) => planet.orbit), 1);
  const reach = (orbit: number) => Math.sqrt(orbit / outer) * size * 0.45;
  g.lineWidth = Math.max(1, size / 96);
  for (const planet of system.planets) {
    g.beginPath();
    g.ellipse(
      c,
      c,
      reach(planet.orbit),
      reach(planet.orbit) * tilt,
      0,
      0,
      Math.PI * 2,
    );
    g.strokeStyle = `${planet.atmosphere}55`;
    g.stroke();
  }
  const bodies = system.planets.map((planet) => {
    const r = reach(planet.orbit);
    return {
      planet,
      x: c + Math.cos(planet.phase) * r,
      y: c + Math.sin(planet.phase) * r * tilt,
      far: Math.sin(planet.phase) < 0,
      d: Math.max(
        size * 0.05,
        Math.min(size * 0.14, planet.radius * size * 0.06),
      ),
    };
  });
  const drawBody = ({ planet, x, y, d }: (typeof bodies)[number]) => {
    const px = Math.max(8, Math.round(d * 2));
    const mark = document.createElement('canvas');
    mark.width = mark.height = px;
    drawPlanetMark(mark, planet, system.star.color);
    g.drawImage(mark, x - d, y - d, d * 2, d * 2);
  };
  bodies.filter((body) => body.far).forEach(drawBody);
  const star = g.createRadialGradient(c, c, 0, c, c, size * 0.2);
  star.addColorStop(0, '#fffdf2');
  star.addColorStop(0.28, system.star.color);
  star.addColorStop(0.55, `${system.star.color}66`);
  star.addColorStop(1, `${system.star.color}00`);
  g.fillStyle = star;
  g.fillRect(0, 0, size, size);
  bodies.filter((body) => !body.far).forEach(drawBody);
}
