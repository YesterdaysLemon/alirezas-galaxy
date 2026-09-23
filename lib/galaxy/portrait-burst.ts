import * as THREE from 'three';
import { portraitUrls } from '@/data/portraits';
import { seededRandom } from './math';

type Portrait = {
  sprite: THREE.Sprite;
  velocity: THREE.Vector3;
  spin: number;
  life: number;
};

/**
 * Spin the home galaxy hard enough and a ring of portraits bursts from its
 * core. Textures load lazily; a burst asked for early waits for them.
 */
export class PortraitBurst {
  readonly group = new THREE.Group();
  private readonly sprites: Portrait[] = [];
  private readonly textures: THREE.Texture[] = [];
  private readonly loader = new THREE.TextureLoader();
  private loading = false;
  private ready = false;
  private pending = false;
  /** Seconds until another burst may start. */
  private cooldown = 0;
  private count = 0;
  private disposed = false;

  /** `target` records the burst count for tests and tooling. */
  constructor(private readonly target: HTMLElement) {
    target.dataset.portraitBursts = '0';
  }

  get coolingDown() {
    return this.cooldown > 0;
  }

  preload() {
    if (this.loading || this.ready) return;
    this.loading = true;
    let unsettled = portraitUrls.length;
    const settle = () => {
      unsettled -= 1;
      if (unsettled > 0) return;
      this.ready = true;
      this.loading = false;
      const waiting = this.pending && this.textures.length > 0;
      this.pending = false;
      if (waiting) this.burst();
    };
    portraitUrls.forEach((url) => {
      this.loader.load(
        url,
        (texture) => {
          if (this.disposed) texture.dispose();
          else {
            texture.colorSpace = THREE.SRGBColorSpace;
            this.textures.push(texture);
          }
          settle();
        },
        undefined,
        settle,
      );
    });
  }

  burst() {
    if (this.cooldown > 0) return;
    if (!this.ready) {
      this.pending = true;
      this.preload();
      return;
    }
    if (this.textures.length === 0) return;
    this.count += 1;
    this.target.dataset.portraitBursts = String(this.count);
    this.clear();
    const random = seededRandom(Date.now());
    for (let index = 0; index < 10; index += 1) {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.textures[Math.floor(random() * this.textures.length)],
          transparent: true,
          depthTest: false,
          depthWrite: false,
        }),
      );
      const angle = (index / 10) * Math.PI * 2 + random() * 0.38;
      const speed = 0.065 + random() * 0.08;
      sprite.position.set(0, 0.82, 0);
      sprite.scale.setScalar(0.01);
      sprite.renderOrder = 20;
      this.group.add(sprite);
      this.sprites.push({
        sprite,
        velocity: new THREE.Vector3(
          Math.cos(angle) * speed,
          0.015 + random() * 0.04,
          Math.sin(angle) * speed,
        ),
        spin: (random() - 0.5) * 0.1,
        life: 1,
      });
    }
    this.cooldown = 5;
  }

  /** Advance the burst: `delta` in 60fps frames. */
  update(elapsedMs: number, delta: number) {
    this.cooldown = Math.max(0, this.cooldown - elapsedMs / 1000);
    for (let index = this.sprites.length - 1; index >= 0; index -= 1) {
      const portrait = this.sprites[index];
      portrait.life -= 0.0085 * delta;
      portrait.sprite.position.addScaledVector(portrait.velocity, delta);
      portrait.sprite.material.rotation += portrait.spin * delta;
      const envelope = Math.sin(Math.max(0, portrait.life) * Math.PI);
      const scale = Math.max(0.01, envelope * 0.96);
      portrait.sprite.scale.set(scale, scale, 1);
      portrait.sprite.material.opacity = Math.min(1, portrait.life * 2);
      if (portrait.life <= 0) {
        this.group.remove(portrait.sprite);
        portrait.sprite.material.dispose();
        this.sprites.splice(index, 1);
      }
    }
  }

  private clear() {
    this.sprites.forEach(({ sprite }) => {
      this.group.remove(sprite);
      sprite.material.dispose();
    });
    this.sprites.length = 0;
  }

  dispose() {
    this.disposed = true;
    this.clear();
    this.textures.forEach((texture) => texture.dispose());
  }
}
