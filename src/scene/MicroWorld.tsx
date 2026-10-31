import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { CLOTH_MAP } from '../data'
import { micro, microEnd, microSteps } from '../microState'
import { useStore } from '../store'

// 繊維の世界（科学的な模式図。実際の分子スケールや形を忠実に再現したものではありません）

const ss = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

const X_YARNS = [-3.6, -1.2, 1.2, 3.6].map((z, k) => ({ z, s: k % 2 ? -1 : 1 }))
const Z_YARNS = [-10.5, -3.5, 3.5, 10.5].map((x, j) => ({ x, t: j % 2 ? 1 : -1 }))
const AMP = 0.8
const yX = (s: number, x: number) => s * AMP * Math.sin(0.45 * x)
const yZ = (t: number, z: number) => t * AMP * Math.sin(1.309 * z)
const YARN_R = 0.72

function buildFibers(perYarn: number, tubular: number) {
  const geos: THREE.BufferGeometry[] = []
  const make = (fn: (u: number, out: THREE.Vector3) => void, phase: number, alongX: boolean) => {
    for (let f = 0; f < perYarn; f++) {
      const a0 = (f / perYarn) * Math.PI * 2 + phase
      const pts: THREE.Vector3[] = []
      for (let i = 0; i <= 120; i++) {
        const u = i / 120
        const c = new THREE.Vector3()
        fn(u, c)
        // 撚り（ねじれ）
        const ang = a0 + u * 24 * 0.55
        if (alongX) c.add(new THREE.Vector3(0, Math.cos(ang) * 0.4, Math.sin(ang) * 0.4))
        else c.add(new THREE.Vector3(Math.sin(ang) * 0.4, Math.cos(ang) * 0.4, 0))
        pts.push(c)
      }
      geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), tubular, 0.25 + (f % 2) * 0.03, 7))
    }
  }
  X_YARNS.forEach(({ z, s }, k) =>
    make(
      (u, out) => {
        const x = -12 + u * 24
        out.set(x, yX(s, x), z)
      },
      k,
      true,
    ),
  )
  Z_YARNS.forEach(({ x, t }, j) =>
    make(
      (u, out) => {
        const z = -12 + u * 24
        out.set(x, yZ(t, z), z)
      },
      j + 0.5,
      false,
    ),
  )
  const merged = mergeGeometries(geos, false)!
  geos.forEach((g) => g.dispose())
  return merged
}

interface Blob {
  base: THREE.Vector3
  r: number
  drift: THREE.Vector3
}
const BLOBS: Blob[] = [
  { base: new THREE.Vector3(-1.6, yX(-1, -1.6) + YARN_R + 0.3, -1.2), r: 0.62, drift: new THREE.Vector3(-0.6, 1, 0.3) },
  { base: new THREE.Vector3(1.8, yX(1, 1.8) + YARN_R + 0.28, 1.2), r: 0.56, drift: new THREE.Vector3(0.7, 1, 0.5) },
  { base: new THREE.Vector3(-3.5, yZ(1, 0.2) + YARN_R + 0.25, 0.2), r: 0.5, drift: new THREE.Vector3(-1, 0.8, 0.2) },
  { base: new THREE.Vector3(4.6, yX(-1, 4.6) + YARN_R + 0.3, -1.2), r: 0.6, drift: new THREE.Vector3(1, 0.9, -0.2) },
]
const MUDS = [
  [0.4, -1.2],
  [-0.6, 1.2],
  [3.0, 1.2],
  [-2.6, -1.2],
  [2.4, -3.6],
  [-1.4, 3.6],
  [5.6, 1.2],
  [-4.6, -3.6],
].map(([x, z], i) => {
  const yarn = X_YARNS.find((y) => y.z === z)!
  return {
    base: new THREE.Vector3(x, yX(yarn.s, x) + YARN_R + 0.12, z + (i % 2 ? 0.2 : -0.2)),
    r: 0.18 + (i % 3) * 0.06,
    drift: new THREE.Vector3((i % 2 ? 1 : -1) * 0.8, 1, (i % 3) - 1),
  }
})

const PER_BLOB = 9
const NMOL = BLOBS.length * PER_BLOB
const TAIL_LEN = 1.0

function fib(i: number, n: number) {
  const y = 1 - ((i + 0.5) / n) * 1.6
  const r = Math.sqrt(1 - y * y)
  const a = i * 2.39996
  return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r).normalize()
}

export function MicroWorld() {
  const det = useStore((s) => s.microDetergent)
  const cloth = CLOTH_MAP[useStore((s) => s.microCloth)]
  const quality = useStore((s) => s.quality)
  const scene = useThree((s) => s.scene)
  const showLabels = useStore((s) => s.microStep === 2) && det

  // 背景とフォグ（退出時に元に戻す）
  const fog = useMemo(() => new THREE.FogExp2('#fdf1dc', 0.02), [])
  useEffect(() => {
    const prevBg = scene.background
    const prevFog = scene.fog
    scene.background = new THREE.Color('#fdf1dc')
    scene.fog = fog
    return () => {
      scene.background = prevBg
      scene.fog = prevFog
    }
  }, [scene, fog])

  const fiberGeo = useMemo(() => buildFibers(quality === 'high' ? 6 : 4, quality === 'high' ? 160 : 90), [quality])
  const fiberTex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 16
    c.height = 64
    const ctx = c.getContext('2d')!
    for (let y = 0; y < 64; y++) {
      const v = 210 + Math.sin(y * 0.8) * 25 + Math.random() * 20
      ctx.fillStyle = `rgb(${v},${v},${v})`
      ctx.fillRect(0, y, 16, 1)
    }
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(30, 1)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  const baseColor = useMemo(() => new THREE.Color(cloth.color).lerp(new THREE.Color('#ffffff'), 0.35), [cloth])
  const fiberMat = useMemo(() => new THREE.MeshStandardMaterial({ color: baseColor.clone(), map: fiberTex, roughness: 0.7 }), [baseColor, fiberTex])
  const blobGeos = useMemo(
    () =>
      BLOBS.map((b, i) => {
        const g = new THREE.IcosahedronGeometry(b.r, 4)
        const p = g.attributes.position as THREE.BufferAttribute
        const v = new THREE.Vector3()
        for (let k = 0; k < p.count; k++) {
          v.fromBufferAttribute(p, k)
          const n = 1 + 0.12 * Math.sin(v.x * 5 + i) * Math.sin(v.y * 6) * Math.cos(v.z * 4 + i)
          v.multiplyScalar(n)
          p.setXYZ(k, v.x, v.y * 0.85, v.z)
        }
        g.computeVertexNormals()
        return g
      }),
    [],
  )
  const oilMat = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: '#f0b429', roughness: 0.12, clearcoat: 1, transparent: true, opacity: 0.93, emissive: '#7a4a00', emissiveIntensity: 0.15 }),
    [],
  )
  const mudGeo = useMemo(() => new THREE.DodecahedronGeometry(1, 0), [])
  const mudMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#7a5532', roughness: 1, flatShading: true }), [])
  const headGeo = useMemo(() => new THREE.SphereGeometry(0.22, 16, 12), [])
  const headMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3fb4ff', roughness: 0.25, emissive: '#0a5fff', emissiveIntensity: 0.25 }), [])
  const tailGeo = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 8; i++) pts.push(new THREE.Vector3(i % 2 ? 0.09 : -0.09, (i / 8) * TAIL_LEN, 0))
    pts[0].x = 0
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.055, 6)
  }, [])
  const tailMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ff9f2e', roughness: 0.4, emissive: '#ff6a00', emissiveIntensity: 0.15 }), [])
  const dotGeo = useMemo(() => new THREE.SphereGeometry(1, 8, 6), [])
  const bubbleMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e8f8ff', roughness: 0.1, transparent: true, opacity: 0.55, depthWrite: false }), [])
  const dropMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#5cc6ff', roughness: 0.05, transparent: true, opacity: 0.8 }), [])
  const streakGeo = useMemo(() => new THREE.BoxGeometry(1.6, 0.025, 0.025), [])
  const streakMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false }), [])
  const sparkGeo = useMemo(() => new THREE.OctahedronGeometry(0.12, 0), [])
  const sparkMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#fff7b0', toneMapped: false }), [])
  const surfMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#7fd0ff', roughness: 0.05, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }),
    [],
  )

  useEffect(
    () => () => {
      ;[fiberGeo, mudGeo, headGeo, tailGeo, dotGeo, streakGeo, sparkGeo, ...blobGeos].forEach((g) => g.dispose())
      ;[fiberMat, oilMat, mudMat, headMat, tailMat, bubbleMat, dropMat, streakMat, sparkMat, surfMat].forEach((m) => m.dispose())
      fiberTex.dispose()
    },
    [fiberGeo, mudGeo, headGeo, tailGeo, dotGeo, streakGeo, sparkGeo, blobGeos, fiberMat, oilMat, mudMat, headMat, tailMat, bubbleMat, dropMat, streakMat, sparkMat, surfMat, fiberTex],
  )

  const mols = useMemo(
    () =>
      Array.from({ length: NMOL }, (_, i) => {
        const k = i % BLOBS.length
        const j = Math.floor(i / BLOBS.length)
        const side = i % 2 ? 1 : -1
        return {
          blob: k,
          dir: fib(j, PER_BLOB),
          far: new THREE.Vector3(side * (14 + Math.random() * 6), 2 + Math.random() * 5, (Math.random() - 0.5) * 8),
          home: new THREE.Vector3((Math.random() - 0.5) * 12, 1.8 + Math.random() * 3.5, (Math.random() - 0.5) * 6),
          ph: Math.random() * 6,
          delay: Math.random() * 2.5,
        }
      }),
    [],
  )
  const bubbles = useMemo(() => Array.from({ length: 50 }, () => new THREE.Vector3((Math.random() - 0.5) * 20, Math.random() * 10 - 3, (Math.random() - 0.5) * 10)), [])
  const streaks = useMemo(() => Array.from({ length: 28 }, () => ({ y: Math.random() * 6 - 1, z: (Math.random() - 0.5) * 8, x: Math.random() * 30, s: 6 + Math.random() * 6 })), [])

  const yarns = useRef<THREE.Mesh>(null)
  const blobRefs = useRef<(THREE.Mesh | null)[]>([])
  const mudRef = useRef<THREE.InstancedMesh>(null)
  const headRef = useRef<THREE.InstancedMesh>(null)
  const tailRef = useRef<THREE.InstancedMesh>(null)
  const bubRef = useRef<THREE.InstancedMesh>(null)
  const dropRef = useRef<THREE.InstancedMesh>(null)
  const streakRef = useRef<THREE.InstancedMesh>(null)
  const sparkRef = useRef<THREE.InstancedMesh>(null)
  const surf = useRef<THREE.Mesh>(null)
  const big = useRef<THREE.Group>(null)
  const light = useRef<THREE.DirectionalLight>(null)

  const tmp = useMemo(
    () => ({
      m4: new THREE.Matrix4(),
      q: new THREE.Quaternion(),
      v: new THREE.Vector3(),
      v2: new THREE.Vector3(),
      s: new THREE.Vector3(),
      up: new THREE.Vector3(0, 1, 0),
      air: new THREE.Color('#fdf1dc'),
      water: new THREE.Color('#4aa6e6'),
      bg: new THREE.Color(),
      wetCol: new THREE.Color(),
      lightWater: new THREE.Color('#bfe6ff'),
      blobPos: BLOBS.map(() => new THREE.Vector3()),
    }),
    [],
  )
  const lastStep = useRef(-1)

  useFrame((state, delta) => {
    const st = useStore.getState()
    const dt = Math.min(delta, 0.05) * (st.slow ? 0.35 : 1)
    micro.t = Math.min(microEnd(det), micro.t + dt)
    const t = micro.t
    const time = state.clock.elapsedTime
    const steps = microSteps(det)
    let idx = 0
    steps.forEach((s, i) => {
      if (t >= s.t) idx = i
    })
    if (idx !== lastStep.current) {
      lastStep.current = idx
      useStore.setState({ microStep: idx })
    }

    const water = ss(6, 10, t)
    const surfIn = det ? ss(12, 15.5, t) : 0
    const bigMol = det ? ss(12.5, 14, t) * (1 - ss(17.5, 19, t)) : 0
    const lift = det ? ss(25, 30, t) : 0
    const carry = det ? ss(31, 37, t) : 0
    const mudLift = det ? ss(24, 30, t) + ss(31, 37, t) : ss(19, 25, t) * 0.55
    const agitate = det ? ss(30.5, 32, t) * (1 - ss(36.5, 38, t)) : ss(18.5, 20, t) * (1 - ss(25, 27, t))
    const clean = det ? ss(37, 39, t) : 0
    const repel = det ? 0 : ss(12, 14, t)

    // 背景：空気 → 水
    tmp.bg.copy(tmp.air).lerp(tmp.water, water)
    if (scene.background instanceof THREE.Color) scene.background.copy(tmp.bg)
    fog.color.copy(tmp.bg)
    fog.density = 0.012 + water * 0.012
    if (light.current) light.current.color.set('#ffffff').lerp(tmp.lightWater, water * 0.6)

    // 水面
    if (surf.current) {
      surf.current.position.y = -6 + water * 16
      surf.current.visible = water > 0.001 && water < 0.999
    }

    // 繊維：ぬれて少しふくらむ・ゆれる
    if (yarns.current) {
      const sway = agitate * Math.sin(time * 2.2) * 0.08
      yarns.current.rotation.z = sway * 0.3
      yarns.current.position.y = Math.sin(time * 1.7) * agitate * 0.15
      const sw = 1 + water * 0.04
      yarns.current.scale.set(1, sw, sw)
      tmp.wetCol.copy(baseColor).multiplyScalar(1 - water * 0.18 + clean * 0.25)
      fiberMat.color.copy(tmp.wetCol)
      fiberMat.roughness = 0.7 - water * 0.35
      fiberMat.emissive.copy(baseColor).multiplyScalar(0.12 + clean * 0.25)
    }

    // 油よごれ
    BLOBS.forEach((b, k) => {
      const p = tmp.blobPos[k]
      p.copy(b.base).addScaledVector(b.drift, lift * 1.6 + carry * 9)
      p.y += Math.sin(time * 1.3 + k) * 0.05 * (lift + agitate)
      if (repel) p.y += Math.sin(time * 4 + k) * 0.03 * repel
      const m = blobRefs.current[k]
      if (m) {
        m.position.copy(p)
        const wob = 1 + Math.sin(time * 3 + k) * 0.04 * (water + agitate)
        const shrink = 1 - carry * 0.3
        m.scale.set(wob * shrink, (2 - wob) * shrink, wob * shrink)
        m.rotation.y = time * 0.2 * lift
        m.visible = carry < 0.98
      }
    })

    // 泥
    const mud = mudRef.current
    if (mud) {
      MUDS.forEach((d, i) => {
        const l = Math.min(1, mudLift)
        const partial = det ? 1 : i % 2 ? 1 : 0.15
        tmp.v.copy(d.base).addScaledVector(d.drift, l * partial * (det ? 6 : 2.5))
        tmp.v.y += Math.sin(time * 2 + i) * 0.06 * agitate
        const sc = d.r * (det ? 1 - carry * 0.5 : 1)
        tmp.q.setFromAxisAngle(tmp.up, time * 0.5 * l + i)
        tmp.s.setScalar(sc)
        tmp.m4.compose(tmp.v, tmp.q, tmp.s)
        mud.setMatrixAt(i, tmp.m4)
      })
      mud.instanceMatrix.needsUpdate = true
    }

    // 界面活性剤（あたま＝親水基、しっぽ＝親油基）
    const heads = headRef.current
    const tails = tailRef.current
    if (heads && tails) {
      heads.visible = tails.visible = surfIn > 0.001
      if (heads.visible) {
        mols.forEach((m, i) => {
          const bp = tmp.blobPos[m.blob]
          const b = BLOBS[m.blob]
          const attach = det ? ss(19 + m.delay, 22.5 + m.delay, t) : 0
          // 自由に泳ぐ位置
          tmp.v.copy(m.home)
          tmp.v.x += Math.sin(time * 0.6 + m.ph) * 0.8
          tmp.v.y += Math.cos(time * 0.5 + m.ph * 1.3) * 0.5
          tmp.v.z += Math.sin(time * 0.4 + m.ph * 0.7) * 0.6
          tmp.v.lerpVectors(m.far, tmp.v, surfIn)
          // くっついた位置
          tmp.v2.copy(bp).addScaledVector(m.dir, b.r * (1 - carry * 0.3) + TAIL_LEN * 0.8)
          tmp.v.lerp(tmp.v2, attach)
          // しっぽの向き
          const freeDir = tmp.s.set(Math.sin(time * 0.7 + m.ph), Math.cos(time * 0.5 + m.ph), Math.sin(time * 0.3 + m.ph * 2)).normalize()
          const attachDir = tmp.v2.copy(m.dir).negate()
          freeDir.lerp(attachDir, attach).normalize()
          tmp.q.setFromUnitVectors(tmp.up, freeDir)
          const sc = Math.min(1, surfIn * 1.3) * (1 - carry * 0.25)
          tmp.v2.setScalar(sc)
          tmp.m4.compose(tmp.v, tmp.q, tmp.v2)
          heads.setMatrixAt(i, tmp.m4)
          tails.setMatrixAt(i, tmp.m4)
        })
        heads.instanceMatrix.needsUpdate = true
        tails.instanceMatrix.needsUpdate = true
      }
    }

    // 大きな説明用モデル
    if (big.current) {
      big.current.visible = bigMol > 0.01
      big.current.scale.setScalar(Math.max(0.001, bigMol) * 2.6)
      big.current.rotation.y = Math.sin(time * 0.6) * 0.5
      big.current.rotation.z = -0.5
    }

    // 泡粒
    const bub = bubRef.current
    if (bub) {
      bubbles.forEach((b, i) => {
        b.y += dt * (0.4 + (i % 5) * 0.12) * (water > 0.5 ? 1 : 0.15)
        if (b.y > 9) b.y = -3
        const sc = water > 0.5 ? 0.06 + (i % 4) * 0.03 : 0.025
        tmp.m4.makeScale(sc, sc, sc).setPosition(b.x + Math.sin(time + i) * 0.2, b.y, b.z)
        bub.setMatrixAt(i, tmp.m4)
      })
      bub.instanceMatrix.needsUpdate = true
    }

    // 水は油をはじく（洗剤なし）
    const drops = dropRef.current
    if (drops) {
      drops.visible = repel > 0.01
      if (drops.visible) {
        for (let i = 0; i < 24; i++) {
          const k = i % BLOBS.length
          const b = BLOBS[k]
          const a = i * 1.7 + time * 0.8
          const bounce = Math.abs(Math.sin(time * 3 + i))
          const r = b.r + 0.35 + bounce * 0.35
          tmp.v.set(Math.cos(a) * r, Math.abs(Math.sin(a * 0.7)) * r * 0.8, Math.sin(a) * r).add(tmp.blobPos[k])
          tmp.m4.makeScale(0.09 * repel, 0.09 * repel, 0.09 * repel).setPosition(tmp.v)
          drops.setMatrixAt(i, tmp.m4)
        }
        drops.instanceMatrix.needsUpdate = true
      }
    }

    // 水の流れ（撹拌）
    const sk = streakRef.current
    if (sk) {
      sk.visible = agitate > 0.01
      streakMat.opacity = agitate * 0.55
      if (sk.visible) {
        streaks.forEach((s, i) => {
          s.x += dt * s.s
          if (s.x > 16) s.x = -16
          tmp.m4.makeScale(1, 1, 1).setPosition(s.x, s.y + Math.sin(s.x * 0.4 + i) * 0.4, s.z)
          sk.setMatrixAt(i, tmp.m4)
        })
        sk.instanceMatrix.needsUpdate = true
      }
    }

    // きらきら
    const sp = sparkRef.current
    if (sp) {
      sp.visible = clean > 0.01
      if (sp.visible) {
        for (let i = 0; i < 30; i++) {
          const yarn = X_YARNS[i % 4]
          const x = ((i * 3.7) % 16) - 8
          const tw = Math.max(0, Math.sin(time * 3 + i * 1.3)) * clean
          tmp.q.setFromAxisAngle(tmp.up, time + i)
          tmp.s.set(tw, tw * 1.8, tw)
          tmp.v.set(x, yX(yarn.s, x) + YARN_R + 0.2, yarn.z + 0.3)
          tmp.m4.compose(tmp.v, tmp.q, tmp.s)
          sp.setMatrixAt(i, tmp.m4)
        }
        sp.instanceMatrix.needsUpdate = true
      }
    }
  })

  return (
    <group>
      <hemisphereLight args={['#ffffff', '#c7a98a', 1.0]} />
      <directionalLight ref={light} position={[4, 10, 6]} intensity={2.2} />
      <pointLight position={[-6, 3, 4]} intensity={30} color="#ffd9f0" />

      <mesh ref={yarns} geometry={fiberGeo} material={fiberMat} />
      {BLOBS.map((_, k) => (
        <mesh key={k} ref={(m) => void (blobRefs.current[k] = m)} geometry={blobGeos[k]} material={oilMat} />
      ))}
      <instancedMesh ref={mudRef} args={[mudGeo, mudMat, MUDS.length]} frustumCulled={false} />
      <instancedMesh ref={headRef} args={[headGeo, headMat, NMOL]} frustumCulled={false} />
      <instancedMesh ref={tailRef} args={[tailGeo, tailMat, NMOL]} frustumCulled={false} />
      <instancedMesh ref={bubRef} args={[dotGeo, bubbleMat, 50]} frustumCulled={false} />
      <instancedMesh ref={dropRef} args={[dotGeo, dropMat, 24]} frustumCulled={false} />
      <instancedMesh ref={streakRef} args={[streakGeo, streakMat, 28]} frustumCulled={false} />
      <instancedMesh ref={sparkRef} args={[sparkGeo, sparkMat, 30]} frustumCulled={false} />
      <mesh ref={surf} material={surfMat} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[60, 60]} />
      </mesh>

      <group ref={big} position={[0.5, 3.4, 4.5]} visible={false}>
        <mesh geometry={headGeo} material={headMat} />
        <mesh geometry={tailGeo} material={tailMat} />
        {showLabels && (
          <>
            <Html position={[-0.75, -0.1, 0]} center zIndexRange={[30, 0]}>
              <div className="tag3d water">💧 あたま：みずが すき</div>
            </Html>
            <Html position={[0.55, TAIL_LEN + 0.15, 0]} center zIndexRange={[30, 0]}>
              <div className="tag3d oil">🛢️ しっぽ：あぶらが すき</div>
            </Html>
          </>
        )}
      </group>
    </group>
  )
}
