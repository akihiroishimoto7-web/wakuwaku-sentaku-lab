import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { addDemoBody, demoBodies } from '../clothSim'
import { softDotTexture } from '../textures'
import { CLOTH_IDS, type ClothId } from '../data'
import { sound } from '../sound'
import { speak, stopSpeech } from '../speech'
import { useStore } from '../store'
import { airPhase, CHAPTERS, GUIDES, mapProgress, tour } from '../tour'
import { ClothItem } from './Clothes'

// たんけんツアー：カメラを通り道にそって動かし、案内役の「しずくん」が先を進む
export function Tour() {
  const on = useStore((s) => s.tour && s.mode === 'wash')
  return on ? <TourInner /> : null
}

const DEMO: ClothId[] = ['shirt', 'towel', 'teddy', 'socks']

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
      lab: new THREE.Vector3(),
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
      stopSpeech()
    }
  }, [camera, gl, controls])

  useEffect(() => {
    if (muted) stopSpeech()
  }, [muted])
  const since = useRef(0)
  const fx = useRef<HTMLElement | null>(null)
  const mapTick = useRef(0)
  const ch = useStore((s) => s.tourCh)

  useFrame((state, delta) => {
    if (!controls) return
    const c = CHAPTERS[tour.ch]
    if (tour.ch !== last.current) {
      last.current = tour.ch
      v.fromPos.copy(camera.position)
      v.fromLook.copy(controls.target)
      blend.current = 0
      since.current = 0
      useStore.setState({ xray: c.xray })
      sound.chime()
      speak(`${c.title}。${c.text}`)
    }
    since.current += Math.min(delta, 0.05)
    const real = Math.min(delta, 0.05)
    blend.current = Math.min(1, blend.current + real / 1.1)
    const k = blend.current * blend.current * (3 - 2 * blend.current)
    const u = tour.t / c.dur
    c.pos(u, v.pos)
    c.look(u, v.look)
    const label = GUIDES[tour.ch].labels[0]
    if (c.drop) {
      // たて長の画面では少し引いて、しずくと部品の名札が両方見えるようにする
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
    // たて長のスマホでは横がせまく見えるので、少し広角にする
    const fov = Math.min(78, c.fov * (camera.aspect < 1 ? 1.25 : 1))
    camera.fov += (fov - camera.fov) * Math.min(1, real * 2.5)
    camera.updateProjectionMatrix()

    // 案内役のしずく。水の通り道がある章では道の上を進み、ない章ではカメラの少し先をふわふわ進む
    if (guide.current && c.drop) {
      const t = state.clock.elapsedTime
      const b = since.current
      c.drop.getPointAt(Math.min(1, Math.max(0, u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2)), guide.current.position)
      guide.current.position.y += Math.sin(t * 3) * 0.004
      guide.current.scale.setScalar(2.1 * (1 + 0.4 * Math.sin(b * Math.PI * 3) * Math.exp(-b * 3.5)))
      guide.current.quaternion.copy(camera.quaternion)
      guide.current.rotateZ(Math.sin(t * 2) * 0.15)
    } else if (guide.current) {
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
      // 章が変わると、ぴょんと はねる
      const b = since.current
      guide.current.scale.setScalar(0.45 * (1 + 0.4 * Math.sin(b * Math.PI * 3) * Math.exp(-b * 3.5)))
      guide.current.quaternion.copy(camera.quaternion)
      guide.current.rotateZ(Math.sin(t * 2) * 0.15)
    }
    if (lamp.current) lamp.current.position.copy(camera.position)

    // 画面の演出：スピード線、乾燥のときの冷たい／あつい色
    // 「いまここ地図」のしずくと通った道（4回に1回だけ更新して軽くする）
    mapTick.current = (mapTick.current + 1) % 4
    if (mapTick.current === 0) {
      const dot = document.getElementById('tour-dot')
      const trail = document.getElementById('tour-trail')
      if (dot && trail) {
        const m = mapProgress(tour.ch, u)
        dot.setAttribute('transform', `translate(${m.here[0].toFixed(1)} ${m.here[1].toFixed(1)})`)
        trail.setAttribute('points', m.trail)
      }
    }
    if (!fx.current || !fx.current.isConnected) fx.current = document.getElementById('tour-fx')
    const el = fx.current
    if (el) {
      let kind = c.fx ?? ''
      let o = kind ? (c.drop ? 0.4 : 0.75) * Math.min(1, since.current * 2) : 0
      if (tour.ch === CHAPTERS.length - 2) {
        const a = airPhase(u)
        kind = a
        o = a ? 0.8 : 0
      }
      if (el.dataset.fx !== kind) el.dataset.fx = kind
      el.style.opacity = String(o)
    }
  }, -0.5)

  return (
    <>
      <pointLight ref={lamp} intensity={0.6} distance={0.6} decay={2} color="#fff1d6" />
      <group ref={guide}>
        <Droplet />
      </group>
      {demo && DEMO.map((id) => <ClothItem key={id} id={id} map={demoBodies} />)}
      {GUIDES[ch].labels.map((l) => (
        <Html key={`${ch}-${l.text}`} position={l.pos} center zIndexRange={[20, 0]}>
          <div className="tour-label">{l.text}</div>
        </Html>
      ))}
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
  // 機械の部品の向こう側にいても見失わないよう、いつも手前に描く
  const body = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({ color: '#59c3ff', roughness: 0.05, clearcoat: 1, emissive: '#1f8fff', emissiveIntensity: 0.45, transparent: true, opacity: 0.95, depthTest: false }),
    [],
  )
  const eye = useMemo(() => new THREE.MeshBasicMaterial({ color: '#1d2340', depthTest: false }), [])
  const cheek = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ff9fc0', depthTest: false }), [])
  const halo = useMemo(
    () => new THREE.SpriteMaterial({ map: softDotTexture(), color: '#9fe0ff', transparent: true, opacity: 0.75, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending }),
    [],
  )
  const ball = useMemo(() => new THREE.SphereGeometry(1, 10, 8), [])
  useEffect(
    () => () => {
      geo.dispose()
      body.dispose()
      eye.dispose()
      cheek.dispose()
      ball.dispose()
      halo.dispose()
    },
    [geo, body, eye, cheek, ball, halo],
  )
  return (
    <group rotation-x={Math.PI}>
      <sprite material={halo} scale={0.05} renderOrder={29} />
      <mesh geometry={geo} material={body} renderOrder={30} />
      <group rotation-x={Math.PI}>
        <mesh geometry={ball} material={eye} position={[-0.0028, 0.0005, 0.0078]} scale={0.0013} renderOrder={31} />
        <mesh geometry={ball} material={eye} position={[0.0028, 0.0005, 0.0078]} scale={0.0013} renderOrder={31} />
        <mesh geometry={ball} material={cheek} position={[-0.0052, -0.0022, 0.0066]} scale={[0.0014, 0.0009, 0.0006]} renderOrder={31} />
        <mesh geometry={ball} material={cheek} position={[0.0052, -0.0022, 0.0066]} scale={[0.0014, 0.0009, 0.0006]} renderOrder={31} />
      </group>
    </group>
  )
}
