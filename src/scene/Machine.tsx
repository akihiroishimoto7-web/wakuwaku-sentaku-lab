import { RoundedBox } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { CAB_D, CAB_H, CAB_W, DOOR_GLASS_R, DOOR_R, FRONT_Z, TUB_C } from '../data'
import { registerPart } from '../partMats'
import { COURSES, COURSE_IDS, PHASES, remaining, sim } from '../sim'
import { useStore } from '../store'
import { useXrayFade } from './xray'

const isTap = (e: ThreeEvent<MouseEvent>) => e.delta < 10 && useStore.getState().mode === 'wash'

export function Machine() {
  const shell = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: '#f1f3f8', roughness: 0.28, metalness: 0.05, clearcoat: 0.7, clearcoatRoughness: 0.2 }),
    [],
  )
  const front = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.22, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.12 }),
    [],
  )
  const gasket = useMemo(() => new THREE.MeshStandardMaterial({ color: '#9aa3ad', roughness: 0.75, side: THREE.DoubleSide }), [])
  useEffect(
    () => () => {
      shell.dispose()
      front.dispose()
      gasket.dispose()
    },
    [shell, front, gasket],
  )
  useXrayFade([shell, front], 0.08)
  useXrayFade([gasket], 0.25)

  const frontGeo = useMemo(() => {
    const w = CAB_W / 2
    const r = 0.03
    const s = new THREE.Shape()
    s.moveTo(-w + r, 0.02)
    s.lineTo(w - r, 0.02)
    s.quadraticCurveTo(w, 0.02, w, 0.02 + r)
    s.lineTo(w, CAB_H - r)
    s.quadraticCurveTo(w, CAB_H, w - r, CAB_H)
    s.lineTo(-w + r, CAB_H)
    s.quadraticCurveTo(-w, CAB_H, -w, CAB_H - r)
    s.lineTo(-w, 0.02 + r)
    s.quadraticCurveTo(-w, 0.02, -w + r, 0.02)
    const hole = new THREE.Path()
    hole.absarc(0, TUB_C.y, 0.172, 0, Math.PI * 2, true)
    s.holes.push(hole)
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.016, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 3, curveSegments: 48 })
    return g
  }, [])
  useEffect(() => () => frontGeo.dispose(), [frontGeo])

  return (
    <group>
      {/* 外装 */}
      <mesh geometry={frontGeo} material={front} position-z={FRONT_Z - 0.02} />
      <mesh material={shell} position={[-CAB_W / 2 + 0.008, CAB_H / 2 + 0.01, -0.01]}>
        <boxGeometry args={[0.016, CAB_H - 0.02, CAB_D - 0.04]} />
      </mesh>
      <mesh material={shell} position={[CAB_W / 2 - 0.008, CAB_H / 2 + 0.01, -0.01]}>
        <boxGeometry args={[0.016, CAB_H - 0.02, CAB_D - 0.04]} />
      </mesh>
      <RoundedBox args={[CAB_W + 0.004, 0.026, CAB_D - 0.01]} radius={0.01} position={[0, CAB_H - 0.006, -0.005]} material={shell} />
      <mesh material={shell} position={[0, CAB_H / 2, -CAB_D / 2 + 0.005]}>
        <boxGeometry args={[CAB_W - 0.03, CAB_H - 0.02, 0.01]} />
      </mesh>
      <mesh material={shell} position={[0, 0.02, -0.01]}>
        <boxGeometry args={[CAB_W - 0.02, 0.03, CAB_D - 0.04]} />
      </mesh>
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * 0.25, 0.006, sz * 0.24]}>
            <cylinderGeometry args={[0.022, 0.026, 0.012, 16]} />
            <meshStandardMaterial color="#555b66" roughness={0.6} />
          </mesh>
        )),
      )}
      {/* フィルターのふた */}
      <RoundedBox args={[0.1, 0.07, 0.008]} radius={0.006} position={[0.17, 0.08, FRONT_Z + 0.002]}>
        <meshStandardMaterial color="#e6e9ef" roughness={0.4} />
      </RoundedBox>

      {/* ゴムのパッキン（ガスケット） */}
      <mesh material={gasket} position={[0, TUB_C.y, 0.25]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.172, 0.18, 0.09, 48, 1, true]} />
      </mesh>
      <mesh material={gasket} position={[0, TUB_C.y, FRONT_Z - 0.012]}>
        <torusGeometry args={[0.172, 0.009, 10, 48]} />
      </mesh>

      <ControlPanel />
      <Drawer />
      <Door />
    </group>
  )
}

// ---- 操作パネル ----
function ControlPanel() {
  const canvas = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 128
    return c
  }, [])
  const tex = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [canvas])
  useEffect(() => () => tex.dispose(), [tex])
  const dial = useRef<THREE.Group>(null)
  const startRing = useRef<THREE.MeshStandardMaterial>(null)
  const lockLed = useRef<THREE.MeshStandardMaterial>(null)
  const leds = useRef<(THREE.MeshStandardMaterial | null)[]>([])
  const timer = useRef(1)
  const course = useStore((s) => s.course)
  const courseIdx = course ? COURSE_IDS.indexOf(course) : -1

  useFrame((state, delta) => {
    const st = useStore.getState()
    timer.current += delta
    if (timer.current > 0.25) {
      timer.current = 0
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#0f2a33'
      ctx.fillRect(0, 0, 256, 128)
      ctx.fillStyle = '#7ff3ff'
      ctx.textAlign = 'center'
      ctx.font = '800 54px "M PLUS Rounded 1c", sans-serif'
      let big = '--:--'
      let small = 'ようこそ'
      if (st.step === 'running') {
        const r = remaining()
        big = `${Math.floor(r / 60)}:${String(Math.floor(r % 60)).padStart(2, '0')}`
        small = sim.phaseId ? PHASES[sim.phaseId].label : ''
        if (sim.phaseId === 'spin') small = `${Math.round(sim.rpm)} かい/ふん`
      } else if (st.step === 'done' || st.step === 'finished') {
        big = 'おわり'
        small = '♪ ♪ ♪'
      } else if (st.course) {
        const total = COURSES[st.course].phases.reduce((a, p) => a + p[1], 0)
        big = `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
        small = COURSES[st.course].name
      } else if (st.step === 'choose') small = 'ふくを いれてね'
      else if (st.step === 'detergent') small = 'せんざいを いれる'
      ctx.fillText(big, 128, 66)
      ctx.font = '700 30px "M PLUS Rounded 1c", sans-serif'
      ctx.fillStyle = '#c7fbff'
      ctx.fillText(small, 128, 110)
      tex.needsUpdate = true
    }
    if (dial.current) {
      const target = courseIdx >= 0 ? -(-0.75 + courseIdx * 0.5) : 0
      dial.current.rotation.z += (target - dial.current.rotation.z) * Math.min(1, delta * 8)
    }
    const t = state.clock.elapsedTime
    if (startRing.current) {
      const ready = st.step === 'course' && !!st.course
      startRing.current.emissiveIntensity = st.step === 'running' ? 1.2 : ready ? 0.8 + Math.sin(t * 6) * 0.7 : 0.15
    }
    if (lockLed.current) lockLed.current.emissiveIntensity = st.step === 'running' ? 1.5 : 0
    leds.current.forEach((m, i) => {
      if (m) m.emissiveIntensity = i === courseIdx ? 2 : 0.05
    })
  })

  const onDial = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (!isTap(e)) return
    const st = useStore.getState()
    if (st.step !== 'course') return
    const i = st.course ? COURSE_IDS.indexOf(st.course) : -1
    st.setCourse(COURSE_IDS[(i + 1) % COURSE_IDS.length])
  }
  const onStart = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (!isTap(e)) return
    useStore.getState().start()
  }

  return (
    <group position={[0, 0.775, FRONT_Z]}>
      <RoundedBox args={[0.36, 0.105, 0.012]} radius={0.01} position={[0.11, 0, 0.006]}>
        <meshPhysicalMaterial color="#26304a" roughness={0.15} clearcoat={1} metalness={0.2} />
      </RoundedBox>
      <mesh position={[0.025, 0, 0.0135]}>
        <planeGeometry args={[0.125, 0.0625]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      <mesh position={[0.098, 0.03, 0.014]}>
        <circleGeometry args={[0.005, 12]} />
        <meshStandardMaterial ref={lockLed} color="#ffb84d" emissive="#ff9a1f" emissiveIntensity={0} />
      </mesh>
      {/* コースダイヤル */}
      <group position={[0.165, -0.004, 0.014]} onClick={onDial}>
        {COURSE_IDS.map((c, i) => {
          const a = Math.PI / 2 + 0.75 - i * 0.5
          return (
            <mesh key={c} position={[Math.cos(a) * 0.042, Math.sin(a) * 0.042, 0]}>
              <circleGeometry args={[0.0045, 12]} />
              <meshStandardMaterial ref={(m) => void (leds.current[i] = m)} color="#9ff7ff" emissive="#52e7ff" emissiveIntensity={0.05} />
            </mesh>
          )
        })}
        <group ref={dial}>
          <mesh rotation-x={Math.PI / 2} position-z={0.008}>
            <cylinderGeometry args={[0.03, 0.032, 0.016, 40]} />
            <meshStandardMaterial color="#dfe5ee" metalness={0.85} roughness={0.25} />
          </mesh>
          <mesh position={[0, 0.019, 0.0165]}>
            <boxGeometry args={[0.005, 0.016, 0.002]} />
            <meshStandardMaterial color="#ff6f9f" emissive="#ff3f7f" emissiveIntensity={0.6} />
          </mesh>
        </group>
      </group>
      {/* スタートボタン */}
      <group position={[0.245, 0, 0.014]} onClick={onStart}>
        <mesh rotation-x={Math.PI / 2} position-z={0.006}>
          <cylinderGeometry args={[0.02, 0.021, 0.012, 32]} />
          <meshPhysicalMaterial color="#ffffff" roughness={0.2} clearcoat={1} />
        </mesh>
        <mesh position-z={0.0125}>
          <ringGeometry args={[0.009, 0.012, 3, 1]} />
          <meshBasicMaterial color="#3ac47d" />
        </mesh>
        <mesh position-z={0.001}>
          <ringGeometry args={[0.021, 0.026, 40]} />
          <meshStandardMaterial ref={startRing} color="#5dffb0" emissive="#22e38a" emissiveIntensity={0.2} />
        </mesh>
      </group>
    </group>
  )
}

// ---- 洗剤投入口（引き出し）と洗剤ボトルの演出 ----
function Drawer() {
  const slide = useRef<THREE.Group>(null)
  const bottle = useRef<THREE.Group>(null)
  const stream = useRef<THREE.Mesh>(null)
  const liquid = useRef<THREE.Mesh>(null)
  const done = useRef(false)
  const trayMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#eef3f8', roughness: 0.4 }), [])
  useEffect(() => {
    const un = registerPart('drawer', trayMat)
    return () => {
      un()
      trayMat.dispose()
    }
  }, [trayMat])

  useFrame(() => {
    const st = useStore.getState()
    let s = 0
    let tilt = 0
    let bScale = 0
    let pouring = false
    if (st.pourStart) {
      const e = (performance.now() - st.pourStart) / 1000
      s = e < 0.4 ? e / 0.4 : e < 2.2 ? 1 : Math.max(0, 1 - (e - 2.2) / 0.4)
      bScale = e < 0.3 ? 0 : e < 0.6 ? (e - 0.3) / 0.3 : e < 2.0 ? 1 : Math.max(0, 1 - (e - 2.0) / 0.25)
      tilt = e < 0.6 ? 0 : e < 0.9 ? ((e - 0.6) / 0.3) * 2.1 : e < 1.9 ? 2.1 : Math.max(0, 2.1 - ((e - 1.9) / 0.3) * 2.1)
      pouring = e > 0.85 && e < 1.9
      if (pouring) sim.drawer = Math.min(1, (e - 0.85) / 1.0)
      if (e > 2.65 && !done.current) {
        done.current = true
        st.finishPour()
      }
    } else done.current = false
    if (slide.current) slide.current.position.z = s * 0.15
    if (bottle.current) {
      bottle.current.scale.setScalar(Math.max(0.001, bScale))
      bottle.current.rotation.z = tilt
    }
    if (stream.current) stream.current.visible = pouring
    if (liquid.current) {
      liquid.current.visible = sim.drawer > 0.01
      liquid.current.scale.y = Math.max(0.01, sim.drawer)
      liquid.current.position.y = -0.025 + sim.drawer * 0.012
    }
  })

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (!isTap(e)) return
    const st = useStore.getState()
    if (st.xray) {
      st.setFocus('drawer')
      return
    }
    st.pourDetergent()
  }

  return (
    <group position={[-0.175, 0.775, FRONT_Z]}>
      <group ref={slide} onClick={onClick}>
        <RoundedBox args={[0.18, 0.085, 0.016]} radius={0.008} position-z={0.008}>
          <meshPhysicalMaterial color="#ffffff" roughness={0.25} clearcoat={1} />
        </RoundedBox>
        <RoundedBox args={[0.09, 0.014, 0.006]} radius={0.004} position={[0, -0.022, 0.018]}>
          <meshStandardMaterial color="#cfd6df" roughness={0.3} metalness={0.4} />
        </RoundedBox>
        <mesh position={[-0.055, 0.018, 0.017]}>
          <circleGeometry args={[0.012, 20]} />
          <meshStandardMaterial color="#5ec8ff" emissive="#5ec8ff" emissiveIntensity={0.3} />
        </mesh>
        {/* トレイ */}
        <mesh material={trayMat} position={[0, -0.033, -0.08]}>
          <boxGeometry args={[0.16, 0.006, 0.15]} />
        </mesh>
        {[-0.078, 0.078].map((x) => (
          <mesh key={x} material={trayMat} position={[x, -0.012, -0.08]}>
            <boxGeometry args={[0.005, 0.045, 0.15]} />
          </mesh>
        ))}
        <mesh material={trayMat} position={[0, -0.012, -0.155]}>
          <boxGeometry args={[0.16, 0.045, 0.005]} />
        </mesh>
        <mesh ref={liquid} position={[0, -0.025, -0.08]}>
          <boxGeometry args={[0.15, 0.02, 0.14]} />
          <meshPhysicalMaterial color="#39a9ff" roughness={0.1} transparent opacity={0.8} clearcoat={1} />
        </mesh>
      </group>
      {/* ボトル */}
      <group position={[0.07, 0.17, 0.07]}>
        <group ref={bottle} scale={0.001}>
          <RoundedBox args={[0.07, 0.13, 0.05]} radius={0.015} position={[0.02, 0.0, 0]}>
            <meshPhysicalMaterial color="#5ec8ff" roughness={0.15} clearcoat={1} />
          </RoundedBox>
          <mesh position={[0.02, 0.0, 0.026]}>
            <circleGeometry args={[0.02, 20]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          <mesh position={[0.02, 0.08, 0]}>
            <cylinderGeometry args={[0.012, 0.016, 0.03, 12]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
        </group>
      </group>
      <mesh ref={stream} position={[-0.009, 0.063, 0.07]} visible={false}>
        <cylinderGeometry args={[0.005, 0.008, 0.17, 8]} />
        <meshPhysicalMaterial color="#39a9ff" roughness={0.05} transparent opacity={0.85} />
      </mesh>
    </group>
  )
}

// ---- 扉 ----
function Door() {
  const hinge = useRef<THREE.Group>(null)
  const ringGeo = useMemo(() => {
    const pts = [
      new THREE.Vector2(DOOR_GLASS_R, -0.004),
      new THREE.Vector2(DOOR_GLASS_R + 0.004, 0.012),
      new THREE.Vector2(0.165, 0.022),
      new THREE.Vector2(DOOR_R - 0.006, 0.02),
      new THREE.Vector2(DOOR_R, 0.008),
      new THREE.Vector2(DOOR_R - 0.004, -0.006),
      new THREE.Vector2(DOOR_GLASS_R, -0.004),
    ]
    return new THREE.LatheGeometry(pts, 72)
  }, [])
  const capR = 0.32
  const capTheta = Math.asin(DOOR_GLASS_R / capR)
  useEffect(() => () => ringGeo.dispose(), [ringGeo])

  useFrame((_, delta) => {
    const open = useStore.getState().doorOpen
    if (hinge.current) {
      const target = open ? -1.95 : 0
      hinge.current.rotation.y += (target - hinge.current.rotation.y) * Math.min(1, delta * 5)
    }
  })

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (!isTap(e)) return
    const st = useStore.getState()
    if (st.step === 'intro' || st.step === 'done') st.openDoor()
    else if (st.step === 'choose' && st.doorOpen) st.closeDoor()
  }

  return (
    <group ref={hinge} position={[-DOOR_R, TUB_C.y, FRONT_Z + 0.006]}>
      <group position-x={DOOR_R} onClick={onClick}>
        <mesh geometry={ringGeo} rotation-x={Math.PI / 2}>
          <meshPhysicalMaterial color="#f4f6fa" roughness={0.2} clearcoat={1} metalness={0.1} />
        </mesh>
        <mesh position-z={0.012}>
          <torusGeometry args={[DOOR_GLASS_R + 0.004, 0.006, 12, 72]} />
          <meshStandardMaterial color="#e8edf3" metalness={1} roughness={0.15} />
        </mesh>
        <mesh position-z={0.022}>
          <torusGeometry args={[0.172, 0.004, 10, 72]} />
          <meshStandardMaterial color="#d7dee8" metalness={1} roughness={0.2} />
        </mesh>
        {/* ガラス（内側にふくらむボウル形） */}
        <mesh rotation-x={-Math.PI / 2} position-z={capR * Math.cos(capTheta)} renderOrder={5}>
          <sphereGeometry args={[capR, 48, 12, 0, Math.PI * 2, 0, capTheta]} />
          <meshPhysicalMaterial color="#bfe0ff" roughness={0.04} metalness={0} clearcoat={1} transparent opacity={0.13} depthWrite={false} side={THREE.DoubleSide} envMapIntensity={1.6} />
        </mesh>
        <mesh position-z={0.004} renderOrder={6}>
          <circleGeometry args={[DOOR_GLASS_R + 0.002, 64]} />
          <meshPhysicalMaterial color="#d8eeff" roughness={0.02} clearcoat={1} transparent opacity={0.06} depthWrite={false} envMapIntensity={2} />
        </mesh>
        {/* 取っ手 */}
        <RoundedBox args={[0.026, 0.1, 0.03]} radius={0.01} position={[DOOR_R - 0.01, 0, 0.02]}>
          <meshStandardMaterial color="#cfd7e2" metalness={0.9} roughness={0.2} />
        </RoundedBox>
      </group>
    </group>
  )
}
