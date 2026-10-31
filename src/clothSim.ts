import * as THREE from 'three'
import { CLOTH_MAP, DRUM_R, TUB_C, TUB_R, type ClothId } from './data'
import { sim } from './sim'

// 衣服の軽量な近似物理：ドラムの断面（xy）での質点運動＋布らしい変形パラメータ
export type BodyMode = 'in' | 'drum' | 'out' | 'shown'

export interface Body {
  id: ClothId
  mode: BodyMode
  t: number
  delay: number
  p: THREE.Vector3 // 槽ローカル座標
  v: THREE.Vector3
  r: number
  rot: number
  rotV: number
  contact: number
  squash: number
  bend: number
  fold: number
  flutter: number
  seed: number
  world: THREE.Vector3
  quat: THREE.Quaternion
  scale: THREE.Vector3
  from: THREE.Vector3
  ctrl: THREE.Vector3
  to: THREE.Vector3
  glow: number
}

export const bodies = new Map<ClothId, Body>()
const G = 9.8
const tmpE = new THREE.Euler()
const tmpQ = new THREE.Quaternion()
const faceQ = new THREE.Quaternion()

export function addBody(id: ClothId) {
  if (bodies.has(id)) return bodies.get(id)!
  const def = CLOTH_MAP[id]
  const seed = Math.random() * 10
  const b: Body = {
    id,
    mode: 'in',
    t: 0,
    delay: 0,
    p: new THREE.Vector3(),
    v: new THREE.Vector3(),
    r: def.r,
    rot: Math.random() * 6,
    rotV: 0,
    contact: 0,
    squash: 0,
    bend: 0,
    fold: 0,
    flutter: 0.5,
    seed,
    world: new THREE.Vector3(0.05, 0.05, 1.2),
    quat: new THREE.Quaternion(),
    scale: new THREE.Vector3(1, 1, 1),
    from: new THREE.Vector3(0.05 + (Math.random() - 0.5) * 0.2, 0.02, 1.25),
    ctrl: new THREE.Vector3(0, 0.75, 0.75),
    to: new THREE.Vector3((Math.random() - 0.5) * 0.08, TUB_C.y - 0.02, 0.06),
    glow: 0,
  }
  b.world.copy(b.from)
  bodies.set(id, b)
  return b
}

export function sendOut(id: ClothId, slot: number, count: number) {
  const b = bodies.get(id)
  if (!b) return
  b.mode = 'out'
  b.t = 0
  b.delay = slot * 0.22
  b.from.copy(b.world)
  const x = (slot - (count - 1) / 2) * Math.min(0.13, 0.5 / Math.max(1, count - 1))
  b.to.set(x, 0.52 + (slot % 2 ? 0.07 : -0.03), 0.52)
  b.ctrl.set(x * 0.4, 0.72, 0.5)
}

export function clearBodies() {
  bodies.clear()
}

const bez = (out: THREE.Vector3, a: THREE.Vector3, c: THREE.Vector3, b: THREE.Vector3, t: number) => {
  const u = 1 - t
  out.set(
    u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    u * u * a.y + 2 * u * t * c.y + t * t * b.y,
    u * u * a.z + 2 * u * t * c.z + t * t * b.z,
  )
}
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

export function stepClothes(dt: number) {
  const time = sim.time
  const surfY = -TUB_R + sim.level * 2 * TUB_R
  const omega = sim.omega
  const pinned = Math.min(1, Math.abs(omega) / 14)
  const list = [...bodies.values()]

  for (const b of list) {
    if (b.mode === 'in') {
      b.t += dt / 0.95
      const t = Math.min(1, b.t)
      bez(b.world, b.from, b.ctrl, b.to, ease(t))
      const s = 0.35 + 0.65 * Math.min(1, t * 1.5)
      b.scale.set(s, s, s)
      b.rot += dt * 6
      tmpE.set(Math.sin(t * 6) * 0.6, t * 3, b.rot)
      b.quat.setFromEuler(tmpE)
      b.flutter = 1
      if (b.t >= 1) {
        b.mode = 'drum'
        b.p.copy(b.world).sub(TUB_C)
        b.v.set((Math.random() - 0.5) * 0.4, -0.6, -0.4)
        b.scale.set(1, 1, 1)
      }
      continue
    }
    if (b.mode === 'out' || b.mode === 'shown') {
      if (b.mode === 'out') {
        b.t += dt
        const t = Math.min(1, Math.max(0, (b.t - b.delay) / 1.1))
        bez(b.world, b.from, b.ctrl, b.to, ease(t))
        b.rot = b.rot * (1 - t) + 0 * t
        tmpE.set(0, (1 - t) * 4, b.rot * (1 - t))
        b.quat.setFromEuler(tmpE)
        b.bend *= 0.95
        b.fold *= 0.95
        b.flutter = 1 - t
        if (t >= 1) {
          b.mode = 'shown'
          b.t = 0
        }
      } else {
        b.t += dt
        const pop = b.t < 0.8 ? 1 + 0.35 * Math.sin(b.t * Math.PI * 2.5) * Math.exp(-b.t * 3) : 1
        b.scale.setScalar(pop * 1.15)
        b.world.set(b.to.x, b.to.y + Math.sin(time * 1.6 + b.seed) * 0.012, b.to.z)
        tmpE.set(Math.sin(time * 1.1 + b.seed) * 0.12, Math.sin(time * 0.8 + b.seed) * 0.35, Math.sin(time * 1.3 + b.seed) * 0.06)
        b.quat.setFromEuler(tmpE)
        b.flutter = 0.25
        b.bend = Math.sin(time * 1.2 + b.seed) * 1.2
        b.glow = 0.12 + 0.08 * Math.sin(time * 3 + b.seed)
      }
      continue
    }

    // ---- ドラムの中 ----
    const inWater = b.p.y < surfY
    const g = G * (inWater ? 0.3 : 1)
    b.v.y -= g * dt
    if (inWater) {
      b.v.multiplyScalar(Math.exp(-3.5 * dt))
      // 水の流れに少し引っぱられる
      const rr = Math.hypot(b.p.x, b.p.y) || 1
      b.v.x += (-b.p.y / rr) * omega * rr * 0.6 * dt
      b.v.y += (b.p.x / rr) * omega * rr * 0.6 * dt
    } else b.v.multiplyScalar(Math.exp(-0.25 * dt))

    b.p.addScaledVector(b.v, dt)

    const rr = Math.hypot(b.p.x, b.p.y)
    const lim = DRUM_R - b.r * 0.55
    const wasContact = b.contact > 0.5
    if (rr > lim) {
      const nx = b.p.x / rr
      const ny = b.p.y / rr
      b.p.x = nx * lim
      b.p.y = ny * lim
      const vn = b.v.x * nx + b.v.y * ny
      if (vn > 0) {
        b.v.x -= nx * vn * 1.12
        b.v.y -= ny * vn * 1.12
        b.squash = Math.min(0.55, Math.max(b.squash, vn * 0.3))
      }
      // リフター＋摩擦でドラム壁の速度に引き込む
      const tx = -ny
      const ty = nx
      const wall = omega * lim
      const vt = b.v.x * tx + b.v.y * ty
      const dv = (wall - vt) * Math.min(1, 14 * dt)
      b.v.x += tx * dv
      b.v.y += ty * dv
      b.contact = 1
    } else {
      b.contact = Math.max(0, b.contact - dt * 6)
    }
    if (wasContact && b.contact <= 0.5) b.rotV = omega * 0.6 + (Math.random() - 0.5) * 5

    // 奥行き
    b.v.z += (Math.sin(time * 0.7 + b.seed * 3) * 0.15 - b.p.z * 0.8) * dt
    b.v.z *= Math.exp(-1.5 * dt)
    b.p.z = THREE.MathUtils.clamp(b.p.z, -0.15, 0.12)

    // 回転と布の変形
    b.rot += (b.contact > 0.5 ? omega : b.rotV) * dt
    b.rotV *= Math.exp(-0.8 * dt)
    const speed = b.v.length()
    const airborne = 1 - b.contact
    b.flutter += (Math.min(1.2, speed * 0.8 + (inWater ? 0.35 : 0.1) + airborne * 0.4) - b.flutter) * Math.min(1, dt * 4)
    const bendTarget = b.contact > 0.5 ? -2.2 * (0.4 + 0.6 * pinned) : Math.sin(time * 1.3 + b.seed) * 3
    b.bend += (bendTarget - b.bend) * Math.min(1, dt * 3)
    b.fold += (Math.sin(time * 0.9 + b.seed * 2) * 2.5 * (1 - pinned) - b.fold) * Math.min(1, dt * 2)
    b.squash *= Math.exp(-5 * dt)
    b.glow *= Math.exp(-2 * dt)

    const sq = b.squash
    b.scale.set(1 + sq * 0.4, 1 - sq * 0.35, 1 + sq * 0.2)
    tmpE.set(Math.sin(time * 0.8 + b.seed) * 0.55 * (1 - pinned), Math.cos(time * 0.95 + b.seed) * 0.45 * (1 - pinned), b.rot)
    b.quat.setFromEuler(tmpE)
  }

  // 衣服同士の押し合い
  for (let i = 0; i < list.length; i++) {
    const a = list[i]
    if (a.mode !== 'drum') continue
    for (let j = i + 1; j < list.length; j++) {
      const c = list[j]
      if (c.mode !== 'drum') continue
      const dx = c.p.x - a.p.x
      const dy = c.p.y - a.p.y
      const dz = c.p.z - a.p.z
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.0001
      const min = (a.r + c.r) * 0.7
      if (d < min) {
        const push = (min - d) * 0.5
        const nx = dx / d
        const ny = dy / d
        const nz = dz / d
        a.p.x -= nx * push
        a.p.y -= ny * push
        a.p.z -= nz * push
        c.p.x += nx * push
        c.p.y += ny * push
        c.p.z += nz * push
      }
    }
  }

  for (const b of list) {
    if (b.mode === 'drum') b.world.copy(b.p).add(TUB_C).add(sim.vib)
  }
  faceQ.identity()
  tmpQ.identity()
}
