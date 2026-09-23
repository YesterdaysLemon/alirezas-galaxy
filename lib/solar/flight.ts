import * as THREE from 'three';
import type { SolarSystem } from '../../data/solar-systems';
import {
  ENTRY_SECONDS,
  GALAXY_UNIT,
  LEAVE_SECONDS,
  SWITCH_SECONDS,
  orbitDirection,
  smootherstep,
} from './math';
import { noise3 } from './shaders';

type SavedView = {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  near: number;
  far: number;
  visibility: [THREE.Object3D, boolean][];
};

/** The haze of the spiral arm the camera flies through on its way in. */
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
      ${noise3}
      void main(){vec3 ray=normalize(p-eye); float b=dot(eye,ray); float d=b*b-dot(eye,eye)+1.; if(d<0.)discard;
        float start=max(0.,-b-sqrt(d)); float end=-b+sqrt(d); float density=0.;
        for(int i=0;i<6;i++){vec3 q=eye+ray*mix(start,end,(float(i)+.5)/6.); float n=noise(q*5.+vec3(time*.035,0.,0.)); density+=smoothstep(.28,.78,n)*(1.-smoothstep(.55,1.,length(q)));}
        float a=(1.-exp(-density*(end-start)*.75))*opacity;
        vec3 color=mix(tint*1.6,vec3(.62,.4,.62),smoothstep(-.4,.6,p.y))*(.7+density*.25);
        gl_FragColor=vec4(color,a); }`,
    }),
  );
}

/**
 * The flight between the galaxy and a system, in one renderer. The camera
 * dives in log-distance about the destination star, so every second covers
 * the same ratio of distance and the dive reads as one continuous zoom. At
 * arrival the scene changes units without changing the projection; the
 * galaxy's own camera and visibility are preserved for the return.
 */
export class SolarFlight {
  /** 0 = galaxy decorations as usual; 1 = markers and core glare hidden for the dive. */
  veil = 0;
  /** 0..1: the galaxy's own stars thin out just before the unit handoff. */
  fade = 0;
  /** True once the camera works in local system units. */
  handedOff = false;
  /** Seconds into the current flight; the owner advances it each frame. */
  time = 0;
  /** Seconds since the unit handoff, while the arm's haze clears. */
  private arrival = 0;
  private duration = ENTRY_SECONDS;
  /** A hop between systems pulls back into the galaxy mid-flight. */
  private switching = false;
  readonly dust = flightDust();
  /** Lights the worlds' stand-ins until the system's own lights are adopted. */
  readonly ambient = new THREE.HemisphereLight(0x899bc5, 0x171122, 0.62);
  readonly starlight = new THREE.PointLight(0xffdfac, 3.8, 0, 0);
  /** The destination star, in galaxy units. */
  readonly origin = new THREE.Vector3();
  readonly galaxyCenter = new THREE.Vector3();
  private saved: SavedView | null = null;
  private readonly startQuaternion = new THREE.Quaternion();
  private readonly lookQuaternion = new THREE.Quaternion();
  private readonly fromDirection = new THREE.Vector3();
  private fromDistance = 1;
  private readonly direction = new THREE.Vector3();
  private readonly toward = new THREE.Vector3();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    /** The local system's root, scaled into galaxy units until the handoff. */
    private readonly group: THREE.Group,
  ) {
    this.dust.renderOrder = 5;
    group.add(this.dust, this.ambient, this.starlight);
  }

  /** The galaxy camera position preserved for the return flight. */
  get savedPosition() {
    return this.saved?.position ?? null;
  }

  /** Remember the galaxy view, and each light's state, for the return. */
  saveGalaxy() {
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
  }

  /** The galaxy around the flight path, lit by the system rather than itself. */
  showGalaxySurroundings() {
    this.saved?.visibility.forEach(([child, visible]) => {
      child.visible = child instanceof THREE.Light ? false : visible;
    });
  }

  /** Begin a flight from wherever the camera is now. */
  private depart() {
    this.startQuaternion.copy(this.camera.quaternion);
    this.fromDirection.subVectors(this.camera.position, this.origin);
    this.fromDistance = Math.max(1e-4, this.fromDirection.length());
    this.fromDirection.divideScalar(this.fromDistance);
    this.time = 0;
  }

  /**
   * Set out for a system whose star is at `origin`. `switching` hops from
   * another system rather than diving from the galaxy view.
   */
  enter(
    system: SolarSystem,
    origin: THREE.Vector3,
    galaxyCenter: THREE.Vector3 | undefined,
    switching: boolean,
    arrivalDistance: number,
  ) {
    this.origin.copy(origin);
    if (galaxyCenter) this.galaxyCenter.copy(galaxyCenter);
    this.switching = switching;
    this.duration = switching ? SWITCH_SECONDS : ENTRY_SECONDS;
    this.handedOff = false;
    this.arrival = 0;
    this.depart();
    this.group.position.copy(origin);
    this.group.scale.setScalar(GALAXY_UNIT);
    this.group.visible = true;
    this.ambient.visible = this.starlight.visible = true;
    this.starlight.color.set(system.star.color);
    this.dust.visible = true;
    this.dust.scale.setScalar(system.extent * 2.4);
    this.dust.material.uniforms.opacity.value = 0;
    this.dust.material.uniforms.tint.value.set(system.nebula[0]);
    this.camera.near = Math.min(
      this.saved?.near ?? 0.1,
      arrivalDistance * GALAXY_UNIT * 0.02,
    );
    this.camera.updateProjectionMatrix();
    this.saved?.visibility.forEach(([object]) => {
      if (object instanceof THREE.Light) object.visible = false;
    });
  }

  /** The system's own lights have taken over. */
  adoptSystemLights() {
    this.ambient.visible = this.starlight.visible = false;
  }

  /** Head back to the preserved galaxy view. */
  leave() {
    this.depart();
    this.dust.visible = true;
  }

  /**
   * One frame of the dive toward the overview pose `goal`, in galaxy units.
   * @returns progress, 0..1
   */
  dive(goal: { yaw: number; pitch: number; distance: number }) {
    const progress = Math.min(1, this.time / this.duration);
    const eased = smootherstep(progress);
    orbitDirection(goal.yaw, goal.pitch, this.toward);
    this.direction
      .copy(this.fromDirection)
      .lerp(this.toward, smootherstep(Math.min(1, eased * 1.15)))
      .normalize();
    this.camera.position
      .copy(this.direction)
      .multiplyScalar(this.logDistance(goal.distance * GALAXY_UNIT, eased))
      .add(this.origin);
    // A system switch pulls back into the galaxy mid-hop before diving again.
    if (this.switching)
      this.camera.position
        .sub(this.origin)
        .multiplyScalar(1 + Math.sin(eased * Math.PI) * 5)
        .add(this.origin);
    this.skirtCore(eased);
    this.camera.lookAt(this.origin);
    this.lookQuaternion.copy(this.camera.quaternion);
    const turn = Math.min(1, progress / 0.45);
    this.camera.quaternion.slerpQuaternions(
      this.startQuaternion,
      this.lookQuaternion,
      turn * turn * (3 - 2 * turn),
    );
    this.veil = THREE.MathUtils.smoothstep(progress, 0, 0.4);
    this.fade = THREE.MathUtils.smoothstep(progress, 0.72, 0.99);
    // Dust gathers only in the last stretch, as the camera enters the arm.
    this.dust.material.uniforms.opacity.value =
      0.55 * THREE.MathUtils.smoothstep(progress, 0.55, 0.97);
    return progress;
  }

  /**
   * After the handoff the arm's haze clears as the local sky appears.
   * @returns how clear the view is, 0..1
   */
  clearHaze(elapsed: number) {
    this.arrival += elapsed;
    const clear = Math.min(1, this.arrival / 0.9);
    this.dust.material.uniforms.opacity.value =
      0.55 * (1 - smootherstep(clear));
    return clear;
  }

  /**
   * One frame of the return, retracing the log-distance dive.
   * @returns progress, 0..1
   */
  retrace(reduceMotion: boolean) {
    const progress = reduceMotion ? 1 : Math.min(1, this.time / LEAVE_SECONDS);
    const eased = smootherstep(progress);
    if (this.saved) {
      this.toward.subVectors(this.saved.position, this.origin);
      const outDistance = Math.max(1e-6, this.toward.length());
      this.toward.divideScalar(outDistance);
      this.direction
        .copy(this.fromDirection)
        .lerp(this.toward, eased)
        .normalize();
      this.camera.position
        .copy(this.direction)
        .multiplyScalar(this.logDistance(outDistance, eased))
        .add(this.origin);
      this.skirtCore(eased);
      this.camera.quaternion.slerpQuaternions(
        this.startQuaternion,
        this.saved.quaternion,
        eased,
      );
    }
    this.veil = 1 - THREE.MathUtils.smoothstep(progress, 0.35, 0.9);
    this.fade = 1 - THREE.MathUtils.smoothstep(progress, 0.02, 0.3);
    this.dust.material.uniforms.opacity.value =
      (1 - THREE.MathUtils.smoothstep(progress, 0.05, 0.45)) * 0.7;
    return progress;
  }

  private logDistance(to: number, eased: number) {
    return Math.exp(
      THREE.MathUtils.lerp(Math.log(this.fromDistance), Math.log(to), eased),
    );
  }

  /**
   * Flights between a far-side star and the galaxy view would pass straight
   * through the blazing core. Bend the path around it; the weight vanishes at
   * both ends, so departure and arrival poses are exact.
   */
  private skirtCore(eased: number) {
    const keep = 10;
    this.direction.subVectors(this.camera.position, this.galaxyCenter);
    const distance = this.direction.length();
    if (distance >= keep) return;
    if (distance < 1e-4) this.direction.set(0, 1, 0);
    else this.direction.divideScalar(distance);
    const clear = keep * (0.8 + 0.2 * (distance / keep) ** 2);
    const reach =
      distance + (clear - distance) * Math.sin(Math.PI * Math.min(1, eased));
    this.camera.position
      .copy(this.direction)
      .multiplyScalar(reach)
      .add(this.galaxyCenter);
  }

  /** The exact change of units at arrival: the projection does not move. */
  toLocalUnits(target: THREE.Vector3, extent: number) {
    this.camera.position.sub(this.origin).divideScalar(GALAXY_UNIT);
    target.sub(this.origin).divideScalar(GALAXY_UNIT);
    this.camera.near /= GALAXY_UNIT;
    this.camera.far = Math.max(this.camera.far / GALAXY_UNIT, extent * 20);
    this.camera.updateProjectionMatrix();
    this.group.position.set(0, 0, 0);
    this.group.scale.setScalar(1);
    this.saved?.visibility.forEach(([child]) => {
      child.visible = false;
    });
    this.handedOff = true;
  }

  toGalaxyUnits(target: THREE.Vector3) {
    this.camera.position.multiplyScalar(GALAXY_UNIT).add(this.origin);
    target.multiplyScalar(GALAXY_UNIT).add(this.origin);
    this.group.position.copy(this.origin);
    this.group.scale.setScalar(GALAXY_UNIT);
    this.camera.near *= GALAXY_UNIT;
    this.camera.far = this.saved?.far ?? 100;
    this.camera.updateProjectionMatrix();
    this.handedOff = false;
  }

  /** Put the galaxy view back exactly as it was left. */
  restoreGalaxy() {
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
    this.handedOff = false;
    this.veil = this.fade = 0;
  }

  /** Keep the haze's ray march in its own space as the camera moves. */
  updateDust() {
    if (!this.dust.visible) return;
    const uniforms = this.dust.material.uniforms;
    this.dust.updateWorldMatrix(true, false);
    this.dust.worldToLocal(uniforms.eye.value.copy(this.camera.position));
    uniforms.time.value = this.time;
  }

  dispose() {
    this.dust.geometry.dispose();
    this.dust.material.dispose();
  }
}
