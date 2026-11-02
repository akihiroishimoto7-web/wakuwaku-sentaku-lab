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
  fx?: 'speed'
  // しずくが進む本当の水の通り道（あるときは、少しはなれた所からしずくを見まもる）
  drop?: THREE.CatmullRomCurve3
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
const fixed = (p: P) => (_u: number, out: THREE.Vector3) => void out.set(...p)
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

// しずくの通り道（実際の水の流れにそう）
const D1 = curve([[0.32, 0.68, -0.44], [0.24, 0.72, -0.4], [0.2, 0.79, -0.33], [0.2, 0.8, -0.24]])
const D2 = curve([[0.2, 0.81, -0.22], [0.13, 0.815, -0.06], [-0.1, 0.815, 0.05], [-0.175, 0.8, 0.14]])
const D3 = curve([[-0.175, 0.8, 0.14], [-0.175, 0.775, 0.19], [-0.175, 0.755, 0.22]])
const D4 = curve([[-0.175, 0.75, 0.2], [-0.16, 0.73, 0.152], [-0.11, 0.7, 0.16], [-0.08, 0.6, 0.12], [-0.03, 0.42, 0.08]])
const D6 = curve([[0, 0.3, 0.05], [0.03, 0.19, 0.06], [0.07, 0.14, 0.1], [0.12, 0.09, 0.13], [0.17, 0.08, 0.16]])
const D7 = curve([[0.21, 0.08, 0.1], [0.25, 0.1, 0.0], [0.255, 0.25, -0.18], [0.255, 0.62, -0.25], [0.255, 0.68, -0.3], [0.25, 0.62, -0.36], [0.24, 0.45, -0.42]])
const D9 = new THREE.CatmullRomCurve3(Array.from({ length: 24 }, (_, i) => AIR_PATH.getPointAt(0.02 + (i / 23) * 0.9)))

// 少しはなれた所から、しずくを追いかけるカメラ
const chase = (drop: THREE.CatmullRomCurve3, off: P) => ({
  drop,
  pos: (u: number, out: THREE.Vector3) => void drop.getPointAt(ease(u), out).add(new THREE.Vector3(...off)),
  look: (u: number, out: THREE.Vector3) => void drop.getPointAt(ease(u), out),
})
const C8 = curve([[0.24, 0.5, -0.42], [0.52, 0.56, -0.28], [0.66, 0.62, 0.2], [0.42, 0.66, 0.72]])
const C10 = curve([[-0.06, 0.5, 0.12], [0, 0.47, 0.24], [0.08, 0.56, 0.7], [0.3, 0.72, 1.7]])
const TUB: P = [TUB_C.x, TUB_C.y, TUB_C.z]

export const CHAPTERS: Chapter[] = [
  {
    icon: '🚰',
    title: 'じゃぐちから しゅっぱつ！',
    text: 'きみは みずの つぶ。すいどうの ホースから せんたくきの せなかへ。でんきで うごく「きゅうすいべん」が カチッと ひらくよ。',
    dur: 9,
    xray: true,
    fov: 44,
    ...chase(D1, [0.12, 0.22, 0.42]),
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
    fx: 'speed',
    text: 'ほそい くだの なかを びゅーん！ この みちは せんざいいれに つづいているよ。',
    dur: 8,
    xray: true,
    fov: 44,
    ...chase(D2, [0.02, 0.26, 0.42]),
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
    fov: 44,
    ...chase(D3, [0.07, 0.16, 0.34]),
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
    fx: 'speed',
    text: 'そとの おけ（がいそう）に みずが たまっていく。ドラムの あなから なかにも はいるよ。',
    dur: 8,
    xray: true,
    fov: 44,
    ...chase(D4, [0.36, 0.06, 0.22]),
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
    fx: 'speed',
    text: 'よごれた みずは おけの そこへ。はいすいポンプの はねが くるくる まわって、みずを すいこむよ。',
    dur: 8,
    xray: true,
    fov: 44,
    ...chase(D6, [0.16, 0.12, 0.42]),
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
    fx: 'speed',
    text: 'ポンプに おされて ホースを のぼり、せんたくきの そとへ でていく。ばいばい よごれ！ すすぎでも この たびを もういちど くりかえすよ。',
    dur: 8,
    xray: true,
    fov: 44,
    ...chase(D7, [0.4, 0.1, 0.14]),
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
    fx: 'speed',
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
    fov: 44,
    ...chase(D9, [0.1, 0.22, 0.45]),
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

// 乾燥の章で、いま風が「ひやされている／あたためられている」ところか
export function airPhase(u: number): '' | 'cold' | 'hot' {
  const p = 0.02 + ease(u) * 0.9
  if (p > 0.3 && p < 0.45) return 'cold'
  if (p >= 0.45 && p < 0.72) return 'hot'
  return ''
}

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

// ---- 子ども向けの案内（短いひとこと・「いまここ」地図・3Dの名札） ----
type XY = [number, number]
export interface ChapterGuide {
  short: string
  map: XY[] // 洗濯機の断面図（100×100）の上での通り道
  focus: XY // 地図で光らせる場所
  labels: { text: string; pos: P }[]
}

const ring = (cx: number, cy: number, r: number, from: number, to: number, n = 16): XY[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = from + ((to - from) * i) / n
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as XY
  })

export const GUIDES: ChapterGuide[] = [
  { short: 'すいどうの みずが はいってくるよ', map: [[99, 2], [90, 8], [80, 13]], focus: [80, 13], labels: [{ text: '🚰 きゅうすいべん', pos: [0.2, 0.85, -0.24] }] },
  { short: 'くだの なかを びゅーん！', map: [[80, 13], [60, 11], [36, 11], [26, 13]], focus: [58, 11], labels: [{ text: '💧 みずの くだ', pos: [0.02, 0.84, 0.0] }] },
  { short: 'せんざいと いっしょに なるよ', map: [[26, 13], [23, 16], [23, 19]], focus: [23, 14], labels: [{ text: '🧴 せんざいいれ', pos: [-0.175, 0.8, 0.21] }] },
  { short: 'おけに みずが たまっていく', map: [[23, 19], [30, 26], [40, 40], [50, 56]], focus: [50, 56], labels: [{ text: '🪣 そとの おけ', pos: [0.17, 0.45, 0.06] }] },
  { short: 'ふくを もちあげて ストン！', map: ring(50, 56, 13, Math.PI / 2, Math.PI / 2 + Math.PI * 1.2), focus: [50, 56], labels: [{ text: '🥁 ドラムの なか', pos: [0, 0.32, -0.1] }] },
  { short: 'ポンプが みずを すいこむ', map: [[50, 56], [50, 70], [51, 86], [62, 89], [74, 88]], focus: [74, 88], labels: [{ text: '🌀 はいすいポンプ', pos: [0.17, 0.13, 0.14] }] },
  { short: 'ホースから そとへ でていく', map: [[74, 88], [86, 86], [88, 60], [88, 24], [93, 19], [98, 25]], focus: [88, 50], labels: [{ text: '🚀 はいすいホース', pos: [0.255, 0.45, -0.22] }] },
  { short: 'ぐるぐる まわって みずを とばす', map: ring(50, 56, 21, -Math.PI / 4, Math.PI * 1.75, 24), focus: [50, 56], labels: [{ text: '💨 1ぷんに 1000かい！', pos: [0, 0.8, 0.12] }] },
  {
    short: 'あったかい かぜで かわかす',
    map: [[50, 56], [57, 40], [62, 24], [57, 18], [44, 18], [38, 24], [42, 40], [48, 52]],
    focus: [52, 18],
    labels: [
      { text: '❄️ ひやす', pos: [0.07, 0.83, -0.12] },
      { text: '🔥 あたためる', pos: [-0.04, 0.83, -0.12] },
    ],
  },
  { short: 'せんたく だいぼうけん クリア！', map: [[48, 52], [50, 56]], focus: [50, 56], labels: [] },
]

function polyAt(pts: XY[], u: number): XY {
  if (pts.length === 1) return pts[0]
  const segs: number[] = []
  let total = 0
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
    segs.push(d)
    total += d
  }
  let target = Math.min(1, Math.max(0, u)) * total
  for (let i = 0; i < segs.length; i++) {
    if (target <= segs[i] || i === segs.length - 1) {
      const k = segs[i] ? Math.min(1, target / segs[i]) : 0
      return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k]
    }
    target -= segs[i]
  }
  return pts[pts.length - 1]
}

// 地図の上の「しずく」の位置と、ここまで通ってきた道
export function mapProgress(ch: number, u: number) {
  const e = ease(Math.min(1, Math.max(0, u)))
  const here = polyAt(GUIDES[ch].map, e)
  const trail: XY[] = []
  for (let i = 0; i < ch; i++) trail.push(...GUIDES[i].map)
  const cur = GUIDES[ch].map
  const steps = 12
  for (let i = 0; i <= steps; i++) trail.push(polyAt(cur, (e * i) / steps))
  return { here, trail: trail.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ') }
}

export const fullRoute = () =>
  GUIDES.flatMap((g) => g.map)
    .map((p) => p.join(','))
    .join(' ')
