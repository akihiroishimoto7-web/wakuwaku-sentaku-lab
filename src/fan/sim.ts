import * as THREE from 'three'
import { BLADE_R, HEAD_OFFSET, LEVELS, PIVOT, type Level } from './data'

// 扇風機の疑似シミュレーション（教育用のモデル。実際の性能を計算するものではありません）
export const fan = {
  level: 0 as Level,
  rpm: 0,
  angle: 0, // 羽根の見た目の回転角
  osc: false,
  yaw: 0,
  yawPhase: 0,
  gear: 0, // 首振りの大きな歯車の角度
  wind: 0, // 0..1
  power: 0, // 電気が流れている度合い 0..1
  time: 0,
  dt: 0,
  xray: 0,
  timeScale: 1,
  tourOverride: false,
}

const VISUAL_OMEGA_MAX = 15 // 速すぎると見えないので、見た目の回転は控えめ（その分ぼかしの円で表す）
const approach = (v: number, t: number, r: number, dt: number) => v + (t - v) * Math.min(1, r * dt)

export function stepFan(dt: number) {
  fan.dt = dt
  fan.time += dt
  const target = LEVELS[fan.level].rpm
  // 回りはじめは ゆっくり、止まるときは もっと ゆっくり
  fan.rpm = approach(fan.rpm, target, target > fan.rpm ? 0.9 : 0.45, dt)
  if (Math.abs(fan.rpm - target) < 1) fan.rpm = target
  const omega = Math.min((fan.rpm * Math.PI * 2) / 60, VISUAL_OMEGA_MAX * Math.min(1, fan.rpm / 600 + 0.2))
  fan.angle += omega * dt
  fan.power = approach(fan.power, fan.level > 0 ? 1 : 0, 4, dt)
  fan.wind = Math.min(1, fan.rpm / 1250)
  if (fan.osc && fan.rpm > 60) {
    fan.yawPhase += dt * 0.42
    fan.gear += dt * 0.42
  }
  fan.yaw = 0.7 * Math.sin(fan.yawPhase)
}

const tmpD = new THREE.Vector3()
const tmpF = new THREE.Vector3()
export const headCenter = (out: THREE.Vector3) =>
  out.copy(HEAD_OFFSET).applyAxisAngle(new THREE.Vector3(0, 1, 0), fan.yaw).add(PIVOT)

// ある場所に、いまどれくらい風が届いているか（0..1）
export function windAt(p: THREE.Vector3) {
  if (fan.wind <= 0.001) return 0
  headCenter(tmpD)
  tmpD.subVectors(p, tmpD)
  tmpF.set(Math.sin(fan.yaw), 0, Math.cos(fan.yaw))
  const along = tmpD.dot(tmpF)
  if (along <= 0.02) return 0
  const lateral = tmpD.addScaledVector(tmpF, -along).length()
  const cone = BLADE_R + along * 0.42
  return fan.wind * Math.exp(-Math.pow(lateral / cone, 2)) / (1 + along * 0.7)
}
