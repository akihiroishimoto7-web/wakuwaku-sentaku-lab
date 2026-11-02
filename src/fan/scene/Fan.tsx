import { Html, RoundedBox } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { flowTexture } from '../../textures'
import { BLADE_R, BLADE_Z, FAN_PARTS, FAN_PART_IDS, GUARD_R, HEAD_OFFSET, OUTLET_POS, PIVOT, type FanPartId, type Level } from '../data'
import { makeBase, makeBlades, makeGear, makeGuard, makeHousing, makeWorm } from '../geometry'
import { fan, windAt } from '../sim'
import { useFan } from '../store'

// ---- 透視と、選んだ部品を光らせるための登録 ----
const partMats = new Map<FanPartId, Set<THREE.MeshStandardMaterial>>()
function usePart(part: FanPartId, mats: THREE.MeshStandardMaterial[]) {
  useEffect(() => {
    let set = partMats.get(part)
    if (!set) partMats.set(part, (set = new Set()))
    mats.forEach((m) => set!.add(m))
    return () => mats.forEach((m) => set!.delete(m))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, mats)
}
function useFade(mats: THREE.Material[], min: number) {
  useFrame(() => {
    const o = 1 + (min - 1) * fan.xray
    const tr = o < 0.999
    for (const m of mats) {
      if (m.transparent !== tr) {
        m.transparent = tr
        m.needsUpdate = true
      }
      m.opacity = o
      m.depthWrite = o > 0.6
    }
  })
}
const tap = (part: FanPartId) => (e: ThreeEvent<MouseEvent>) => {
  const st = useFan.getState()
  if (!st.xray || st.tour || e.delta > 10) return
  e.stopPropagation()
  st.setFocus(part)
}
function useDispose(...items: { dispose: () => void }[]) {
  useEffect(
    () => () => items.forEach((i) => i.dispose()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
}

export function Fan() {
  const head = useRef<THREE.Group>(null)
  useFrame(() => {
    if (head.current) head.current.rotation.y = fan.yaw
  })
  return (
    <group>
      <BaseAndPole />
      <group ref={head} position={PIVOT}>
        <Neck />
        <group position={HEAD_OFFSET}>
          <Head />
        </group>
      </group>
      <Cord />
      <PartLabels />
      <Highlighter />
    </group>
  )
}

// ---- 台と支柱（スイッチ・コンデンサー入り） ----
const LEVEL_COLORS = ['#ff8db3', '#a6e1ff', '#4fb8ff', '#1f7fd6']
function BaseAndPole() {
  const shell = useMemo(() => new THREE.MeshPhysicalMaterial({ color: '#f6fbff', roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.2 }), [])
  const pole = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e9f2f8', metalness: 0.6, roughness: 0.25 }), [])
  const baseGeo = useMemo(() => makeBase(), [])
  const switchMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#7d8aa0', roughness: 0.5 }), [])
  const capMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2d3446', roughness: 0.4 }), [])
  const capBand = useMemo(() => new THREE.MeshStandardMaterial({ color: '#5ec8ff', roughness: 0.4 }), [])
  useFade([shell, pole], 0.12)
  usePart('switch', [switchMat])
  usePart('capacitor', [capMat, capBand])
  useDispose(shell, pole, baseGeo, switchMat, capMat, capBand)
  const buttons = useRef<(THREE.Mesh | null)[]>([])
  useFrame((_, dt) => {
    const lv = useFan.getState().tour ? fan.level : useFan.getState().level
    buttons.current.forEach((b, i) => {
      if (!b) return
      const target = i === lv ? -0.004 : 0
      b.position.y += (target - b.position.y) * Math.min(1, dt * 15)
    })
  })
  const press = (l: Level) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (e.delta > 10) return
    useFan.getState().setLevel(l)
  }
  return (
    <group>
      <mesh geometry={baseGeo} material={shell} />
      {/* ボタン（きる・よわ・ちゅう・つよ） */}
      <group position={[0, 0.056, 0.105]} rotation-x={-0.35}>
        {[0, 1, 2, 3].map((i) => (
          <group key={i} position={[(i - 1.5) * 0.034, 0, 0]}>
            <mesh ref={(m) => void (buttons.current[i] = m)} onClick={press(i as Level)}>
              <RoundedBox args={[0.028, 0.012, 0.03]} radius={0.004}>
                <meshPhysicalMaterial color={LEVEL_COLORS[i]} roughness={0.25} clearcoat={1} />
              </RoundedBox>
            </mesh>
            {Array.from({ length: i }).map((_, k) => (
              <mesh key={k} position={[(k - (i - 1) / 2) * 0.007, 0.0075, 0.004]} rotation-x={-Math.PI / 2}>
                <circleGeometry args={[0.0022, 10]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
            ))}
            {i === 0 && (
              <mesh position={[0, 0.0075, 0.004]} rotation-x={-Math.PI / 2}>
                <ringGeometry args={[0.003, 0.0045, 16]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
            )}
          </group>
        ))}
      </group>
      {/* 中：スイッチとコンデンサー */}
      <group onClick={tap('switch')}>
        <mesh material={switchMat} position={[0, 0.03, 0.09]}>
          <boxGeometry args={[0.14, 0.03, 0.04]} />
        </mesh>
      </group>
      <group onClick={tap('capacitor')} position={[0.07, 0.035, -0.06]} rotation-z={Math.PI / 2}>
        <mesh material={capMat}>
          <cylinderGeometry args={[0.014, 0.014, 0.045, 20]} />
        </mesh>
        <mesh material={capBand}>
          <cylinderGeometry args={[0.0145, 0.0145, 0.012, 20]} />
        </mesh>
      </group>
      {/* 支柱（太い管と、のびる細い管） */}
      <mesh material={pole} position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.019, 0.022, 0.5, 24]} />
      </mesh>
      <mesh material={pole} position={[0, 0.65, 0]}>
        <cylinderGeometry args={[0.013, 0.013, 0.24, 20]} />
      </mesh>
      <mesh material={shell} position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.026, 0.026, 0.02, 24]} />
      </mesh>
      <PoleWire />
    </group>
  )
}

// 電気が流れる線（中の黄色い流れが見える）
function Wire({ points, part, inHead = false, radius = 0.003 }: { points: [number, number, number][]; part: FanPartId; inHead?: boolean; radius?: number }) {
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), [points])
  const geo = useMemo(() => new THREE.TubeGeometry(curve, 48, radius, 6), [curve, radius])
  const tex = useMemo(() => {
    const t = flowTexture().clone()
    t.repeat.set(Math.max(2, curve.getLength() / 0.03), 1)
    t.needsUpdate = true
    return t
  }, [curve])
  const outer = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c9d4e2', transparent: true, opacity: 0.35, depthWrite: false }), [])
  const glow = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffd84d', map: tex, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }), [tex])
  const inner = useMemo(() => new THREE.TubeGeometry(curve, 48, radius * 0.6, 5), [curve, radius])
  usePart(part, [outer])
  useDispose(geo, inner, tex, outer, glow)
  const mesh = useRef<THREE.Mesh>(null)
  useFrame(() => {
    tex.offset.x -= fan.dt * 3
    const show = Math.max(fan.xray, useFan.getState().tour ? 1 : 0)
    glow.opacity = fan.power * show * 0.95
    outer.opacity = 0.35 * show
    if (mesh.current) mesh.current.visible = show > 0.02
  })
  return (
    <group onClick={tap(part)} visible={inHead || true}>
      <mesh geometry={geo} material={outer} />
      <mesh ref={mesh} geometry={inner} material={glow} />
    </group>
  )
}

const BASE_WIRE: [number, number, number][] = [
  [0, 0.02, -0.17],
  [0, 0.025, -0.05],
  [0, 0.03, 0.07],
  [0.04, 0.03, 0.06],
  [0.06, 0.035, -0.04],
  [0.02, 0.04, -0.01],
  [0, 0.08, 0],
  [0, 0.76, 0],
]
function PoleWire() {
  return <Wire points={BASE_WIRE} part="cord" />
}

// 床を通ってコンセントへ
const CORD: [number, number, number][] = [
  [0, 0.02, -0.17],
  [0, 0.006, -0.28],
  [-0.3, 0.006, -0.5],
  [-0.62, 0.006, -0.66],
  [OUTLET_POS.x, 0.1, OUTLET_POS.z + 0.02],
  [OUTLET_POS.x, OUTLET_POS.y - 0.02, OUTLET_POS.z + 0.02],
]
function Cord() {
  const curve = useMemo(() => new THREE.CatmullRomCurve3(CORD.map((p) => new THREE.Vector3(...p))), [])
  const geo = useMemo(() => new THREE.TubeGeometry(curve, 80, 0.004, 6), [curve])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f2f4f8', roughness: 0.6 }), [])
  usePart('cord', [mat])
  useDispose(geo, mat)
  return (
    <group onClick={tap('cord')}>
      <mesh geometry={geo} material={mat} />
      <Wire points={CORD} part="cord" radius={0.0042} />
      {/* コンセント */}
      <group position={[OUTLET_POS.x, OUTLET_POS.y, OUTLET_POS.z]}>
        <RoundedBox args={[0.07, 0.11, 0.012]} radius={0.006}>
          <meshStandardMaterial color="#ffffff" roughness={0.4} />
        </RoundedBox>
        <RoundedBox args={[0.034, 0.03, 0.02]} radius={0.004} position={[0, -0.02, 0.012]}>
          <meshStandardMaterial color="#f2f4f8" roughness={0.4} />
        </RoundedBox>
      </group>
    </group>
  )
}

// ---- 首の関節 ----
function Neck() {
  const mat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: '#f6fbff', roughness: 0.25, clearcoat: 0.8 }), [])
  useFade([mat], 0.15)
  useDispose(mat)
  return (
    <group>
      <mesh material={mat} position={[0, -0.01, -0.04]}>
        <boxGeometry args={[0.05, 0.04, 0.07]} />
      </mesh>
      <mesh material={mat} position={[0, -0.02, 0]}>
        <cylinderGeometry args={[0.02, 0.022, 0.03, 20]} />
      </mesh>
    </group>
  )
}

// ---- 頭（モーター・羽根・ガード・首振りの歯車） ----
function Head() {
  const quality = useFan((s) => s.quality)
  const housing = useMemo(() => new THREE.MeshPhysicalMaterial({ color: '#f6fbff', roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.15, side: THREE.DoubleSide }), [])
  const housingGeo = useMemo(() => makeHousing(), [])
  const guardGeo = useMemo(() => makeGuard(GUARD_R, quality), [quality])
  const guardMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e8eef5', metalness: 0.85, roughness: 0.25 }), [])
  const bladeGeo = useMemo(() => makeBlades(5, 28), [])
  const bladeMat = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: '#7fcaff', roughness: 0.12, transparent: true, opacity: 0.62, side: THREE.DoubleSide, depthWrite: false, clearcoat: 1 }),
    [],
  )
  const hubMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: '#5ab6f5', roughness: 0.2, clearcoat: 1 }), [])
  const blurMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#bfe6ff', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }), [])
  const badge = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(64, 64, 62, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#7fcaff'
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2
      ctx.beginPath()
      ctx.ellipse(64 + Math.cos(a) * 24, 64 + Math.sin(a) * 24, 20, 13, a, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = '#ffd84d'
    ctx.beginPath()
    ctx.arc(64, 64, 12, 0, Math.PI * 2)
    ctx.fill()
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  useFade([housing], 0.12)
  usePart('guard', [guardMat])
  usePart('blades', [bladeMat, hubMat])
  useDispose(housing, housingGeo, guardMat, bladeGeo, bladeMat, hubMat, blurMat, badge)
  useEffect(() => () => guardGeo.dispose(), [guardGeo])

  const rotor = useRef<THREE.Group>(null)
  const blades = useRef<THREE.Group>(null)
  const knob = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    if (rotor.current) rotor.current.rotation.z = fan.angle
    if (blades.current) blades.current.rotation.z = fan.angle
    // 速く回ると羽根は うすく、ぼかしの円が こく なる
    const fast = THREE.MathUtils.smoothstep(fan.rpm, 250, 1100)
    bladeMat.opacity = 0.62 * (1 - 0.62 * fast)
    blurMat.opacity = 0.32 * fast
    if (knob.current) {
      const target = fan.osc ? -0.01 : 0
      knob.current.position.y += (target - knob.current.position.y) * Math.min(1, dt * 12)
    }
  })

  const onKnob = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (e.delta > 10) return
    useFan.getState().toggleOsc()
  }

  return (
    <group>
      <group onClick={tap('motor')}>
        <mesh geometry={housingGeo} material={housing} />
      </group>
      <Motor />
      <Gearbox />
      {/* 首振りのつまみ */}
      <group ref={knob} position={[0, 0.082, -0.15]} onClick={onKnob}>
        <mesh position-y={0.012}>
          <cylinderGeometry args={[0.012, 0.014, 0.026, 20]} />
          <meshPhysicalMaterial color="#ffd84d" roughness={0.3} clearcoat={1} />
        </mesh>
      </group>
      {/* 羽根 */}
      <group ref={blades} position-z={BLADE_Z} onClick={tap('blades')}>
        <mesh geometry={bladeGeo} material={bladeMat} renderOrder={2} />
        <mesh material={hubMat} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.034, 0.03, 0.03, 32]} />
        </mesh>
        <mesh material={hubMat} position-z={0.016} scale={[1, 1, 0.55]}>
          <sphereGeometry args={[0.028, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
      </group>
      <mesh material={blurMat} position-z={BLADE_Z} renderOrder={3}>
        <ringGeometry args={[0.035, BLADE_R, 64]} />
      </mesh>
      {/* ガード */}
      <group onClick={tap('guard')}>
        <mesh geometry={guardGeo} material={guardMat} />
        <mesh position-z={0.101}>
          <circleGeometry args={[0.04, 40]} />
          <meshStandardMaterial map={badge} roughness={0.3} />
        </mesh>
      </group>
      <Ribbons />
    </group>
  )
}

// モーター：コイルが順番に光って「回る磁石の力」を見せる
function Motor() {
  const stator = useMemo(() => new THREE.MeshStandardMaterial({ color: '#59627a', metalness: 0.6, roughness: 0.4 }), [])
  const rotorMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#aeb8c6', metalness: 0.8, roughness: 0.3 }), [])
  const coils = useMemo(() => Array.from({ length: 8 }, () => new THREE.MeshStandardMaterial({ color: '#d98a3a', metalness: 0.7, roughness: 0.35, emissive: '#ff7a1a', emissiveIntensity: 0 })), [])
  usePart('motor', [stator, rotorMat])
  useDispose(stator, rotorMat, ...coils)
  const rotor = useRef<THREE.Group>(null)
  useFrame(() => {
    if (rotor.current) rotor.current.rotation.z = fan.angle
    coils.forEach((m, k) => {
      const wave = Math.max(0, Math.cos(fan.angle * 1.0 - (k / 8) * Math.PI * 2))
      m.emissiveIntensity = fan.power * (0.15 + 1.4 * Math.pow(wave, 3)) * Math.max(0.35, fan.xray)
    })
  })
  return (
    <group onClick={tap('motor')}>
      <mesh material={stator} position-z={-0.1} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.064, 0.064, 0.07, 32, 1, true]} />
      </mesh>
      {coils.map((m, k) => {
        const a = (k / 8) * Math.PI * 2
        return (
          <mesh key={k} material={m} position={[Math.cos(a) * 0.05, Math.sin(a) * 0.05, -0.1]} rotation-z={a}>
            <boxGeometry args={[0.018, 0.022, 0.062]} />
          </mesh>
        )
      })}
      <group ref={rotor} position-z={-0.1}>
        <mesh material={rotorMat} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.032, 0.032, 0.066, 24]} />
        </mesh>
        {Array.from({ length: 10 }).map((_, k) => {
          const a = (k / 10) * Math.PI * 2
          return (
            <mesh key={k} position={[Math.cos(a) * 0.033, Math.sin(a) * 0.033, 0]} rotation-z={a}>
              <boxGeometry args={[0.003, 0.006, 0.066]} />
              <meshStandardMaterial color="#e3a35b" metalness={0.8} roughness={0.3} />
            </mesh>
          )
        })}
        <mesh rotation-x={Math.PI / 2} position-z={-0.02}>
          <cylinderGeometry args={[0.005, 0.005, 0.2, 10]} />
          <meshStandardMaterial color="#dfe6ee" metalness={1} roughness={0.2} />
        </mesh>
      </group>
      <Wire points={[[0, -0.05, -0.06], [0, -0.02, -0.08], [0, 0.0, -0.1]]} part="cord" inHead />
    </group>
  )
}

// 首振りの歯車：ウォーム → 大きな歯車 → うで
function Gearbox() {
  const metal = useMemo(() => new THREE.MeshStandardMaterial({ color: '#cfd8e3', metalness: 0.85, roughness: 0.25 }), [])
  const gearMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffd166', roughness: 0.4 }), [])
  const armMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ff8db3', roughness: 0.4 }), [])
  const wormGeo = useMemo(() => makeWorm(), [])
  const gearGeo = useMemo(() => makeGear(0.022, 18, 0.006), [])
  usePart('gear', [metal, gearMat, armMat])
  useDispose(metal, gearMat, armMat, wormGeo, gearGeo)
  const worm = useRef<THREE.Mesh>(null)
  const wheel = useRef<THREE.Mesh>(null)
  const arm = useRef<THREE.Mesh>(null)
  const pin = useMemo(() => new THREE.Vector3(), [])
  const anchor = useMemo(() => new THREE.Vector3(0, -0.075, -0.11), [])
  const mid = useMemo(() => new THREE.Vector3(), [])
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const dir = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    if (worm.current) worm.current.rotation.z = fan.angle
    if (wheel.current) wheel.current.rotation.x = fan.gear
    pin.set(0.008, -0.034 + Math.sin(fan.gear) * 0.015, -0.185 + Math.cos(fan.gear) * 0.015)
    if (arm.current) {
      mid.addVectors(pin, anchor).multiplyScalar(0.5)
      arm.current.position.copy(mid)
      dir.subVectors(anchor, pin)
      arm.current.scale.set(1, dir.length(), 1)
      arm.current.quaternion.setFromUnitVectors(up, dir.normalize())
    }
  })
  return (
    <group onClick={tap('gear')}>
      <mesh ref={worm} geometry={wormGeo} material={metal} position-z={-0.185} />
      <mesh ref={wheel} geometry={gearGeo} material={gearMat} position={[0, -0.034, -0.185]} />
      <mesh ref={arm} material={armMat}>
        <cylinderGeometry args={[0.003, 0.003, 1, 8]} />
      </mesh>
      <mesh material={metal} position={[0, -0.075, -0.11]}>
        <sphereGeometry args={[0.006, 12, 8]} />
      </mesh>
    </group>
  )
}

// ガードに結んだリボン：風でひらひら
function Ribbons() {
  const N = 14
  const L = 0.15
  const anchors = useMemo(
    () => [0.62, 1.5708, 2.52].map((a) => new THREE.Vector3(Math.cos(a) * (GUARD_R - 0.004), Math.sin(a) * (GUARD_R - 0.004), 0.012)),
    [],
  )
  const geos = useMemo(() => anchors.map(() => new THREE.PlaneGeometry(0.014, L, 1, N)), [anchors])
  const mats = useMemo(() => ['#ff8db3', '#ffd84d', '#7fe0b0'].map((c) => new THREE.MeshStandardMaterial({ color: c, side: THREE.DoubleSide, roughness: 0.7 })), [])
  useDispose(...geos, ...mats)
  const world = useMemo(() => new THREE.Vector3(), [])
  useFrame((state) => {
    const t = state.clock.elapsedTime
    // ガードの前では、首の向きにかかわらず風がまっすぐ当たる
    world.set(0, 0, 0)
    const w = Math.min(1, fan.wind * 1.1)
    geos.forEach((g, gi) => {
      const p = g.attributes.position as THREE.BufferAttribute
      const a = anchors[gi]
      for (let k = 0; k <= N; k++) {
        const s = k / N
        const lift = w * (0.75 + 0.25 * Math.sin(t * (6 + gi) + s * 5))
        const dy = -(1 - lift) * s * L
        const dz = lift * s * L * 1.05
        const wav = Math.sin(t * (10 + gi * 2) * (0.3 + w) - s * 9) * 0.012 * s * (0.2 + w)
        for (let side = 0; side < 2; side++) {
          const i = k * 2 + side
          p.setXYZ(i, a.x + (side ? 0.007 : -0.007) + wav * 0.6, a.y + dy + wav * 0.4, a.z + dz)
        }
      }
      p.needsUpdate = true
      g.computeVertexNormals()
    })
  })
  return (
    <>
      {geos.map((g, i) => (
        <mesh key={i} geometry={g} material={mats[i]} />
      ))}
    </>
  )
}

// ---- 部品の名札（透視モード） ----
function PartLabels() {
  const xray = useFan((s) => s.xray)
  const focus = useFan((s) => s.focus)
  const tour = useFan((s) => s.tour)
  const mode = useFan((s) => s.mode)
  const setFocus = useFan((s) => s.setFocus)
  if (!xray || focus || tour || mode !== 'play') return null
  return (
    <>
      {FAN_PART_IDS.map((id) => {
        const p = FAN_PARTS[id]
        return (
          <LabelAt key={id} part={id}>
            <button className="tag3d tap" onClick={() => setFocus(id)}>
              {p.icon} {p.short}
            </button>
          </LabelAt>
        )
      })}
    </>
  )
}

// 首の中の部品は、首振りといっしょに動く位置に名札を出す
function LabelAt({ part, children }: { part: FanPartId; children: React.ReactNode }) {
  const p = FAN_PARTS[part]
  const g = useRef<THREE.Group>(null)
  const v = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    if (!g.current) return
    v.set(...p.pos)
    if (p.inHead) v.add(HEAD_OFFSET).applyAxisAngle(new THREE.Vector3(0, 1, 0), fan.yaw).add(PIVOT)
    g.current.position.copy(v)
  })
  return (
    <group ref={g}>
      <Html center zIndexRange={[20, 0]}>
        {children}
      </Html>
    </group>
  )
}

function Highlighter() {
  const glow = useMemo(() => new THREE.Color('#ffd84d'), [])
  const black = useMemo(() => new THREE.Color('#000000'), [])
  const last = useRef<FanPartId | null>(null)
  useFrame((state) => {
    const focus = useFan.getState().focus
    if (last.current && last.current !== focus)
      partMats.get(last.current)?.forEach((m) => {
        m.emissive.copy(black)
      })
    last.current = focus
    if (!focus) return
    const k = 0.25 + 0.2 * Math.sin(state.clock.elapsedTime * 5)
    partMats.get(focus)?.forEach((m) => {
      m.emissive.copy(glow)
      m.emissiveIntensity = k
    })
  })
  return null
}

export { windAt }
