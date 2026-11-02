import { Html, RoundedBox } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { makeBlades } from '../geometry'
import { useFan, type FanLane, type Pitch } from '../store'

// 「どの はねが いちばん かぜが つよい？」
// ※ しくみを わかりやすく した もけい。ほんとうの 扇風機の 性能を 計算する ものでは ありません。
export const PITCH_DEG: Record<Pitch, number> = { flat: 12, mid: 28, steep: 52 }
export const PITCH_NAME: Record<Pitch, string> = { flat: 'ねかせる', mid: 'ちょうどいい', steep: 'たてる' }
export const RUN_TIME = 5

// 羽根が多い・角度が立っているほど空気は押せるが、重くなって回る速さが落ちる
export function laneModel(l: FanLane) {
  const deg = PITCH_DEG[l.pitch]
  const drag = 1 + 0.08 * l.blades * Math.pow(deg / 28, 1.5)
  const rpm = (l.strong ? 1200 : 650) / drag
  const flow = (rpm * Math.sqrt(l.blades) * Math.sin(THREE.MathUtils.degToRad(deg * 2))) / 2100
  return { rpm, flow: Math.min(1, flow) }
}
export const ramp = (t: number) => Math.min(1, t / 1.5)

export function FanExperiment() {
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    const prev = scene.background
    scene.background = new THREE.Color('#eaf6ff')
    return () => {
      scene.background = prev
    }
  }, [scene])
  const time = useRef(0)
  const hud = useRef(0)
  const expState = useFan((s) => s.expState)
  useEffect(() => {
    if (expState !== 'done') time.current = 0
  }, [expState])
  useFrame((_, delta) => {
    const st = useFan.getState()
    if (st.expState !== 'running') return
    time.current += Math.min(delta, 0.05)
    hud.current += delta
    if (hud.current > 0.15) {
      hud.current = 0
      const done = time.current >= RUN_TIME
      useFan.setState({
        expProgress: st.lanes.map((l) => laneModel(l).flow * ramp(time.current)),
        ...(done ? { expState: 'done' as const } : {}),
      })
    }
  })
  return (
    <group>
      <hemisphereLight args={['#ffffff', '#d9c4a8', 0.8]} />
      <directionalLight position={[1.5, 3, 2]} intensity={2} />
      <mesh position={[0, 1.5, -0.5]}>
        <planeGeometry args={[8, 4]} />
        <meshStandardMaterial color="#e3f3ff" />
      </mesh>
      <RoundedBox args={[1.9, 0.05, 1.1]} radius={0.02} position={[0, 0.7, 0.2]}>
        <meshStandardMaterial color="#f6d6a8" roughness={0.6} />
      </RoundedBox>
      <mesh position={[0, 0.34, 0.2]}>
        <boxGeometry args={[1.8, 0.68, 1.0]} />
        <meshStandardMaterial color="#ffffff" roughness={0.7} />
      </mesh>
      {[-0.5, 0, 0.5].map((x, i) => (
        <MiniLane key={i} index={i} x={x} timeRef={time} />
      ))}
    </group>
  )
}

const LANE_COLORS = ['#ff8db3', '#5ec8ff', '#9be37a']

function MiniLane({ index, x, timeRef }: { index: number; x: number; timeRef: { current: number } }) {
  const lane = useFan((s) => s.lanes[index])
  const expState = useFan((s) => s.expState)
  const progress = useFan((s) => s.expProgress[index])
  const bladeGeo = useMemo(() => makeBlades(lane.blades, PITCH_DEG[lane.pitch], 0.075, 0.018), [lane.blades, lane.pitch])
  useEffect(() => () => bladeGeo.dispose(), [bladeGeo])
  const bladeMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: LANE_COLORS[index], roughness: 0.2, transparent: true, opacity: 0.8, side: THREE.DoubleSide, clearcoat: 1 }), [index])
  const blurMat = useMemo(() => new THREE.MeshBasicMaterial({ color: LANE_COLORS[index], transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }), [index])
  const streamGeo = useMemo(() => new THREE.PlaneGeometry(0.02, 0.18, 1, 12), [])
  const streamMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffd84d', side: THREE.DoubleSide, roughness: 0.7 }), [])
  useEffect(() => () => [bladeMat, blurMat, streamGeo, streamMat].forEach((m) => m.dispose()), [bladeMat, blurMat, streamGeo, streamMat])
  const blades = useRef<THREE.Group>(null)
  const wheel = useRef<THREE.Group>(null)
  const ang = useRef(0)
  const wheelAng = useRef(0)
  const flowNow = useRef(0)

  useFrame((state, delta) => {
    const st = useFan.getState()
    const m = laneModel(st.lanes[index])
    const on = st.expState === 'running' || st.expState === 'done'
    const k = st.expState === 'running' ? ramp(timeRef.current) : st.expState === 'done' ? 1 : 0
    const dt = Math.min(0.05, delta)
    flowNow.current += ((on ? m.flow * k : 0) - flowNow.current) * Math.min(1, dt * 3)
    const omega = on ? Math.min(14, (m.rpm * Math.PI * 2) / 60) * k : 0
    ang.current += omega * dt
    if (blades.current) blades.current.rotation.z = ang.current
    const fast = THREE.MathUtils.smoothstep(m.rpm * k, 200, 900)
    bladeMat.opacity = 0.8 * (1 - 0.6 * fast * (on ? 1 : 0))
    blurMat.opacity = 0.35 * fast * (on ? 1 : 0)
    wheelAng.current += flowNow.current * 28 * dt
    if (wheel.current) wheel.current.rotation.z = -wheelAng.current
    // 吹き流し：風が強いほど水平に近づく
    const p = streamGeo.attributes.position as THREE.BufferAttribute
    const w = flowNow.current
    const t = state.clock.elapsedTime
    for (let i = 0; i <= 12; i++) {
      const s = i / 12
      const lift = Math.min(1, w * 1.3)
      const wav = Math.sin(t * (8 + 10 * w) - s * 8) * 0.01 * s * (0.2 + w)
      for (let side = 0; side < 2; side++) {
        p.setXYZ(i * 2 + side, (side ? 0.01 : -0.01) + wav, -(1 - lift) * s * 0.18, lift * s * 0.18)
      }
    }
    p.needsUpdate = true
    streamGeo.computeVertexNormals()
  })

  return (
    <group position={[x, 0.725, 0]}>
      {/* ミニ扇風機 */}
      <mesh position-y={0.012}>
        <cylinderGeometry args={[0.07, 0.08, 0.024, 24]} />
        <meshStandardMaterial color="#ffffff" roughness={0.4} />
      </mesh>
      <mesh position-y={0.11}>
        <cylinderGeometry args={[0.008, 0.008, 0.2, 10]} />
        <meshStandardMaterial color="#dfe8f2" metalness={0.6} roughness={0.3} />
      </mesh>
      <group position={[0, 0.23, 0]}>
        <mesh position-z={-0.04} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.035, 0.03, 0.06, 20]} />
          <meshStandardMaterial color="#ffffff" roughness={0.3} />
        </mesh>
        <group ref={blades} position-z={0.0}>
          <mesh geometry={bladeGeo} material={bladeMat} />
          <mesh rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.018, 0.016, 0.02, 16]} />
            <meshStandardMaterial color={LANE_COLORS[index]} />
          </mesh>
        </group>
        <mesh material={blurMat}>
          <ringGeometry args={[0.018, 0.075, 40]} />
        </mesh>
        <mesh>
          <torusGeometry args={[0.085, 0.003, 8, 48]} />
          <meshStandardMaterial color="#cfd8e3" metalness={0.8} roughness={0.3} />
        </mesh>
      </group>
      {/* 吹き流しのゲート */}
      <group position={[0, 0, 0.3]}>
        {[-0.06, 0.06].map((gx) => (
          <mesh key={gx} position={[gx, 0.15, 0]}>
            <cylinderGeometry args={[0.004, 0.004, 0.3, 8]} />
            <meshStandardMaterial color="#c99a5e" />
          </mesh>
        ))}
        <mesh position={[0, 0.3, 0]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.004, 0.004, 0.13, 8]} />
          <meshStandardMaterial color="#c99a5e" />
        </mesh>
        <mesh geometry={streamGeo} material={streamMat} position-y={0.3} />
      </group>
      {/* かざぐるま */}
      <group position={[0, 0, 0.5]}>
        <mesh position-y={0.11}>
          <cylinderGeometry args={[0.004, 0.004, 0.22, 8]} />
          <meshStandardMaterial color="#c99a5e" />
        </mesh>
        <group ref={wheel} position={[0, 0.23, -0.008]} rotation-y={Math.PI}>
          {['#ff6f9f', '#ffd84d', '#4fb8ff', '#6ee0a0'].map((c, i) => (
            <mesh key={i} rotation-z={(i / 4) * Math.PI * 2}>
              <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[new Float32Array([0, 0, 0, 0.055, 0.008, 0, 0.05, 0.05, 0.018]), 3]} />
              </bufferGeometry>
              <meshStandardMaterial color={c} side={THREE.DoubleSide} />
            </mesh>
          ))}
        </group>
      </group>
      <Html position={[0, 0.42, 0]} center zIndexRange={[20, 0]}>
        <div className="jar-tag">
          <b>{'①②③'[index]}</b>
          <span>🌀×{lane.blades}</span>
          <span>{lane.strong ? '💪' : '🍃'}</span>
          {expState !== 'idle' && <em>{Math.round(progress * 100)}</em>}
        </div>
      </Html>
    </group>
  )
}
