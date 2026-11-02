import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { bodies } from '../clothSim'
import { PARTS } from '../data'
import { useStore } from '../store'

interface Tween {
  fromPos: THREE.Vector3
  fromTarget: THREE.Vector3
  toPos: THREE.Vector3
  toTarget: THREE.Vector3
  fromFov: number
  toFov: number
  t: number
  dur: number
  track?: () => THREE.Vector3 | null
  onDone?: () => void
}

const BASE_FOV = 40

// 機械が画面いっぱいに見える距離を、画面の縦横比から計算する
export function homeView(aspect: number, xray = false) {
  const t = Math.tan(THREE.MathUtils.degToRad(BASE_FOV / 2))
  // 横長画面では上下の操作パネルぶん余白をとる
  const land = aspect >= 1
  const W = xray ? 1.0 : 0.74
  const H = (xray ? 1.08 : 0.98) * (land ? 1.3 : 1)
  const d = Math.max(H / 2 / t, W / 2 / (t * aspect)) + 0.25
  const dir = xray ? new THREE.Vector3(0.8, 0.42, 0.85).normalize() : new THREE.Vector3(0.22, 0.16, 1).normalize()
  const target = new THREE.Vector3(0, xray ? 0.42 : 0.45, 0)
  return { pos: target.clone().addScaledVector(dir, d), target }
}

function experimentView(aspect: number) {
  const t = Math.tan(THREE.MathUtils.degToRad(BASE_FOV / 2))
  const portrait = aspect < 1
  const W = portrait ? 0.98 : 2.1
  const H = portrait ? 1.0 : 0.9
  const d = Math.max(H / 2 / t, W / 2 / (t * aspect)) + 0.3
  const target = new THREE.Vector3(0, portrait ? 1.08 : 0.8, 0)
  const dir = new THREE.Vector3(0, 0.28, 1).normalize()
  return { pos: target.clone().addScaledVector(dir, d), target }
}

export function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const controls = useThree((s) => s.controls) as unknown as OrbitControlsImpl | null
  const size = useThree((s) => s.size)
  const cam = useStore((s) => s.cam)
  const mode = useStore((s) => s.mode)
  const tourOn = useStore((s) => s.tour)
  const tween = useRef<Tween | null>(null)
  const first = useRef(true)

  // 画面下の操作パネルぶん、描画を上へずらす（オービットの中心は変えない）
  useEffect(() => {
    const portrait = size.width < size.height
    const off = mode === 'micro' ? 0 : size.height * (tourOn ? (portrait ? 0.1 : 0.06) : portrait ? 0.13 : 0.1)
    camera.setViewOffset(size.width, size.height, 0, off, size.width, size.height)
    camera.updateProjectionMatrix()
  }, [camera, size, mode, tourOn])

  useEffect(() => {
    if (!controls) return
    const aspect = size.width / size.height
    if (first.current) {
      first.current = false
      const h = homeView(aspect)
      camera.position.copy(h.pos)
      controls.target.copy(h.target)
      controls.minDistance = 0.3
      controls.maxDistance = 4.5
      controls.update()
      return
    }
    const start = (toPos: THREE.Vector3, toTarget: THREE.Vector3, dur: number, extra: Partial<Tween> = {}) => {
      tween.current = {
        fromPos: camera.position.clone(),
        fromTarget: controls.target.clone(),
        toPos,
        toTarget,
        fromFov: camera.fov,
        toFov: BASE_FOV,
        t: 0,
        dur,
        ...extra,
      }
    }
    const c = cam
    switch (c.kind) {
      case 'home': {
        const h = homeView(aspect, useStore.getState().xray)
        start(h.pos, h.target, c.dur ?? 1.1)
        controls.minDistance = 0.3
        controls.maxDistance = 4.5
        break
      }
      case 'part': {
        const p = PARTS[c.part]
        const target = new THREE.Vector3(...p.pos)
        const dir = new THREE.Vector3(...p.dir).normalize()
        const dist = p.dist * (aspect < 1 ? 1.35 : 1)
        start(target.clone().addScaledVector(dir, dist), target, 1.1)
        break
      }
      case 'zoom': {
        const b = bodies.get(c.cloth)
        if (!b) return
        const track = () => bodies.get(c.cloth)?.world ?? null
        start(b.world.clone().add(new THREE.Vector3(0, 0.02, 0.12)), b.world.clone(), 1.7, {
          toFov: 14,
          track,
          onDone: () => useStore.getState().enterMicro(),
        })
        break
      }
      case 'micro': {
        camera.position.set(0, 1.5, 40)
        controls.target.set(0, 0, 0)
        camera.fov = BASE_FOV
        camera.updateProjectionMatrix()
        start(new THREE.Vector3(1.5, 2.5, 12), new THREE.Vector3(0, 0, 0), 2.6)
        controls.minDistance = 4
        controls.maxDistance = 22
        break
      }
      case 'fromCloth': {
        const b = bodies.get(c.cloth)
        const w = b ? b.world.clone() : new THREE.Vector3(0, 0.46, 0)
        camera.position.copy(w).add(new THREE.Vector3(0, 0.02, 0.1))
        controls.target.copy(w)
        camera.fov = 16
        camera.updateProjectionMatrix()
        const h = homeView(aspect)
        start(h.pos, h.target, 1.6)
        controls.minDistance = 0.3
        controls.maxDistance = 4.5
        break
      }
      case 'experiment': {
        const e = experimentView(aspect)
        camera.position.copy(e.pos).add(new THREE.Vector3(0.6, 0.4, 1.2))
        controls.target.copy(e.target)
        start(e.pos, e.target, 1.3)
        controls.minDistance = 0.8
        controls.maxDistance = 6
        break
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cam.n, controls])

  useFrame((_, delta) => {
    const tw = tween.current
    if (!tw || !controls) return
    tw.t += Math.min(delta, 0.05) / tw.dur
    const k = Math.min(1, tw.t)
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2
    const tracked = tw.track?.()
    if (tracked) {
      tw.toTarget.copy(tracked)
      tw.toPos.copy(tracked).add(new THREE.Vector3(0, 0.02, 0.12))
    }
    camera.position.lerpVectors(tw.fromPos, tw.toPos, e)
    controls.target.lerpVectors(tw.fromTarget, tw.toTarget, e)
    camera.fov = THREE.MathUtils.lerp(tw.fromFov, tw.toFov, e)
    camera.updateProjectionMatrix()
    controls.enabled = false
    if (k >= 1) {
      tween.current = null
      controls.enabled = true
      if (tw.toFov !== BASE_FOV && !tw.onDone) {
        camera.fov = BASE_FOV
        camera.updateProjectionMatrix()
      }
      tw.onDone?.()
      if (tw.onDone) {
        camera.fov = BASE_FOV
        camera.updateProjectionMatrix()
      }
    }
    controls.update()
  }, -1)

  return null
}
