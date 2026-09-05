import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { DistantGalaxyParallax } from '../../lib/distant-galaxy-parallax';

function cameraFor(width = 1440, height = 1000, distance = 20.5) {
  const camera = new PerspectiveCamera(42, width / height, 0.1, 100);
  camera.position.set(-0.45, distance * 0.37, distance * 0.93);
  camera.lookAt(0.7, 0, 0);
  camera.updateMatrixWorld();
  return camera;
}

describe('distant galaxy camera parallax', () => {
  it('preserves the original corner placement at the neutral camera pose', () => {
    const parallax = new DistantGalaxyParallax(1440, 1000, 20.5);
    const position = new Vector3();
    const camera = cameraFor();
    parallax.update(camera, position);
    expect(parallax.screenX).toBeCloseTo(1308);
    expect(parallax.screenY).toBeCloseTo(91);
    expect(position.distanceTo(camera.position)).toBeCloseTo(44);
  });

  it('moves with camera parallax instead of staying fixed on the screen', () => {
    const parallax = new DistantGalaxyParallax(1440, 1000, 20.5);
    const position = new Vector3();
    const camera = cameraFor();
    parallax.update(camera, position);
    const worldAnchor = position.clone();
    camera.lookAt(1.1, 0.1, 0);
    camera.updateMatrixWorld();
    const projected = worldAnchor.project(camera);
    parallax.update(camera, position);
    expect(Math.abs(parallax.screenX - 1308)).toBeGreaterThan(1);
    expect(parallax.screenX - 1308).toBeCloseTo(
      ((projected.x * 0.5 + 0.5) * 1440 - 1308) * 0.7,
    );
    // The rendered galaxy projects to the same position used by the portal.
    position.project(camera);
    expect((position.x * 0.5 + 0.5) * 1440).toBeCloseTo(parallax.screenX);
    expect((-position.y * 0.5 + 0.5) * 1000).toBeCloseTo(parallax.screenY);
  });

  it('has no independent drift and returns with the camera', () => {
    const parallax = new DistantGalaxyParallax(1440, 1000, 20.5);
    const position = new Vector3();
    const camera = cameraFor();
    camera.lookAt(1.1, 0.1, 0);
    parallax.update(camera, position);
    const first = position.clone();
    for (let frame = 0; frame < 100; frame++) parallax.update(camera, position);
    expect(position.distanceTo(first)).toBe(0);
    camera.lookAt(0.7, 0, 0);
    parallax.update(camera, position);
    expect(parallax.screenX).toBeCloseTo(1308);
    expect(parallax.screenY).toBeCloseTo(91);
  });

  it('keeps mobile drift bounded and respects the right safe inset', () => {
    const parallax = new DistantGalaxyParallax(390, 844, 25.5);
    parallax.resize(390, 844, 25.5, 12);
    const position = new Vector3();
    const camera = cameraFor(390, 844, 25.5);
    parallax.update(camera, position);
    expect(parallax.screenX).toBeCloseTo(295);
    for (const x of [-8, 0, 8]) {
      camera.lookAt(x, 3, 0);
      parallax.update(camera, position);
      expect(Math.abs(parallax.screenX - 295)).toBeLessThanOrEqual(21.451);
      expect(Math.abs(parallax.screenY - 86)).toBeLessThanOrEqual(21.101);
    }
  });

  it('uses a gentler response for reduced motion', () => {
    const parallax = new DistantGalaxyParallax(1440, 1000, 20.5);
    const camera = cameraFor();
    camera.lookAt(1.1, 0.1, 0);
    const position = new Vector3();
    parallax.update(camera, position);
    const fullShift = parallax.screenX - 1308;
    parallax.update(camera, position, true);
    expect(parallax.screenX - 1308).toBeCloseTo(fullShift * (0.2 / 0.7));
  });

  it('reanchors correctly after switching to a short landscape viewport', () => {
    const parallax = new DistantGalaxyParallax(390, 844, 25.5);
    parallax.resize(844, 390, 20.5);
    parallax.update(cameraFor(844, 390), new Vector3());
    expect(parallax.screenX).toBeCloseTo(761);
    expect(parallax.screenY).toBeCloseTo(30);
  });
});
