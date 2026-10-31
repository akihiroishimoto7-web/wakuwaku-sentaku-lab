import * as THREE from 'three'
import { weaveTexture } from './textures'

// 布の見た目と変形を1つのシェーダーで表現する。
// ・形（シャツ/くつした…）は細分化した平面を SDF で切り抜く
// ・変形は頂点シェーダーで曲げ・はためき・しわを足す（軽量な近似）
// ・汚れ／濡れ／仕上がりの輝きはユニフォームで制御

export interface ClothUniforms {
  uTime: { value: number }
  uBend: { value: number }
  uFold: { value: number }
  uFlutter: { value: number }
  uSeed: { value: number }
  uShape: { value: number }
  uMud: { value: number }
  uOil: { value: number }
  uWet: { value: number }
  uGlow: { value: number }
  uDeform: { value: number }
  uSize: { value: THREE.Vector2 }
}

const VERT_HEAD = /* glsl */ `
uniform float uTime, uBend, uFold, uFlutter, uSeed, uDeform;
varying vec2 vMyUv;
float dispZ(vec2 p){
  float b = uBend * p.x * p.x + uFold * p.y * p.y;
  float f = uFlutter * (sin(p.x * 28.0 + uTime * 7.0 + uSeed) + sin(p.y * 23.0 - uTime * 5.3 + uSeed * 1.7)) * 0.008;
  float w = 0.004 * sin(p.x * 46.0 + uSeed) * sin(p.y * 39.0 + uSeed * 2.0);
  return b + f + w;
}
`

const FRAG_HEAD = /* glsl */ `
uniform float uShape, uMud, uOil, uWet, uSeed, uGlow;
uniform vec2 uSize;
varying vec2 vMyUv;
float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hsh(i), hsh(i + vec2(1.0, 0.0)), f.x), mix(hsh(i + vec2(0.0, 1.0)), hsh(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p){ return vnoise(p) * 0.6 + vnoise(p * 2.1) * 0.3 + vnoise(p * 4.3) * 0.1; }
float sdRB(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
mat2 rot2(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float clothSDF(vec2 p){
  if (uShape < 0.5) {
    float body = sdRB(p - vec2(0.0, -0.02), vec2(0.062, 0.08), 0.012);
    float sl = sdRB(rot2(-0.55) * (p - vec2(0.072, 0.038)), vec2(0.04, 0.024), 0.01);
    float sr = sdRB(rot2(0.55) * (p - vec2(-0.072, 0.038)), vec2(0.04, 0.024), 0.01);
    float d = min(body, min(sl, sr));
    return max(d, -(length(p - vec2(0.0, 0.07)) - 0.026));
  } else if (uShape < 1.5) {
    float leg = sdRB(p - vec2(-0.012, 0.02), vec2(0.022, 0.042), 0.012);
    float foot = sdRB(p - vec2(0.006, -0.036), vec2(0.033, 0.02), 0.018);
    return min(leg, foot);
  } else if (uShape < 2.5) {
    return sdRB(p, vec2(0.105, 0.07), 0.014);
  } else if (uShape < 3.5) {
    float waist = sdRB(p - vec2(0.0, 0.085), vec2(0.068, 0.022), 0.006);
    float l1 = sdRB(rot2(0.06) * (p - vec2(0.036, -0.02)), vec2(0.031, 0.088), 0.01);
    float l2 = sdRB(rot2(-0.06) * (p - vec2(-0.036, -0.02)), vec2(0.031, 0.088), 0.01);
    return min(waist, min(l1, l2));
  } else if (uShape < 4.5) {
    return -1.0;
  }
  return sdRB(p, vec2(0.075, 0.075), 0.01);
}
`

export function makeClothMaterial(color: string, shape: number, seed: number, size: [number, number]) {
  const uniforms: ClothUniforms = {
    uTime: { value: 0 },
    uBend: { value: 0 },
    uFold: { value: 0 },
    uFlutter: { value: 0 },
    uSeed: { value: seed },
    uShape: { value: shape },
    uMud: { value: 1 },
    uOil: { value: 1 },
    uWet: { value: 0 },
    uGlow: { value: 0 },
    uDeform: { value: shape === 4 ? 0 : 1 },
    uSize: { value: new THREE.Vector2(size[0], size[1]) },
  }
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: shape === 4 ? 1 : 0.88,
    side: THREE.DoubleSide,
    map: weaveTexture(),
  })
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms)
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_HEAD)
      .replace(
        '#include <beginnormal_vertex>',
        `vec2 pp = position.xy;
        float dz0 = dispZ(pp);
        float ddx = (dispZ(pp + vec2(0.002, 0.0)) - dz0) / 0.002;
        float ddy = (dispZ(pp + vec2(0.0, 0.002)) - dz0) / 0.002;
        vec3 objectNormal = normalize(mix(normal, normalize(vec3(-ddx, -ddy, 1.0)), uDeform));
        #ifdef USE_TANGENT
        vec3 objectTangent = vec3(tangent.xyz);
        #endif`,
      )
      .replace('#include <begin_vertex>', 'vec3 transformed = vec3(position);\ntransformed.z += dz0 * uDeform;\nvMyUv = uv;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAG_HEAD)
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
        vec2 cp = (vMyUv - 0.5) * uSize;
        float sd = clothSDF(cp);
        if (sd > 0.0) discard;`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        if (uShape > 1.5 && uShape < 2.5) { float sx = abs(cp.x); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), step(0.074, sx) * step(sx, 0.086)); }
        if (uShape > 0.5 && uShape < 1.5) { diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), step(0.04, cp.y) * step(cp.y, 0.05)); }
        if (uShape < 0.5) { diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.95, 0.6), (1.0 - smoothstep(0.012, 0.016, length(cp - vec2(0.0, -0.01))))); }
        if (uShape > 2.5 && uShape < 3.5) { diffuseColor.rgb *= 1.0 - 0.18 * step(0.064, cp.y); }
        float mudN = fbm(cp * 55.0 + uSeed * 7.0);
        float mud = smoothstep(0.56, 0.66, mudN) * clamp(uMud * 1.15, 0.0, 1.0);
        float oilN = fbm(cp * 32.0 + uSeed * 3.0 + 17.0);
        float oil = smoothstep(0.58, 0.68, oilN) * clamp(uOil * 1.15, 0.0, 1.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.38, 0.26, 0.15), mud * 0.88);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.8, 0.64, 0.18), oil * 0.62);
        diffuseColor.rgb *= 1.0 - 0.32 * uWet;
        diffuseColor.rgb *= 0.84 + 0.16 * (1.0 - smoothstep(-0.008, -0.002, sd));`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.4, uWet * 0.7);
        roughnessFactor = mix(roughnessFactor, 0.3, oil * 0.5);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += diffuseColor.rgb * uGlow;`,
      )
  }
  return { mat, uniforms }
}
