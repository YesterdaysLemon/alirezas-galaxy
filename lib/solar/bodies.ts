import * as THREE from 'three';
import type {
  PlanetRecipe,
  SolarSystem,
  SystemBelt,
} from '../../data/solar-systems';
import {
  adoptPlanetBuffers,
  seededRandom,
  terrainNoise,
  type PlanetBuffers,
} from '../planet-textures';
import { noise3, planeVertex } from './shaders';

export type SolarBody = {
  recipe: PlanetRecipe;
  root: THREE.Group;
  surface: THREE.Mesh;
  clouds: THREE.Mesh;
  moons: THREE.Group[];
  moonDistances: number[];
  /** The world's outer edge, including any rings. */
  footprint: number;
};

/** The system's own light: a soft fill and the star as a point light. */
export function systemLights(color: THREE.ColorRepresentation) {
  return [
    new THREE.HemisphereLight(0x899bc5, 0x171122, 0.62),
    new THREE.PointLight(color, 3.8, 0, 0),
  ] as const;
}

/** The star's churning surface. */
export function starMaterial(color: string) {
  return new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      tint: { value: new THREE.Color(color) },
    },
    vertexShader: `varying vec3 p; varying vec3 n; varying vec3 v; void main(){ p=normalize(position); vec4 mv=modelViewMatrix*vec4(position,1.); n=normalize(normalMatrix*normal); v=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `varying vec3 p; varying vec3 n; varying vec3 v; uniform float time; uniform vec3 tint;
      ${noise3}
      void main(){float granules=noise(p*72.+time); float flow=noise(p*13.+vec3(0,time,0)); float filaments=pow(abs(sin(flow*22.+p.y*18.)),8.); float facing=max(0.,dot(normalize(n),normalize(v))); float limb=pow(facing,.3); vec3 hot=mix(tint,vec3(1.,.98,.78),.3+granules*.55); vec3 col=hot*(.6+limb*.43+granules*.2)-tint*filaments*.1; gl_FragColor=vec4(col,1.); }`,
    toneMapped: false,
  });
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

/** The rendered world: surface, atmosphere rim and cloud shell. Shared with the planet lab. */
export function createWorldBody(
  recipe: PlanetRecipe,
  buffers: PlanetBuffers,
  starPosition: THREE.Vector3,
) {
  const { geometry, textures } = adoptPlanetBuffers(buffers);
  const material = new THREE.MeshStandardMaterial({
    map: textures.map,
    bumpMap: textures.bumpMap,
    bumpScale:
      recipe.terrain === 'gas' ? recipe.radius * 0.012 : recipe.radius * 0.075,
    roughnessMap: textures.roughnessMap,
    roughness: 1,
    emissiveMap: textures.emissiveMap,
    emissive: recipe.terrain === 'culture' ? 0xffffff : 0x000000,
    emissiveIntensity: 0.45,
    metalness: 0,
  });
  const surface = new THREE.Mesh(geometry, material);
  surface.rotation.z = recipe.terrain === 'gas' ? 0.18 : 0.08;
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(recipe.radius * 1.035, 64, 40),
    atmosphereMaterial(recipe.atmosphere, starPosition),
  );
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
  return { surface, atmosphere, clouds };
}

/** Room around a world's orbit before it meets the star, a neighbor or a belt. */
function orbitClearance(recipe: PlanetRecipe, system: SolarSystem) {
  let clearance = recipe.orbit - system.star.radius;
  for (const other of system.planets)
    if (other !== recipe)
      clearance = Math.min(
        clearance,
        Math.abs(other.orbit - recipe.orbit) * 0.46,
      );
  for (const belt of system.belts)
    clearance = Math.min(
      clearance,
      Math.min(
        Math.abs(belt.inner - recipe.orbit),
        Math.abs(belt.outer - recipe.orbit),
      ) - 0.3,
    );
  return clearance;
}

function ringSystem(recipe: PlanetRecipe, outer: number) {
  const inner = recipe.radius * 1.45;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(inner, outer, 160, 1),
    new THREE.ShaderMaterial({
      uniforms: {
        inner: { value: inner },
        outer: { value: outer },
      },
      vertexShader: planeVertex,
      fragmentShader: `varying vec2 p; uniform float inner; uniform float outer; void main(){ float r=(length(p)-inner)/(outer-inner); float footprint=fwidth(r); float bands=.54+.15*sin(r*115.)*(1.-smoothstep(.01,.04,footprint))+.07*sin(r*340.)*(1.-smoothstep(.003,.012,footprint)); float gap=smoothstep(.022,.043,abs(r-.58)); float edge=smoothstep(0.,.045,r)*(1.-smoothstep(.95,1.,r)); vec3 color=mix(vec3(.58,.47,.37),vec3(.91,.83,.68),r); gl_FragColor=vec4(color,bands*gap*edge); }`,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
    }),
  );
  ring.rotation.x = -Math.PI / 2 + 0.32;
  ring.rotation.y = 0.16;
  return ring;
}

function moon(recipe: PlanetRecipe, index: number) {
  const geometry = new THREE.IcosahedronGeometry(
    recipe.radius * (index === 0 ? 0.16 : 0.11),
    3,
  );
  const points = geometry.getAttribute('position');
  // Keep duplicated face vertices coincident; independent jitter cracks them.
  for (let j = 0; j < points.count; j++) {
    const x = points.getX(j),
      y = points.getY(j),
      z = points.getZ(j);
    const rough =
      0.95 + terrainNoise(x * 17, y * 17, z * 17, recipe.seed + index) * 0.1;
    points.setXYZ(j, x * rough, y * rough, z * rough);
  }
  geometry.computeVertexNormals();
  const group = new THREE.Group();
  group.add(
    new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        color: index === 0 ? 0xc9c6b7 : 0x8c99b4,
        roughness: 1,
        flatShading: true,
      }),
    ),
  );
  return group;
}

/**
 * A hairline of constant screen width: the ribbon geometry only reserves
 * room, and fwidth() draws ~1.5px however near or far the camera is. The
 * line parts around its world (never skewering it) and brightens into a
 * short wake behind the direction of travel.
 */
function orbitTrail(recipe: PlanetRecipe, system: SolarSystem) {
  const width = Math.max(0.12, system.extent * 0.006);
  const orbit = new THREE.Mesh(
    new THREE.RingGeometry(recipe.orbit - width, recipe.orbit + width, 384),
    new THREE.ShaderMaterial({
      uniforms: {
        tint: { value: new THREE.Color(recipe.atmosphere) },
        radius: { value: recipe.orbit },
        planetAngle: { value: recipe.phase },
        focus: { value: 1 },
      },
      vertexShader: planeVertex,
      // As in Spore's space stage, only a short comet trail follows each
      // world: brightest where it meets the world, gone a quarter-turn behind,
      // and nothing ahead. A soft glow around a thin core, tapering with it.
      fragmentShader: `varying vec2 p; uniform vec3 tint; uniform float radius; uniform float planetAngle; uniform float focus;
        void main(){
          float behind=mod(planetAngle-atan(-p.y,p.x),6.2831853);
          float trail=pow(1.-clamp(behind/1.7,0.,1.),1.8);
          if(trail<=0.)discard;
          float r=length(p); float px=abs(r-radius)/max(fwidth(r),1e-5);
          float width=.45+.55*trail;
          float core=1.-smoothstep(.5*width,1.5*width,px);
          float glow=exp(-px*px/(9.*width*width))*.45;
          gl_FragColor=vec4(tint*1.4,(core+glow)*trail*focus);
        }`,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  );
  orbit.rotation.x = -Math.PI / 2;
  return orbit;
}

/** A world with its rings and moons, and the comet trail along its orbit. */
export function createPlanet(
  recipe: PlanetRecipe,
  buffers: PlanetBuffers,
  system: SolarSystem,
  starPosition: THREE.Vector3,
) {
  const root = new THREE.Group();
  root.name = recipe.id;
  root.position.set(
    Math.cos(recipe.phase) * recipe.orbit,
    0,
    Math.sin(recipe.phase) * recipe.orbit,
  );
  const clearance = orbitClearance(recipe, system);
  const ringOuter = Math.min(recipe.radius * 2.3, clearance * 0.77);
  const { surface, atmosphere, clouds } = createWorldBody(
    recipe,
    buffers,
    starPosition,
  );
  root.add(surface, atmosphere, clouds);
  if (recipe.rings) root.add(ringSystem(recipe, ringOuter));
  const moons: THREE.Group[] = [];
  const moonDistances: number[] = [];
  const moonCount = recipe.moons ?? 0;
  const nearest = recipe.rings
    ? ringOuter + recipe.radius * 0.3
    : recipe.radius * 1.6;
  const farthest = Math.max(
    nearest,
    Math.min(clearance - recipe.radius * 0.2, recipe.radius * 3.5),
  );
  for (let i = 0; i < moonCount; i++) {
    const body = moon(recipe, i);
    root.add(body);
    moons.push(body);
    moonDistances.push(
      nearest + (farthest - nearest) * ((i + 1) / (moonCount + 1)),
    );
  }
  const body: SolarBody = {
    recipe,
    root,
    surface,
    clouds,
    moons,
    moonDistances,
    footprint: recipe.rings ? ringOuter : recipe.radius,
  };
  return { body, orbit: orbitTrail(recipe, system) };
}

/**
 * Asteroid belts are dense, thin and rocky; Kuiper belts are sparse, thick
 * and icy, with a few larger bodies, ringing the whole system.
 */
export function createBelt({ kind, inner, outer, count, seed }: SystemBelt) {
  const random = seededRandom(seed);
  const kuiper = kind === 'kuiper';
  const belt = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 0),
    new THREE.MeshStandardMaterial({
      color: kuiper ? 0xe6eef5 : 0x938781,
      roughness: kuiper ? 0.7 : 1,
      flatShading: true,
    }),
    count,
  );
  const dummy = new THREE.Object3D(),
    color = new THREE.Color();
  // Farther belts are seen from farther away; keep their rocks legible.
  const reach = 0.6 + outer / 32;
  for (let i = 0; i < count; i++) {
    const angle = random() * Math.PI * 2,
      radius = inner + random() * (outer - inner);
    dummy.position.set(
      Math.cos(angle) * radius,
      (random() - 0.5) * (kuiper ? 2.4 : 0.32),
      Math.sin(angle) * radius,
    );
    const size =
      reach *
      (kuiper
        ? 0.05 + Math.pow(random(), 5) * 0.22
        : 0.03 + Math.pow(random(), 3) * 0.13);
    dummy.scale.set(
      size,
      size * (0.6 + random() * 0.6),
      size * (0.65 + random() * 0.7),
    );
    dummy.rotation.set(random() * 6, random() * 6, random() * 6);
    dummy.updateMatrix();
    belt.setMatrixAt(i, dummy.matrix);
    if (kuiper)
      color.setHSL(0.55 + random() * 0.1, 0.18, 0.62 + random() * 0.3);
    else color.setHSL(0.08 + random() * 0.1, 0.12, 0.32 + random() * 0.35);
    belt.setColorAt(i, color);
  }
  return belt;
}
