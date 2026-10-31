import { Html, RoundedBox } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { DRUM_LEN, DRUM_R, PARTS, PART_IDS, TUB_C, TUB_LEN, TUB_R, type PartId } from '../data'
import { partMats, registerPart } from '../partMats'
import { sim } from '../sim'
import { useStore } from '../store'
import { flowTexture, perforationTexture } from '../textures'
import { Drops, Foam, InletStream, Steam, WaterBody } from './Water'
import { useXrayFade } from './xray'

const partClick = (part: PartId) => (e: ThreeEvent<MouseEvent>) => {
  const st = useStore.getState()
  if (!st.xray || st.mode !== 'wash' || e.delta > 10) return
  e.stopPropagation()
  st.setFocus(part)
}

function usePartMats(part: PartId, mats: THREE.MeshStandardMaterial[]) {
  useEffect(() => {
    const un = registerPart(part, ...mats)
    return () => {
      un()
      mats.forEach((m) => m.dispose())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, mats)
}

export function Internals() {
  const quality = useStore((s) => s.quality)
  const seg = quality === 'high' ? 64 : 32
  return (
    <group>
      <TubAssembly seg={seg} />
      <Springs />
      <Dampers />
      <Valve />
      <Pump />
      <DryerUnit />
      <Airflow />
      <PartLabels />
      <PartHighlighter />
    </group>
  )
}

// ---- 外槽＋ドラム＋モーター（振動する部分） ----
function TubAssembly({ seg }: { seg: number }) {
  const group = useRef<THREE.Group>(null)
  const drum = useRef<THREE.Group>(null)
  const rotor = useRef<THREE.Group>(null)

  const tubMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8d9bb0', roughness: 0.55, side: THREE.DoubleSide }), [])
  const drumMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#c9d2de',
        metalness: 0.9,
        roughness: 0.28,
        alphaMap: perforationTexture(),
        alphaTest: 0.5,
        side: THREE.DoubleSide,
      }),
    [],
  )
  const drumSolid = useMemo(() => new THREE.MeshStandardMaterial({ color: '#dfe5ec', metalness: 0.9, roughness: 0.25 }), [])
  const statorMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3b4250', roughness: 0.5, metalness: 0.4 }), [])
  const coilMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d9822b', roughness: 0.35, metalness: 0.8 }), [])
  const rotorMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8a96a8', roughness: 0.35, metalness: 0.8 }), [])
  const magN = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ff5d73', roughness: 0.4 }), [])
  const magS = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4d8dff', roughness: 0.4 }), [])
  usePartMats('tub', [tubMat])
  usePartMats('drum', [drumMat, drumSolid])
  usePartMats('motor', [statorMat, coilMat, rotorMat, magN, magS])
  useXrayFade([tubMat], 0.32)

  useFrame(() => {
    if (group.current) group.current.position.copy(TUB_C).add(sim.vib)
    if (drum.current) drum.current.rotation.z = sim.angle
    if (rotor.current) rotor.current.rotation.z = sim.angle
  })

  const zBack = -TUB_LEN / 2
  return (
    <group ref={group} position={TUB_C}>
      {/* 外槽 */}
      <group onClick={partClick('tub')}>
        <mesh material={tubMat} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[TUB_R, TUB_R, TUB_LEN, seg, 1, true]} />
        </mesh>
        <mesh material={tubMat} position-z={zBack}>
          <circleGeometry args={[TUB_R, seg]} />
        </mesh>
        <mesh material={tubMat} position-z={TUB_LEN / 2}>
          <ringGeometry args={[0.172, TUB_R, seg]} />
        </mesh>
        {[-0.12, 0, 0.12].map((z) => (
          <mesh key={z} material={tubMat} position-z={z}>
            <torusGeometry args={[TUB_R + 0.004, 0.006, 6, seg]} />
          </mesh>
        ))}
      </group>

      {/* 回転ドラム */}
      <group ref={drum} onClick={partClick('drum')}>
        <mesh material={drumMat} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[DRUM_R, DRUM_R, DRUM_LEN, seg, 1, true]} />
        </mesh>
        <mesh material={drumMat} position-z={-DRUM_LEN / 2}>
          <circleGeometry args={[DRUM_R, seg]} />
        </mesh>
        <mesh material={drumSolid} position-z={DRUM_LEN / 2}>
          <ringGeometry args={[0.165, DRUM_R, seg]} />
        </mesh>
        <mesh material={drumSolid} position-z={DRUM_LEN / 2}>
          <torusGeometry args={[0.165, 0.008, 10, seg]} />
        </mesh>
        {[0, 1, 2].map((i) => {
          const a = (i / 3) * Math.PI * 2 + 0.3
          const r = DRUM_R - 0.018
          return (
            <RoundedBox key={i} args={[0.045, 0.04, DRUM_LEN * 0.92]} radius={0.015} position={[Math.cos(a) * r, Math.sin(a) * r, 0]} rotation-z={a + Math.PI / 2} material={drumSolid} />
          )
        })}
        <mesh material={drumSolid} rotation-x={Math.PI / 2} position-z={-DRUM_LEN / 2 - 0.05}>
          <cylinderGeometry args={[0.014, 0.014, 0.1, 12]} />
        </mesh>
      </group>

      {/* ダイレクトドライブモーター：外側の回転子（磁石）と内側の固定子（コイル） */}
      <group onClick={partClick('motor')}>
        <group position-z={zBack - 0.03}>
          <mesh material={statorMat} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.105, 0.105, 0.028, 36]} />
          </mesh>
          {Array.from({ length: 18 }).map((_, i) => {
            const a = (i / 18) * Math.PI * 2
            return (
              <mesh key={i} material={coilMat} position={[Math.cos(a) * 0.108, Math.sin(a) * 0.108, 0]} rotation-z={a}>
                <boxGeometry args={[0.022, 0.016, 0.03]} />
              </mesh>
            )
          })}
        </group>
        <group ref={rotor} position-z={zBack - 0.032}>
          <mesh material={rotorMat} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.138, 0.138, 0.042, 48, 1, true]} />
          </mesh>
          <mesh material={rotorMat} position-z={-0.021}>
            <ringGeometry args={[0.03, 0.138, 48]} />
          </mesh>
          {Array.from({ length: 4 }).map((_, i) => (
            <mesh key={i} material={rotorMat} position-z={-0.024} rotation-z={(i / 4) * Math.PI}>
              <boxGeometry args={[0.27, 0.018, 0.006]} />
            </mesh>
          ))}
          {Array.from({ length: 20 }).map((_, i) => {
            const a = (i / 20) * Math.PI * 2
            return (
              <mesh key={i} material={i % 2 ? magN : magS} position={[Math.cos(a) * 0.129, Math.sin(a) * 0.129, 0]} rotation-z={a}>
                <boxGeometry args={[0.012, 0.034, 0.034]} />
              </mesh>
            )
          })}
        </group>
      </group>

      <WaterBody />
      <Foam />
      <Drops />
      <InletStream />
      <Steam />
    </group>
  )
}

// ---- ばね（上から槽をつるす） ----
function Springs() {
  const refs = useRef<(THREE.Group | null)[]>([])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c3cad6', metalness: 0.9, roughness: 0.3 }), [])
  usePartMats('damper', [mat])
  const geo = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 200; i++) {
      const t = i / 200
      const a = t * Math.PI * 2 * 9
      pts.push(new THREE.Vector3(Math.cos(a) * 0.012, -t, Math.sin(a) * 0.012))
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 400, 0.0022, 5)
  }, [])
  useEffect(() => () => geo.dispose(), [geo])
  const topY = 0.828
  useFrame(() => {
    refs.current.forEach((g, i) => {
      if (!g) return
      const x = i ? 0.2 : -0.2
      const bottom = TUB_C.y + Math.sqrt(TUB_R * TUB_R - x * x) + sim.vib.y
      g.scale.y = topY - bottom
      g.position.x = x + sim.vib.x * 0.5
    })
  })
  return (
    <group onClick={partClick('damper')}>
      {[0, 1].map((i) => (
        <group key={i} ref={(g) => void (refs.current[i] = g)} position={[i ? 0.2 : -0.2, topY, 0]}>
          <mesh geometry={geo} material={mat} />
        </group>
      ))}
    </group>
  )
}

// ---- ダンパー（下で揺れを吸収） ----
function Dampers() {
  const rods = useRef<(THREE.Mesh | null)[]>([])
  const body = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4b5563', roughness: 0.5, metalness: 0.3 }), [])
  const rod = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e5e9f0', roughness: 0.2, metalness: 1 }), [])
  usePartMats('damper', [body, rod])
  useFrame(() => {
    rods.current.forEach((m) => {
      if (m) m.position.y = 0.19 + sim.vib.y
    })
  })
  return (
    <group onClick={partClick('damper')}>
      {[-0.14, 0.14].map((x, i) => (
        <group key={x} position={[x, 0, 0.02]} rotation-z={x > 0 ? 0.12 : -0.12}>
          <mesh material={body} position-y={0.1}>
            <cylinderGeometry args={[0.016, 0.016, 0.12, 16]} />
          </mesh>
          <mesh ref={(m) => void (rods.current[i] = m)} material={rod} position-y={0.19}>
            <cylinderGeometry args={[0.006, 0.006, 0.09, 10]} />
          </mesh>
          <mesh material={body} position-y={0.04}>
            <sphereGeometry args={[0.014, 12, 8]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// ---- 配管（中の流れが見える） ----
function Pipe({
  points,
  radius = 0.011,
  part,
  flow,
  color,
  speed = 1,
}: {
  points: [number, number, number][]
  radius?: number
  part: PartId
  flow: () => number
  color: string | (() => THREE.Color)
  speed?: number
}) {
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), [points])
  const outer = useMemo(() => new THREE.TubeGeometry(curve, 48, radius, 10), [curve, radius])
  const inner = useMemo(() => new THREE.TubeGeometry(curve, 48, radius * 0.62, 8), [curve, radius])
  const tex = useMemo(() => {
    const t = flowTexture().clone()
    t.repeat.set(Math.max(2, curve.getLength() / 0.05), 1)
    t.needsUpdate = true
    return t
  }, [curve])
  const outerMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#dbe3ec', roughness: 0.2, transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide }),
    [],
  )
  const innerMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: typeof color === 'string' ? color : '#ffffff', map: tex, transparent: true, opacity: 0, depthWrite: false }),
    [tex, color],
  )
  const innerMesh = useRef<THREE.Mesh>(null)
  usePartMats(part, [outerMat])
  useEffect(
    () => () => {
      outer.dispose()
      inner.dispose()
      tex.dispose()
      innerMat.dispose()
    },
    [outer, inner, tex, innerMat],
  )
  useFrame(() => {
    const f = flow()
    tex.offset.x -= sim.dt * 2.2 * speed
    innerMat.opacity = Math.min(1, f) * 0.95
    if (typeof color !== 'string') innerMat.color.copy(color())
    if (innerMesh.current) innerMesh.current.visible = f > 0.01
  })
  return (
    <group onClick={partClick(part)}>
      <mesh geometry={outer} material={outerMat} renderOrder={2} />
      <mesh ref={innerMesh} geometry={inner} material={innerMat} renderOrder={1} />
    </group>
  )
}

const WATER = new THREE.Color('#38b4ff')
const DIRTY = new THREE.Color('#9b7d4e')
const tmpColor = new THREE.Color()
const drainColor = () => tmpColor.copy(WATER).lerp(DIRTY, Math.min(1, sim.waterDirt * 0.9))

const P_INLET: [number, number, number][] = [
  [0.2, 0.79, -0.22],
  [0.13, 0.805, -0.06],
  [-0.1, 0.805, 0.05],
  [-0.175, 0.79, 0.14],
]
const P_DRAWER_TUB: [number, number, number][] = [
  [-0.175, 0.745, 0.14],
  [-0.16, 0.728, 0.152],
  [-0.11, 0.702, 0.16],
]
const P_HOSE_IN: [number, number, number][] = [
  [0.2, 0.79, -0.26],
  [0.2, 0.79, -0.33],
  [0.24, 0.72, -0.4],
]

// ---- 給水弁 ----
function Valve() {
  const plunger = useRef<THREE.Mesh>(null)
  const led = useRef<THREE.MeshStandardMaterial>(null)
  const body = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f1f4f8', roughness: 0.4 }), [])
  const coil = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c8742a', roughness: 0.35, metalness: 0.7 }), [])
  usePartMats('valve', [body, coil])
  useFrame(() => {
    if (plunger.current) plunger.current.position.y = 0.03 + sim.valve * 0.012
    if (led.current) led.current.emissiveIntensity = sim.valve * 2.5
  })
  return (
    <group>
      <group position={PARTS.valve.pos} onClick={partClick('valve')}>
        <RoundedBox args={[0.06, 0.04, 0.055]} radius={0.008} material={body} />
        <mesh material={coil} position-y={0.032}>
          <cylinderGeometry args={[0.018, 0.018, 0.028, 20]} />
        </mesh>
        <mesh ref={plunger} position-y={0.03}>
          <cylinderGeometry args={[0.006, 0.006, 0.04, 8]} />
          <meshStandardMaterial color="#e6ebf2" metalness={1} roughness={0.2} />
        </mesh>
        <mesh position={[0.031, 0.006, 0]} rotation-y={Math.PI / 2}>
          <circleGeometry args={[0.007, 16]} />
          <meshStandardMaterial ref={led} color="#7dffb0" emissive="#21e07a" emissiveIntensity={0} />
        </mesh>
      </group>
      <Pipe points={P_HOSE_IN} part="valve" radius={0.013} flow={() => sim.inlet} color="#38b4ff" />
      <Pipe points={P_INLET} part="valve" flow={() => sim.inlet} color="#38b4ff" />
      <Pipe points={P_DRAWER_TUB} part="drawer" radius={0.013} flow={() => sim.inlet} color={() => tmpColor.set(sim.drawer > 0.02 ? '#7fc8ff' : '#38b4ff')} />
    </group>
  )
}

const P_SUMP: [number, number, number][] = [
  [0.03, 0.19, 0.06],
  [0.07, 0.14, 0.1],
  [0.12, 0.09, 0.13],
]
const P_DRAIN: [number, number, number][] = [
  [0.21, 0.08, 0.1],
  [0.25, 0.1, 0.0],
  [0.255, 0.25, -0.18],
  [0.255, 0.62, -0.25],
  [0.255, 0.68, -0.3],
  [0.25, 0.62, -0.36],
  [0.24, 0.45, -0.42],
]

// ---- 排水ポンプ ----
function Pump() {
  const impeller = useRef<THREE.Group>(null)
  const housing = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#e8eef5', roughness: 0.2, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide }),
    [],
  )
  const motor = useMemo(() => new THREE.MeshStandardMaterial({ color: '#5a6374', roughness: 0.5, metalness: 0.4 }), [])
  const blade = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3fb6ff', roughness: 0.4 }), [])
  usePartMats('pump', [housing, motor, blade])
  const ang = useRef(0)
  useFrame(() => {
    ang.current += sim.pump * sim.dt * 40
    if (impeller.current) impeller.current.rotation.z = ang.current
  })
  return (
    <group>
      <group position={PARTS.pump.pos} onClick={partClick('pump')}>
        <mesh material={housing} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.048, 0.048, 0.05, 28]} />
        </mesh>
        <mesh material={housing} rotation-x={Math.PI / 2} position-z={0.09}>
          <cylinderGeometry args={[0.03, 0.03, 0.13, 20]} />
        </mesh>
        <mesh material={motor} rotation-x={Math.PI / 2} position-z={-0.05}>
          <cylinderGeometry args={[0.03, 0.03, 0.05, 20]} />
        </mesh>
        <group ref={impeller}>
          {Array.from({ length: 6 }).map((_, i) => (
            <mesh key={i} material={blade} rotation-z={(i / 6) * Math.PI * 2} position={[0, 0, 0]}>
              <boxGeometry args={[0.07, 0.008, 0.03]} />
            </mesh>
          ))}
        </group>
      </group>
      <Pipe points={P_SUMP} part="pump" radius={0.016} flow={() => sim.pump * sim.drainFlow} color={drainColor} />
      <Pipe points={P_DRAIN} part="pump" radius={0.014} flow={() => sim.pump * sim.drainFlow} color={drainColor} speed={1.4} />
    </group>
  )
}

const P_DUCT_IN: [number, number, number][] = [
  [0.12, 0.69, -0.13],
  [0.135, 0.76, -0.125],
  [0.15, 0.785, -0.12],
]
const P_DUCT_OUT: [number, number, number][] = [
  [-0.15, 0.785, -0.12],
  [-0.17, 0.785, -0.01],
  [-0.07, 0.75, 0.16],
  [0, 0.715, 0.2],
]
const P_CONDENSE: [number, number, number][] = [
  [0.06, 0.755, -0.12],
  [0.26, 0.62, -0.2],
  [0.265, 0.2, -0.08],
  [0.22, 0.1, 0.12],
]

// ---- 乾燥ユニット（除湿→加熱→送風の簡略モデル） ----
function DryerUnit() {
  const fan = useRef<THREE.Group>(null)
  const focus = useStore((s) => s.focus)
  const housing = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#f3f6fa', roughness: 0.25, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }),
    [],
  )
  const cold = useMemo(() => new THREE.MeshStandardMaterial({ color: '#6cc7ff', roughness: 0.3, metalness: 0.6, emissive: '#1a8fff', emissiveIntensity: 0 }), [])
  const hot = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ff8a7a', roughness: 0.3, metalness: 0.6, emissive: '#ff3a1f', emissiveIntensity: 0 }), [])
  const fanMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffd166', roughness: 0.4 }), [])
  usePartMats('dryer', [housing, fanMat])
  useEffect(
    () => () => {
      cold.dispose()
      hot.dispose()
    },
    [cold, hot],
  )
  const ang = useRef(0)
  useFrame(() => {
    ang.current += sim.airflow * sim.dt * 30
    if (fan.current) fan.current.rotation.x = ang.current
    cold.emissiveIntensity = sim.airflow * 0.6
    hot.emissiveIntensity = sim.heat * 0.8
  })
  return (
    <group>
      <group position={PARTS.dryer.pos} onClick={partClick('dryer')}>
        <RoundedBox args={[0.32, 0.06, 0.18]} radius={0.015} material={housing} />
        {Array.from({ length: 7 }).map((_, i) => (
          <mesh key={`c${i}`} material={cold} position={[0.035 + i * 0.008, 0, 0]}>
            <boxGeometry args={[0.003, 0.045, 0.14]} />
          </mesh>
        ))}
        {Array.from({ length: 7 }).map((_, i) => (
          <mesh key={`h${i}`} material={hot} position={[-0.055 + i * 0.008, 0, 0]}>
            <boxGeometry args={[0.003, 0.045, 0.14]} />
          </mesh>
        ))}
        <group ref={fan} position={[-0.12, 0, 0]}>
          {Array.from({ length: 5 }).map((_, i) => (
            <mesh key={i} material={fanMat} rotation-x={(i / 5) * Math.PI * 2}>
              <boxGeometry args={[0.012, 0.045, 0.012]} />
            </mesh>
          ))}
        </group>
        {focus === 'dryer' && (
          <>
            <Html position={[0.06, 0.05, 0]} center zIndexRange={[30, 0]}>
              <div className="tag3d cold">❄️ ひやして じょしつ</div>
            </Html>
            <Html position={[-0.03, 0.05, 0.05]} center zIndexRange={[30, 0]}>
              <div className="tag3d hot">🔥 あたためる</div>
            </Html>
            <Html position={[-0.12, -0.05, 0]} center zIndexRange={[30, 0]}>
              <div className="tag3d">🌀 ファン</div>
            </Html>
          </>
        )}
      </group>
      <Pipe points={P_DUCT_IN} part="dryer" radius={0.024} flow={() => 0} color="#ffffff" />
      <Pipe points={P_DUCT_OUT} part="dryer" radius={0.024} flow={() => 0} color="#ffffff" />
      <Pipe points={P_CONDENSE} part="dryer" radius={0.007} flow={() => sim.airflow * Math.min(1, sim.wet * 2.5)} color="#38b4ff" />
    </group>
  )
}

// ---- 温風の流れ（粒子） ----
const AIR_PATH = new THREE.CatmullRomCurve3(
  [
    [0, 0.42, 0.05],
    [0.08, 0.6, -0.08],
    [0.12, 0.7, -0.13],
    [0.15, 0.785, -0.12],
    [0.06, 0.785, -0.12],
    [-0.03, 0.785, -0.12],
    [-0.12, 0.785, -0.12],
    [-0.17, 0.785, -0.01],
    [-0.07, 0.75, 0.16],
    [0, 0.66, 0.17],
    [-0.06, 0.5, 0.12],
  ].map((p) => new THREE.Vector3(...(p as [number, number, number]))),
  true,
)
const C_MOIST = new THREE.Color('#c9a6ff')
const C_COLD = new THREE.Color('#4fb8ff')
const C_HOT = new THREE.Color('#ff5a3c')
const C_WARM = new THREE.Color('#ffb347')
function airColor(u: number, out: THREE.Color) {
  if (u < 0.33) return out.copy(C_MOIST).lerp(C_COLD, Math.max(0, (u - 0.2) / 0.13))
  if (u < 0.43) return out.copy(C_COLD)
  if (u < 0.5) return out.copy(C_COLD).lerp(C_HOT, (u - 0.43) / 0.07)
  if (u < 0.8) return out.copy(C_HOT).lerp(C_WARM, (u - 0.5) / 0.3)
  return out.copy(C_WARM).lerp(C_MOIST, (u - 0.8) / 0.2)
}

function Airflow() {
  const N = 70
  const mesh = useRef<THREE.InstancedMesh>(null)
  const geo = useMemo(() => new THREE.SphereGeometry(0.008, 8, 6), [])
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85, depthWrite: false }), [])
  useEffect(
    () => () => {
      geo.dispose()
      mat.dispose()
    },
    [geo, mat],
  )
  const offs = useMemo(() => Array.from({ length: N }, () => [Math.random(), (Math.random() - 0.5) * 0.03, (Math.random() - 0.5) * 0.03]), [])
  const m4 = useMemo(() => new THREE.Matrix4(), [])
  const p = useMemo(() => new THREE.Vector3(), [])
  const c = useMemo(() => new THREE.Color(), [])
  const phase = useRef(0)
  useFrame(() => {
    const m = mesh.current
    if (!m) return
    const a = sim.airflow
    m.visible = a > 0.02
    if (!m.visible) return
    phase.current += sim.dt * 0.12
    for (let i = 0; i < N; i++) {
      const u = (offs[i][0] + phase.current) % 1
      AIR_PATH.getPointAt(u, p)
      p.x += offs[i][1]
      p.z += offs[i][2]
      const s = a * (0.7 + 0.5 * Math.sin(u * 40 + i))
      m4.makeScale(s, s, s).setPosition(p)
      m.setMatrixAt(i, m4)
      m.setColorAt(i, airColor(u, c))
    }
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  })
  return <instancedMesh ref={mesh} args={[geo, mat, N]} frustumCulled={false} renderOrder={3} />
}

// ---- 部品の名札（透視モード） ----
const SHORT: Record<PartId, string> = {
  drum: 'ドラム',
  tub: 'がいそう',
  motor: 'モーター',
  valve: 'きゅうすいべん',
  pump: 'はいすいポンプ',
  damper: 'ダンパー',
  dryer: 'かんそう',
  drawer: 'せんざいいれ',
}
function PartLabels() {
  const xray = useStore((s) => s.xray)
  const focus = useStore((s) => s.focus)
  const mode = useStore((s) => s.mode)
  const setFocus = useStore((s) => s.setFocus)
  if (!xray || focus || mode !== 'wash') return null
  return (
    <>
      {PART_IDS.map((id) => (
        <Html key={id} position={PARTS[id].label} center zIndexRange={[20, 0]}>
          <button className="tag3d tap" onClick={() => setFocus(id)}>
            {PARTS[id].icon} {SHORT[id]}
          </button>
        </Html>
      ))}
    </>
  )
}

// 選んだ部品をふわっと光らせる
function PartHighlighter() {
  const glow = useMemo(() => new THREE.Color('#ffd84d'), [])
  const black = useMemo(() => new THREE.Color('#000000'), [])
  const last = useRef<PartId | null>(null)
  useFrame((state) => {
    const focus = useStore.getState().focus
    if (last.current && last.current !== focus) {
      partMats.get(last.current)?.forEach((m) => {
        m.emissive.copy(black)
        m.emissiveIntensity = 1
      })
    }
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
