import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { addDemoBody, demoBodies } from '../clothSim'
import { CLOTH_IDS, type ClothId } from '../data'
import { useStore } from '../store'
import { CHAPTERS, tour } from '../tour'
import { ClothItem } from './Clothes'

// たんけんツアー：カメラを通り道にそって動かし、案内役の「しずくん」が先を進む
export function Tour() {
  const on = useStore((s) => s.tour && s.mode === 'wash')
  return on ? <TourInner /> : null
}

const DEMO: ClothId[] = ['shirt', 'towel', 'teddy', 'socks']

function speak(text: string) {
  try {
    const synth = window.speechSynthesis
    if (!synth || useStore.getState().muted) return
    synth.cancel()
    const u = new SpeechSynthesisUtterance(text.replace(/（.*?）/g, ''))
    u.lang = 'ja-JP'
    u.rate = 1.0
    u.pitch = 1.15
    const ja = synth.getVoices().find((v) => v.lang.startsWith('ja'))
    if (ja) u.voice = ja
    synth.speak(u)
  } catch {
    // 読み上げが使えない端末では文字だけで進める
  }
}

function TourInner() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const gl = useThree((s) => s.gl)
  const controls = useThree((s) => s.controls) as unknown as OrbitControlsImpl | null
  const items = useStore.getState().items
  // ドラムが空なら見本の服を入れて旅をにぎやかにする
  const demo = useMemo(() => !CLOTH_IDS.some((id) => items[id] === 'drum'), [items])
  useMemo(() => {
    if (demo) DEMO.forEach((id, i) => addDemoBody(id, i))
  }, [demo])

  const guide = useRef<THREE.Group>(null)
  const lamp = useRef<THREE.PointLight>(null)
  const v = useMemo(
    () => ({
      pos: new THREE.Vector3(),
      look: new THREE.Vector3(),
      cur: new THREE.Vector3(),
      fromPos: new THREE.Vector3(),
      fromLook: new THREE.Vector3(),
      fwd: new THREE.Vector3(),
      up: new THREE.Vector3(),
      right: new THREE.Vector3(),
    }),
    [],
  )
  const last = useRef(-1)
  const blend = useRef(0)
  const muted = useStore((s) => s.muted)

  useEffect(() => {
    camera.near = 0.005
    camera.updateProjectionMatrix()
    const exposure = gl.toneMappingExposure
    gl.toneMappingExposure = exposure * 0.85
    return () => {
      gl.toneMappingExposure = exposure
      camera.near = 0.02
      camera.updateProjectionMatrix()
      demoBodies.clear()
      if (controls) controls.enabled = true
      try {
        window.speechSynthesis?.cancel()
      } catch {
        /* noop */
      }
    }
  }, [camera, gl, controls])

  useEffect(() => {
    if (muted)
      try {
        window.speechSynthesis?.cancel()
      } catch {
        /* noop */
      }
  }, [muted])

  useFrame((state, delta) => {
    if (!controls) return
    const c = CHAPTERS[tour.ch]
    if (tour.ch !== last.current) {
      last.current = tour.ch
      v.fromPos.copy(camera.position)
      v.fromLook.copy(controls.target)
      blend.current = 0
      useStore.setState({ xray: c.xray })
      speak(`${c.title}。${c.text}`)
    }
    const real = Math.min(delta, 0.05)
    blend.current = Math.min(1, blend.current + real / 1.1)
    const k = blend.current * blend.current * (3 - 2 * blend.current)
    const u = tour.t / c.dur
    c.pos(u, v.pos)
    c.look(u, v.look)
    camera.position.lerpVectors(v.fromPos, v.pos, k)
    v.cur.lerpVectors(v.fromLook, v.look, k)
    controls.enabled = false
    controls.target.copy(v.cur)
    camera.up.set(0, 1, 0)
    camera.lookAt(v.cur)
    camera.fov += (c.fov - camera.fov) * Math.min(1, real * 2.5)
    camera.updateProjectionMatrix()

    // 案内役のしずくんは、いつも少し先をふわふわ進む
    if (guide.current) {
      camera.getWorldDirection(v.fwd)
      v.up.set(0, 1, 0).applyQuaternion(camera.quaternion)
      v.right.set(1, 0, 0).applyQuaternion(camera.quaternion)
      const t = state.clock.elapsedTime
      // 画面のまんなかをふさがないよう、左下を少し先に進む
      const aspect = Math.min(1.6, camera.aspect)
      guide.current.position
        .copy(camera.position)
        .addScaledVector(v.fwd, 0.1)
        .addScaledVector(v.right, -0.024 * aspect + Math.sin(t * 1.3) * 0.002)
        .addScaledVector(v.up, -0.006 + Math.sin(t * 3) * 0.002)
      guide.current.scale.setScalar(0.45)
      guide.current.quaternion.copy(camera.quaternion)
      guide.current.rotateZ(Math.sin(t * 2) * 0.15)
    }
    if (lamp.current) lamp.current.position.copy(camera.position)
  }, -0.5)

  return (
    <>
      <pointLight ref={lamp} intensity={0.6} distance={0.6} decay={2} color="#fff1d6" />
      <group ref={guide}>
        <Droplet />
      </group>
      {demo && DEMO.map((id) => <ClothItem key={id} id={id} map={demoBodies} />)}
    </>
  )
}

// 水のつぶのキャラクター
function Droplet() {
  const geo = useMemo(() => {
    const pts: THREE.Vector2[] = []
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI
      const r = Math.sin(a) * (1 - 0.55 * Math.pow(Math.max(0, Math.cos(a)), 1.6))
      pts.push(new THREE.Vector2(r * 0.009, -Math.cos(a) * 0.011 * (a < Math.PI / 2 ? 1.25 : 1)))
    }
    return new THREE.LatheGeometry(pts, 24)
  }, [])
  const body = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: '#59c3ff', roughness: 0.05, clearcoat: 1, emissive: '#1f8fff', emissiveIntensity: 0.35, transparent: true, opacity: 0.92 }),
    [],
  )
  const eye = useMemo(() => new THREE.MeshBasicMaterial({ color: '#1d2340' }), [])
  const cheek = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ff9fc0' }), [])
  const ball = useMemo(() => new THREE.SphereGeometry(1, 10, 8), [])
  useEffect(
    () => () => {
      geo.dispose()
      body.dispose()
      eye.dispose()
      cheek.dispose()
      ball.dispose()
    },
    [geo, body, eye, cheek, ball],
  )
  return (
    <group rotation-x={Math.PI}>
      <mesh geometry={geo} material={body} />
      <group rotation-x={Math.PI}>
        <mesh geometry={ball} material={eye} position={[-0.0028, 0.0005, 0.0078]} scale={0.0013} />
        <mesh geometry={ball} material={eye} position={[0.0028, 0.0005, 0.0078]} scale={0.0013} />
        <mesh geometry={ball} material={cheek} position={[-0.0052, -0.0022, 0.0066]} scale={[0.0014, 0.0009, 0.0006]} />
        <mesh geometry={ball} material={cheek} position={[0.0052, -0.0022, 0.0066]} scale={[0.0014, 0.0009, 0.0006]} />
      </group>
    </group>
  )
}
