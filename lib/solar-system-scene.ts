import * as THREE from 'three';
import type { PlanetRecipe, SolarSystem } from '../data/solar-systems';
import { PlanetPreparation, preparationTurn } from './planet-preparation';
import { SolarSystemResources, type SolarBody } from './solar-system-resources';

export type SolarPhase =
  | 'galaxy'
  | 'entering'
  | 'system'
  | 'planet'
  | 'leaving';
type SavedView = {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  near: number;
  far: number;
  visibility: [THREE.Object3D, boolean][];
};
const EMPTY_BODIES: SolarBody[] = [];
const EMPTY_ORBITS: THREE.ShaderMaterial[] = [];
const GALAXY_UNIT = 0.035;

function flightDust() {
  return new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 20),
    new THREE.ShaderMaterial({
      uniforms: {
        eye: { value: new THREE.Vector3() },
        time: { value: 0 },
        opacity: { value: 0 },
        tint: { value: new THREE.Color('#71639d') },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      side: THREE.BackSide,
      vertexShader: `varying vec3 p; void main(){p=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `varying vec3 p; uniform vec3 eye; uniform float time; uniform float opacity; uniform vec3 tint;
      float hash(vec3 q){return fract(sin(dot(q,vec3(127.1,311.7,74.7)))*43758.5453);}
      float noise(vec3 q){vec3 i=floor(q),f=fract(q); f=f*f*(3.-2.*f); return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      void main(){vec3 ray=normalize(p-eye); float b=dot(eye,ray); float d=b*b-dot(eye,eye)+1.; if(d<0.)discard;
        float start=max(0.,-b-sqrt(d)); float end=-b+sqrt(d); float density=0.;
        for(int i=0;i<6;i++){vec3 q=eye+ray*mix(start,end,(float(i)+.5)/6.); float n=noise(q*5.+vec3(time*.035,0.,0.)); density+=smoothstep(.28,.78,n)*(1.-smoothstep(.55,1.,length(q)));}
        float a=(1.-exp(-density*(end-start)*.75))*opacity;
        vec3 color=mix(tint,vec3(.48,.24,.12),smoothstep(-.4,.6,p.y))*(.38+density*.12);
        gl_FragColor=vec4(color,a); }`,
    }),
  );
}

/** One renderer, with an exactly projection-preserving change of units at arrival. */
export class SolarSystemScene {
  readonly group = new THREE.Group();
  phase: SolarPhase = 'galaxy';
  selected: number | null = null;
  system: SolarSystem | null = null;
  private readonly canvas: HTMLCanvasElement;
  private readonly preparation = new PlanetPreparation();
  private readonly cache = new Map<SolarSystem, SolarSystemResources>();
  private current: SolarSystemResources | null = null;
  private recent: SolarSystem | null = null;
  private flightPreparation = new AbortController();
  private saved: SavedView | null = null;
  private origin = new THREE.Vector3();
  private transitionFrom = new THREE.Vector3();
  private transitionQuaternion = new THREE.Quaternion();
  private transitionTime = 0;
  private arrivalTime = 0;
  private localTime = 0;
  private visualTime = 0;
  private handedOff = false;
  private yaw = -0.32;
  private pitch = 0.62;
  private distance = 61;
  private target = new THREE.Vector3();
  private desiredPosition = new THREE.Vector3();
  private desiredTarget = new THREE.Vector3();
  private projected = new THREE.Vector3();
  private transitionEnd = new THREE.Vector3();
  private lookQuaternion = new THREE.Quaternion();
  private pointer = new Map<number, { x: number; y: number }>();
  private dragged = 0;
  private autoPaused = false;
  private destroyed = false;
  private dust = flightDust();
  private flightAmbient = new THREE.HemisphereLight(0x899bc5, 0x171122, 0.62);
  private flightLight = new THREE.PointLight(0xffdfac, 3.8, 0, 0);
  private hovered: number | null = null;
  private labels: (HTMLElement | null)[] = [];
  private labelsDirty = true;
  private layoutDirty = true;
  private labelObserver: MutationObserver;
  private resizeObserver: ResizeObserver;
  private host: HTMLElement;
  private preview: HTMLElement | null = null;
  private inspectorBounds: DOMRect | null = null;
  private previewWidth = 0;
  private previewHeight = 0;
  private previewX = 0;
  private previewY = 0;
  private hoverAnchorX = 0;
  private hoverAnchorY = 0;
  private previewOffsetX = 0;
  private previewOffsetY = 0;
  private canvasLeft = 0;
  private canvasTop = 0;
  private safeTop = 8;
  private safeBottom = 0;

  constructor(
    private scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
    private renderer: THREE.WebGLRenderer,
    private stage: HTMLElement,
    private onChange: (phase: SolarPhase, selected: number | null) => void,
    private onHover: (index: number | null) => void,
  ) {
    this.canvas = renderer.domElement;
    this.host = stage.parentElement ?? stage;
    this.group.name = 'Local solar system';
    this.group.visible = false;
    this.dust.renderOrder = 5;
    this.group.add(this.dust, this.flightAmbient, this.flightLight);
    scene.add(this.group);
    this.labelObserver = new MutationObserver(() => {
      this.labelsDirty = this.layoutDirty = true;
    });
    this.labelObserver.observe(this.host, { childList: true, subtree: true });
    this.resizeObserver = new ResizeObserver(() => {
      this.layoutDirty = true;
    });
    this.resizeObserver.observe(this.canvas);
    void this.warmFlight();
  }

  get active() {
    return this.phase !== 'galaxy';
  }
  get navigating() {
    return this.phase === 'entering' || this.phase === 'leaving';
  }
  private get bodies() {
    return this.current?.bodies ?? EMPTY_BODIES;
  }
  private get orbitMaterials() {
    return this.current?.orbitMaterials ?? EMPTY_ORBITS;
  }

  private async warmFlight() {
    const staging = new THREE.Scene();
    const dust = new THREE.Mesh(this.dust.geometry, this.dust.material);
    staging.add(dust, new THREE.HemisphereLight(), new THREE.PointLight());
    const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 10);
    camera.position.z = 2;
    try {
      await preparationTurn(this.flightPreparation.signal);
      await this.renderer.compileAsync(staging, camera);
      await preparationTurn(this.flightPreparation.signal);
      const material = this.dust.material;
      const colorWrite = material.colorWrite,
        autoClear = this.renderer.autoClear;
      material.colorWrite = false;
      this.renderer.autoClear = false;
      try {
        this.renderer.render(staging, camera);
      } finally {
        material.colorWrite = colorWrite;
        this.renderer.autoClear = autoClear;
      }
    } catch (error) {
      if (
        !this.destroyed &&
        error instanceof Error &&
        error.name !== 'AbortError'
      )
        console.error('Solar flight preparation failed', error);
    }
  }

  private report(phase: SolarPhase) {
    this.phase = phase;
    this.stage.dataset.solarPhase = phase;
    this.onChange(phase, this.selected);
  }

  /** Retain only the active (or most recent) system and the latest explicit intent. */
  prepare(system: SolarSystem) {
    if (this.destroyed) return;
    const protectedSystem =
      this.active && system !== this.system
        ? this.system
        : (this.current?.system ?? this.recent);
    for (const [key, resource] of this.cache) {
      if (key !== protectedSystem && key !== system) {
        resource.dispose();
        this.cache.delete(key);
      }
    }
    if (this.cache.has(system)) return;
    const resource = new SolarSystemResources(
      system,
      this.renderer,
      this.preparation,
    );
    this.cache.set(system, resource);
    void resource.completion.catch((error) => {
      if (this.cache.get(system) !== resource) return;
      this.cache.delete(system);
      resource.dispose();
      if (
        !this.destroyed &&
        error instanceof Error &&
        error.name !== 'AbortError'
      ) {
        // Worker failures already use the cooperative generator. An actual WebGL
        // failure cannot yield a valid destination; return the preserved galaxy.
        if (this.system === system && this.phase === 'entering') this.exit();
        console.error('Solar resource preparation failed', error);
      }
    });
  }

  enter(system: SolarSystem, origin: THREE.Vector3) {
    if (this.destroyed) return;
    if (!this.active) {
      const visibility: SavedView['visibility'] = [];
      for (const child of this.scene.children)
        if (child !== this.group) {
          visibility.push([child, child.visible]);
          child.traverse((object) => {
            if (object !== child && object instanceof THREE.Light)
              visibility.push([object, object.visible]);
          });
        }
      this.saved = {
        position: this.camera.position.clone(),
        quaternion: this.camera.quaternion.clone(),
        near: this.camera.near,
        far: this.camera.far,
        visibility,
      };
    } else {
      this.toGalaxyUnits();
      this.showGalaxySurroundings();
    }
    this.setHover(null);
    this.releasePointers();
    if (this.current) this.recent = this.current.system;
    this.current?.group.removeFromParent();
    this.current = null;
    this.system = system;
    this.origin.copy(origin);
    this.selected = null;
    this.autoPaused = false;
    this.localTime =
      this.visualTime =
      this.transitionTime =
      this.arrivalTime =
        0;
    this.yaw = -0.32;
    this.pitch = this.camera.aspect < 1 ? 0.9 : 0.62;
    this.distance = this.overviewDistance();
    this.handedOff = false;
    this.transitionFrom.copy(this.camera.position);
    this.transitionQuaternion.copy(this.camera.quaternion);
    this.group.position.copy(origin);
    this.group.scale.setScalar(GALAXY_UNIT);
    this.group.visible = true;
    this.flightAmbient.visible = this.flightLight.visible = true;
    this.flightLight.color.set(system.star.color);
    this.dust.visible = true;
    this.dust.scale.setScalar(system.extent * 2.4);
    this.dust.material.uniforms.opacity.value = 0;
    this.dust.material.uniforms.tint.value.set(system.nebula[0]);
    this.camera.near = Math.min(this.saved?.near ?? 0.1, 0.003);
    this.camera.updateProjectionMatrix();
    this.saved?.visibility.forEach(([object]) => {
      if (object instanceof THREE.Light) object.visible = false;
    });
    this.labelsDirty = true;
    // Report before scheduling a single byte of terrain work.
    this.report('entering');
    this.prepare(system);
  }

  private adoptReady() {
    if (this.current || !this.system) return;
    const resource = this.cache.get(this.system);
    if (!resource?.ready) return;
    this.current = resource;
    resource.starPosition.copy(this.group.position);
    this.group.add(resource.group);
    this.flightAmbient.visible = this.flightLight.visible = false;
    for (const material of resource.orbitMaterials)
      material.uniforms.focus.value = 1;
    this.labelsDirty = true;
  }

  private toLocalUnits() {
    this.camera.position.sub(this.origin).divideScalar(GALAXY_UNIT);
    this.target.sub(this.origin).divideScalar(GALAXY_UNIT);
    this.camera.near /= GALAXY_UNIT;
    this.camera.far = Math.max(
      this.camera.far / GALAXY_UNIT,
      (this.system?.extent ?? 40) * 20,
    );
    this.camera.updateProjectionMatrix();
    this.group.position.set(0, 0, 0);
    this.group.scale.setScalar(1);
    this.current?.starPosition.set(0, 0, 0);
    this.saved?.visibility.forEach(([child]) => {
      child.visible = false;
    });
    this.handedOff = true;
  }

  private toGalaxyUnits() {
    if (!this.handedOff) return;
    this.camera.position.multiplyScalar(GALAXY_UNIT).add(this.origin);
    this.target.multiplyScalar(GALAXY_UNIT).add(this.origin);
    this.group.position.copy(this.origin);
    this.group.scale.setScalar(GALAXY_UNIT);
    this.current?.starPosition.copy(this.origin);
    this.camera.near *= GALAXY_UNIT;
    this.camera.far = this.saved?.far ?? 100;
    this.camera.updateProjectionMatrix();
    this.handedOff = false;
  }

  private showGalaxySurroundings() {
    this.saved?.visibility.forEach(([child, visible]) => {
      child.visible = child instanceof THREE.Light ? false : visible;
    });
  }

  exit() {
    if (!this.active || this.phase === 'leaving') return;
    this.setHover(null);
    this.releasePointers();
    this.toGalaxyUnits();
    this.showGalaxySurroundings();
    this.transitionFrom.copy(this.camera.position);
    this.transitionQuaternion.copy(this.camera.quaternion);
    this.transitionTime = 0;
    this.dust.visible = true;
    this.report('leaving');
    // A cancelled cold destination must not continue competing with galaxy input.
    for (const [key, resource] of this.cache)
      if (!resource.ready) {
        resource.dispose();
        this.cache.delete(key);
      }
  }

  private restoreGalaxy() {
    this.group.visible = false;
    this.saved?.visibility.forEach(([child, visible]) => {
      child.visible = visible;
    });
    if (this.saved) {
      this.camera.position.copy(this.saved.position);
      this.camera.quaternion.copy(this.saved.quaternion);
      this.camera.near = this.saved.near;
      this.camera.far = this.saved.far;
      this.camera.updateProjectionMatrix();
    }
    this.saved = null;
    this.selected = null;
    this.handedOff = false;
  }

  select(index: number | null) {
    if (!this.active || this.navigating) return;
    if (index !== null && !this.bodies[index]) return;
    this.setHover(null);
    this.selected = index;
    this.yaw =
      index === null
        ? -0.32
        : Math.atan2(
            -this.bodies[index].root.position.x,
            -this.bodies[index].root.position.z,
          ) + 0.55;
    for (const material of this.orbitMaterials)
      material.uniforms.focus.value = index === null ? 1 : 0.16;
    this.pitch = index === null ? (this.camera.aspect < 1 ? 0.9 : 0.62) : 0.3;
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
    const extent = this.system?.extent ?? 40;
    // Frame the tilted orbital plane rather than the sphere containing its belts.
    return extent * 1.55 * Math.max(1, 0.8 / this.camera.aspect);
  }
  private focusDistance(planet: PlanetRecipe) {
    const ringRadius =
      this.bodies.find((body) => body.recipe === planet)?.footprint ??
      planet.radius;
    const width = this.canvas.clientWidth,
      height = this.canvas.clientHeight;
    const short = width > height && height <= 520;
    const portrait = width <= 720 && !short;
    const availableHeight = Math.max(
      100,
      height - (portrait ? 420 : short ? 235 : 200),
    );
    const availableWidth = Math.max(
      120,
      width - (portrait ? 48 : short ? 330 : 350),
    );
    const vertical = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const apparentRadius = planet.rings ? ringRadius : planet.radius * 1.12;
    return Math.max(
      (apparentRadius * 1.25) / ((vertical * availableHeight) / height),
      (apparentRadius * 1.25) /
        ((vertical * this.camera.aspect * availableWidth) / width),
    );
  }

  resize() {
    this.layoutDirty = true;
    if (this.selected === null) {
      this.distance = this.overviewDistance();
      this.pitch = this.camera.aspect < 1 ? 0.9 : 0.62;
    } else
      this.distance = this.focusDistance(this.bodies[this.selected].recipe);
  }

  update(milliseconds: number, reduceMotion: boolean) {
    if (!this.active) return;
    const elapsed = Math.max(0, milliseconds) / 1000;
    const dt = Math.min(elapsed, 0.04);
    if (this.phase === 'entering') this.adoptReady();
    const advance = !reduceMotion && !this.autoPaused;
    if (advance) this.visualTime += dt;
    if (
      advance &&
      this.selected === null &&
      this.hovered === null &&
      !this.navigating
    )
      this.localTime += dt;
    for (let index = 0; index < this.bodies.length; index++) {
      const body = this.bodies[index];
      const angle =
        body.recipe.phase +
        (this.localTime * 0.028) / Math.sqrt(body.recipe.orbit);
      body.root.position.set(
        Math.cos(angle) * body.recipe.orbit,
        0,
        Math.sin(angle) * body.recipe.orbit,
      );
      if (advance) {
        body.surface.rotation.y +=
          dt * (body.recipe.terrain === 'gas' ? 0.028 : 0.045);
        body.clouds.rotation.y += dt * 0.052;
      }
      for (let mi = 0; mi < body.moons.length; mi++) {
        const moonAngle = this.visualTime * 0.08 + mi * 2.9 + index;
        body.moons[mi].position.set(
          Math.cos(moonAngle) * body.moonDistances[mi],
          Math.sin(moonAngle * 0.7) * body.recipe.radius * 0.18,
          Math.sin(moonAngle) * body.moonDistances[mi],
        );
      }
    }
    if (this.current?.sun && advance)
      (this.current.sun.material as THREE.ShaderMaterial).uniforms.time.value +=
        dt * 0.035;
    if (this.current?.corona)
      this.current.corona.scale.setScalar(
        this.current.coronaSize * (1 + Math.sin(this.visualTime * 0.7) * 0.012),
      );

    if (this.phase === 'entering') {
      this.transitionTime += elapsed;
      if (reduceMotion) {
        if (this.current) {
          this.target.copy(this.origin);
          if (!this.handedOff) this.toLocalUnits();
          this.moveCamera(dt, true);
          this.dust.visible = false;
          this.report('system');
        }
      } else if (!this.handedOff) {
        const progress = 1 - Math.exp(-this.transitionTime * 1.45);
        this.transitionEnd
          .set(
            Math.sin(this.yaw) * Math.cos(this.pitch),
            Math.sin(this.pitch),
            Math.cos(this.yaw) * Math.cos(this.pitch),
          )
          .multiplyScalar(this.distance * GALAXY_UNIT)
          .add(this.origin);
        // The asymptotic approach keeps moving on genuinely cold preparation;
        // a small decaying curve adds parallax without a discontinuous camera cut.
        this.transitionEnd.x +=
          Math.sin(this.transitionTime * 0.45) *
          Math.exp(-this.transitionTime * 0.3) *
          GALAXY_UNIT *
          this.distance *
          0.08;
        this.camera.position.lerpVectors(
          this.transitionFrom,
          this.transitionEnd,
          progress,
        );
        this.camera.lookAt(this.origin);
        this.lookQuaternion.copy(this.camera.quaternion);
        const turn = Math.min(1, this.transitionTime / 2);
        this.camera.quaternion.slerpQuaternions(
          this.transitionQuaternion,
          this.lookQuaternion,
          turn * turn * (3 - 2 * turn),
        );
        this.target.copy(this.origin);
        this.dust.material.uniforms.opacity.value = Math.min(
          0.92,
          this.transitionTime * 0.48,
        );
        if (this.current && this.transitionTime >= 2.4) {
          this.toLocalUnits();
          this.arrivalTime = 0;
        }
      } else {
        this.arrivalTime += elapsed;
        this.moveCamera(elapsed, false);
        this.dust.material.uniforms.opacity.value =
          0.92 * Math.max(0, 1 - this.arrivalTime / 1.05);
        if (this.arrivalTime >= 1.05) {
          this.dust.visible = false;
          this.report('system');
        }
      }
    } else if (this.phase === 'leaving') {
      this.transitionTime += elapsed;
      const progress = reduceMotion
        ? 1
        : Math.min(1, this.transitionTime / 1.5);
      const ease = progress * progress * (3 - 2 * progress);
      if (this.saved) {
        this.camera.position.lerpVectors(
          this.transitionFrom,
          this.saved.position,
          ease,
        );
        this.camera.quaternion.slerpQuaternions(
          this.transitionQuaternion,
          this.saved.quaternion,
          ease,
        );
      }
      this.dust.material.uniforms.opacity.value =
        Math.sin(progress * Math.PI) * 0.65;
      if (progress === 1) {
        this.restoreGalaxy();
        this.report('galaxy');
      }
    } else this.moveCamera(dt, reduceMotion);
    if (this.dust.visible) {
      this.group.updateMatrixWorld(true);
      this.dust.material.uniforms.eye.value.copy(this.camera.position);
      this.dust.worldToLocal(this.dust.material.uniforms.eye.value);
      this.dust.material.uniforms.time.value = this.transitionTime;
    }
    this.updateLabels();
  }

  private moveCamera(dt: number, reduceMotion: boolean) {
    const body = this.selected === null ? null : this.bodies[this.selected];
    if (body) this.desiredTarget.copy(body.root.position);
    else this.desiredTarget.set(0, 0, 0);
    if (body) {
      const short =
        this.canvas.clientWidth > this.canvas.clientHeight &&
        this.canvas.clientHeight <= 520;
      const portrait = this.canvas.clientWidth <= 720 && !short;
      const halfHeight =
        this.distance * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
      // Shift in camera-plane coordinates, so framing survives dragging around a world.
      const horizontal = portrait ? 0 : short ? 0.22 : -0.2;
      const vertical = portrait
        ? -Math.min(0.62, 288 / this.canvas.clientHeight)
        : short
          ? -0.28
          : -0.12;
      this.desiredTarget.x +=
        Math.cos(this.yaw) * horizontal * halfHeight * this.camera.aspect;
      this.desiredTarget.z -=
        Math.sin(this.yaw) * horizontal * halfHeight * this.camera.aspect;
      this.desiredTarget.y += Math.cos(this.pitch) * vertical * halfHeight;
      this.desiredTarget.x -=
        Math.sin(this.yaw) * Math.sin(this.pitch) * vertical * halfHeight;
      this.desiredTarget.z -=
        Math.cos(this.yaw) * Math.sin(this.pitch) * vertical * halfHeight;
    }
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

  setHover(index: number | null) {
    if (
      !this.active ||
      this.navigating ||
      (index !== null && !this.bodies[index])
    )
      index = null;
    if (index === this.hovered) return;
    this.hovered = index;
    if (this.preview) this.preview.style.visibility = 'hidden';
    this.onHover(index);
  }

  private measureChrome() {
    const rect = this.canvas.getBoundingClientRect();
    this.canvasLeft = rect.left;
    this.canvasTop = rect.top;
    this.safeTop = 8;
    this.safeBottom = rect.height - 8;
    const heading = this.host.querySelector<HTMLElement>('.solar-heading');
    const console = this.host.querySelector<HTMLElement>('.solar-console');
    if (heading) {
      this.safeTop = Math.max(
        8,
        heading.getBoundingClientRect().bottom - rect.top + 8,
      );
      this.resizeObserver.observe(heading);
    }
    if (console) {
      this.safeBottom = Math.min(
        this.safeBottom,
        console.getBoundingClientRect().top - rect.top - 8,
      );
      this.resizeObserver.observe(console);
    }
    const inspector = this.host.querySelector<HTMLElement>('.solar-inspector');
    this.inspectorBounds = inspector?.getBoundingClientRect() ?? null;
    if (inspector) this.resizeObserver.observe(inspector);
    if (this.preview) {
      const parent =
        (
          this.preview.offsetParent as HTMLElement | null
        )?.getBoundingClientRect() ?? rect;
      this.previewOffsetX = rect.left - parent.left;
      this.previewOffsetY = rect.top - parent.top;
      const available = Math.max(64, this.safeBottom - this.safeTop);
      this.preview.style.maxHeight = `${available}px`;
      this.preview.style.overflowY = 'auto';
      const bounds = this.preview.getBoundingClientRect();
      this.previewWidth = bounds.width;
      this.previewHeight = Math.min(bounds.height, available);
      this.resizeObserver.observe(this.preview);
    }
    this.layoutDirty = false;
  }

  private updateLabels() {
    const width = this.canvas.clientWidth,
      height = this.canvas.clientHeight;
    this.group.updateMatrixWorld(true);
    this.camera.updateMatrixWorld(true);
    if (this.labelsDirty) {
      this.resizeObserver.disconnect();
      this.resizeObserver.observe(this.canvas);
      this.labels = this.bodies.map((body) =>
        this.host.querySelector<HTMLElement>(
          `[data-planet-label="${body.recipe.id}"]`,
        ),
      );
      this.preview = this.host.querySelector<HTMLElement>(
        '[data-solar-preview]',
      );
      this.labelsDirty = false;
      this.layoutDirty = true;
    }
    if (this.layoutDirty) this.measureChrome();
    for (let index = 0; index < this.bodies.length; index++) {
      const body = this.bodies[index],
        label = this.labels[index];
      body.root.getWorldPosition(this.projected).project(this.camera);
      const x = ((this.projected.x + 1) * width) / 2,
        y = ((1 - this.projected.y) * height) / 2;
      const inView =
        this.projected.z >= -1 &&
        this.projected.z < 1 &&
        x > 0 &&
        x < width &&
        y > 0 &&
        y < height;
      if (label) {
        const visible =
          !this.navigating &&
          (this.selected === null || this.selected === index) &&
          inView &&
          x > 45 &&
          x < width - 45 &&
          y > 90 &&
          y < height - (width < 720 ? 155 : 112);
        label.style.visibility = visible ? 'visible' : 'hidden';
        label.style.transform = `translate(${x}px, ${y}px)`;
        label.dataset.selected = String(this.selected === index);
      }
      if (this.hovered !== index) continue;
      if (!inView || this.navigating) {
        this.setHover(null);
        continue;
      }
      if (!this.preview || Number(this.preview.dataset.planetIndex) !== index)
        continue;
      this.hoverAnchorX = x;
      this.hoverAnchorY = y;
      const radius =
        (body.recipe.radius * height) /
        (2 *
          Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) *
          this.camera.position.distanceTo(body.root.position));
      const right = x + radius + 16;
      const preferredX =
        right + this.previewWidth < width - 8
          ? right
          : x - radius - 16 - this.previewWidth;
      this.previewX = THREE.MathUtils.clamp(
        preferredX,
        8,
        Math.max(8, width - this.previewWidth - 8),
      );
      this.previewY = THREE.MathUtils.clamp(
        y - this.previewHeight * 0.45,
        this.safeTop,
        Math.max(this.safeTop, this.safeBottom - this.previewHeight),
      );
      // The short-landscape inspector floats beside, rather than inside, the
      // footer's measured box. Keep the transmission clear of that second panel.
      const inspector = this.inspectorBounds;
      if (
        inspector &&
        this.previewX + this.canvasLeft < inspector.right + 8 &&
        this.previewX + this.canvasLeft + this.previewWidth >
          inspector.left - 8 &&
        this.previewY + this.canvasTop < inspector.bottom + 8 &&
        this.previewY + this.canvasTop + this.previewHeight > inspector.top - 8
      ) {
        const above = inspector.top - this.canvasTop - 8 - this.previewHeight;
        const left = inspector.left - this.canvasLeft - 8 - this.previewWidth;
        if (above >= this.safeTop) this.previewY = above;
        else if (left >= 8) this.previewX = left;
      }
      this.preview.style.transform = `translate(${this.previewX + this.previewOffsetX}px, ${this.previewY + this.previewOffsetY}px)`;
      this.preview.style.visibility = 'visible';
    }
  }

  private inPreviewBridge(clientX: number, clientY: number) {
    if (
      this.hovered === null ||
      !this.preview ||
      this.preview.style.visibility !== 'visible'
    )
      return false;
    const x = clientX - this.canvasLeft,
      y = clientY - this.canvasTop;
    if (
      x >= this.previewX - 24 &&
      x <= this.previewX + this.previewWidth + 24 &&
      y >= this.previewY - 24 &&
      y <= this.previewY + this.previewHeight + 24
    )
      return true;
    const endX = THREE.MathUtils.clamp(
      this.hoverAnchorX,
      this.previewX,
      this.previewX + this.previewWidth,
    );
    const endY = THREE.MathUtils.clamp(
      this.hoverAnchorY,
      this.previewY,
      this.previewY + this.previewHeight,
    );
    const dx = endX - this.hoverAnchorX,
      dy = endY - this.hoverAnchorY;
    const lengthSquared = dx * dx + dy * dy;
    const along = lengthSquared
      ? THREE.MathUtils.clamp(
          ((x - this.hoverAnchorX) * dx + (y - this.hoverAnchorY) * dy) /
            lengthSquared,
          0,
          1,
        )
      : 0;
    return (
      Math.hypot(
        x - this.hoverAnchorX - dx * along,
        y - this.hoverAnchorY - dy * along,
      ) <= 24
    );
  }

  pointerDown(event: PointerEvent) {
    if (!this.active || this.navigating || event.button !== 0) return;
    if (!this.pointer.size) this.dragged = 0;
    this.pointer.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.canvas.setPointerCapture(event.pointerId);
    this.canvas.style.cursor = 'grabbing';
  }

  pointerMove(event: PointerEvent) {
    const previous = this.pointer.get(event.pointerId);
    if (!previous) {
      const picked = this.pick(event.clientX, event.clientY);
      if (
        picked !== null ||
        !this.inPreviewBridge(event.clientX, event.clientY)
      )
        this.setHover(picked);
      this.canvas.style.cursor = picked === null ? 'grab' : 'pointer';
      return;
    }
    const dx = event.clientX - previous.x,
      dy = event.clientY - previous.y;
    this.dragged += Math.abs(dx) + Math.abs(dy);
    if (this.dragged >= 7) this.setHover(null);
    let other: { x: number; y: number } | undefined;
    for (const [id, point] of this.pointer)
      if (id !== event.pointerId) {
        other = point;
        break;
      }
    if (other) {
      const before = Math.hypot(previous.x - other.x, previous.y - other.y),
        after = Math.hypot(event.clientX - other.x, event.clientY - other.y);
      if (after > 0) this.zoom(before / after);
      this.dragged = Infinity;
    } else {
      this.yaw -= dx * 0.006;
      this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.004, 0.12, 1.3);
    }
    previous.x = event.clientX;
    previous.y = event.clientY;
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
    if (!this.active || this.navigating) return;
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
    if (!this.active || this.navigating) return null;
    const rect = this.canvas.getBoundingClientRect();
    let closest: number | null = null,
      distance = Infinity;
    this.bodies.forEach((body, index) => {
      if (this.selected !== null && index !== this.selected) return;
      body.root.getWorldPosition(this.projected).project(this.camera);
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
    this.canvas.style.cursor = '';
  }

  dispose() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.flightPreparation.abort();
    this.setHover(null);
    this.labelObserver.disconnect();
    this.resizeObserver.disconnect();
    this.releasePointers();
    if (this.active) this.restoreGalaxy();
    for (const resource of this.cache.values()) resource.dispose();
    this.cache.clear();
    this.preparation.dispose();
    this.current = null;
    this.system = this.recent = null;
    this.dust.geometry.dispose();
    this.dust.material.dispose();
    this.group.removeFromParent();
    this.group.clear();
  }
}
