import * as THREE from 'three';
import {
  patternsSystem,
  planetPosition,
  type PlanetRecipe,
} from '../data/solar-systems';
import {
  createPlanetTextures,
  seededRandom,
  surfaceHeight,
  terrainNoise,
} from './planet-textures';

export type SolarPhase =
  | 'galaxy'
  | 'entering'
  | 'system'
  | 'planet'
  | 'leaving';
type Body = {
  recipe: PlanetRecipe;
  root: THREE.Group;
  surface: THREE.Mesh;
  clouds: THREE.Mesh;
  moons: THREE.Group[];
};
type SavedView = {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  far: number;
  visibility: [THREE.Object3D, boolean][];
};

function glowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(128, 128, 2, 128, 128, 128);
  gradient.addColorStop(0, 'rgba(255,255,230,1)');
  gradient.addColorStop(0.15, 'rgba(255,229,155,.9)');
  gradient.addColorStop(0.3, 'rgba(255,182,66,.35)');
  gradient.addColorStop(0.52, 'rgba(239,126,29,.10)');
  gradient.addColorStop(1, 'rgba(217,104,25,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function atmosphereMaterial(color: string) {
  return new THREE.ShaderMaterial({
    uniforms: { tint: { value: new THREE.Color(color) } },
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: `varying vec3 vNormal; varying vec3 vView;
      void main() { vec4 p = modelViewMatrix * vec4(position,1.); vNormal = normalize(normalMatrix * normal); vView = normalize(-p.xyz); gl_Position = projectionMatrix * p; }`,
    fragmentShader: `uniform vec3 tint; varying vec3 vNormal; varying vec3 vView;
      void main() { float facing = abs(dot(normalize(vNormal), normalize(vView))); float rim = pow(1. - facing, 3.4) * pow(facing, .42); gl_FragColor = vec4(tint, rim * 1.15); }`,
  });
}

/** A local coordinate space inside the existing renderer, scene and animation loop. */
export class SolarSystemScene {
  readonly group = new THREE.Group();
  phase: SolarPhase = 'galaxy';
  selected: number | null = null;
  private bodies: Body[] = [];
  private built = false;
  private saved: SavedView | null = null;
  private origin = new THREE.Vector3();
  private transitionFrom = new THREE.Vector3();
  private transitionQuaternion = new THREE.Quaternion();
  private transitionTime = 0;
  private localTime = 0;
  private visualTime = 0;
  private handedOff = false;
  private yaw = 0;
  private pitch = 0.54;
  private distance = 61;
  private target = new THREE.Vector3();
  private desiredPosition = new THREE.Vector3();
  private desiredTarget = new THREE.Vector3();
  private projected = new THREE.Vector3();
  private pointer = new Map<number, { x: number; y: number }>();
  private dragged = 0;
  private sun: THREE.Mesh | null = null;
  private corona: THREE.Sprite | null = null;
  private flash = 0;
  private autoPaused = false;
  private destroyed = false;

  constructor(
    private scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
    private canvas: HTMLCanvasElement,
    private stage: HTMLElement,
    private onChange: (phase: SolarPhase, selected: number | null) => void,
  ) {
    this.group.name = 'Patterns & Life solar system';
    this.group.visible = false;
    scene.add(this.group);
  }

  get active() {
    return this.phase !== 'galaxy';
  }
  get navigating() {
    return this.phase === 'entering' || this.phase === 'leaving';
  }

  private report(phase: SolarPhase) {
    this.phase = phase;
    this.stage.dataset.solarPhase = phase;
    this.onChange(phase, this.selected);
  }

  enter(origin: THREE.Vector3) {
    if (this.active || this.destroyed) return;
    this.build();
    this.saved = {
      position: this.camera.position.clone(),
      quaternion: this.camera.quaternion.clone(),
      far: this.camera.far,
      visibility: this.scene.children
        .filter((child) => child !== this.group)
        .map((child) => [child, child.visible]),
    };
    this.origin.copy(origin);
    this.transitionFrom.copy(this.camera.position);
    this.transitionQuaternion.copy(this.camera.quaternion);
    this.transitionTime = 0;
    this.handedOff = false;
    this.selected = null;
    this.autoPaused = false;
    this.yaw = 0;
    this.pitch = this.camera.aspect < 1 ? 0.78 : 0.54;
    this.distance = this.overviewDistance();
    this.report('entering');
  }

  exit() {
    if (!this.active || this.phase === 'leaving') return;
    if (!this.handedOff) this.activateLocalSpace();
    this.transitionTime = 0;
    this.handedOff = false;
    this.transitionFrom.copy(this.camera.position);
    this.transitionQuaternion.copy(this.camera.quaternion);
    this.releasePointers();
    this.report('leaving');
  }

  select(index: number | null) {
    if (!this.active || this.navigating) return;
    if (index !== null && !this.bodies[index]) return;
    this.selected = index;
    this.yaw = index === null ? 0 : -0.12;
    this.pitch = index === null ? (this.camera.aspect < 1 ? 0.78 : 0.54) : 0.27;
    this.distance =
      index === null
        ? this.overviewDistance()
        : this.focusDistance(this.bodies[index].recipe);
    this.report(index === null ? 'system' : 'planet');
  }

  escape() {
    if (this.selected !== null && !this.navigating) this.select(null);
    else this.exit();
  }
  setPaused(paused: boolean) {
    this.autoPaused = paused;
  }

  private overviewDistance() {
    return 65 * Math.max(1, 1.5 / this.camera.aspect);
  }
  private focusDistance(planet: PlanetRecipe) {
    return (
      planet.radius *
      (planet.rings
        ? Math.max(10, 9.5 / this.camera.aspect)
        : Math.max(6.3, 3.6 / this.camera.aspect))
    );
  }

  resize() {
    if (this.selected === null) {
      this.distance = this.overviewDistance();
      this.pitch = this.camera.aspect < 1 ? 0.78 : 0.54;
    } else
      this.distance = this.focusDistance(this.bodies[this.selected].recipe);
  }

  private activateLocalSpace() {
    this.saved?.visibility.forEach(([child]) => {
      child.visible = false;
    });
    this.group.visible = true;
    this.camera.far = 400;
    this.camera.updateProjectionMatrix();
    this.target.set(0, 0, 0);
    this.camera.position.set(0, this.distance * 0.58, this.distance * 0.96);
    this.camera.lookAt(this.target);
    this.handedOff = true;
  }

  private restoreGalaxy() {
    this.group.visible = false;
    this.saved?.visibility.forEach(([child, visible]) => {
      child.visible = visible;
    });
    if (this.saved) {
      this.camera.far = this.saved.far;
      this.camera.updateProjectionMatrix();
    }
  }

  update(milliseconds: number, reduceMotion: boolean) {
    if (!this.active) return;
    const dt = Math.min(milliseconds, 40) / 1000;
    if (reduceMotion && this.navigating) {
      if (this.phase === 'entering') {
        this.activateLocalSpace();
        this.moveCamera(dt, true);
        this.report('system');
      } else if (this.saved) {
        this.restoreGalaxy();
        this.camera.position.copy(this.saved.position);
        this.camera.quaternion.copy(this.saved.quaternion);
        this.selected = null;
        this.saved = null;
        this.report('galaxy');
      }
      this.flash = 0;
      if (!this.active) {
        this.stage.parentElement?.style.setProperty('--solar-flash', '0');
        return;
      }
    }
    const advance = !reduceMotion && !this.autoPaused;
    if (advance) this.visualTime += dt;
    if (advance && this.selected === null && !this.navigating)
      this.localTime += dt;
    this.bodies.forEach((body, index) => {
      const position = planetPosition(body.recipe, this.localTime);
      body.root.position.set(position.x, 0, position.z);
      if (advance) {
        body.surface.rotation.y += dt * (index === 5 ? 0.028 : 0.045);
        body.clouds.rotation.y += dt * 0.052;
      }
      if (body.recipe.terrain === 'folds')
        body.surface.scale.setScalar(
          1 + Math.sin((this.visualTime * Math.PI * 2) / 13) * 0.004,
        );
      body.moons.forEach((moon, mi) => {
        const angle = this.localTime * 0.08 + mi * 2.9 + index;
        moon.position.set(
          Math.cos(angle) * body.recipe.radius * (2.1 + mi * 0.65),
          body.recipe.radius * 0.2,
          Math.sin(angle) * body.recipe.radius * (2.1 + mi * 0.65),
        );
      });
    });
    if (this.sun && advance)
      (this.sun.material as THREE.ShaderMaterial).uniforms.time.value +=
        dt * 0.035;
    if (this.corona)
      this.corona.scale.setScalar(
        13.8 + (advance ? Math.sin(this.localTime * 0.7) * 0.18 : 0),
      );

    if (this.phase === 'entering') {
      this.transitionTime += dt;
      const t = Math.min(1, this.transitionTime / (reduceMotion ? 0.18 : 1.85));
      this.flash = reduceMotion
        ? 0
        : Math.max(0, 1 - Math.abs(t - 0.46) / 0.17) * 0.82;
      if (t < 0.46) {
        const p = t / 0.46;
        const end = this.origin.clone().add(new THREE.Vector3(0, 0.8, 2.2));
        this.camera.position.lerpVectors(this.transitionFrom, end, p * p);
        const q = this.camera.quaternion.clone();
        this.camera.lookAt(this.origin);
        this.camera.quaternion.slerpQuaternions(
          this.transitionQuaternion,
          this.camera.quaternion.clone(),
          p,
        );
        if (!Number.isFinite(this.camera.quaternion.w))
          this.camera.quaternion.copy(q);
      } else {
        if (!this.handedOff) this.activateLocalSpace();
        this.moveCamera(dt, reduceMotion);
      }
      if (t === 1) {
        this.flash = 0;
        this.report('system');
      }
    } else if (this.phase === 'leaving') {
      this.transitionTime += dt;
      const t = Math.min(1, this.transitionTime / (reduceMotion ? 0.18 : 1.2));
      this.flash = reduceMotion
        ? 0
        : Math.max(0, 1 - Math.abs(t - 0.35) / 0.18) * 0.75;
      if (t < 0.35)
        this.camera.position
          .copy(this.transitionFrom)
          .multiplyScalar(1 + t * 0.7);
      else if (this.saved) {
        if (!this.handedOff) {
          this.restoreGalaxy();
          this.handedOff = true;
        }
        const p = (t - 0.35) / 0.65,
          ease = p * p * (3 - 2 * p);
        this.camera.position.lerpVectors(
          this.origin.clone().add(new THREE.Vector3(0, 1.2, 3.5)),
          this.saved.position,
          ease,
        );
        this.camera.quaternion.copy(this.saved.quaternion);
      }
      if (t === 1 && this.saved) {
        this.camera.position.copy(this.saved.position);
        this.camera.quaternion.copy(this.saved.quaternion);
        this.flash = 0;
        this.selected = null;
        this.saved = null;
        this.report('galaxy');
      }
    } else this.moveCamera(dt, reduceMotion);
    this.stage.parentElement?.style.setProperty(
      '--solar-flash',
      String(this.flash),
    );
    this.updateLabels();
  }

  private moveCamera(dt: number, reduceMotion: boolean) {
    const body = this.selected === null ? null : this.bodies[this.selected];
    this.desiredTarget.copy(
      body ? body.root.position : new THREE.Vector3(0, 0, 0),
    );
    // Leave the lower-left instrument console clear in close view.
    if (body && this.camera.aspect >= 1)
      this.desiredTarget.x +=
        body.recipe.radius * (this.canvas.clientHeight <= 500 ? 1.2 : -1.05);
    if (body && this.camera.aspect < 1)
      this.desiredTarget.y -= body.recipe.radius;
    if (body && this.canvas.clientHeight <= 500)
      this.desiredTarget.y -= body.recipe.radius * 0.55;
    this.desiredPosition
      .set(
        Math.sin(this.yaw) * Math.cos(this.pitch),
        Math.sin(this.pitch),
        Math.cos(this.yaw) * Math.cos(this.pitch),
      )
      .multiplyScalar(this.distance)
      .add(this.desiredTarget);
    const blend = reduceMotion ? 1 : 1 - Math.exp(-dt * 4.2);
    this.camera.position.lerp(this.desiredPosition, blend);
    this.target.lerp(this.desiredTarget, blend);
    this.camera.lookAt(this.target);
  }

  private updateLabels() {
    const width = this.canvas.clientWidth,
      height = this.canvas.clientHeight;
    this.group.updateMatrixWorld(true);
    this.camera.updateMatrixWorld(true);
    this.bodies.forEach((body, index) => {
      const label = this.stage.parentElement?.querySelector<HTMLElement>(
        `[data-planet-label="${body.recipe.id}"]`,
      );
      if (!label) return;
      this.projected.copy(body.root.position).project(this.camera);
      const x = ((this.projected.x + 1) * width) / 2,
        y = ((1 - this.projected.y) * height) / 2;
      const visible =
        !this.navigating &&
        (this.selected === null || this.selected === index) &&
        this.projected.z < 1 &&
        x > 45 &&
        x < width - 45 &&
        y > 90 &&
        y < height - (width < 720 ? 155 : 112);
      label.style.visibility = visible ? 'visible' : 'hidden';
      label.style.transform = `translate(${x}px, ${y}px)`;
      label.dataset.selected = String(this.selected === index);
    });
  }

  pointerDown(event: PointerEvent) {
    if (this.navigating || event.button !== 0) return;
    if (!this.pointer.size) this.dragged = 0;
    this.pointer.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.canvas.setPointerCapture(event.pointerId);
    this.canvas.style.cursor = 'grabbing';
  }

  pointerMove(event: PointerEvent) {
    const previous = this.pointer.get(event.pointerId);
    if (!previous) {
      this.canvas.style.cursor =
        this.pick(event.clientX, event.clientY) === null ? 'grab' : 'pointer';
      return;
    }
    const dx = event.clientX - previous.x,
      dy = event.clientY - previous.y;
    this.dragged += Math.abs(dx) + Math.abs(dy);
    const other = [...this.pointer.entries()].find(
      ([id]) => id !== event.pointerId,
    )?.[1];
    if (other) {
      const before = Math.hypot(previous.x - other.x, previous.y - other.y),
        after = Math.hypot(event.clientX - other.x, event.clientY - other.y);
      if (after > 0) this.zoom(before / after);
      this.dragged = Infinity;
    } else {
      this.yaw -= dx * 0.006;
      this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.004, 0.12, 1.3);
    }
    this.pointer.set(event.pointerId, { x: event.clientX, y: event.clientY });
  }

  pointerUp(event: PointerEvent) {
    if (!this.pointer.has(event.pointerId)) return;
    const tap =
      this.dragged < 7 && this.pointer.size === 1 && event.type === 'pointerup';
    this.pointer.delete(event.pointerId);
    if (this.canvas.hasPointerCapture(event.pointerId))
      this.canvas.releasePointerCapture(event.pointerId);
    if (tap) {
      const picked = this.pick(event.clientX, event.clientY);
      if (picked !== null) this.select(picked);
    }
    this.canvas.style.cursor = 'grab';
  }

  wheel(delta: number) {
    if (this.navigating) return;
    if (
      delta > 0 &&
      this.selected !== null &&
      this.distance >=
        this.focusDistance(this.bodies[this.selected].recipe) * 1.7
    ) {
      this.select(null);
      return;
    }
    this.zoom(
      Math.exp(Math.sign(delta) * Math.min(Math.abs(delta), 120) * 0.0015),
    );
  }

  zoom(factor: number) {
    const base =
      this.selected === null
        ? this.overviewDistance()
        : this.focusDistance(this.bodies[this.selected].recipe);
    this.distance = THREE.MathUtils.clamp(
      this.distance * factor,
      base * 0.56,
      base * 1.85,
    );
  }

  private pick(clientX: number, clientY: number) {
    if (this.navigating) return null;
    const rect = this.canvas.getBoundingClientRect();
    let closest: number | null = null,
      distance = Infinity;
    this.bodies.forEach((body, index) => {
      this.projected.copy(body.root.position).project(this.camera);
      if (this.projected.z > 1) return;
      const x = ((this.projected.x + 1) * rect.width) / 2 + rect.left,
        y = ((1 - this.projected.y) * rect.height) / 2 + rect.top;
      const pixels =
        ((body.recipe.radius /
          this.camera.position.distanceTo(body.root.position)) *
          rect.height) /
        (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)));
      const d = Math.hypot(x - clientX, y - clientY);
      if (d < Math.max(20, pixels * 1.1) && d < distance) {
        closest = index;
        distance = d;
      }
    });
    return closest;
  }

  private releasePointers() {
    this.pointer.forEach((_, id) => {
      if (this.canvas.hasPointerCapture(id))
        this.canvas.releasePointerCapture(id);
    });
    this.pointer.clear();
  }

  private build() {
    if (this.built) return;
    this.built = true;
    this.group.add(new THREE.HemisphereLight(0xb3d5ff, 0x24233a, 1.7));
    const starlight = new THREE.PointLight(0xffe3b4, 4.6, 0, 0);
    this.group.add(starlight);
    const sunMaterial = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: `varying vec3 p; varying vec3 n; varying vec3 v; void main(){ p=position; vec4 mv=modelViewMatrix*vec4(position,1.); n=normalize(normalMatrix*normal); v=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `varying vec3 p; varying vec3 n; varying vec3 v; uniform float time;
        void main(){ float a=sin(p.x*39.+sin(p.y*19.)*3.+time)*sin(p.z*31.+cos(p.x*23.)*2.); float b=sin(p.y*83.+p.z*64.)*sin(p.x*71.); float edge=pow(max(0.,dot(n,v)),.28); vec3 col=mix(vec3(1.,.42,.05),vec3(1.,.94,.57),edge); gl_FragColor=vec4(col*(1.25+a*.15+b*.06),1.); }`,
    });
    this.sun = new THREE.Mesh(
      new THREE.SphereGeometry(2.25, 64, 40),
      sunMaterial,
    );
    this.group.add(this.sun);
    this.corona = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture(),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
        opacity: 0.85,
      }),
    );
    this.corona.scale.setScalar(13.8);
    this.group.add(this.corona);
    const random = seededRandom(8123);
    const starPositions = [],
      starColors = [];
    for (let i = 0; i < 2000; i++) {
      const a = random() * Math.PI * 2,
        y = random() * 2 - 1,
        r = Math.sqrt(1 - y * y);
      starPositions.push(Math.cos(a) * r * 145, y * 145, Math.sin(a) * r * 145);
      const brightness = 0.24 + random() * 0.65;
      starColors.push(brightness * 0.8, brightness * 0.9, brightness);
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(starPositions, 3),
    );
    starGeometry.setAttribute(
      'color',
      new THREE.Float32BufferAttribute(starColors, 3),
    );
    this.group.add(
      new THREE.Points(
        starGeometry,
        new THREE.PointsMaterial({
          size: 0.21,
          vertexColors: true,
          sizeAttenuation: true,
          transparent: true,
          opacity: 0.85,
        }),
      ),
    );
    const nebulaTexture = glowTexture();
    [
      [-80, 8, -95, 0x4a67b9],
      [80, -18, -105, 0x593a83],
      [-14, 68, -115, 0x334e7e],
    ].forEach(([x, y, z, color]) => {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: nebulaTexture,
          color,
          transparent: true,
          opacity: 0.22,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      sprite.position.set(x, y, z);
      sprite.scale.set(210, 130, 1);
      this.group.add(sprite);
    });
    patternsSystem.planets.forEach((recipe) => this.addPlanet(recipe));
    this.addAsteroids(13.75, 14.6, 460, 433);
    this.addAsteroids(33.5, 34.9, 260, 921);
  }

  private addPlanet(recipe: PlanetRecipe) {
    const root = new THREE.Group();
    this.group.add(root);
    const geometry = new THREE.SphereGeometry(recipe.radius, 80, 48);
    if (recipe.terrain !== 'gas') {
      const position = geometry.getAttribute('position');
      const p = new THREE.Vector3();
      for (let i = 0; i < position.count; i++) {
        p.fromBufferAttribute(position, i).normalize();
        const h = surfaceHeight(p.x, p.y, p.z, recipe);
        const elevation =
          recipe.terrain === 'ocean' ? Math.max(0, h - 0.53) : h - 0.5;
        p.multiplyScalar(
          recipe.radius *
            (1 + elevation * (recipe.terrain === 'folds' ? 0.11 : 0.08)),
        );
        position.setXYZ(i, p.x, p.y, p.z);
      }
      geometry.computeVertexNormals();
    }
    const textures = createPlanetTextures(recipe);
    const material = new THREE.MeshStandardMaterial({
      map: textures.map,
      bumpMap: textures.bumpMap,
      bumpScale: recipe.terrain === 'gas' ? 0.006 : recipe.radius * 0.17,
      roughness: recipe.terrain === 'ocean' ? 0.42 : 0.89,
      metalness: 0,
    });
    const surface = new THREE.Mesh(geometry, material);
    surface.rotation.z = recipe.terrain === 'gas' ? 0.18 : 0.08;
    root.add(surface);
    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(recipe.radius * 1.075, 48, 32),
      atmosphereMaterial(recipe.atmosphere),
    );
    root.add(atmosphere);
    const clouds = new THREE.Mesh(
      new THREE.SphereGeometry(recipe.radius * 1.022, 48, 32),
      new THREE.MeshStandardMaterial({
        map: textures.cloudMap,
        transparent: true,
        opacity:
          recipe.terrain === 'desert' || recipe.terrain === 'gas' ? 0.09 : 0.5,
        depthWrite: false,
        roughness: 1,
      }),
    );
    root.add(clouds);
    if (recipe.rings) {
      const ringGeo = new THREE.RingGeometry(
        recipe.radius * 1.45,
        recipe.radius * 2.5,
        160,
        1,
      );
      const ring = new THREE.Mesh(
        ringGeo,
        new THREE.ShaderMaterial({
          uniforms: {
            inner: { value: recipe.radius * 1.45 },
            outer: { value: recipe.radius * 2.5 },
          },
          vertexShader: `varying vec2 p; void main(){p=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
          fragmentShader: `varying vec2 p; uniform float inner; uniform float outer; void main(){ float r=(length(p)-inner)/(outer-inner); float footprint=fwidth(r); float bands=.42+.13*sin(r*115.)*(1.-smoothstep(.01,.04,footprint))+.055*sin(r*340.)*(1.-smoothstep(.003,.012,footprint)); float gap=smoothstep(.025,.045,abs(r-.58)); float edge=smoothstep(0.,.06,r)*(1.-smoothstep(.92,1.,r)); vec3 color=mix(vec3(.79,.69,.56),vec3(.91,.87,.77),r); gl_FragColor=vec4(color,bands*gap*edge); }`,
          side: THREE.DoubleSide,
          transparent: true,
          depthWrite: false,
        }),
      );
      ring.rotation.x = -Math.PI / 2 + 0.17;
      ring.rotation.y = 0.08;
      root.add(ring);
    }
    const moons: THREE.Group[] = [];
    for (let i = 0; i < (recipe.moons ?? 0); i++) {
      const moon = new THREE.Group();
      const moonGeo = new THREE.IcosahedronGeometry(
        recipe.radius * (i === 0 ? 0.16 : 0.11),
        3,
      );
      const points = moonGeo.getAttribute('position');
      // Keep duplicated face vertices coincident; independent jitter cracks them.
      for (let j = 0; j < points.count; j++) {
        const x = points.getX(j),
          y = points.getY(j),
          z = points.getZ(j);
        const rough =
          0.95 + terrainNoise(x * 17, y * 17, z * 17, recipe.seed + i) * 0.1;
        points.setXYZ(j, x * rough, y * rough, z * rough);
      }
      moonGeo.computeVertexNormals();
      moon.add(
        new THREE.Mesh(
          moonGeo,
          new THREE.MeshStandardMaterial({
            color: i === 0 ? 0xc9c6b7 : 0x8c99b4,
            roughness: 1,
            flatShading: true,
          }),
        ),
      );
      root.add(moon);
      moons.push(moon);
    }
    this.bodies.push({ recipe, root, surface, clouds, moons });
    const orbitPoints = Array.from(
      { length: 257 },
      (_, i) =>
        new THREE.Vector3(
          Math.cos((i / 256) * Math.PI * 2) * recipe.orbit,
          0,
          Math.sin((i / 256) * Math.PI * 2) * recipe.orbit,
        ),
    );
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(orbitPoints),
      new THREE.LineBasicMaterial({
        color: recipe.atmosphere,
        transparent: true,
        opacity: 0.19,
        depthWrite: false,
      }),
    );
    this.group.add(line);
  }

  private addAsteroids(
    inner: number,
    outer: number,
    count: number,
    seed: number,
  ) {
    const random = seededRandom(seed);
    const belt = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.MeshStandardMaterial({
        color: 0x938781,
        roughness: 1,
        flatShading: true,
      }),
      count,
    );
    const dummy = new THREE.Object3D(),
      color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const angle = random() * Math.PI * 2,
        radius = inner + random() * (outer - inner);
      dummy.position.set(
        Math.cos(angle) * radius,
        (random() - 0.5) * 0.32,
        Math.sin(angle) * radius,
      );
      const size = 0.025 + Math.pow(random(), 3) * 0.12;
      dummy.scale.set(
        size,
        size * (0.6 + random() * 0.6),
        size * (0.65 + random() * 0.7),
      );
      dummy.rotation.set(random() * 6, random() * 6, random() * 6);
      dummy.updateMatrix();
      belt.setMatrixAt(i, dummy.matrix);
      color.setHSL(0.08 + random() * 0.1, 0.12, 0.32 + random() * 0.35);
      belt.setColorAt(i, color);
    }
    this.group.add(belt);
  }

  dispose() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.releasePointers();
    if (this.active) this.restoreGalaxy();
    const geometries = new Set<THREE.BufferGeometry>(),
      materials = new Set<THREE.Material>(),
      textures = new Set<THREE.Texture>();
    this.group.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) geometries.add(mesh.geometry);
      if (mesh.material)
        (Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material]
        ).forEach((material) => {
          materials.add(material);
          Object.values(material).forEach((value) => {
            if (value instanceof THREE.Texture) textures.add(value);
          });
        });
    });
    geometries.forEach((item) => item.dispose());
    materials.forEach((item) => item.dispose());
    textures.forEach((item) => item.dispose());
    this.group.removeFromParent();
    this.bodies = [];
  }
}
