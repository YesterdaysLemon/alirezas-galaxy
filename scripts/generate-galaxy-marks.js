// Generates the spiral galaxy marks from one parametric description:
//
//   public/spiral-galaxy.svg  the flat silhouette used for the settings orb
//   public/favicon.svg        the same arm, dressed in the site's chrome
//
// Both share a 256x256 space centred on (128, 128), so the favicon can simply
// <use> the arm five times at 72 degree rotations. Run `npm run generate:marks`
// after changing any tunable below.

import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'public',
);

// --- tunables ---------------------------------------------------------------

const ARMS = 5;
const CENTER = 128;
const WIND = 1.4 * Math.PI; // how far around each arm sweeps
const R_INNER = 26; // where an arm leaves the core
const R_OUTER = 104; // where its tip lands
const W_ROOT = 30; // arm width at the core, before the per-count scale
const W_TIP = 18; // arm width at the tip; keep below W_ROOT so it tapers in
// The mark is loaded through <img src="/spiral-galaxy.svg">, and inside an
// <img> currentColor resolves to black instead of inheriting the page colour,
// so the fill has to be baked in.
const MARK_FILL = '#d6f5ff';
const CORE_BASE = 22;
const CORE_SPAN = 8;
const SAMPLES = 34; // points along the centreline
const CAP_SAMPLES = 9; // points around each rounded end

// A logarithmic spiral, r = R_INNER * e^(GROWTH * theta), tuned so theta runs
// from 0 at the core to WIND at R_OUTER.
const GROWTH = Math.log(R_OUTER / R_INNER) / WIND;

// --- geometry ---------------------------------------------------------------

const round = (n) => Math.round(n * 10) / 10;

// One arm: the spiral centreline offset into a ribbon that is thick at the core
// and tapers to a slimmer, round-capped tip. Both caps are sampled as
// semicircles -- a blunt cap makes the smoothing overshoot into a loop, and a
// loop punches a hole under nonzero fill.
function arm({ r0, b, w0, w1, rot, wind, n = SAMPLES, k = CAP_SAMPLES }) {
  const rad = (rot * Math.PI) / 180;
  const at = (th) => {
    const r = r0 * Math.exp(b * th);
    return [CENTER + r * Math.cos(th + rad), CENTER + r * Math.sin(th + rad)];
  };
  const frame = (t) => {
    const th = wind * t;
    const [x, y] = at(th);
    const d = 1e-3;
    const [ax, ay] = at(th - d);
    const [bx, by] = at(th + d);
    let tx = bx - ax;
    let ty = by - ay;
    const m = Math.hypot(tx, ty);
    tx /= m;
    ty /= m;
    return {
      p: [x, y],
      t: [tx, ty],
      n: [-ty, tx],
      h: (w0 + (w1 - w0) * t) / 2,
    };
  };
  const off = (f, s) => [f.p[0] + f.n[0] * s * f.h, f.p[1] + f.n[1] * s * f.h];
  // dir 1 sweeps left -> front -> right; dir -1 sweeps right -> back -> left,
  // which is the order the closing edge of the outline needs.
  const cap = (f, dir) => {
    const out = [];
    for (let i = 1; i < k; i++) {
      const a = dir > 0 ? (i / k) * Math.PI : Math.PI - (i / k) * Math.PI;
      out.push([
        f.p[0] + f.n[0] * f.h * Math.cos(a) + dir * f.t[0] * f.h * Math.sin(a),
        f.p[1] + f.n[1] * f.h * Math.cos(a) + dir * f.t[1] * f.h * Math.sin(a),
      ]);
    }
    return out;
  };

  const frames = [];
  for (let i = 0; i <= n; i++) frames.push(frame(i / n));
  const left = frames.map((f) => off(f, 1));
  const right = frames.map((f) => off(f, -1));
  return [
    ...left, // core -> tip, left edge
    ...cap(frames[n], 1), // round the tip
    ...right.reverse(), // tip -> core, right edge
    ...cap(frames[0], -1), // round the root
  ];
}

// Closed centripetal Catmull-Rom -> cubic beziers. Centripetal (alpha = 0.5)
// parameterisation is what keeps the dense cap samples from overshooting into a
// loop where they meet the sparser samples along the edges.
function toPath(points) {
  const p = points.filter(
    (q, i) =>
      i === 0 ||
      Math.hypot(q[0] - points[i - 1][0], q[1] - points[i - 1][1]) > 1e-4,
  );
  const n = p.length;
  const at = (i) => p[((i % n) + n) % n];
  const knot = (a, b) =>
    Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])) || 1e-4;
  let d = `M${round(p[0][0])} ${round(p[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const d1 = knot(p0, p1);
    const d2 = knot(p1, p2);
    const d3 = knot(p2, p3);
    const c1 = [];
    const c2 = [];
    for (let k = 0; k < 2; k++) {
      const m1 =
        d2 *
        ((p1[k] - p0[k]) / d1 -
          (p2[k] - p0[k]) / (d1 + d2) +
          (p2[k] - p1[k]) / d2);
      const m2 =
        d2 *
        ((p2[k] - p1[k]) / d2 -
          (p3[k] - p1[k]) / (d2 + d3) +
          (p3[k] - p2[k]) / d3);
      c1.push(p1[k] + m1 / 3);
      c2.push(p2[k] - m2 / 3);
    }
    d += `C${round(c1[0])} ${round(c1[1])} ${round(c2[0])} ${round(c2[1])} ${round(p2[0])} ${round(p2[1])}`;
  }
  return `${d}Z`;
}

// More arms have to be slimmer, or neighbouring windings merge into a disc.
export function galaxy(count = ARMS) {
  const scale = Math.pow(3 / count, 0.6);
  const spec = {
    r0: R_INNER,
    b: GROWTH,
    w0: W_ROOT * scale,
    w1: W_TIP * scale,
    wind: WIND,
  };
  return {
    count,
    core: +(CORE_BASE + CORE_SPAN * scale).toFixed(1),
    arms: Array.from({ length: count }, (_, i) =>
      toPath(arm({ ...spec, rot: (360 / count) * i })),
    ),
  };
}

// --- output -----------------------------------------------------------------

function markSvg(g) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" fill="${MARK_FILL}" role="img" aria-labelledby="sg-title">
  <title id="sg-title">Spiral galaxy</title>
  <circle cx="128" cy="128" r="${g.core}"/>
${g.arms.map((d) => `  <path d="${d}"/>`).join('\n')}
</svg>
`;
}

// Every arm is the same shape at a different rotation, so the favicon defines it
// once and <use>s it -- which is what tests/unit/chrome-icons.test.ts checks.
function faviconSvg(g) {
  const uses = Array.from({ length: g.count }, (_, i) =>
    i === 0
      ? '      <use href="#spiral-arm" />'
      : `      <use href="#spiral-arm" transform="rotate(${(360 / g.count) * i} 128 128)" />`,
  ).join('\n');
  return `<svg width="64" height="64" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="space" cx="0" cy="0" r="1" gradientTransform="translate(92 72) rotate(53) scale(216)">
      <stop stop-color="#245c91" />
      <stop offset=".5" stop-color="#0b2348" />
      <stop offset="1" stop-color="#030817" />
    </radialGradient>
    <linearGradient id="arms" x1="70" y1="45" x2="195" y2="200" gradientUnits="userSpaceOnUse">
      <stop stop-color="#f6ffff" />
      <stop offset=".42" stop-color="#74ddff" />
      <stop offset="1" stop-color="#7867ff" />
    </linearGradient>
    <path id="spiral-arm" d="${g.arms[0]}" />
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="5" result="blur" />
      <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
  </defs>
  <circle cx="128" cy="128" r="120" fill="url(#space)" stroke="#8cecff" stroke-width="8" />
  <g filter="url(#glow)">
    <circle cx="128" cy="128" r="${g.core}" fill="url(#arms)" />
    <g fill="url(#arms)" stroke="#dffaff" stroke-width="4" stroke-linejoin="round">
${uses}
    </g>
    <circle cx="128" cy="128" r="13" fill="#fff8a6" stroke="#f5ffff" stroke-width="5" />
  </g>
</svg>
`;
}

const mark = galaxy();
await writeFile(path.join(PUBLIC, 'spiral-galaxy.svg'), markSvg(mark));
await writeFile(path.join(PUBLIC, 'favicon.svg'), faviconSvg(mark));
console.log(`generated ${mark.count}-arm marks into public/`);
