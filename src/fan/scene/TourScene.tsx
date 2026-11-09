import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { speak, stopSpeech } from '../../speech'
import { softDotTexture } from '../../textures'
import { fanSound } from '../sound'
import { useFan } from '../store'
import { FAN_CHAPTERS, FAN_ROUTE, fanMapProgress, fanTour } from '../tour'
import { ARM_WRIST, OUTLET_POS } from '../data'
import { fitOverview, samplePoints } from '../../overview'
import { RouteOverlay, type OverviewState } from '../../scene/RouteOverlay'
import { skinState } from './Props'
import { partWorld } from './Rig'

// ぜんたいを みる ときに がめんに いれる ばしょ（みち ＋ コンセント・だい・うで）
const FRAME_PTS = [...samplePoints(FAN_ROUTE), OUTLET_POS.clone(), new THREE.Vector3(0, 0, 0.2), new THREE.Vector3(0, 1.0, 0), ARM_WRIST.clone()]
// へやの ちずの ように、ななめ うえから すこし ほそい がかくで みおろす
const OV_DIR = new THREE.Vector3(0.22, 1.35, 1)

// みちの ない 章で、つぶが いる ばしょ
function anchorAt(ch: number, u: number, out: THREE.Vector3) {
  const c = FAN_CHAPTERS[ch]
  if (c.drop) return c.drop.getPointAt(easeU(Math.min(1, Math.max(0, u))), out)
  if (ch === 6) return partWorld('gear', out)
  return out.copy(ARM_WRIST)
}

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
  const size = useThree((s) => s.size)
  const ovView = useMemo(() => {
    const aspect = size.width / size.height
    const fov = 30 * (aspect < 1 ? 1.25 : 1)
    return { ...fitOverview(FRAME_PTS, OV_DIR, fov, aspect), fov }
  }, [size])
  const ov = useMemo<OverviewState>(() => ({ w: 0, ch: 0, here: new THREE.Vector3() }), [])
  const ovRaw = useRef(0)
  const ovWas = useRef(false)
  const tmp = useMemo(() => new THREE.Vector3(), [])
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
      document.body.classList.remove('tour-ov-on')
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
      fanSound.chimeTour()
      const pre = c.overview ? (fanTour.ch === 0 ? 'これから この みちを たびするよ。' : 'ぜんたいを みてみよう。いまは ここ！ ') : ''
      speak(`${pre}${c.title}。${c.text}`)
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

    // ぜんたいを みる：へやを うえから みおろして、みちと「いま ここ！」を みせる
    const st = useFan.getState()
    if (fanTour.ov > 0 && !st.tourPaused) fanTour.ov = Math.max(0, fanTour.ov - real)
    const ovOn = fanTour.ov > 0
    ovRaw.current = Math.min(1, Math.max(0, ovRaw.current + (ovOn ? real / 0.9 : -real / 1.1)))
    const kw = ovRaw.current * ovRaw.current * (3 - 2 * ovRaw.current)
    if (kw > 0) {
      camera.position.lerp(ovView.pos, kw)
      v.cur.lerp(ovView.look, kw)
    }
    if (ovOn !== st.tourOv) useFan.setState({ tourOv: ovOn })
    if (ovOn !== ovWas.current) {
      ovWas.current = ovOn
      document.body.classList.toggle('tour-ov-on', ovOn)
    }
    // へやの ようすが わかるよう、ぜんたいの ときは すけない すがたで
    const wantX = ovOn || kw > 0.3 ? false : c.xray
    if (st.xray !== wantX) useFan.setState({ xray: wantX })
    controls.enabled = false
    controls.target.copy(v.cur)
    camera.up.set(0, 1, 0)
    camera.lookAt(v.cur)
    const fov = THREE.MathUtils.lerp(Math.min(76, c.fov * (camera.aspect < 1 ? 1.25 : 1)), ovView.fov, kw)
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
      // ぜんたいを みる ときは、つぶを ほんとうの ばしょに おおきく だす
      anchorAt(fanTour.ch, u, tmp)
      if (!c.drop) g.position.lerp(tmp, kw)
      if (kw > 0) g.scale.setScalar(THREE.MathUtils.lerp(g.scale.x, ovView.dist * 2, kw))
      ov.here.copy(g.position)
      g.quaternion.copy(camera.quaternion)
      g.rotateZ(Math.sin(t * 2) * 0.15)
      if (spark.current) spark.current.visible = c.spark
      if (puff.current) puff.current.visible = !c.spark
      if (spark.current && c.spark) spark.current.rotation.z = t * 2
    }

    ov.w = kw
    ov.ch = fanTour.ch

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
      fx.current.style.opacity = String(kind ? 0.45 * Math.min(1, since.current * 2) * (1 - kw) : 0)
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
      <RouteOverlay curves={FAN_ROUTE} state={ov} dist={ovView.dist} fov={ovView.fov} futureColor="#ffffff" hereText={FAN_CHAPTERS[ch].spark ? '⚡ いま ここ！' : '🌬️ いま ここ！'} />
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
