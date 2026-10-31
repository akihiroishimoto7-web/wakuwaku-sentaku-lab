import * as THREE from 'three'
import { AIR_PATH, TUB_C } from './data'
import { sim } from './sim'
import { useStore } from './store'

// 「たんけん」：みずのつぶになって、給水から乾燥まで洗濯機の中を旅するガイドツアー。
// カメラの通り道と、その章で見せる機械の動き（デモ用の状態）をまとめて定義する。

export interface Chapter {
  icon: string
  title: string
  text: string
  dur: number
  xray: boolean
  fov: number
  pos: (u: number, out: THREE.Vector3) => void
  look: (u: number, out: THREE.Vector3) => void
  demo: (t: number, dur: number, dt: number) => void
}

type P = [number, number, number]
const curve = (pts: P[]) => new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)))
const ease = (u: number) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2)
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const approach = (v: number, target: number, rate: number, dt: number) => v + (target - v) * Math.min(1, rate * dt)
const alternate = (t: number, amp: number) => {
  const s = t % 6.4
  return s < 2.8 ? amp : s < 3.2 ? 0 : s < 6.0 ? -amp : 0
}
const along = (c: THREE.CatmullRomCurve3) => (u: number, out: THREE.Vector3) => void c.getPointAt(ease(u), out)
const ahead = (c: THREE.CatmullRomCurve3, d = 0.15, dy = -0.02) => (u: number, out: THREE.Vector3) => {
  const e = ease(u)
  if (e + d <= 1) c.getPointAt(e + d, out)
  else {
    // 終点の先は接線方向に伸ばす
    c.getPointAt(1, out).addScaledVector(c.getTangentAt(1), (e + d - 1) * c.getLength())
  }
  out.y += dy
}
const fixed = (p: P) => (_u: number, out: THREE.Vector3) => void out.set(...p)
const mix = (a: (u: number, o: THREE.Vector3) => void, b: (u: number, o: THREE.Vector3) => void, from: number, to: number) => {
  const tmp = new THREE.Vector3()
  return (u: number, out: THREE.Vector3) => {
    a(u, out)
    b(u, tmp)
    out.lerp(tmp, smooth(from, to, u))
  }
}

// 機械のデモ状態（章ごとに少しずつ近づける）
function quiet(dt: number) {
  sim.valve = approach(sim.valve, 0, 6, dt)
  sim.pump = approach(sim.pump, 0, 5, dt)
  sim.drainFlow = approach(sim.drainFlow, 0, 5, dt)
  sim.airflow = approach(sim.airflow, 0, 2, dt)
  sim.heat = approach(sim.heat, 0, 1, dt)
  sim.spinWater = 0
}
function turn(target: number, dt: number) {
  sim.omega = approach(sim.omega, target, 3, dt)
  sim.rpm = approach(sim.rpm, (Math.abs(sim.omega) * 60) / (Math.PI * 2), 6, dt)
}

const C1 = curve([[0.62, 1.1, -0.12], [0.46, 0.95, -0.33], [0.31, 0.85, -0.36]])
const C2 = curve([[0.29, 0.85, -0.33], [0.21, 0.835, -0.22], [0.13, 0.85, -0.06], [-0.1, 0.85, 0.05], [-0.17, 0.84, 0.12]])
const C3 = curve([[-0.17, 0.84, 0.12], [-0.2, 0.875, 0.2], [-0.175, 0.865, 0.27]])
const C4 = curve([[-0.175, 0.85, 0.26], [-0.14, 0.74, 0.19], [-0.09, 0.62, 0.14], [-0.02, 0.5, 0.11]])
const C6 = curve([[0, 0.5, 0.11], [0, 0.36, 0.09], [0.02, 0.26, 0.08], [0.04, 0.2, 0.07], [0.08, 0.14, 0.1], [0.12, 0.1, 0.15], [0.16, 0.1, 0.23]])
const C7 = curve([[0.16, 0.1, 0.23], [0.22, 0.11, 0.12], [0.25, 0.13, 0], [0.255, 0.28, -0.17], [0.255, 0.6, -0.24], [0.255, 0.71, -0.3], [0.25, 0.64, -0.37], [0.24, 0.5, -0.42]])
const C8 = curve([[0, 0.48, 0.12], [0.1, 0.55, 0.36], [0.42, 0.68, 0.72]])
const C10 = curve([[-0.06, 0.5, 0.12], [0, 0.47, 0.24], [0.08, 0.56, 0.7], [0.3, 0.72, 1.7]])
const TUB: P = [TUB_C.x, TUB_C.y, TUB_C.z]

export const CHAPTERS: Chapter[] = [
  {
    icon: '🚰',
    title: 'じゃぐちから しゅっぱつ！',
    text: 'きみは みずの つぶ。すいどうの ホースから せんたくきの せなかへ。でんきで うごく「きゅうすいべん」が カチッと ひらくよ。',
    dur: 9,
    xray: true,
    fov: 45,
    pos: along(C1),
    look: fixed([0.2, 0.79, -0.24]),
    demo: (t, _d, dt) => {
      quiet(dt)
      sim.valve = approach(sim.valve, t > 3 ? 1 : 0, 6, dt)
      sim.inlet = sim.valve
      sim.level = approach(sim.level, 0, 1, dt)
      turn(0, dt)
    },
  },
  {
    icon: '🛝',
    title: 'みずの みちを すすめ',
    text: 'ほそい くだの なかを びゅーん！ この みちは せんざいいれに つづいているよ。',
    dur: 8,
    xray: true,
    fov: 55,
    pos: along(C2),
    look: ahead(C2, 0.18, -0.03),
    demo: (_t, _d, dt) => {
      quiet(dt)
      sim.valve = approach(sim.valve, 1, 6, dt)
      sim.inlet = sim.valve
      turn(0, dt)
    },
  },
  {
    icon: '🧴',
    title: 'せんざいと がっしん',
    text: 'せんざいいれで せんざいと まざるよ。あわの もとが いっしょに ついてくる！',
    dur: 7,
    xray: true,
    fov: 55,
    pos: along(C3),
    look: fixed([-0.175, 0.745, 0.2]),
    demo: (t, d, dt) => {
      quiet(dt)
      sim.valve = approach(sim.valve, 1, 6, dt)
      sim.inlet = sim.valve
      sim.drawer = t < 0.1 ? 1 : Math.max(0.25, 1 - 0.75 * (t / d))
      sim.detInWater = approach(sim.detInWater, 0.9, 0.5, dt)
      turn(0, dt)
    },
  },
  {
    icon: '🌊',
    title: 'おけの なかへ ザブーン',
    text: 'そとの おけ（がいそう）に みずが たまっていく。ドラムの あなから なかにも はいるよ。',
    dur: 8,
    xray: true,
    fov: 58,
    pos: along(C4),
    look: mix(ahead(C4, 0.25, -0.03), fixed([0, 0.4, -0.12]), 0.45, 0.85),
    demo: (t, d, dt) => {
      quiet(dt)
      sim.valve = approach(sim.valve, 1, 6, dt)
      sim.inlet = sim.valve
      sim.drawer = approach(sim.drawer, 0, 0.8, dt)
      sim.level = Math.min(0.42, (0.42 * t) / (d * 0.85))
      sim.foam = approach(sim.foam, 0.5, 0.4, dt)
      turn(t > 3 ? alternate(t, 2.6) : 0, dt)
      sim.wet = approach(sim.wet, 1, 0.8, dt)
    },
  },
  {
    icon: '🌀',
    title: 'ドラムで ぐるぐる あらい',
    text: 'ドラムが みぎ・ひだりに まわる。でっぱり（リフター）が ふくを もちあげて ストン！ よごれが どんどん みずへ。',
    dur: 11,
    xray: false,
    fov: 62,
    pos: (u, out) => {
      const a = u * Math.PI * 1.2
      out.set(TUB_C.x + 0.07 * Math.sin(a), TUB_C.y + 0.05 + 0.02 * Math.cos(a), 0.11)
    },
    look: (u, out) => {
      const a = u * Math.PI * 1.2
      out.set(TUB_C.x + 0.02 * Math.sin(a), TUB_C.y - 0.05, -0.12)
    },
    demo: (t, _d, dt) => {
      quiet(dt)
      sim.inlet = 0
      sim.level = approach(sim.level, 0.42, 1, dt)
      sim.foam = approach(sim.foam, 0.85, 0.5, dt)
      sim.waterDirt = approach(sim.waterDirt, 0.6, 0.25, dt)
      sim.dirtMud *= Math.exp(-0.25 * dt)
      sim.dirtOil *= Math.exp(-0.18 * dt)
      sim.wet = approach(sim.wet, 1, 1, dt)
      turn(alternate(t, 4.7), dt)
    },
  },
  {
    icon: '⬇️',
    title: 'そこから はいすいへ',
    text: 'よごれた みずは おけの そこへ。はいすいポンプの はねが くるくる まわって、みずを すいこむよ。',
    dur: 8,
    xray: true,
    fov: 58,
    pos: along(C6),
    look: mix(ahead(C6, 0.15, -0.01), fixed([0.17, 0.08, 0.14]), 0.65, 0.9),
    demo: (t, d, dt) => {
      quiet(dt)
      sim.inlet = 0
      sim.pump = approach(sim.pump, 1, 5, dt)
      sim.drainFlow = 1
      sim.level = Math.max(0, 0.42 * (1 - t / (d * 0.9)))
      sim.foam = approach(sim.foam, 0.2, 0.4, dt)
      turn(alternate(t, 1.6), dt)
    },
  },
  {
    icon: '🚀',
    title: 'ホースを のぼって そとへ',
    text: 'ポンプに おされて ホースを のぼり、せんたくきの そとへ でていく。ばいばい よごれ！ すすぎでも この たびを もういちど くりかえすよ。',
    dur: 8,
    xray: true,
    fov: 58,
    pos: along(C7),
    look: ahead(C7, 0.12, 0),
    demo: (t, _d, dt) => {
      quiet(dt)
      sim.inlet = 0
      sim.pump = approach(sim.pump, 1, 5, dt)
      sim.drainFlow = 1
      sim.level = approach(sim.level, 0, 1, dt)
      sim.foam = approach(sim.foam, 0, 0.5, dt)
      turn(alternate(t, 1.6), dt)
    },
  },
  {
    icon: '💨',
    title: 'だっすい！ びゅんびゅん',
    text: 'ドラムが 1ぷんに 1000かいも まわる！ ふくの みずが ちいさな あなから そとへ とびだしていくよ。',
    dur: 10,
    xray: true,
    fov: 50,
    pos: along(C8),
    look: fixed(TUB),
    demo: (t, d, dt) => {
      quiet(dt)
      sim.inlet = 0
      sim.level = 0
      sim.waterDirt = approach(sim.waterDirt, 0.15, 0.3, dt)
      sim.pump = approach(sim.pump, 1, 5, dt)
      sim.drainFlow = 1
      sim.rpm = 50 + 950 * smooth(1, d * 0.55, t)
      sim.omega = Math.min((sim.rpm * Math.PI * 2) / 60, 24)
      sim.wet = approach(sim.wet, 0.35, 0.35, dt)
      sim.spinWater = Math.max(0, sim.wet - 0.3) * Math.min(1, sim.rpm / 400) + 0.08
    },
  },
  {
    icon: '♨️',
    title: 'あったかい かぜの たび',
    text: 'しめった かぜは ひやされて みずを おとし（じょしつ）、あたためられて ドラムに もどる。ぐるぐる まわって ふくが かわく！',
    dur: 12,
    xray: true,
    fov: 62,
    pos: (u, out) => void AIR_PATH.getPointAt(0.02 + ease(u) * 0.9, out),
    look: (u, out) => void AIR_PATH.getPointAt(Math.min(0.999, 0.02 + ease(u) * 0.9 + 0.05), out),
    demo: (t, _d, dt) => {
      quiet(dt)
      sim.airflow = approach(sim.airflow, 1, 2, dt)
      sim.heat = approach(sim.heat, 1, 0.8, dt)
      sim.wet = approach(sim.wet, 0.02, 0.25, dt)
      sim.drainFlow = 0
      turn(alternate(t, 3.4), dt)
    },
  },
  {
    icon: '🏁',
    title: 'ゴール！ ぴかぴか',
    text: 'みずの つぶの だいぼうけん、おしまい！ じゃぐちから はじまって、あらって、だして、かわかす。せんたくきの しくみが ぜんぶ わかったね。',
    dur: 7,
    xray: false,
    fov: 40,
    pos: along(C10),
    look: fixed([0, 0.45, 0]),
    demo: (_t, _d, dt) => {
      quiet(dt)
      turn(0, dt)
      sim.wet = approach(sim.wet, 0, 0.5, dt)
    },
  },
]

// ---- 進行 ----
const KEYS = [
  'level', 'valve', 'inlet', 'pump', 'drainFlow', 'omega', 'rpm', 'foam', 'detInWater', 'drawer',
  'waterDirt', 'dirtMud', 'dirtOil', 'wet', 'heat', 'airflow', 'spinWater',
] as const
type Snapshot = Record<(typeof KEYS)[number], number>

export const tour = { ch: 0, t: 0, done: false, snapshot: null as Snapshot | null }

export function beginTour() {
  tour.snapshot = Object.fromEntries(KEYS.map((k) => [k, sim[k]])) as Snapshot
  tour.ch = 0
  tour.t = 0
  tour.done = false
  sim.level = 0
  sim.foam = 0
  sim.waterDirt = 0
  sim.dirtMud = 1
  sim.dirtOil = 1
  sim.wet = 0.1
  sim.drawer = 0
  sim.detInWater = 0
}

export function endTour() {
  if (tour.snapshot) Object.assign(sim, tour.snapshot)
  tour.snapshot = null
}

export function jumpChapter(ch: number) {
  tour.ch = Math.max(0, Math.min(CHAPTERS.length - 1, ch))
  tour.t = 0
  tour.done = false
}

export function stepTour(dt: number) {
  const c = CHAPTERS[tour.ch]
  tour.t = Math.min(c.dur, tour.t + dt)
  c.demo(tour.t, c.dur, dt)
  sim.time += dt
  sim.dt = dt
  sim.angle += sim.omega * dt
  let amp = Math.abs(sim.omega) * 0.00012
  if (sim.rpm > 120) amp = 0.0045 * Math.exp(-Math.pow((sim.rpm - 260) / 120, 2)) + 0.0009 * Math.min(1, sim.rpm / 500)
  sim.vib.set(Math.sin(sim.angle * 0.5 + sim.time * 31) * amp, Math.cos(sim.angle * 0.5 + sim.time * 27) * amp * 0.7, 0)
  if (tour.t >= c.dur) {
    if (tour.ch < CHAPTERS.length - 1) {
      tour.ch++
      tour.t = 0
      useStore.getState().setTourChapter(tour.ch)
    } else if (!tour.done) {
      tour.done = true
      useStore.getState().finishTour()
    }
  }
}
