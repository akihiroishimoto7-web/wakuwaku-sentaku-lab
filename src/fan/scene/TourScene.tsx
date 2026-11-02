import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { speak, stopSpeech } from '../../speech'
import { softDotTexture } from '../../textures'
import { fanSound } from '../sound'
import { useFan } from '../store'
import { FAN_CHAPTERS, fanMapProgress, fanTour } from '../tour'
import { skinState } from './Props'

// 扇風機のたんけん：カメラを道にそって動かし、案内役（でんきの つぶ → かぜの つぶ）が進む
export function FanTourScene() {
  const on = useFan((s) => s.tour && s.mode === 'play')
  return on ? <Inner /> : null
}

const easeU = (u: number) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2)

function Inner() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const controls = useThree((s) => s.controls) as unknown as OrbitControlsImpl | null
  const ch = useFan((s) => s.tourCh)
  const muted = useFan((s) => s.muted)
  const guide = useRef<THREE.Group>(null)
  const spark = useRef<THREE.Group>(null)
  const puff = useRef<THREE.Group>(null)
  const v = useMemo(
    () => ({ pos: new THREE.Vector3(), look: new THREE.Vector3(), cur: new THREE.Vector3(), fromPos: new THREE.Vector3(), fromLook: new THREE.Vector3(), fwd: new THREE.Vector3(), up: new THREE.Vector3(), right: new THREE.Vector3(), lab: new THREE.Vector3() }),
    [],
  )
  const last = useRef(-1)
  const blend = useRef(0)
  const since = useRef(0)
  const tick = useRef(0)
  const fx = useRef<HTMLElement | null>(null)

  useEffect(() => {
    camera.near = 0.005
    camera.updateProjectionMatrix()
    return () => {
      camera.near = 0.02
      camera.updateProjectionMatrix()
      skinState.show = 0
      skinState.cool = 0
      if (controls) controls.enabled = true
      stopSpeech()
    }
  }, [camera, controls])
  useEffect(() => {
    if (muted) stopSpeech()
  }, [muted])

  useFrame((state, delta) => {
    if (!controls) return
    const c = FAN_CHAPTERS[fanTour.ch]
    if (fanTour.ch !== last.current) {
      last.current = fanTour.ch
      v.fromPos.copy(camera.position)
      v.fromLook.copy(controls.target)
      blend.current = 0
      since.current = 0
      useFan.setState({ xray: c.xray })
      fanSound.chimeTour()
      speak(`${c.title}。${c.text}`)
    }
    const real = Math.min(delta, 0.05)
    since.current += real
    blend.current = Math.min(1, blend.current + real / 1.1)
    const k = blend.current * blend.current * (3 - 2 * blend.current)
    const u = fanTour.t / c.dur
    c.pos(u, v.pos)
    c.look(u, v.look)
    const label = c.labels[0]
    if (c.drop) {
      const pull = camera.aspect < 1 ? 1.25 : 1.05
      v.pos.sub(v.look).multiplyScalar(pull)
      if (label) v.look.lerp(v.lab.set(...label.pos), 0.3)
      v.pos.add(v.look)
    }
    camera.position.lerpVectors(v.fromPos, v.pos, k)
    v.cur.lerpVectors(v.fromLook, v.look, k)
    controls.enabled = false
    controls.target.copy(v.cur)
    camera.up.set(0, 1, 0)
    camera.lookAt(v.cur)
    const fov = Math.min(76, c.fov * (camera.aspect < 1 ? 1.25 : 1))
    camera.fov += (fov - camera.fov) * Math.min(1, real * 2.5)
    camera.updateProjectionMatrix()

    // 案内役
    const g = guide.current
    if (g) {
      const t = state.clock.elapsedTime
      const bounce = 1 + 0.4 * Math.sin(since.current * Math.PI * 3) * Math.exp(-since.current * 3.5)
      if (c.drop) {
        c.drop.getPointAt(Math.min(1, Math.max(0, easeU(u))), g.position)
        g.position.y += Math.sin(t * 3) * 0.004
        g.scale.setScalar(2.1 * bounce)
      } else {
        camera.getWorldDirection(v.fwd)
        v.up.set(0, 1, 0).applyQuaternion(camera.quaternion)
        v.right.set(1, 0, 0).applyQuaternion(camera.quaternion)
        g.position.copy(camera.position).addScaledVector(v.fwd, 0.1).addScaledVector(v.right, -0.024 * Math.min(1.6, camera.aspect)).addScaledVector(v.up, -0.006)
        g.scale.setScalar(0.45 * bounce)
      }
      g.quaternion.copy(camera.quaternion)
      g.rotateZ(Math.sin(t * 2) * 0.15)
      if (spark.current) spark.current.visible = c.spark
      if (puff.current) puff.current.visible = !c.spark
      if (spark.current && c.spark) spark.current.rotation.z = t * 2
    }

    // はだの章
    const skinOn = fanTour.ch === 8
    skinState.show += ((skinOn ? 1 : 0) - skinState.show) * Math.min(1, real * 3)
    skinState.cool = skinOn ? Math.min(1, fanTour.t / (c.dur * 0.8)) : 0

    // 地図と画面演出
    tick.current = (tick.current + 1) % 4
    if (tick.current === 0) {
      const dot = document.getElementById('tour-dot')
      const trail = document.getElementById('tour-trail')
      if (dot && trail) {
        const m = fanMapProgress(fanTour.ch, u)
        dot.setAttribute('transform', `translate(${m.here[0].toFixed(1)} ${m.here[1].toFixed(1)})`)
        trail.setAttribute('points', m.trail)
      }
    }
    if (!fx.current || !fx.current.isConnected) fx.current = document.getElementById('tour-fx')
    if (fx.current) {
      const kind = c.fx ?? ''
      if (fx.current.dataset.fx !== kind) fx.current.dataset.fx = kind
      fx.current.style.opacity = String(kind ? 0.45 * Math.min(1, since.current * 2) : 0)
    }
  }, -0.5)

  return (
    <>
      <group ref={guide}>
        <group ref={spark}>
          <Spark />
        </group>
        <group ref={puff}>
          <Puff />
        </group>
      </group>
      {FAN_CHAPTERS[ch].labels.map((l) => (
        <Html key={`${ch}-${l.text}`} position={l.pos} center zIndexRange={[20, 0]}>
          <div className="tour-label">{l.text}</div>
        </Html>
      ))}
    </>
  )
}

// でんきの つぶ：黄色く光る星
function Spark() {
  const geo = useMemo(() => {
    const s = new THREE.Shape()
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2
      const r = i % 2 ? 0.0045 : 0.011
      if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r)
      else s.lineTo(Math.cos(a) * r, Math.sin(a) * r)
    }
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.003, bevelEnabled: true, bevelSize: 0.0015, bevelThickness: 0.0015, bevelSegments: 2 })
    g.translate(0, 0, -0.0015)
    return g
  }, [])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffd84d', emissive: '#ffb800', emissiveIntensity: 0.9, depthTest: false }), [])
  const eye = useMemo(() => new THREE.MeshBasicMaterial({ color: '#3a2a00', depthTest: false }), [])
  const halo = useMemo(
    () => new THREE.SpriteMaterial({ map: softDotTexture(), color: '#ffe680', transparent: true, opacity: 0.85, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending }),
    [],
  )
  const ball = useMemo(() => new THREE.SphereGeometry(1, 10, 8), [])
  useEffect(() => () => [geo, mat, eye, halo, ball].forEach((x) => x.dispose()), [geo, mat, eye, halo, ball])
  return (
    <group>
      <sprite material={halo} scale={0.05} renderOrder={29} />
      <mesh geometry={geo} material={mat} renderOrder={30} />
      <mesh geometry={ball} material={eye} position={[-0.0022, 0.0008, 0.004]} scale={0.0011} renderOrder={31} />
      <mesh geometry={ball} material={eye} position={[0.0022, 0.0008, 0.004]} scale={0.0011} renderOrder={31} />
    </group>
  )
}

// かぜの つぶ：ふわふわの雲
function Puff() {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#bfe8ff', emissiveIntensity: 0.45, roughness: 0.8, depthTest: false }), [])
  const eye = useMemo(() => new THREE.MeshBasicMaterial({ color: '#1d2340', depthTest: false }), [])
  const cheek = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ff9fc0', depthTest: false }), [])
  const halo = useMemo(
    () => new THREE.SpriteMaterial({ map: softDotTexture(), color: '#bfe8ff', transparent: true, opacity: 0.7, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending }),
    [],
  )
  const ball = useMemo(() => new THREE.SphereGeometry(1, 16, 12), [])
  useEffect(() => () => [mat, eye, cheek, halo, ball].forEach((x) => x.dispose()), [mat, eye, cheek, halo, ball])
  const parts: [number, number, number][] = [
    [0, 0, 0.0085],
    [-0.008, -0.002, 0.0065],
    [0.008, -0.002, 0.0065],
    [-0.004, 0.005, 0.0068],
    [0.0045, 0.005, 0.0062],
  ]
  return (
    <group>
      <sprite material={halo} scale={0.05} renderOrder={29} />
      {parts.map(([x, y, r], i) => (
        <mesh key={i} geometry={ball} material={mat} position={[x, y, 0]} scale={r} renderOrder={30} />
      ))}
      <mesh geometry={ball} material={eye} position={[-0.0028, 0.0008, 0.0082]} scale={0.0012} renderOrder={31} />
      <mesh geometry={ball} material={eye} position={[0.0028, 0.0008, 0.0082]} scale={0.0012} renderOrder={31} />
      <mesh geometry={ball} material={cheek} position={[-0.005, -0.0018, 0.0072]} scale={[0.0014, 0.0009, 0.0006]} renderOrder={31} />
      <mesh geometry={ball} material={cheek} position={[0.005, -0.0018, 0.0072]} scale={[0.0014, 0.0009, 0.0006]} renderOrder={31} />
    </group>
  )
}
