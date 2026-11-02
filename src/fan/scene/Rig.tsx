import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { FAN_PARTS, HEAD_OFFSET, PIVOT, type FanPartId } from '../data'
import { fan } from '../sim'
import { useFan } from '../store'

const FOV = 40
const Y = new THREE.Vector3(0, 1, 0)

// 扇風機と、まわりのかざぐるま・風鈴がスマホでも見える距離
export function fanHome(aspect: number, xray: boolean) {
  const t = Math.tan(THREE.MathUtils.degToRad(FOV / 2))
  const land = aspect >= 1
  const W = xray ? 0.75 : land ? 1.5 : 0.82
  const H = (xray ? 1.1 : 1.2) * (land ? 1.15 : 1)
  const d = Math.max(H / 2 / t, W / 2 / (t * aspect)) + 0.2
  const dir = xray ? new THREE.Vector3(0.85, 0.45, 0.7).normalize() : new THREE.Vector3(0.32, 0.22, 1).normalize()
  const target = new THREE.Vector3(0, xray ? 0.55 : 0.62, xray ? 0 : 0.3)
  return { pos: target.clone().addScaledVector(dir, d), target }
}

function experimentView(aspect: number) {
  const t = Math.tan(THREE.MathUtils.degToRad(FOV / 2))
  const W = aspect < 1 ? 1.1 : 1.6
  const H = 0.75
  const d = Math.max(H / 2 / t, W / 2 / (t * aspect)) + 0.2
  const target = new THREE.Vector3(0, 0.95, 0.15)
  return { pos: target.clone().addScaledVector(new THREE.Vector3(0, 0.45, 1).normalize(), d), target }
}

export function partWorld(id: FanPartId, out: THREE.Vector3) {
  const p = FAN_PARTS[id]
  out.set(...p.pos)
  if (p.inHead) out.add(HEAD_OFFSET).applyAxisAngle(Y, fan.yaw).add(PIVOT)
  return out
}

interface Tween {
  fromPos: THREE.Vector3
  fromTarget: THREE.Vector3
  toPos: THREE.Vector3
  toTarget: THREE.Vector3
  fromFov: number
  t: number
  dur: number
  track?: FanPartId
}

export function FanRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const controls = useThree((s) => s.controls) as unknown as OrbitControlsImpl | null
  const size = useThree((s) => s.size)
  const cam = useFan((s) => s.cam)
  const tour = useFan((s) => s.tour)
  const tween = useRef<Tween | null>(null)
  const first = useRef(true)

  useEffect(() => {
    const portrait = size.width < size.height
    const off = size.height * (tour ? (portrait ? 0.1 : 0.06) : portrait ? 0.12 : 0.08)
    camera.setViewOffset(size.width, size.height, 0, off, size.width, size.height)
    camera.updateProjectionMatrix()
  }, [camera, size, tour])

  useEffect(() => {
    if (!controls) return
    const aspect = size.width / size.height
    if (first.current) {
      first.current = false
      const h = fanHome(aspect, false)
      camera.position.copy(h.pos)
      controls.target.copy(h.target)
      controls.minDistance = 0.25
      controls.maxDistance = 5
      controls.update()
      return
    }
    const start = (toPos: THREE.Vector3, toTarget: THREE.Vector3, dur: number, track?: FanPartId) => {
      tween.current = { fromPos: camera.position.clone(), fromTarget: controls.target.clone(), toPos, toTarget, fromFov: camera.fov, t: 0, dur, track }
    }
    if (cam.kind === 'home') {
      const h = fanHome(aspect, useFan.getState().xray)
      start(h.pos, h.target, cam.dur ?? 1.1)
    } else if (cam.kind === 'part') {
      const p = FAN_PARTS[cam.part]
      const target = partWorld(cam.part, new THREE.Vector3())
      const dir = new THREE.Vector3(...p.dir).normalize()
      start(target.clone().addScaledVector(dir, p.dist * (aspect < 1 ? 1.4 : 1)), target, 1.1, p.inHead ? cam.part : undefined)
    } else {
      const e = experimentView(aspect)
      start(e.pos, e.target, 1.2)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cam.n, controls])

  const tmp = useRef(new THREE.Vector3())
  useFrame((_, delta) => {
    const tw = tween.current
    if (!controls) return
    if (!tw) {
      // 部品を見ているあいだに首が動いたら、いっしょについていく
      const f = useFan.getState().focus
      if (f && FAN_PARTS[f].inHead && !useFan.getState().tour) {
        const p = partWorld(f, tmp.current)
        const d = p.clone().sub(controls.target)
        controls.target.add(d)
        camera.position.add(d)
      }
      return
    }
    tw.t += Math.min(delta, 0.05) / tw.dur
    const k = Math.min(1, tw.t)
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2
    if (tw.track) {
      const p = partWorld(tw.track, tmp.current)
      const d = p.clone().sub(tw.toTarget)
      tw.toTarget.add(d)
      tw.toPos.add(d)
    }
    camera.position.lerpVectors(tw.fromPos, tw.toPos, e)
    controls.target.lerpVectors(tw.fromTarget, tw.toTarget, e)
    camera.fov = THREE.MathUtils.lerp(tw.fromFov, FOV, e)
    camera.updateProjectionMatrix()
    controls.enabled = false
    if (k >= 1) {
      tween.current = null
      controls.enabled = true
    }
    controls.update()
  }, -1)
  return null
}
