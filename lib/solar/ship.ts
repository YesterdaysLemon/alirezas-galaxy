import * as THREE from 'three';

/**
 * An original, toy-like scout saucer: the player's presence in a system.
 * It follows whichever world is hovered or selected, so the scene itself
 * answers "where am I pointing?" without another HUD label.
 */
export class SolarShip {
  readonly root = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly beam: THREE.Mesh<
    THREE.CylinderGeometry,
    THREE.ShaderMaterial
  >;
  private readonly lights: THREE.InstancedMesh;
  private readonly lightMaterial: THREE.MeshBasicMaterial;
  readonly velocity = new THREE.Vector3();
  private readonly finishes: THREE.MeshPhysicalMaterial[] = [];
  private readonly goal = new THREE.Vector3();
  private readonly scratch = new THREE.Vector3();
  private readonly lightColor = new THREE.Color();
  private readonly owned: (THREE.BufferGeometry | THREE.Material)[] = [];
  private time = 0;
  private beamLevel = 0;
  private chase = -1;
  private placed = false;
  size = 1;

  constructor() {
    this.root.name = 'Scout saucer';
    // Lacquered toy finishes: a clear coat over pearl, enamel blue and tinted
    // glass. The star is the key light, so the far side falls into shade like
    // the worlds around it; reflections (setEnvironment) only add gloss.
    const hull = new THREE.MeshPhysicalMaterial({
      color: 0xd3dce5,
      metalness: 0.2,
      roughness: 0.34,
      clearcoat: 1,
      clearcoatRoughness: 0.16,
      emissive: 0x04080d,
    });
    const trim = new THREE.MeshPhysicalMaterial({
      color: 0x2f7fd0,
      metalness: 0.3,
      roughness: 0.28,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      emissive: 0x020a14,
    });
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0x5fd8ff,
      metalness: 0,
      roughness: 0.06,
      clearcoat: 1,
      emissive: 0x0d4a5e,
      transparent: true,
      opacity: 0.72,
    });
    this.finishes.push(hull, trim, glass);
    // One lathe silhouette: flat belly, fat bumper, shallow upper deck.
    const profile = [
      [0, -0.2],
      [0.34, -0.22],
      [0.72, -0.12],
      [0.98, -0.02],
      [1.02, 0.03],
      [0.96, 0.09],
      [0.62, 0.17],
      [0.38, 0.2],
      [0, 0.2],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const hullGeometry = new THREE.LatheGeometry(profile, 40);
    const bumperGeometry = new THREE.TorusGeometry(0.99, 0.055, 10, 48);
    const domeGeometry = new THREE.SphereGeometry(
      0.4,
      28,
      14,
      0,
      Math.PI * 2,
      0,
      Math.PI / 2,
    );
    const podGeometry = new THREE.SphereGeometry(0.2, 20, 10);
    const antennaGeometry = new THREE.CylinderGeometry(0.012, 0.012, 0.22, 6);
    const tipGeometry = new THREE.SphereGeometry(0.045, 10, 8);
    this.owned.push(
      hull,
      trim,
      glass,
      hullGeometry,
      bumperGeometry,
      domeGeometry,
      podGeometry,
      antennaGeometry,
      tipGeometry,
    );
    const hullMesh = new THREE.Mesh(hullGeometry, hull);
    const bumper = new THREE.Mesh(bumperGeometry, trim);
    bumper.rotation.x = Math.PI / 2;
    bumper.position.y = 0.03;
    const dome = new THREE.Mesh(domeGeometry, glass);
    dome.position.y = 0.17;
    dome.scale.y = 0.9;
    const pod = new THREE.Mesh(podGeometry, trim);
    pod.position.y = -0.2;
    pod.scale.y = 0.55;
    const antenna = new THREE.Mesh(antennaGeometry, hull);
    antenna.position.y = 0.62;
    const tip = new THREE.Mesh(
      tipGeometry,
      new THREE.MeshBasicMaterial({ color: 0x9dff6f, toneMapped: false }),
    );
    this.owned.push(tip.material);
    tip.position.y = 0.75;
    this.body.add(hullMesh, bumper, dome, pod, antenna, tip);

    // Running lights ride the bumper and chase around it.
    this.lightMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      toneMapped: false,
    });
    const lightGeometry = new THREE.SphereGeometry(0.055, 8, 6);
    this.owned.push(this.lightMaterial, lightGeometry);
    this.lights = new THREE.InstancedMesh(
      lightGeometry,
      this.lightMaterial,
      12,
    );
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      dummy.position.set(Math.cos(angle) * 1.03, 0.04, Math.sin(angle) * 1.03);
      dummy.updateMatrix();
      this.lights.setMatrixAt(i, dummy.matrix);
      this.lights.setColorAt(i, new THREE.Color(0xffe27a));
    }
    this.body.add(this.lights);
    this.root.add(this.body);

    // A soft tractor beam: additive, open-ended, fading toward the world.
    const beamGeometry = new THREE.CylinderGeometry(0.22, 1, 1, 32, 1, true);
    beamGeometry.translate(0, -0.5, 0);
    const beamMaterial = new THREE.ShaderMaterial({
      uniforms: {
        level: { value: 0 },
        time: { value: 0 },
        tint: { value: new THREE.Color(0x9fefff) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `varying vec2 vUv; uniform float level; uniform float time; uniform vec3 tint;
        void main(){ float along=vUv.y; float rings=.72+.28*sin(along*28.+time*5.); float fade=smoothstep(0.,.35,along)*(1.-smoothstep(.93,1.,along));
          gl_FragColor=vec4(tint*rings, fade*level*.34); }`,
    });
    this.owned.push(beamGeometry, beamMaterial);
    this.beam = new THREE.Mesh(beamGeometry, beamMaterial);
    this.beam.position.y = -0.16;
    this.beam.renderOrder = 4;
    this.beam.visible = false;
    this.root.add(this.beam);
  }

  /**
   * Image-based reflections for the lacquer's gloss. Kept low: a studio room
   * lights every side evenly, which made the saucer glow apart from the
   * star-lit worlds.
   */
  setEnvironment(texture: THREE.Texture) {
    for (const material of this.finishes) {
      material.envMap = texture;
      material.envMapIntensity = material.transparent ? 0.45 : 0.28;
      material.needsUpdate = true;
    }
  }

  /** Place without flying, e.g. on arrival or with reduced motion. */
  place(position: THREE.Vector3) {
    this.root.position.copy(position);
    this.velocity.set(0, 0, 0);
    this.placed = true;
  }

  /**
   * @param target world-space point to hover at
   * @param beamDepth distance the beam should reach below, or 0 for none
   * @param size rendered hull radius in local units
   */
  update(
    dt: number,
    target: THREE.Vector3,
    beamDepth: number,
    size: number,
    reduceMotion: boolean,
    animate: boolean,
  ) {
    if (!this.placed) this.place(target);
    this.size = size;
    this.root.scale.setScalar(size);
    if (animate) this.time += dt;
    this.goal.copy(target);
    if (!reduceMotion && animate)
      this.goal.y += Math.sin(this.time * 1.9) * size * 0.14;
    if (reduceMotion) {
      this.root.position.copy(this.goal);
      this.velocity.set(0, 0, 0);
    } else {
      // A slightly underdamped spring: eager departure, a small settle.
      const stiffness = 16,
        damping = 6.2;
      this.scratch
        .subVectors(this.goal, this.root.position)
        .multiplyScalar(stiffness)
        .addScaledVector(this.velocity, -damping);
      this.velocity.addScaledVector(this.scratch, dt);
      this.root.position.addScaledVector(this.velocity, dt);
    }
    // Bank into the direction of travel, relative to its own size.
    const lean = reduceMotion ? 0 : 0.045 / Math.max(0.001, size);
    this.body.rotation.z = THREE.MathUtils.clamp(
      -this.velocity.x * lean,
      -0.5,
      0.5,
    );
    this.body.rotation.x = THREE.MathUtils.clamp(
      this.velocity.z * lean,
      -0.5,
      0.5,
    );
    if (animate && !reduceMotion) this.body.rotation.y += dt * 0.9;

    const want = beamDepth > 0 ? 1 : 0;
    this.beamLevel +=
      (want - this.beamLevel) * (reduceMotion ? 1 : 1 - Math.exp(-dt * 7));
    this.beam.visible = this.beamLevel > 0.02;
    if (this.beam.visible) {
      this.beam.scale.set(
        1,
        Math.max(0.2, beamDepth / Math.max(0.001, size)),
        1,
      );
      this.beam.material.uniforms.level.value = this.beamLevel;
      this.beam.material.uniforms.time.value = this.time;
    }
    // The chase steps nine times a second; upload colors only when it does.
    const chase = Math.floor(this.time * 9) % 12;
    if (chase === this.chase) return;
    this.chase = chase;
    for (let i = 0; i < 12; i++) {
      this.lightColor.set(
        (i + chase) % 12 < 2 ? 0xfff6c8 : i % 2 ? 0xffc35a : 0x7ff0ff,
      );
      this.lights.setColorAt(i, this.lightColor);
    }
    if (this.lights.instanceColor) this.lights.instanceColor.needsUpdate = true;
  }

  dispose() {
    this.lights.dispose();
    this.owned.forEach((item) => item.dispose());
    this.root.removeFromParent();
  }
}
