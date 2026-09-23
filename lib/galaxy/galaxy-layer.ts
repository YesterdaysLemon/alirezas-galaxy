import * as THREE from 'three';
import type { galaxies, GalaxyId } from '@/data/galaxies';
import { createGalaxyGeometry } from './geometry';
import { seededRandom } from './math';
import { createPointsMaterial } from './points-material';

/** The galaxy's resting tilt toward the viewer. */
export const GALAXY_TILT = -0.08;
/** The smoky second pass turns slightly off the stars, so the arms read soft. */
export const MIST_TWIST = 0.018;

export type GalaxyTextures = {
  glow: THREE.Texture | null;
  marker: THREE.Texture | null;
  starlight: THREE.Texture | null;
  signalWave: THREE.Texture | null;
};

/** A spectral colour, brightness, size and shimmer phase fixed by a world's id. */
function starCharacter(id: string) {
  let seed = 7;
  for (let char = 0; char < id.length; char += 1)
    seed = Math.imul(seed, 31) + id.charCodeAt(char);
  const random = seededRandom(seed);
  const spectralColors = [0xff8570, 0xffcb91, 0xf4f7ff, 0x9bccff, 0x76a5ff];
  return {
    color: spectralColors[Math.floor(random() * spectralColors.length)],
    luminosity: 1 + random() * 0.9,
    lightSize: 1 + random() * 0.4,
    shimmerPhase: random() * Math.PI * 2,
    rotation: (random() - 0.5) * 0.7,
  };
}

/**
 * One galaxy: its stars and mist, core glow, and a marker, sparkle and signal
 * waves for each world. Both galaxies share this architecture; travel moves
 * the real groups continuously between foreground and distance.
 */
export function createGalaxyLayer(
  definition: (typeof galaxies)[GalaxyId],
  options: {
    starCount: number;
    pixelRatio: number;
    coreExposure: number;
    textures: GalaxyTextures;
  },
) {
  const { starCount, pixelRatio, coreExposure, textures } = options;
  const galaxy = new THREE.Group();
  galaxy.rotation.x = GALAXY_TILT;
  galaxy.rotation.y = 0.16;
  galaxy.position.y = 1.35;
  galaxy.scale.setScalar(1.08);

  const galaxyGeometry = createGalaxyGeometry(
    definition.id === 'home' ? starCount : Math.round(starCount * 0.7),
    definition.arms,
  );
  const galaxyMaterial = createPointsMaterial(pixelRatio);
  const galaxyPoints = new THREE.Points(galaxyGeometry, galaxyMaterial);
  galaxyPoints.renderOrder = 1;
  galaxy.add(galaxyPoints);

  // A second pass over the same compact buffer turns the points into the
  // broad, smoky ribbons that made the original menu read from across a room.
  const galaxyMistMaterial = createPointsMaterial(pixelRatio, 0.32, 2.45);
  galaxyMistMaterial.depthTest = false;
  const galaxyMist = new THREE.Points(galaxyGeometry, galaxyMistMaterial);
  galaxyMist.scale.set(1.012, 1, 1.012);
  galaxyMist.rotation.y = MIST_TWIST;
  galaxyMist.renderOrder = 0;
  galaxy.add(galaxyMist);

  const glowMaterial = new THREE.SpriteMaterial({
    map: textures.glow,
    color: 0xffffff,
    transparent: true,
    opacity: coreExposure,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
  });
  const glow = new THREE.Sprite(glowMaterial);
  glow.scale.set(17.5, 8.2, 1);
  glow.position.y = 0.22;
  glow.renderOrder = 3;
  galaxy.add(glow);

  const softGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: textures.glow,
      color: 0x7d5dff,
      transparent: true,
      opacity: 0.3 * coreExposure,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    }),
  );
  softGlow.scale.set(25, 12.4, 1);
  softGlow.position.y = -0.05;
  softGlow.renderOrder = 2;
  galaxy.add(softGlow);

  const nodes = definition.worlds.map((destination, index) => {
    const star = starCharacter(destination.id);
    const position = new THREE.Vector3(
      Math.cos(destination.angle) * destination.radius,
      0.38 + index * 0.018,
      Math.sin(destination.angle) * destination.radius,
    );
    const marker = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: textures.marker,
        color: new THREE.Color(destination.color).lerp(
          new THREE.Color(0xe9f3ff),
          0.82,
        ),
        transparent: true,
        opacity: 1,
        // Normal compositing lets the dark, clear lens suppress local haze;
        // additive black cannot clear anything beneath the marker.
        blending: THREE.NormalBlending,
        depthWrite: false,
        depthTest: false,
      }),
    );
    marker.position.copy(position);
    marker.scale.setScalar(destination.size * (index === 0 ? 0.56 : 0.51));
    marker.userData.destinationIndex = index;
    marker.renderOrder = 8;
    galaxy.add(marker);

    // Shared white light texture, individually tinted; the lens stays clear.
    const sparkle = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: textures.starlight,
        color: star.color,
        toneMapped: false,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
      }),
    );
    sparkle.position.copy(position);
    sparkle.material.rotation = star.rotation;
    sparkle.scale.copy(marker.scale).multiplyScalar(star.lightSize);
    sparkle.renderOrder = 9;
    galaxy.add(sparkle);

    const signalWaves = Array.from({ length: 3 }, (_, waveIndex) => {
      const wave = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: textures.signalWave,
          color: new THREE.Color(destination.color).lerp(
            new THREE.Color(0xd3cfff),
            0.78,
          ),
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          depthTest: false,
        }),
      );
      wave.position.copy(position);
      wave.scale.setScalar(destination.size * 0.5);
      wave.renderOrder = 7;
      wave.userData.phase = waveIndex / 3;
      galaxy.add(wave);
      return wave;
    });

    return {
      marker,
      sparkle,
      signalWaves,
      position,
      luminosity: star.luminosity,
      lightSize: star.lightSize,
      shimmerPhase: star.shimmerPhase,
      occluded: false,
    };
  });

  return {
    galaxy,
    tilt: GALAXY_TILT,
    galaxyGeometry,
    galaxyMaterial,
    galaxyPoints,
    galaxyMistMaterial,
    galaxyMist,
    glowMaterial,
    glow,
    softGlow,
    nodes,
  };
}

export type GalaxyLayer = ReturnType<typeof createGalaxyLayer>;

export function disposeGalaxyLayer(layer: GalaxyLayer) {
  layer.galaxyGeometry.dispose();
  layer.galaxyMaterial.dispose();
  layer.galaxyMistMaterial.dispose();
  layer.glowMaterial.dispose();
  layer.softGlow.material.dispose();
  layer.nodes.forEach(({ marker, sparkle, signalWaves }) => {
    marker.material.dispose();
    sparkle.material.dispose();
    signalWaves.forEach(({ material }) => material.dispose());
  });
}
