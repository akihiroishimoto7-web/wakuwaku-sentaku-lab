import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { ARM_ELBOW, ARM_WRIST, CHIME_POS, PINWHEEL_POS } from '../data'
import { fan, windAt } from '../sim'
import { fanSound } from '../sound'
import { useFan } from '../store'
import { award } from '../../stamps'

// 風に反応する小物：かざぐるま・風鈴・（たんけん用の）はだ
export function Props() {
  return (
    <>
      <Pinwheel />
      <WindChime />
      <Skin />
    </>
  )
}

export const propWind = { pinwheel: 0, chime: 0 }

function Pinwheel() {
  const head = useRef<THREE.Group>(null)
  const spin = useRef(0)
  const vel = useRef(0)
  const petals = useMemo(() => {
    const colors = ['#ff6f9f', '#ffd84d', '#4fb8ff', '#6ee0a0']
    return colors.map((c, i) => {
      // 正方形の紙を折ったような三角の羽根
      const g = new THREE.BufferGeometry()
      const v = new Float32Array([0, 0, 0, 0.075, 0.01, 0.0, 0.07, 0.07, 0.025])
      g.setAttribute('position', new THREE.BufferAttribute(v, 3))
      g.computeVertexNormals()
      return { g, m: new THREE.MeshStandardMaterial({ color: c, side: THREE.DoubleSide, roughness: 0.6 }), a: (i / 4) * Math.PI * 2 }
    })
  }, [])
  useEffect(
    () => () =>
      petals.forEach((p) => {
        p.g.dispose()
        p.m.dispose()
      }),
    [petals],
  )
  useFrame(() => {
    const w = windAt(PINWHEEL_POS)
    propWind.pinwheel = w
    vel.current += (w * 26 - vel.current) * Math.min(1, fan.dt * 1.5)
    spin.current += vel.current * fan.dt
    if (head.current) head.current.rotation.z = -spin.current
  })
  return (
    <group position={[PINWHEEL_POS.x, 0, PINWHEEL_POS.z]}>
      <mesh position-y={PINWHEEL_POS.y / 2}>
        <cylinderGeometry args={[0.006, 0.006, PINWHEEL_POS.y, 10]} />
        <meshStandardMaterial color="#e9c48a" roughness={0.8} />
      </mesh>
      <mesh position-y={0.01}>
        <cylinderGeometry args={[0.06, 0.07, 0.02, 24]} />
        <meshStandardMaterial color="#c99a5e" roughness={0.7} />
      </mesh>
      {/* 風が来る扇風機のほうを向く */}
      <group position-y={PINWHEEL_POS.y} rotation-y={Math.atan2(-PINWHEEL_POS.x, -PINWHEEL_POS.z)}>
        <group ref={head} position-z={0.01}>
          {petals.map((p, i) => (
            <mesh key={i} geometry={p.g} material={p.m} rotation-z={p.a} />
          ))}
          <mesh position-z={0.012}>
            <sphereGeometry args={[0.008, 10, 8]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
        </group>
      </group>
    </group>
  )
}

function WindChime() {
  const bell = useRef<THREE.Group>(null)
  const strip = useRef<THREE.Group>(null)
  const ang = useRef(0)
  const vel = useRef(0)
  const cooldown = useRef(0)
  const glass = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: '#dff4ff', roughness: 0.05, transparent: true, opacity: 0.55, clearcoat: 1, side: THREE.DoubleSide }),
    [],
  )
  const pattern = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 128
    c.height = 64
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, 128, 64)
    ctx.fillStyle = '#ff6f9f'
    for (let i = 0; i < 6; i++) {
      ctx.beginPath()
      ctx.arc(10 + i * 22, 38, 7, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = '#4fb8ff'
    ctx.fillRect(0, 54, 128, 6)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.wrapS = THREE.RepeatWrapping
    return t
  }, [])
  useEffect(
    () => () => {
      glass.dispose()
      pattern.dispose()
    },
    [glass, pattern],
  )
  useFrame((state) => {
    const dt = fan.dt
    const w = windAt(CHIME_POS)
    propWind.chime = w
    const t = state.clock.elapsedTime
    // ふり子：風で押され、少しずつおさまる
    const force = w * (1.6 + Math.sin(t * 3.1) * 0.9 + Math.sin(t * 7.3) * 0.5)
    vel.current += (force - ang.current * 9 - vel.current * 1.4) * dt
    ang.current += vel.current * dt
    if (strip.current) strip.current.rotation.x = ang.current * 2.2
    if (bell.current) bell.current.rotation.x = ang.current * 0.25
    cooldown.current -= dt
    if (Math.abs(vel.current) > 0.25 && cooldown.current <= 0 && Math.random() < 0.08 + w * 0.2) {
      cooldown.current = 0.5 + Math.random() * 0.8
      const inTour = useFan.getState().tour
      if (!inTour || w > 0.05) fanSound.chime(Math.abs(vel.current))
      if (!inTour && w > 0.05) award('fan_chime')
    }
  })
  return (
    <group>
      {/* 風鈴スタンド */}
      <group position={[CHIME_POS.x, 0, CHIME_POS.z]}>
        <mesh position-y={0.62}>
          <cylinderGeometry args={[0.008, 0.009, 1.24, 10]} />
          <meshStandardMaterial color="#a4743f" roughness={0.7} />
        </mesh>
        <mesh position={[0.06, 1.22, 0]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.006, 0.006, 0.14, 8]} />
          <meshStandardMaterial color="#a4743f" roughness={0.7} />
        </mesh>
        <mesh position-y={0.01}>
          <cylinderGeometry args={[0.08, 0.09, 0.02, 24]} />
          <meshStandardMaterial color="#8a5e30" roughness={0.7} />
        </mesh>
      </group>
      <group position={[CHIME_POS.x + 0.1, 1.2, CHIME_POS.z]}>
        <mesh position-y={-0.025}>
          <cylinderGeometry args={[0.0008, 0.0008, 0.05, 4]} />
          <meshBasicMaterial color="#888" />
        </mesh>
        <group ref={bell} position-y={-0.05}>
          <mesh material={glass} position-y={-0.025}>
            <sphereGeometry args={[0.032, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
          </mesh>
          <mesh position-y={-0.012}>
            <sphereGeometry args={[0.033, 24, 6, 0, Math.PI * 2, Math.PI * 0.32, Math.PI * 0.12]} />
            <meshStandardMaterial map={pattern} side={THREE.DoubleSide} transparent opacity={0.9} />
          </mesh>
          {/* 舌（ぜつ）と短冊 */}
          <group ref={strip} position-y={-0.035}>
            <mesh position-y={-0.02}>
              <cylinderGeometry args={[0.0007, 0.0007, 0.04, 4]} />
              <meshBasicMaterial color="#888" />
            </mesh>
            <mesh position-y={-0.04}>
              <sphereGeometry args={[0.004, 8, 6]} />
              <meshStandardMaterial color="#c0c8d4" metalness={0.8} roughness={0.3} />
            </mesh>
            <mesh position-y={-0.1}>
              <planeGeometry args={[0.035, 0.11]} />
              <meshStandardMaterial color="#ffe08a" side={THREE.DoubleSide} roughness={0.8} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  )
}

// たんけんの「はだで すずしい」章だけに出る「きみの うで」（イメージ）
// あせの つぶが かぜで かわいて ゆげに なり、うでの ほてりが すっと ひいていく
export const skinState = { show: 0, cool: 0 }
const ARM_R = 0.034
function Skin() {
  const group = useRef<THREE.Group>(null)
  const drops = useRef<THREE.InstancedMesh>(null)
  const steam = useRef<THREE.InstancedMesh>(null)
  const sparks = useRef<THREE.InstancedMesh>(null)
  // ひじ → てくびを z じくに した ローカルの むき
  const frame = useMemo(() => {
    const z = ARM_WRIST.clone().sub(ARM_ELBOW)
    const len = z.length()
    z.normalize()
    const x = new THREE.Vector3(0, 1, 0).cross(z).normalize()
    const y = z.clone().cross(x)
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z))
    return { q, len }
  }, [])
  const skinMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffcfb0', roughness: 0.55, emissive: '#ff5a3c', emissiveIntensity: 0.3 }), [])
  const sleeveMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#7cc8ff', roughness: 0.8 }), [])
  const armGeo = useMemo(() => new THREE.CapsuleGeometry(ARM_R, frame.len, 6, 20).rotateX(Math.PI / 2), [frame.len])
  const palmGeo = useMemo(() => new THREE.SphereGeometry(0.04, 20, 14), [])
  const fingerGeo = useMemo(() => new THREE.CapsuleGeometry(0.0095, 0.034, 4, 10).rotateX(Math.PI / 2), [])
  const sleeveGeo = useMemo(() => new THREE.CylinderGeometry(ARM_R * 1.45, ARM_R * 1.6, 0.09, 24, 1, true).rotateX(Math.PI / 2), [])
  const dropGeo = useMemo(() => new THREE.SphereGeometry(0.0075, 12, 8), [])
  const dropMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: '#bfe8ff', roughness: 0.02, transparent: true, opacity: 0.9, clearcoat: 1 }), [])
  const steamMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false }), [])
  const sparkGeo = useMemo(() => new THREE.OctahedronGeometry(0.006, 0), [])
  const sparkMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#7fdcff', transparent: true, opacity: 0.9, depthWrite: false }), [])
  useEffect(
    () => () => {
      ;[skinMat, sleeveMat, armGeo, palmGeo, fingerGeo, sleeveGeo, dropGeo, dropMat, steamMat, sparkGeo, sparkMat].forEach((x) => x.dispose())
    },
    [skinMat, sleeveMat, armGeo, palmGeo, fingerGeo, sleeveGeo, dropGeo, dropMat, steamMat, sparkGeo, sparkMat],
  )
  // あせの つぶ：うでの うえがわと てのこうに ならべる [x, y, z, かわく はやさ]
  const seeds = useMemo(() => {
    const out: [number, number, number, number][] = []
    for (let i = 0; i < 16; i++) {
      const onHand = i >= 12
      const a = ((i * 0.37) % 1) * 1.6 - 0.8
      const z = onHand ? 0.02 + ((i * 0.29) % 1) * 0.05 : -frame.len + 0.05 + ((i * 0.61) % 1) * (frame.len - 0.06)
      const r = onHand ? 0.019 : ARM_R
      out.push([Math.sin(a) * r * (onHand ? 1.6 : 1), Math.cos(a) * r, z, 0.7 + ((i * 0.43) % 1) * 0.6])
    }
    return out
  }, [frame.len])
  const m4 = useMemo(() => new THREE.Matrix4(), [])
  const warm = useMemo(() => new THREE.Color('#ffcfb0'), [])
  const coolC = useMemo(() => new THREE.Color('#ffe6d8'), [])
  useFrame((state) => {
    const g = group.current
    if (!g) return
    g.visible = skinState.show > 0.01
    if (!g.visible) return
    g.scale.setScalar(Math.max(0.001, skinState.show))
    const c = skinState.cool
    skinMat.emissiveIntensity = 0.32 * (1 - c)
    skinMat.color.copy(warm).lerp(coolC, c)
    const t = state.clock.elapsedTime
    if (drops.current && steam.current && sparks.current) {
      seeds.forEach((sd, i) => {
        const left = Math.max(0, 1 - c * sd[3] * 1.35)
        m4.makeScale(left, left * 0.75, left).setPosition(sd[0], sd[1] + 0.003, sd[2])
        drops.current!.setMatrixAt(i, m4)
        // ゆげ：かわいた ぶんだけ うえへ のぼって きえる（かぜに ながされて ひじの ほうへ）
        const k = (t * 0.7 + i * 0.13) % 1
        const sc = c > 0.04 && left < 0.98 ? (1 - k) * 0.95 * Math.min(1, c * 2.5) : 0
        m4.makeScale(sc, sc, sc).setPosition(sd[0] + Math.sin(t * 2 + i) * 0.006, sd[1] + 0.012 + k * 0.07, sd[2] - k * 0.05)
        steam.current!.setMatrixAt(i, m4)
        // すずしい きらきら
        const a = i * 2.4 + t * 0.8
        const tw = Math.max(0, Math.sin(t * 5 + i * 1.7)) * Math.min(1, Math.max(0, c * 1.6 - 0.2))
        m4.makeScale(tw, tw, tw).setPosition(Math.cos(a) * 0.06, 0.035 + Math.sin(a * 1.3) * 0.025, sd[2] * 0.8)
        sparks.current!.setMatrixAt(i, m4)
      })
      drops.current.instanceMatrix.needsUpdate = true
      steam.current.instanceMatrix.needsUpdate = true
      sparks.current.instanceMatrix.needsUpdate = true
    }
  })
  return (
    <group ref={group} position={ARM_WRIST} quaternion={frame.q} visible={false}>
      {/* うで（ひじ → てくび） */}
      <mesh geometry={armGeo} material={skinMat} position-z={-frame.len / 2} />
      {/* そで */}
      <mesh geometry={sleeveGeo} material={sleeveMat} position-z={-frame.len + 0.02} />
      {/* て：てのひら・ゆび・おやゆび */}
      <group position={[0, -0.004, 0.035]} rotation-x={0.12}>
        <mesh geometry={palmGeo} material={skinMat} scale={[0.95, 0.42, 1.05]} />
        {[-0.024, -0.008, 0.008, 0.024].map((x, i) => (
          <mesh key={x} geometry={fingerGeo} material={skinMat} position={[x, -0.002, 0.052 + (i === 1 || i === 2 ? 0.006 : 0)]} />
        ))}
        <mesh geometry={fingerGeo} material={skinMat} position={[-0.04, -0.004, 0.012]} rotation-y={-0.9} />
      </group>
      <instancedMesh ref={drops} args={[dropGeo, dropMat, 16]} frustumCulled={false} />
      <instancedMesh ref={steam} args={[dropGeo, steamMat, 16]} frustumCulled={false} />
      <instancedMesh ref={sparks} args={[sparkGeo, sparkMat, 16]} frustumCulled={false} />
    </group>
  )
}
