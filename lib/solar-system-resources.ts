import * as THREE from 'three';
import type { PlanetRecipe, SolarSystem } from '../data/solar-systems';
import {
  adoptPlanetBuffers,
  seededRandom,
  terrainNoise,
  type PlanetBuffers,
} from './planet-textures';
import { PlanetPreparation, preparationTurn } from './planet-preparation';

export type SolarBody = {
  recipe: PlanetRecipe;
  root: THREE.Group;
  surface: THREE.Mesh;
  clouds: THREE.Mesh;
  moons: THREE.Group[];
  moonDistances: number[];
  footprint: number;
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

function atmosphereMaterial(color: string, starPosition: THREE.Vector3) {
  return new THREE.ShaderMaterial({
    uniforms: {
      tint: { value: new THREE.Color(color) },
      starPosition: { value: starPosition },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    vertexShader: `uniform vec3 starPosition; varying vec3 n; varying vec3 view; varying vec3 light;
      void main(){ vec4 world=modelMatrix*vec4(position,1.); vec4 p=viewMatrix*world; n=normalize(normalMatrix*normal); view=normalize(-p.xyz); light=normalize((viewMatrix*vec4(starPosition-world.xyz,0.)).xyz); gl_Position=projectionMatrix*p; }`,
    fragmentShader: `uniform vec3 tint; varying vec3 n; varying vec3 view; varying vec3 light;
      void main(){ float rim=pow(1.-max(0.,dot(normalize(n),normalize(view))),5.); float day=smoothstep(-.3,.7,dot(normalize(n),normalize(light))); gl_FragColor=vec4(tint,rim*(.08+day*.52)); }`,
  });
}

async function nebulaTexture(seed: number, signal: AbortSignal) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d')!;
  const image = context.createImageData(256, 256);
  for (let y = 0; y < 256; y++) {
    if (y % 4 === 0) await preparationTurn(signal);
    for (let x = 0; x < 256; x++) {
      const u = (x - 128) / 128,
        v = (y - 128) / 128;
      const warp = terrainNoise(u * 3, v * 3, 2, seed);
      const cloud =
        terrainNoise(u * 4 + warp, v * 4, 4, seed + 1) * 0.62 +
        terrainNoise(u * 11, v * 11, 8, seed + 2) * 0.26 +
        terrainNoise(u * 29, v * 29, 3, seed + 3) * 0.12;
      const alpha =
        Math.pow(Math.max(0, 1 - u * u - v * v), 1.6) *
        Math.pow(Math.max(0, cloud - 0.24), 1.7) *
        600;
      const i = (y * 256 + x) * 4;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = 255;
      image.data[i + 3] = alpha;
    }
  }
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** A detached, abortable detailed system. No preparation touches the live view. */
export class SolarSystemResources {
  readonly group = new THREE.Group();
  readonly starPosition = new THREE.Vector3();
  readonly controller = new AbortController();
  readonly bodies: SolarBody[] = [];
  readonly orbitMaterials: THREE.ShaderMaterial[] = [];
  readonly completion: Promise<void>;
  ready = false;
  sun: THREE.Mesh | null = null;
  corona: THREE.Sprite | null = null;
  coronaSize = 1;
  private ownedTextures = new Set<THREE.Texture>();
  private disposed = false;

  constructor(
    readonly system: SolarSystem,
    private renderer: THREE.WebGLRenderer,
    private preparation: PlanetPreparation,
  ) {
    this.group.name = `${system.name} detailed system`;
    this.completion = this.build();
  }

  private async build() {
    const system = this.system;
    const signal = this.controller.signal;
    await preparationTurn(signal);
    this.group.add(new THREE.HemisphereLight(0x899bc5, 0x171122, 0.62));
    const starlight = new THREE.PointLight(system.star.color, 3.8, 0, 0);
    this.group.add(starlight);
    const sunMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        tint: { value: new THREE.Color(system.star.color) },
      },
      vertexShader: `varying vec3 p; varying vec3 n; varying vec3 v; void main(){ p=normalize(position); vec4 mv=modelViewMatrix*vec4(position,1.); n=normalize(normalMatrix*normal); v=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `varying vec3 p; varying vec3 n; varying vec3 v; uniform float time; uniform vec3 tint;
        float hash(vec3 q){return fract(sin(dot(q,vec3(127.1,311.7,74.7)))*43758.5453);}
        float noise(vec3 q){vec3 i=floor(q),f=fract(q); f=f*f*(3.-2.*f); return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
        void main(){float granules=noise(p*72.+time); float flow=noise(p*13.+vec3(0,time,0)); float filaments=pow(abs(sin(flow*22.+p.y*18.)),8.); float facing=max(0.,dot(normalize(n),normalize(v))); float limb=pow(facing,.3); vec3 hot=mix(tint,vec3(1.,.98,.78),.3+granules*.55); vec3 col=hot*(.6+limb*.43+granules*.2)-tint*filaments*.1; gl_FragColor=vec4(col,1.); }`,
      toneMapped: false,
    });
    this.sun = new THREE.Mesh(
      new THREE.SphereGeometry(system.star.radius, 72, 48),
      sunMaterial,
    );
    this.sun.name = system.starName;
    this.sun.userData.classification = system.star.classification;
    this.group.add(this.sun);
    this.corona = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture(),
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
    const random = seededRandom(system.seed);
    const skyRadius = Math.max(150, system.extent * 8);
    const starPositions = new Float32Array(2400 * 3),
      starColors = new Float32Array(2400 * 3);
    for (let i = 0; i < 2400; i++) {
      const a = random() * Math.PI * 2,
        y = random() * 2 - 1,
        r = Math.sqrt(1 - y * y);
      starPositions[i * 3] = Math.cos(a) * r * skyRadius;
      starPositions[i * 3 + 1] = y * skyRadius;
      starPositions[i * 3 + 2] = Math.sin(a) * r * skyRadius;
      const brightness = 0.15 + Math.pow(random(), 3) * 0.85,
        warm = random();
      starColors[i * 3] = brightness * (0.72 + warm * 0.28);
      starColors[i * 3 + 1] = brightness * 0.85;
      starColors[i * 3 + 2] = brightness * (1 - warm * 0.22);
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(starPositions, 3),
    );
    starGeometry.setAttribute(
      'color',
      new THREE.BufferAttribute(starColors, 3),
    );
    const starMaterial = new THREE.PointsMaterial({
      size: skyRadius * 0.0014,
      vertexColors: true,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    starMaterial.onBeforeCompile = (shader) => {
      // PointsMaterial ignores object scale; preserve star size across the flight's unit rebase.
      shader.vertexShader = shader.vertexShader.replace(
        'gl_PointSize = size;',
        'gl_PointSize = size * length(modelMatrix[0].xyz);',
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        '#include <color_fragment>\ndiffuseColor.a *= 1.0 - smoothstep(0.12, 0.5, length(gl_PointCoord - vec2(0.5)));',
      );
    };
    this.group.add(new THREE.Points(starGeometry, starMaterial));
    const clouds: THREE.Texture[] = [];
    for (const seed of [system.seed, system.seed + 51]) {
      const texture = await nebulaTexture(seed, signal);
      this.ownedTextures.add(texture);
      clouds.push(texture);
    }
    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2;
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: clouds[i % 2],
          color: system.nebula[i % 2],
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          rotation: random() * Math.PI,
        }),
      );
      sprite.position.set(
        Math.cos(angle) * skyRadius * 0.75,
        (random() - 0.5) * skyRadius * 0.9,
        Math.sin(angle) * skyRadius * 0.75,
      );
      sprite.scale.set(
        skyRadius * (0.85 + random() * 0.45),
        skyRadius * (0.55 + random() * 0.4),
        1,
      );
      this.group.add(sprite);
    }
    for (const recipe of system.planets) {
      const buffers = await this.preparation.generate(recipe, signal);
      await preparationTurn(signal);
      this.addPlanet(recipe, buffers);
    }
    for (const belt of system.belts) {
      await preparationTurn(signal);
      this.addAsteroids(belt.inner, belt.outer, belt.count, belt.seed);
    }
    await this.warm();
    if (!signal.aborted) this.ready = true;
  }

  private addPlanet(recipe: PlanetRecipe, buffers: PlanetBuffers) {
    const root = new THREE.Group();
    this.group.add(root);
    root.name = recipe.id;
    root.position.set(
      Math.cos(recipe.phase) * recipe.orbit,
      0,
      Math.sin(recipe.phase) * recipe.orbit,
    );
    let clearance = recipe.orbit - (this.system?.star.radius ?? 2);
    for (const other of this.system?.planets ?? []) {
      if (other !== recipe)
        clearance = Math.min(
          clearance,
          Math.abs(other.orbit - recipe.orbit) * 0.46,
        );
    }
    for (const belt of this.system?.belts ?? []) {
      clearance = Math.min(
        clearance,
        Math.min(
          Math.abs(belt.inner - recipe.orbit),
          Math.abs(belt.outer - recipe.orbit),
        ) - 0.3,
      );
    }
    const ringOuter = Math.min(recipe.radius * 2.3, clearance * 0.77);
    const { geometry, textures } = adoptPlanetBuffers(buffers);
    const material = new THREE.MeshStandardMaterial({
      map: textures.map,
      bumpMap: textures.bumpMap,
      bumpScale:
        recipe.terrain === 'gas'
          ? recipe.radius * 0.012
          : recipe.radius * 0.075,
      roughnessMap: textures.roughnessMap,
      roughness: 1,
      emissiveMap: textures.emissiveMap,
      emissive: recipe.terrain === 'culture' ? 0xffffff : 0x000000,
      emissiveIntensity: 0.45,
      metalness: 0,
    });
    const surface = new THREE.Mesh(geometry, material);
    surface.rotation.z = recipe.terrain === 'gas' ? 0.18 : 0.08;
    root.add(surface);
    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(recipe.radius * 1.035, 64, 40),
      atmosphereMaterial(recipe.atmosphere, this.starPosition),
    );
    root.add(atmosphere);
    const clouds = new THREE.Mesh(
      new THREE.SphereGeometry(recipe.radius * 1.042, 64, 40),
      new THREE.MeshStandardMaterial({
        map: textures.cloudMap,
        transparent: true,
        opacity: 0.64,
        depthWrite: false,
        roughness: 1,
      }),
    );
    root.add(clouds);
    if (recipe.rings) {
      const ringGeo = new THREE.RingGeometry(
        recipe.radius * 1.45,
        ringOuter,
        160,
        1,
      );
      const ring = new THREE.Mesh(
        ringGeo,
        new THREE.ShaderMaterial({
          uniforms: {
            inner: { value: recipe.radius * 1.45 },
            outer: { value: ringOuter },
          },
          vertexShader: `varying vec2 p; void main(){p=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
          fragmentShader: `varying vec2 p; uniform float inner; uniform float outer; void main(){ float r=(length(p)-inner)/(outer-inner); float footprint=fwidth(r); float bands=.54+.15*sin(r*115.)*(1.-smoothstep(.01,.04,footprint))+.07*sin(r*340.)*(1.-smoothstep(.003,.012,footprint)); float gap=smoothstep(.022,.043,abs(r-.58)); float edge=smoothstep(0.,.045,r)*(1.-smoothstep(.95,1.,r)); vec3 color=mix(vec3(.58,.47,.37),vec3(.91,.83,.68),r); gl_FragColor=vec4(color,bands*gap*edge); }`,
          side: THREE.DoubleSide,
          transparent: true,
          depthWrite: false,
        }),
      );
      ring.rotation.x = -Math.PI / 2 + 0.32;
      ring.rotation.y = 0.16;
      root.add(ring);
    }
    const moons: THREE.Group[] = [];
    const moonDistances: number[] = [];
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
      const minimum = recipe.rings
        ? ringOuter + recipe.radius * 0.3
        : recipe.radius * 1.6;
      moonDistances.push(
        minimum +
          (Math.max(
            minimum,
            Math.min(clearance - recipe.radius * 0.2, recipe.radius * 3.5),
          ) -
            minimum) *
            ((i + 1) / ((recipe.moons ?? 0) + 1)),
      );
    }
    this.bodies.push({
      recipe,
      root,
      surface,
      clouds,
      moons,
      moonDistances,
      footprint: recipe.rings ? ringOuter : recipe.radius,
    });
    // A world-space ribbon stays luminous at oblique angles; angular modulation
    // gives the orbit a leading arc instead of a flat diagram's uniform hairline.
    const orbitWidth = Math.max(0.06, (this.system?.extent ?? 40) * 0.005);
    const orbit = new THREE.Mesh(
      new THREE.RingGeometry(
        recipe.orbit - orbitWidth,
        recipe.orbit + orbitWidth,
        256,
      ),
      new THREE.ShaderMaterial({
        uniforms: {
          tint: { value: new THREE.Color(recipe.atmosphere) },
          radius: { value: recipe.orbit },
          width: { value: orbitWidth },
          phase: { value: recipe.phase },
          focus: { value: 1 },
        },
        vertexShader: `varying vec2 p; void main(){p=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader: `varying vec2 p; uniform vec3 tint; uniform float radius; uniform float width; uniform float phase; uniform float focus; void main(){float edge=abs(length(p)-radius)/width; float arc=.35+.65*pow(.5+.5*cos(atan(-p.y,p.x)-phase),3.); float alpha=(1.-smoothstep(.12,1.,edge))*arc; gl_FragColor=vec4(tint*1.55,alpha*.9*focus);}`,
        side: THREE.DoubleSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    orbit.rotation.x = -Math.PI / 2;
    this.group.add(orbit);
    this.orbitMaterials.push(orbit.material);
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
    this.group.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.material) return;
      for (const material of Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material]) {
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
    const materials = new Map<THREE.Material, [boolean, boolean]>();
    const culling = new Map<THREE.Object3D, boolean>();
    const children = this.group.children.filter(
      (child) => !(child instanceof THREE.Light),
    );
    const visibility = children.map((child) => child.visible);
    const autoClear = this.renderer.autoClear;
    // Color/depth write masks are render state, not shader variants. Submitting
    // invisible batches to the real framebuffer warms the exact live programs.
    try {
      this.group.traverse((object) => {
        culling.set(object, object.frustumCulled);
        object.frustumCulled = false;
        const mesh = object as THREE.Mesh;
        if (!mesh.material) return;
        for (const material of Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material]) {
          if (materials.has(material)) continue;
          materials.set(material, [material.colorWrite, material.depthWrite]);
          material.colorWrite = material.depthWrite = false;
        }
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
      if (mesh.material)
        for (const material of Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material]) {
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
    this.sun = this.corona = null;
    this.ownedTextures.clear();
  }
}
