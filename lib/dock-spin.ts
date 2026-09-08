const TURN = Math.PI * 2;
const DECAY = 3.2;

const HOVER_SECONDS = 1.6;
const HOVER_KICK_SECONDS = 0.1;
const HOVER_KICK_ANGLE = TURN / 3;

/** A sharp third-turn, then a forward coast to the live orientation and speed. */
export class DockHover {
  angle = 0;
  private elapsed = HOVER_SECONDS;
  private start = 0;
  private kickEnd = 0;
  private target = 0;

  nudge(direction: number) {
    this.start = this.angle;
    const sign = direction < 0 ? -1 : 1;
    this.kickEnd = this.start + sign * HOVER_KICK_ANGLE;
    this.target = sign * (Math.floor((sign * this.start) / TURN) + 1) * TURN;
    if (Math.abs(this.target - this.start) < TURN / 2)
      this.target += sign * TURN;
    this.elapsed = 0;
  }

  reset() {
    this.angle = 0;
    this.start = 0;
    this.elapsed = HOVER_SECONDS;
  }

  step(seconds: number, reducedMotion = false) {
    if (reducedMotion) this.reset();
    this.elapsed = Math.min(HOVER_SECONDS, this.elapsed + seconds);
    if (this.elapsed === HOVER_SECONDS) {
      this.angle = 0;
      return this.angle;
    }
    if (this.elapsed <= HOVER_KICK_SECONDS) {
      this.angle =
        this.start +
        (this.kickEnd - this.start) * (this.elapsed / HOVER_KICK_SECONDS);
    } else {
      const progress =
        (this.elapsed - HOVER_KICK_SECONDS) /
        (HOVER_SECONDS - HOVER_KICK_SECONDS);
      // The offset's velocity falls to zero; the renderer's live rotation
      // keeps running underneath, so both orientation and pace reconnect.
      this.angle =
        this.target + (this.kickEnd - this.target) * (1 - progress) ** 3;
    }
    return this.angle;
  }
}

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
