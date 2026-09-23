import * as THREE from 'three';

const pointsVertexShader = /* glsl */ `
  uniform float uPixelRatio;
  uniform float uPointScale;
  uniform float uOpacity;
  attribute float aSize;
  attribute float aAlpha;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vColor = color;
    vAlpha = aAlpha * uOpacity;
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    float perspective = clamp(24.0 / max(1.0, -viewPosition.z), 0.32, 2.5);
    gl_PointSize = max(1.0, aSize * uPointScale * uPixelRatio * perspective);
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const pointsFragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float distanceToCenter = length(gl_PointCoord - vec2(0.5)) * 2.0;
    if (distanceToCenter > 1.0) discard;
    float haze = 1.0 - smoothstep(0.06, 1.0, distanceToCenter);
    float spark = 1.0 - smoothstep(0.0, 0.22, distanceToCenter);
    float alpha = (haze * haze * 0.8 + spark * 0.48) * vAlpha;
    gl_FragColor = vec4(vColor * (0.82 + spark * 1.35), alpha);
  }
`;

/** Soft additive points whose size follows perspective, for every star field. */
export function createPointsMaterial(
  pixelRatio: number,
  opacity = 1,
  pointScale = 1,
) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uPixelRatio: { value: pixelRatio },
      uPointScale: { value: pointScale },
      uOpacity: { value: opacity },
    },
    vertexShader: pointsVertexShader,
    fragmentShader: pointsFragmentShader,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
  });
}
