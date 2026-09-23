import * as THREE from 'three';
import type { SolarSystem } from '../../data/solar-systems';
import { PlanetPreparation, preparationTurn } from '../planet-preparation';
import {
  createBelt,
  createPlanet,
  starMaterial,
  systemLights,
  type SolarBody,
} from './bodies';
import { createSky, glowTexture } from './sky';

export type { SolarBody } from './bodies';

/** Every material on an object, whether it has one or several. */
function materialsOf(object: THREE.Object3D) {
  const material = (object as THREE.Mesh).material;
  if (!material) return [];
  return Array.isArray(material) ? material : [material];
}

/** A detached, abortable detailed system. No preparation touches the live view. */
export class SolarSystemResources {
  readonly group = new THREE.Group();
  readonly starPosition = new THREE.Vector3();
  readonly bodies: SolarBody[] = [];
  readonly orbitMaterials: THREE.ShaderMaterial[] = [];
  readonly completion: Promise<void>;
  ready = false;
  sun: THREE.Mesh | null = null;
  corona: THREE.Sprite | null = null;
  coronaSize = 1;
  /** Local sky: only meaningful after the unit handoff, so it fades in separately. */
  private sky: THREE.Group | null = null;
  /** The galactic band, turned so its bright core faces the real galaxy center. */
  private band: THREE.Group | null = null;
  private readonly skyMaterials: [THREE.Material, number][] = [];
  private skyLevel = -1;
  private readonly controller = new AbortController();
  private readonly ownedTextures = new Set<THREE.Texture>();
  private disposed = false;

  constructor(
    readonly system: SolarSystem,
    private readonly renderer: THREE.WebGLRenderer,
    private readonly preparation: PlanetPreparation,
  ) {
    this.group.name = `${system.name} detailed system`;
    this.completion = this.build();
  }

  private async build() {
    const system = this.system;
    const signal = this.controller.signal;
    await preparationTurn(signal);
    this.group.add(...systemLights(system.star.color));
    this.sun = new THREE.Mesh(
      new THREE.SphereGeometry(system.star.radius, 72, 48),
      starMaterial(system.star.color),
    );
    this.sun.name = system.starName;
    this.sun.userData.classification = system.star.classification;
    this.group.add(this.sun);
    const glow = glowTexture();
    this.ownedTextures.add(glow);
    this.corona = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glow,
        color: system.star.color,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
        opacity: 0.7,
      }),
    );
    this.coronaSize = system.star.radius * 5.5;
    this.corona.scale.setScalar(this.coronaSize);
    this.group.add(this.corona);
    const { sky, band, clouds } = await createSky(system, glow, signal);
    clouds.forEach((texture) => this.ownedTextures.add(texture));
    sky.traverse((object) => {
      for (const material of materialsOf(object))
        this.skyMaterials.push([material, material.opacity]);
    });
    this.sky = sky;
    this.band = band;
    sky.visible = false;
    this.group.add(sky);
    // Request every world at once so the worker pool generates in parallel;
    // adopt them in orbital order as each arrives.
    const surfaces = system.planets.map((recipe) =>
      this.preparation.generate(recipe, signal),
    );
    surfaces.forEach((surface) => surface.catch(() => undefined));
    for (let index = 0; index < system.planets.length; index++) {
      const buffers = await surfaces[index];
      await preparationTurn(signal);
      const { body, orbit } = createPlanet(
        system.planets[index],
        buffers,
        system,
        this.starPosition,
      );
      this.group.add(body.root, orbit);
      this.bodies.push(body);
      this.orbitMaterials.push(orbit.material);
    }
    for (const belt of system.belts) {
      await preparationTurn(signal);
      this.group.add(createBelt(belt));
    }
    await this.warm();
    if (!signal.aborted) this.ready = true;
  }

  /**
   * Face the band's core toward the galaxy center, as seen from this star, and
   * lean the band's plane through the overview's line of sight so the galaxy
   * the camera just crossed stays in frame behind the orbits.
   */
  orientSky(towardCore: THREE.Vector3, lineOfSight: THREE.Vector3) {
    if (!this.band) return;
    const core = new THREE.Vector3(towardCore.x, 0, towardCore.z);
    if (core.lengthSq() < 1e-8) core.set(1, 0, 0);
    core.normalize();
    const sight = new THREE.Vector3(
      lineOfSight.x,
      lineOfSight.y * 0.7,
      lineOfSight.z,
    ).normalize();
    const normal = new THREE.Vector3().crossVectors(core, sight);
    if (normal.lengthSq() < 1e-4) normal.set(0, 1, 0);
    normal.normalize();
    if (normal.y < 0) normal.negate();
    const third = new THREE.Vector3().crossVectors(core, normal);
    this.band.quaternion.setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(core, normal, third),
    );
  }

  setSkyOpacity(level: number) {
    if (!this.sky || level === this.skyLevel) return;
    this.skyLevel = level;
    this.sky.visible = level > 0.001;
    for (const [material, base] of this.skyMaterials)
      material.opacity = base * level;
  }

  /**
   * Upload every texture and compile every program before the system is
   * shown, a batch per idle turn, so its first frame costs no GPU work.
   */
  private async warm() {
    const signal = this.controller.signal;
    const staging = new THREE.Scene();
    staging.add(this.group);
    const camera = new THREE.PerspectiveCamera(
      42,
      1,
      0.01,
      this.system.extent * 30,
    );
    camera.position.set(0, this.system.extent, this.system.extent * 1.6);
    camera.lookAt(0, 0, 0);
    const textures = new Set<THREE.Texture>();
    const materials = new Map<THREE.Material, [boolean, boolean]>();
    const culling = new Map<THREE.Object3D, boolean>();
    this.group.traverse((object) => {
      culling.set(object, object.frustumCulled);
      for (const material of materialsOf(object)) {
        if (materials.has(material)) continue;
        materials.set(material, [material.colorWrite, material.depthWrite]);
        for (const value of Object.values(material))
          if (value instanceof THREE.Texture) textures.add(value);
      }
    });
    for (const texture of textures) {
      await preparationTurn(signal);
      this.renderer.initTexture(texture);
    }
    await preparationTurn(signal);
    // Compile the displayed framebuffer variant with precisely the local lights.
    await this.renderer.compileAsync(staging, camera);
    await preparationTurn(signal);
    const children = this.group.children.filter(
      (child) => !(child instanceof THREE.Light),
    );
    const visibility = children.map((child) => child.visible);
    const autoClear = this.renderer.autoClear;
    // Color/depth write masks are render state, not shader variants. Submitting
    // invisible batches to the real framebuffer warms the exact live programs.
    try {
      culling.forEach((_, object) => {
        object.frustumCulled = false;
      });
      materials.forEach((_, material) => {
        material.colorWrite = material.depthWrite = false;
      });
      children.forEach((child) => {
        child.visible = false;
      });
      for (const child of children) {
        await preparationTurn(signal);
        child.visible = true;
        this.renderer.autoClear = false;
        try {
          this.renderer.render(staging, camera);
        } finally {
          this.renderer.autoClear = autoClear;
          child.visible = false;
        }
      }
    } finally {
      materials.forEach(([color, depth], material) => {
        material.colorWrite = color;
        material.depthWrite = depth;
      });
      culling.forEach((value, object) => {
        object.frustumCulled = value;
      });
      children.forEach((child, index) => {
        child.visible = visibility[index];
      });
      this.group.removeFromParent();
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.controller.abort();
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = this.ownedTextures;
    this.group.traverse((object) => {
      if (object instanceof THREE.InstancedMesh) object.dispose();
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) geometries.add(mesh.geometry);
      for (const material of materialsOf(object)) {
        materials.add(material);
        for (const value of Object.values(material))
          if (value instanceof THREE.Texture) textures.add(value);
      }
    });
    geometries.forEach((item) => item.dispose());
    materials.forEach((item) => item.dispose());
    textures.forEach((item) => item.dispose());
    this.group.removeFromParent();
    this.group.clear();
    this.bodies.length = this.orbitMaterials.length = 0;
    this.sun = this.corona = this.sky = this.band = null;
    this.skyMaterials.length = 0;
    this.ownedTextures.clear();
  }
}
