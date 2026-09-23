import * as THREE from 'three';

/** The galaxy core's glow. */
export function createGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) return null;

  const glow = context.createRadialGradient(128, 128, 0, 128, 128, 128);
  glow.addColorStop(0, 'rgba(255, 255, 244, 1)');
  glow.addColorStop(0.09, 'rgba(255, 247, 197, .98)');
  glow.addColorStop(0.22, 'rgba(255, 207, 160, .76)');
  glow.addColorStop(0.46, 'rgba(245, 145, 245, .25)');
  glow.addColorStop(0.72, 'rgba(103, 81, 255, .08)');
  glow.addColorStop(1, 'rgba(27, 21, 92, 0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, 256, 256);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** A family star's lens: a dark window in two bright rings. */
export function createMarkerTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) return null;

  context.translate(128, 128);
  const aura = context.createRadialGradient(0, 0, 1, 0, 0, 108);
  aura.addColorStop(0, 'rgba(255,255,255,1)');
  aura.addColorStop(0.025, 'rgba(255,247,193,1)');
  aura.addColorStop(0.075, 'rgba(255,235,196,.42)');
  aura.addColorStop(0.2, 'rgba(255,210,131,.08)');
  aura.addColorStop(0.34, 'rgba(255,255,255,0)');
  aura.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = aura;
  context.fillRect(-128, -128, 256, 256);

  const lens = context.createRadialGradient(-8, -10, 2, 0, 0, 39);
  lens.addColorStop(0, 'rgba(6,12,25,.98)');
  lens.addColorStop(0.7, 'rgba(5,9,19,.97)');
  lens.addColorStop(1, 'rgba(9,14,30,.88)');
  context.fillStyle = lens;
  context.beginPath();
  context.arc(0, 0, 38, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = 'rgba(238, 246, 255, .98)';
  context.lineWidth = 4.6;
  [43, 61].forEach((radius, index) => {
    context.globalAlpha = 1 - index * 0.2;
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.stroke();
  });

  context.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Four tapered diffraction spikes, shared by the star texture and the HUD's SVG. */
export const starDiffractionPath =
  'M0 -29C2 -10 3 -4 6 -3Q12 -1 24 0Q12 1 6 3C3 4 2 10 0 29C-2 10 -3 4 -6 3Q-12 1 -24 0Q-12 -1 -6 -3C-3 -4 -2 -10 0 -29Z';

export function createStarlightTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.translate(128, 128);
  // Separate the star's light from its neutral lens so its color and
  // luminosity can vary without tinting the clear window or its rim.
  const starlight = context.createRadialGradient(0, 0, 0, 0, 0, 22);
  starlight.addColorStop(0, 'rgba(255,255,255,1)');
  starlight.addColorStop(0.12, 'rgba(255,255,255,.98)');
  starlight.addColorStop(0.3, 'rgba(255,255,255,.55)');
  starlight.addColorStop(0.65, 'rgba(255,255,255,.13)');
  starlight.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = starlight;
  context.fillRect(-35, -35, 70, 70);

  // Diffraction spikes taper into the glow instead of reading as equally
  // weighted asterisk strokes. The vertical pair is a little longer.
  const diffraction = context.createRadialGradient(0, 0, 2, 0, 0, 29);
  diffraction.addColorStop(0, 'rgba(255,255,255,1)');
  diffraction.addColorStop(0.32, 'rgba(255,255,255,.95)');
  diffraction.addColorStop(0.72, 'rgba(255,255,255,.5)');
  diffraction.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = diffraction;
  context.shadowColor = 'rgba(255,255,255,.45)';
  context.shadowBlur = 2;
  context.fill(new Path2D(starDiffractionPath));
  context.shadowBlur = 0;
  context.fillStyle = 'white';
  context.beginPath();
  context.arc(0, 0, 5.5, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** A ring that ripples out from a star as it answers. */
export function createSignalWaveTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) return null;

  context.translate(128, 128);
  context.strokeStyle = 'rgba(237, 234, 255, .96)';
  context.shadowColor = 'rgba(213, 201, 255, .92)';
  context.shadowBlur = 10;
  context.lineWidth = 4;
  context.beginPath();
  context.arc(0, 0, 94, 0, Math.PI * 2);
  context.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
