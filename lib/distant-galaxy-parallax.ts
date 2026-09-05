import { MathUtils, PerspectiveCamera, Vector3 } from 'three';

/** A distant world anchor, with bounded camera parallax near its UI-safe corner. */
export class DistantGalaxyParallax {
  readonly depth = 44;
  screenX = 0;
  screenY = 0;
  private width = 1;
  private height = 1;
  private anchorX = 0;
  private anchorY = 0;
  private readonly referenceCamera = new PerspectiveCamera(42, 1, 0.1, 100);
  private readonly anchor = new Vector3();
  private readonly projected = new Vector3();

  constructor(width: number, height: number, distance: number) {
    this.resize(width, height, distance);
  }

  resize(width: number, height: number, distance: number, rightInset = 0) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    const compact = width <= 720 || height <= 500;
    this.anchorX = width - (compact ? 83 : 132) - rightInset;
    this.anchorY =
      (height <= 500 && width > 720 ? 44 : compact ? 100 : 105) - 14;
    const reference = this.referenceCamera;
    reference.aspect = this.width / this.height;
    reference.position.set(-0.45, distance * 0.37, distance * 0.93);
    reference.lookAt(0.7, 0, 0);
    reference.updateProjectionMatrix();
    reference.updateMatrixWorld();
    this.unproject(reference, this.anchorX, this.anchorY, this.anchor);
  }

  update(camera: PerspectiveCamera, position: Vector3, reducedMotion = false) {
    camera.updateMatrixWorld();
    this.projected.copy(this.anchor).project(camera);
    const projectedX = (this.projected.x * 0.5 + 0.5) * this.width;
    const projectedY = (-this.projected.y * 0.5 + 0.5) * this.height;
    const strength = reducedMotion ? 0.2 : 0.7;
    // Camera motion, not an independent bobbing animation. Keep zoom/drag
    // extremes from carrying the neighboring galaxy out of reach.
    this.screenX =
      this.anchorX +
      MathUtils.clamp(
        (projectedX - this.anchorX) * strength,
        -Math.min(42, this.width * 0.055),
        Math.min(42, this.width * 0.055),
      );
    this.screenY =
      this.anchorY +
      MathUtils.clamp(
        (projectedY - this.anchorY) * strength,
        -Math.min(28, this.height * 0.025),
        Math.min(28, this.height * 0.025),
      );
    this.unproject(camera, this.screenX, this.screenY, position);
  }

  private unproject(
    camera: PerspectiveCamera,
    x: number,
    y: number,
    out: Vector3,
  ) {
    out
      .set((x / this.width) * 2 - 1, 1 - (y / this.height) * 2, 0.5)
      .unproject(camera)
      .sub(camera.position)
      .normalize()
      .multiplyScalar(this.depth)
      .add(camera.position);
  }
}
