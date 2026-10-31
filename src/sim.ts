import * as THREE from 'three'

// 洗濯サイクルの疑似シミュレーション（教育用モデル。実機の制御を再現したものではありません）

export type PhaseId = 'fill' | 'wash' | 'drain' | 'rinseFill' | 'rinse' | 'rinseDrain' | 'spin' | 'dry'
export type CourseId = 'standard' | 'quick' | 'heavy' | 'dry'

export const PHASES: Record<PhaseId, { label: string; icon: string; desc: string; color: string }> = {
  fill: { label: 'きゅうすい', icon: '🚰', desc: 'きゅうすいべんが ひらいて、みずと せんざいが はいってくるよ', color: '#4cb8ff' },
  wash: { label: 'あらい', icon: '🌀', desc: 'ドラムが みぎ・ひだりに まわって、ふくを もちあげては おとすよ', color: '#7a6cff' },
  drain: { label: 'はいすい', icon: '⬇️', desc: 'はいすいポンプが よごれた みずを そとへ だすよ', color: '#b08a5a' },
  rinseFill: { label: 'すすぎ', icon: '🚰', desc: 'あたらしい きれいな みずを いれるよ', color: '#36d0c4' },
  rinse: { label: 'すすぎ', icon: '💧', desc: 'せんざいと よごれを あらいながすよ。あわが へっていくね', color: '#36d0c4' },
  rinseDrain: { label: 'はいすい', icon: '⬇️', desc: 'すすいだ みずを そとへ だすよ', color: '#b08a5a' },
  spin: { label: 'だっすい', icon: '💨', desc: 'ドラムが ものすごく はやく まわって、みずが あなから とびだすよ', color: '#ff8a3d' },
  dry: { label: 'かんそう', icon: '♨️', desc: 'あたたかい かぜが ぐるぐる めぐって、ふくを かわかすよ', color: '#ff5a6e' },
}

export const COURSES: Record<CourseId, { name: string; icon: string; note: string; phases: [PhaseId, number][] }> = {
  standard: {
    name: 'おまかせ',
    icon: '⭐',
    note: 'ふつうの せんたく',
    phases: [['fill', 7], ['wash', 20], ['drain', 5], ['rinseFill', 5], ['rinse', 10], ['rinseDrain', 4], ['spin', 13]],
  },
  quick: {
    name: 'はやい',
    icon: '⚡',
    note: 'みじかく ためす',
    phases: [['fill', 6], ['wash', 14], ['drain', 4], ['rinseFill', 5], ['rinse', 8], ['rinseDrain', 4], ['spin', 10]],
  },
  heavy: {
    name: 'しっかり',
    icon: '💪',
    note: 'すすぎ 2かい',
    phases: [
      ['fill', 7], ['wash', 26], ['drain', 5], ['rinseFill', 5], ['rinse', 8], ['rinseDrain', 4],
      ['rinseFill', 5], ['rinse', 8], ['rinseDrain', 4], ['spin', 13],
    ],
  },
  dry: {
    name: 'かんそうつき',
    icon: '☀️',
    note: 'さいごに かわかす',
    phases: [['fill', 7], ['wash', 18], ['drain', 5], ['rinseFill', 5], ['rinse', 9], ['rinseDrain', 4], ['spin', 12], ['dry', 26]],
  },
}
export const COURSE_IDS = Object.keys(COURSES) as CourseId[]

export const courseDuration = (c: CourseId) => COURSES[c].phases.reduce((a, p) => a + p[1], 0)

export const SPIN_RPM = 1000
const WASH_OMEGA = 4.7 // ≒45回/分
const VISUAL_OMEGA_MAX = 24 // 表示上のドラム最高角速度（実際の1000回/分は速すぎて見えないため）

export const sim = {
  running: false,
  done: false,
  phases: [] as [PhaseId, number][],
  idx: 0,
  t: 0,
  phaseId: null as PhaseId | null,
  detergent: false,
  timeScale: 1,
  time: 0,
  dt: 0,
  // 状態量
  level: 0, // 0..1（おけの直径に対する水位）
  valve: 0,
  inlet: 0,
  pump: 0,
  drainFlow: 0,
  omega: 0,
  angle: 0,
  rpm: 0,
  foam: 0,
  detInWater: 0,
  drawer: 0,
  waterDirt: 0,
  dirtMud: 1,
  dirtOil: 1,
  wet: 0,
  heat: 0,
  airflow: 0,
  spinWater: 0,
  vib: new THREE.Vector3(),
  xray: 0,
}
export type SimState = typeof sim

export function resetSim() {
  Object.assign(sim, {
    running: false, done: false, phases: [], idx: 0, t: 0, phaseId: null,
    level: 0, valve: 0, inlet: 0, pump: 0, drainFlow: 0, omega: 0, rpm: 0, foam: 0,
    detInWater: 0, drawer: 0, waterDirt: 0, dirtMud: 1, dirtOil: 1, wet: 0, heat: 0, airflow: 0, spinWater: 0,
  })
  sim.vib.set(0, 0, 0)
}

export function startCycle(course: CourseId, detergent: boolean) {
  sim.phases = COURSES[course].phases
  sim.idx = 0
  sim.t = 0
  sim.running = true
  sim.done = false
  sim.detergent = detergent
}

export function remaining() {
  if (!sim.running) return 0
  let r = sim.phases[sim.idx][1] - sim.t
  for (let i = sim.idx + 1; i < sim.phases.length; i++) r += sim.phases[i][1]
  return Math.max(0, r)
}

export function totalProgress() {
  if (!sim.phases.length) return 0
  let total = 0
  let done = 0
  sim.phases.forEach(([, d], i) => {
    total += d
    if (i < sim.idx) done += d
  })
  if (sim.running) done += Math.min(sim.t, sim.phases[sim.idx][1])
  else if (sim.done) done = total
  return done / total
}

export const cleanRatio = () => 1 - (0.5 * sim.dirtMud + 0.5 * sim.dirtOil)

const approach = (v: number, target: number, rate: number, dt: number) => v + (target - v) * Math.min(1, rate * dt)

// 左右交互の回転パターン
function alternate(t: number, amp: number) {
  const s = t % 6.4
  if (s < 2.8) return amp
  if (s < 3.2) return 0
  if (s < 6.0) return -amp
  return 0
}

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

export function stepSim(dt: number) {
  const s = sim
  s.dt = dt
  s.time += dt
  if (dt <= 0) return
  let targetOmega = 0
  let valve = 0
  let pump = 0
  let heat = 0
  let air = 0
  let spinning = false

  if (s.running) {
    const [ph, dur] = s.phases[s.idx]
    s.phaseId = ph
    s.t += dt
    const t = s.t
    switch (ph) {
      case 'fill':
      case 'rinseFill': {
        valve = t < dur * 0.9 ? 1 : 0
        const target = ph === 'fill' ? 0.42 : 0.38
        if (valve) s.level = Math.min(target, s.level + (dt * target) / (dur * 0.8))
        targetOmega = t > 1.5 ? alternate(t, 2.6) : 0
        if (ph === 'fill' && s.drawer > 0) {
          const tr = Math.min(s.drawer, (dt * 1.4) / dur)
          s.drawer -= tr
          s.detInWater += tr
        }
        break
      }
      case 'wash':
      case 'rinse':
        targetOmega = alternate(t, WASH_OMEGA)
        if (ph === 'rinse') s.detInWater = approach(s.detInWater, 0, 0.18, dt)
        break
      case 'drain':
      case 'rinseDrain':
        pump = 1
        s.level = Math.max(0, s.level - (dt * 0.42) / (dur * 0.7))
        targetOmega = alternate(t, 1.6)
        break
      case 'spin': {
        pump = 1
        spinning = true
        s.level = Math.max(0, s.level - dt * 0.2)
        const up = smooth(1.2, dur * 0.6, t)
        const down = 1 - smooth(dur - 2.6, dur - 0.2, t)
        s.rpm = (50 + (SPIN_RPM - 50) * up) * down * (t < 1.2 ? t / 1.2 : 1)
        break
      }
      case 'dry':
        heat = 1
        air = 1
        targetOmega = alternate(t, 3.4)
        break
    }

    if (s.t >= dur) {
      s.idx++
      s.t = 0
      if (s.idx >= s.phases.length) {
        s.running = false
        s.done = true
        s.phaseId = null
        s.idx = s.phases.length - 1
      } else {
        const next = s.phases[s.idx][0]
        if (next === 'rinseFill') {
          s.waterDirt *= 0.25
          s.detInWater *= 0.3
        }
      }
    }
  }

  // 回転
  if (spinning) {
    const w = (s.rpm * Math.PI * 2) / 60
    s.omega = Math.min(w, VISUAL_OMEGA_MAX)
  } else {
    s.omega = approach(s.omega, targetOmega, 3, dt)
    s.rpm = approach(s.rpm, (Math.abs(s.omega) * 60) / (Math.PI * 2), 6, dt)
  }
  s.angle += s.omega * dt

  // 振動（だっすいの立ち上がりで共振 → ダンパーが吸収）
  let amp = Math.abs(s.omega) * 0.00012
  if (spinning) {
    const res = Math.exp(-Math.pow((s.rpm - 260) / 120, 2))
    amp = 0.0045 * res + 0.0009 * Math.min(1, s.rpm / 500)
  }
  s.vib.set(Math.sin(s.angle * 0.5 + s.time * 31) * amp, Math.cos(s.angle * 0.5 + s.time * 27) * amp * 0.7, 0)

  // 給排水
  s.valve = approach(s.valve, valve, 8, dt)
  s.inlet = s.valve
  s.pump = approach(s.pump, pump, 5, dt)
  s.drainFlow = pump ? (s.level > 0.01 || (spinning && s.wet > 0.35) ? 1 : 0.15) : approach(s.drainFlow, 0, 4, dt)
  if (!s.running) s.level = approach(s.level, 0, 0.6, dt)

  // 汚れ・泡・水の汚れ
  const submerged = s.level > 0.15
  const agit = Math.min(1, Math.abs(s.omega) / WASH_OMEGA)
  const det = Math.min(1, s.detInWater * 1.2)
  if (submerged && s.wet > 0.4) {
    const km = 0.06 + 0.12 * agit + 0.05 * det
    const ko = 0.008 + det * (0.06 + 0.1 * agit)
    const m0 = s.dirtMud
    const o0 = s.dirtOil
    s.dirtMud *= Math.exp(-km * dt)
    s.dirtOil *= Math.exp(-ko * dt)
    s.waterDirt = Math.min(1, s.waterDirt + (m0 - s.dirtMud + o0 - s.dirtOil) * 1.4)
  }
  const foamTarget = submerged ? det * (0.55 + 0.45 * agit) : s.level > 0.02 ? s.foam * 0.6 : 0
  s.foam = approach(s.foam, foamTarget, foamTarget > s.foam ? 0.5 : 0.35, dt)

  // 濡れ具合
  if (s.level > 0.08) s.wet = approach(s.wet, 1, 0.6, dt)
  else if (spinning) s.wet = approach(s.wet, 0.3, 0.0004 * s.rpm, dt)
  else if (heat > 0) s.wet = approach(s.wet, 0, 0.13 * s.heat, dt)
  s.spinWater = spinning ? Math.max(0, s.wet - 0.3) * Math.min(1, s.rpm / 400) : 0

  s.heat = approach(s.heat, heat, 0.5, dt)
  s.airflow = approach(s.airflow, air, 1.5, dt)
}
