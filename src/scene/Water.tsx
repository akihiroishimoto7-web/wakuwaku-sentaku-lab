import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { DRUM_R, TUB_C, TUB_LEN, TUB_R } from '../data'
import { sim } from '../sim'
import { useStore } from '../store'
import { flowTexture } from '../textures'

// すべて外槽ローカル座標（TubAssembly の子）
export const surfaceY = () => -TUB_R + sim.level * 2 * TUB_R

const CLEAN = new THREE.Color('#5cc6ff')
const SOAPY = new THREE.Color('#a9dcff')
const DIRTY = new THREE.Color('#9a7f50')

const surfVert = /* glsl */ `
uniform float uTime, uAmp, uSlosh;
varying vec3 vW;
varying vec2 vUv2;
void main(){
  vec3 p = position;
  float h = sin(p.x * 22.0 + uTime * 3.1) * 0.004 * uAmp + sin(p.y * 17.0 - uTime * 2.3) * 0.003 * uAmp + p.x * uSlosh;
  p.z += h;
  vUv2 = uv;
  vec4 w = modelMatrix * vec4(p, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`
const surfFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uFoam, uTime;
varying vec3 vW;
varying vec2 vUv2;
float h2(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float n2(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h2(i), h2(i+vec2(1,0)), f.x), mix(h2(i+vec2(0,1)), h2(i+vec2(1,1)), f.x), f.y); }
void main(){
  vec3 v = normalize(cameraPosition - vW);
  float fr = pow(1.0 - abs(v.y), 3.0);
  float caust = n2(vUv2 * vec2(18.0, 12.0) + uTime * 0.6) * n2(vUv2 * vec2(11.0, 15.0) - uTime * 0.4);
  vec3 col = uColor * (0.85 + 0.5 * caust) + fr * 0.35;
  float foam = smoothstep(0.45, 0.75, n2(vUv2 * vec2(26.0, 20.0) + vec2(uTime * 0.3, 0.0))) * uFoam;
  col = mix(col, vec3(1.0), foam * 0.85);
  gl_FragColor = vec4(col, 0.55 + 0.3 * fr + foam * 0.3);
  #include <colorspace_fragment>
}`

export function WaterBody() {
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), 0), [])
  const bodyMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: CLEAN,
        transparent: true,
        opacity: 0.42,
        roughness: 0.1,
        depthWrite: false,
        side: THREE.DoubleSide,
        clippingPlanes: [plane],
      }),
    [plane],
  )
  const surfMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uAmp: { value: 1 }, uSlosh: { value: 0 }, uColor: { value: CLEAN.clone() }, uFoam: { value: 0 } },
        vertexShader: surfVert,
        fragmentShader: surfFrag,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [],
  )
  useEffect(
    () => () => {
      bodyMat.dispose()
      surfMat.dispose()
    },
    [bodyMat, surfMat],
  )
  const body = useRef<THREE.Mesh>(null)
  const surf = useRef<THREE.Mesh>(null)
  const col = useMemo(() => new THREE.Color(), [])

  useFrame(() => {
    const y = surfaceY()
    const vis = sim.level > 0.004
    if (body.current) body.current.visible = vis
    if (surf.current) surf.current.visible = vis
    if (!vis) return
    plane.constant = TUB_C.y + sim.vib.y + y
    col.copy(CLEAN).lerp(SOAPY, Math.min(1, sim.detInWater) * 0.6).lerp(DIRTY, Math.min(0.85, sim.waterDirt * 0.85))
    bodyMat.color.copy(col)
    const u = surfMat.uniforms
    u.uTime.value = sim.time
    u.uColor.value.copy(col)
    u.uFoam.value = sim.foam
    u.uAmp.value = 0.6 + Math.abs(sim.omega) * 0.4 + sim.inlet * 1.5
    u.uSlosh.value += (-sim.omega * 0.012 - u.uSlosh.value) * Math.min(1, sim.dt * 2)
    if (surf.current) {
      const chord = 2 * Math.sqrt(Math.max(0, TUB_R * TUB_R - y * y)) - 0.01
      surf.current.position.y = y
      surf.current.scale.set(Math.max(0.001, chord), TUB_LEN - 0.01, 1)
    }
  })
  return (
    <group>
      <mesh ref={body} material={bodyMat} rotation-x={Math.PI / 2} renderOrder={1}>
        <cylinderGeometry args={[TUB_R - 0.006, TUB_R - 0.006, TUB_LEN - 0.01, 48, 1, false]} />
      </mesh>
      <mesh ref={surf} material={surfMat} rotation-x={-Math.PI / 2} renderOrder={2}>
        <planeGeometry args={[1, 1, 32, 16]} />
      </mesh>
    </group>
  )
}

// ---- 泡 ----
export function Foam() {
  const N = 120
  const quality = useStore((s) => s.quality)
  const mesh = useRef<THREE.InstancedMesh>(null)
  const geo = useMemo(() => new THREE.SphereGeometry(1, 10, 8), [])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.15, transparent: true, opacity: 0.88 }), [])
  useEffect(
    () => () => {
      geo.dispose()
      mat.dispose()
    },
    [geo, mat],
  )
  const seeds = useMemo(() => Array.from({ length: N }, () => ({ u: Math.random() * 2 - 1, z: Math.random() * 2 - 1, r: 0.006 + Math.random() * 0.016, ph: Math.random() * 6 })), [])
  const m4 = useMemo(() => new THREE.Matrix4(), [])
  const drift = useRef(0)
  useFrame(() => {
    const m = mesh.current
    if (!m) return
    const max = quality === 'high' ? N : N / 2
    const count = Math.round(Math.min(1, sim.foam) * max)
    m.count = count
    m.visible = count > 0 && sim.level > 0.01
    if (!m.visible) return
    drift.current += sim.omega * sim.dt * 0.04
    const y = surfaceY()
    const half = Math.sqrt(Math.max(0, TUB_R * TUB_R - y * y)) - 0.02
    for (let i = 0; i < count; i++) {
      const s = seeds[i]
      let u = s.u + drift.current
      u = ((((u + 1) % 2) + 2) % 2) - 1
      const bob = Math.sin(sim.time * 2 + s.ph) * 0.003
      const r = s.r * (0.6 + 0.4 * Math.min(1, sim.foam * 1.5))
      m4.makeScale(r, r * 0.8, r).setPosition(u * half, y + r * 0.4 + bob, s.z * (TUB_LEN / 2 - 0.02))
      m.setMatrixAt(i, m4)
    }
    m.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={mesh} args={[geo, mat, N]} frustumCulled={false} />
}

// ---- 脱水の水滴：ドラムの穴から外へ ----
export function Drops() {
  const N = 110
  const mesh = useRef<THREE.InstancedMesh>(null)
  const geo = useMemo(() => new THREE.SphereGeometry(0.004, 6, 4), [])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#7fd4ff', roughness: 0.05, emissive: '#2a9fff', emissiveIntensity: 0.35 }), [])
  useEffect(
    () => () => {
      geo.dispose()
      mat.dispose()
    },
    [geo, mat],
  )
  const ps = useMemo(
    () => Array.from({ length: N }, () => ({ alive: false, life: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), wall: false })),
    [],
  )
  const acc = useRef(0)
  const m4 = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const s = useMemo(() => new THREE.Vector3(), [])
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const dir = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    const m = mesh.current
    if (!m) return
    const dt = sim.dt
    acc.current += sim.spinWater * 260 * dt
    let any = false
    for (const d of ps) {
      if (!d.alive && acc.current >= 1) {
        acc.current -= 1
        const a = Math.random() * Math.PI * 2
        const r = DRUM_R
        d.p.set(Math.cos(a) * r, Math.sin(a) * r, (Math.random() - 0.5) * 0.34)
        const vt = sim.omega * r * 0.12
        d.v.set(-Math.sin(a) * vt + Math.cos(a) * 0.5, Math.cos(a) * vt + Math.sin(a) * 0.5, 0)
        d.alive = true
        d.wall = false
        d.life = 0
      }
      if (!d.alive) continue
      any = true
      d.life += dt
      if (!d.wall) {
        d.p.addScaledVector(d.v, dt)
        const rr = Math.hypot(d.p.x, d.p.y)
        if (rr > TUB_R - 0.008) {
          d.p.multiplyScalar((TUB_R - 0.008) / rr)
          d.wall = true
          d.v.set(0, -0.3, 0)
        }
      } else {
        // 外槽の内壁をつたって下へ
        d.v.y -= 2.5 * dt
        d.p.addScaledVector(d.v, dt)
        const rr = Math.hypot(d.p.x, d.p.y)
        d.p.x *= (TUB_R - 0.008) / rr
        d.p.y *= (TUB_R - 0.008) / rr
      }
      if (d.life > 1.4 || (d.wall && d.p.y < -TUB_R + 0.03)) d.alive = false
    }
    m.visible = any
    let i = 0
    for (const d of ps) {
      if (!d.alive) {
        m4.makeScale(0, 0, 0)
      } else {
        dir.copy(d.v).normalize()
        q.setFromUnitVectors(up, dir.lengthSq() > 0 ? dir : up)
        s.set(1, 1 + Math.min(3, d.v.length() * 1.5), 1)
        m4.compose(d.p, q, s)
      }
      m.setMatrixAt(i++, m4)
    }
    m.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={mesh} args={[geo, mat, N]} frustumCulled={false} />
}

// ---- 給水の水流 ----
const INLET = new THREE.Vector3(-0.11, 0.235, 0.16)
export function InletStream() {
  const mesh = useRef<THREE.Mesh>(null)
  const ripple = useRef<THREE.Mesh>(null)
  const tex = useMemo(() => {
    const t = flowTexture().clone()
    t.rotation = Math.PI / 2
    t.repeat.set(4, 1)
    t.needsUpdate = true
    return t
  }, [])
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#9fdcff', map: tex, transparent: true, opacity: 0.8, roughness: 0.05, depthWrite: false, emissive: '#3aa8ff', emissiveIntensity: 0.25 }),
    [tex],
  )
  const rmat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }), [])
  useEffect(
    () => () => {
      tex.dispose()
      mat.dispose()
      rmat.dispose()
    },
    [tex, mat, rmat],
  )
  useFrame(() => {
    const on = sim.inlet > 0.05
    const bottom = Math.max(surfaceY(), -DRUM_R + 0.02)
    if (mesh.current) {
      mesh.current.visible = on
      const h = INLET.y - bottom
      mesh.current.scale.set(sim.inlet, h, sim.inlet)
      mesh.current.position.set(INLET.x, bottom + h / 2, INLET.z)
      tex.offset.y -= sim.dt * 3
    }
    if (ripple.current) {
      ripple.current.visible = on
      const k = (sim.time * 2) % 1
      ripple.current.position.set(INLET.x, bottom + 0.004, INLET.z)
      ripple.current.scale.setScalar(0.3 + k * 1.4)
      rmat.opacity = (1 - k) * 0.7
    }
  })
  return (
    <group>
      <mesh ref={mesh} material={mat}>
        <cylinderGeometry args={[0.009, 0.012, 1, 10, 1, true]} />
      </mesh>
      <mesh ref={ripple} material={rmat} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.02, 0.026, 24]} />
      </mesh>
    </group>
  )
}

// ---- 乾燥の湯気 ----
export function Steam() {
  const N = 40
  const mesh = useRef<THREE.InstancedMesh>(null)
  const geo = useMemo(() => new THREE.SphereGeometry(0.02, 8, 6), [])
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.22, depthWrite: false }), [])
  useEffect(
    () => () => {
      geo.dispose()
      mat.dispose()
    },
    [geo, mat],
  )
  const ps = useMemo(() => Array.from({ length: N }, () => ({ life: -Math.random() * 2, p: new THREE.Vector3() })), [])
  const m4 = useMemo(() => new THREE.Matrix4(), [])
  useFrame(() => {
    const m = mesh.current
    if (!m) return
    const k = sim.heat * Math.min(1, sim.wet * 3)
    m.visible = k > 0.02
    if (!m.visible) return
    ps.forEach((s, i) => {
      s.life += sim.dt * 0.7
      if (s.life > 1) {
        s.life = 0
        const a = Math.random() * Math.PI * 2
        const r = Math.random() * 0.15
        s.p.set(Math.cos(a) * r, -0.1 + Math.random() * 0.08, (Math.random() - 0.5) * 0.25)
      }
      const l = Math.max(0, s.life)
      const sc = k * Math.sin(l * Math.PI) * (0.6 + l)
      m4.makeScale(sc, sc, sc).setPosition(s.p.x + Math.sin(l * 5 + i) * 0.02, s.p.y + l * 0.25, s.p.z)
      m.setMatrixAt(i, m4)
    })
    m.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={mesh} args={[geo, mat, N]} frustumCulled={false} />
}
