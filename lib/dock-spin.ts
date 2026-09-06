const TURN = Math.PI * 2;
const DECAY = 3.2;

/** A temporary flywheel phase; whole-turn endpoints rejoin the live galaxy. */
export class DockSpin {
  angle = 0;
  private target = 0;

  kick(direction: number) {
    const sign = direction < 0 ? -1 : 1;
    this.target = sign * (Math.floor((sign * this.angle) / TURN) + 1) * TURN;
    if (Math.abs(this.target - this.angle) < TURN / 2)
      this.target += sign * TURN;
  }

  reset() {
    this.angle = 0;
    this.target = 0;
  }

  step(seconds: number, reducedMotion = false) {
    if (reducedMotion) this.reset();
    this.angle =
      this.target + (this.angle - this.target) * Math.exp(-DECAY * seconds);
    // The remaining phase is subpixel; whole turns are visually identical to 0.
    if (Math.abs(this.target - this.angle) < 0.001) this.reset();
    return this.angle;
  }
}
