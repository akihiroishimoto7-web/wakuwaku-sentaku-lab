import { Html, RoundedBox } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { makeClothMaterial } from '../clothMaterial'
import { useStore, type ExpLane } from '../store'

// 「どの洗い方がきれいになる？」実験モード
// ※ 原理を理解するための教育モデル。実際の洗浄性能を予測するものではありません。

export const EXP_SHORT = 3
export const EXP_LONG = 6

export function laneDirt(l: ExpLane, t: number) {
  const tau = Math.min(t, l.long ? EXP_LONG : EXP_SHORT)
  const rot = l.rot ? 1 : 0
  const det = l.det ? 1 : 0
  const km = 0.15 + 0.35 * rot + 0.15 * det
  const ko = 0.03 + det * (0.25 + 0.35 * rot)
  return { mud: Math.exp(-km * tau), oil: Math.exp(-ko * tau) }
}
export const laneClean = (l: ExpLane, t: number) => {
  const d = laneDirt(l, t)
  return 1 - 0.5 * d.mud - 0.5 * d.oil
}

const MARKS = ['①', '②', '③', '④']

export function ExperimentScene() {
  const scene = useThree((s) => s.scene)
  const size = useThree((s) => s.size)
  const portrait = size.width < size.height
  useEffect(() => {
    const prev = scene.background
    scene.background = new THREE.Color('#eaf6ff')
    return () => {
      scene.background = prev
    }
  }, [scene])

  const expT = useRef(0)
  const hudT = useRef(0)
  const expState = useStore((s) => s.expState)
  useEffect(() => {
    if (expState === 'running') expT.current = 0
    if (expState === 'idle') expT.current = 0
  }, [expState])

  useFrame((_, delta) => {
    const st = useStore.getState()
    if (st.expState === 'running') {
      expT.current += Math.min(delta, 0.05)
      hudT.current += delta
      if (hudT.current > 0.15 || expT.current > EXP_LONG + 0.3) {
        hudT.current = 0
        const done = expT.current > EXP_LONG + 0.3
        useStore.setState({
          expProgress: st.expLanes.map((l) => laneClean(l, expT.current)),
          ...(done ? { expState: 'done' as const } : {}),
        })
      }
    }
  })

  const positions: [number, number, number][] = portrait
    ? [
        [-0.27, 1.37, 0],
        [0.27, 1.37, 0],
        [-0.27, 0.92, 0],
        [0.27, 0.92, 0],
      ]
    : [
        [-0.81, 0.92, 0],
        [-0.27, 0.92, 0],
        [0.27, 0.92, 0],
        [0.81, 0.92, 0],
      ]

  return (
    <group>
      <hemisphereLight args={['#ffffff', '#d9c4a8', 0.8]} />
      <directionalLight position={[2, 4, 3]} intensity={2} />
      {/* 背景の壁と机 */}
      <mesh position={[0, 1.5, -0.6]}>
        <planeGeometry args={[8, 4]} />
        <meshStandardMaterial color="#dff1ff" />
      </mesh>
      {Array.from({ length: 9 }).map((_, i) => (
        <mesh key={i} position={[-2 + i * 0.5, 1.6, -0.59]}>
          <circleGeometry args={[0.04, 16]} />
          <meshStandardMaterial color={['#ffd1e1', '#fff1b3', '#c9f2d9'][i % 3]} />
        </mesh>
      ))}
      <RoundedBox args={[portrait ? 1.3 : 2.4, 0.06, 0.8]} radius={0.02} position={[0, 0.72, 0.05]}>
        <meshStandardMaterial color="#f6d6a8" roughness={0.6} />
      </RoundedBox>
      <mesh position={[0, 0.35, 0.05]}>
        <boxGeometry args={[portrait ? 1.2 : 2.3, 0.7, 0.7]} />
        <meshStandardMaterial color="#ffffff" roughness={0.7} />
      </mesh>
      {portrait && (
        <RoundedBox args={[1.2, 0.04, 0.5]} radius={0.015} position={[0, 1.165, -0.05]}>
          <meshStandardMaterial color="#cfe8ff" roughness={0.5} />
        </RoundedBox>
      )}
      {positions.map((p, i) => (
        <Jar key={i} index={i} position={p} timeRef={expT} />
      ))}
    </group>
  )
}

function Jar({ index, position, timeRef }: { index: number; position: [number, number, number]; timeRef: { current: number } }) {
  const drum = useRef<THREE.Group>(null)
  const swatch = useRef<THREE.Mesh>(null)
  const foam = useRef<THREE.Group>(null)
  const { mat, uniforms } = useMemo(() => makeClothMaterial('#ffffff', 5, 3.3, [0.16, 0.16]), [])
  const swGeo = useMemo(() => new THREE.PlaneGeometry(0.16, 0.16, 14, 14), [])
  const waterMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#7fd0ff', transparent: true, opacity: 0.5, roughness: 0.1, depthWrite: false }), [])
  useEffect(
    () => () => {
      mat.dispose()
      swGeo.dispose()
      waterMat.dispose()
    },
    [mat, swGeo, waterMat],
  )
  const lane = useStore((s) => s.expLanes[index])
  const clean = useStore((s) => s.expProgress[index])
  const expState = useStore((s) => s.expState)
  const clear = useMemo(() => new THREE.Color('#7fd0ff'), [])
  const dirty = useMemo(() => new THREE.Color('#a48a5c'), [])
  const ang = useRef(0)

  useFrame((state, delta) => {
    const st = useStore.getState()
    const running = st.expState === 'running'
    const t = st.expState === 'idle' ? 0 : timeRef.current
    const l = st.expLanes[index]
    const active = running && t < (l.long ? EXP_LONG : EXP_SHORT)
    const d = laneDirt(l, t)
    uniforms.uMud.value = d.mud
    uniforms.uOil.value = d.oil
    uniforms.uWet.value = st.expState === 'idle' ? 0.2 : 0.7
    uniforms.uTime.value = state.clock.elapsedTime
    const removed = 2 - d.mud - d.oil
    waterMat.color.copy(clear).lerp(dirty, Math.min(0.8, removed * 0.45))
    const spin = active && l.rot
    ang.current += (spin ? 5.5 : 0) * Math.min(delta, 0.05)
    if (drum.current) drum.current.rotation.z = ang.current
    if (swatch.current) {
      const time = state.clock.elapsedTime
      if (spin) {
        const ph = ang.current
        swatch.current.position.set(Math.sin(ph) * 0.05, -0.04 + Math.abs(Math.sin(ph * 0.5)) * 0.07, 0)
        swatch.current.rotation.set(Math.sin(time * 2) * 0.4, Math.cos(time * 1.7) * 0.4, ph)
        uniforms.uFlutter.value = 1
        uniforms.uBend.value = Math.sin(time * 3) * 3
      } else {
        swatch.current.position.set(0, -0.06 + Math.sin(time * 1.5 + index) * 0.004, 0)
        swatch.current.rotation.set(-0.3, 0, Math.sin(time + index) * 0.05)
        uniforms.uFlutter.value = active ? 0.4 : 0.15
        uniforms.uBend.value = 1.5
      }
    }
    if (foam.current) {
      foam.current.visible = l.det && st.expState !== 'idle'
      foam.current.children.forEach((c, i) => {
        c.position.y = 0.002 + Math.sin(state.clock.elapsedTime * 2 + i) * 0.004
      })
    }
  })

  const R = 0.16
  const L = 0.2
  return (
    <group position={position}>
      {/* 台 */}
      <RoundedBox args={[0.3, 0.05, 0.24]} radius={0.015} position={[0, -R - 0.03, 0]}>
        <meshStandardMaterial color={['#ff8fb3', '#5ec8ff', '#9be37a', '#ffc93c'][index]} roughness={0.5} />
      </RoundedBox>
      {/* ドラム（回転） */}
      <group ref={drum}>
        <mesh rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[R, R, L, 40, 1, true]} />
          <meshStandardMaterial color="#dfe8f2" metalness={0.6} roughness={0.3} side={THREE.BackSide} />
        </mesh>
        {[0, 1, 2].map((k) => {
          const a = (k / 3) * Math.PI * 2
          return (
            <mesh key={k} position={[Math.cos(a) * (R - 0.015), Math.sin(a) * (R - 0.015), 0]} rotation-z={a}>
              <boxGeometry args={[0.03, 0.02, L * 0.9]} />
              <meshStandardMaterial color="#c3ccd8" metalness={0.7} roughness={0.3} />
            </mesh>
          )
        })}
        <mesh position-z={-L / 2}>
          <circleGeometry args={[R, 40]} />
          <meshStandardMaterial color="#cfd8e3" metalness={0.5} roughness={0.35} />
        </mesh>
      </group>
      {/* 水（下半分） */}
      <mesh rotation-x={Math.PI / 2} material={waterMat} renderOrder={1}>
        <cylinderGeometry args={[R - 0.004, R - 0.004, L - 0.01, 32, 1, false, -Math.PI / 2, Math.PI]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} material={waterMat} renderOrder={1}>
        <planeGeometry args={[2 * R - 0.01, L - 0.01]} />
      </mesh>
      <group ref={foam}>
        {Array.from({ length: 10 }).map((_, i) => (
          <mesh key={i} position={[((i * 0.37) % 1) * 0.26 - 0.13, 0, ((i * 0.61) % 1) * 0.16 - 0.08]}>
            <sphereGeometry args={[0.012 + (i % 3) * 0.006, 8, 6]} />
            <meshStandardMaterial color="#ffffff" roughness={0.2} />
          </mesh>
        ))}
      </group>
      <mesh ref={swatch} geometry={swGeo} material={mat} />
      {/* ガラスのふた */}
      <mesh position-z={L / 2} renderOrder={3}>
        <circleGeometry args={[R, 40]} />
        <meshPhysicalMaterial color="#e6f6ff" transparent opacity={0.15} roughness={0.02} clearcoat={1} depthWrite={false} />
      </mesh>
      <mesh position-z={L / 2}>
        <torusGeometry args={[R, 0.012, 10, 48]} />
        <meshStandardMaterial color="#ffffff" roughness={0.3} />
      </mesh>
      <Html position={[0, R + 0.06, 0]} center zIndexRange={[20, 0]}>
        <div className="jar-tag">
          <b>{MARKS[index]}</b>
          <span>{lane.det ? '🧴' : '💧'}</span>
          <span>{lane.rot ? '🔄' : '⏸️'}</span>
          <span>{lane.long ? '⏱️⏱️' : '⏱️'}</span>
          {expState !== 'idle' && <em>{Math.round(clean * 100)}%</em>}
        </div>
      </Html>
    </group>
  )
}
