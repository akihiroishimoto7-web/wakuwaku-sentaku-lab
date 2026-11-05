import * as THREE from 'three'
import { fan, stepFan } from './sim'
import { useFan } from './store'

// 扇風機の「たんけん」：でんきの つぶ → かぜの つぶ になって、しくみを旅する

type P = [number, number, number]
type XY = [number, number]
const V = (p: P) => new THREE.Vector3(...p)
const curve = (pts: P[]) => new THREE.CatmullRomCurve3(pts.map(V))
const ease = (u: number) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2)
const approach = (v: number, t: number, r: number, dt: number) => v + (t - v) * Math.min(1, r * dt)

export interface FanChapter {
  icon: string
  title: string
  short: string
  text: string
  dur: number
  xray: boolean
  fov: number
  spark: boolean // でんきの つぶ（黄色）か、かぜの つぶ（白）か
  fx?: 'speed'
  drop?: THREE.CatmullRomCurve3
  pos: (u: number, out: THREE.Vector3) => void
  look: (u: number, out: THREE.Vector3) => void
  demo: (t: number, dur: number, dt: number) => void
  map: XY[]
  focus: XY
  labels: { text: string; pos: P }[]
}

const chase = (drop: THREE.CatmullRomCurve3, off: P) => ({
  drop,
  pos: (u: number, out: THREE.Vector3) => void drop.getPointAt(ease(u), out).add(V(off)),
  look: (u: number, out: THREE.Vector3) => void drop.getPointAt(ease(u), out),
})
const ring = (cx: number, cy: number, r: number, n = 16, turns = 1): XY[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = (i / n) * Math.PI * 2 * turns
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as XY
  })

// 首をまっすぐ前にもどす
function faceFront(dt: number) {
  fan.osc = false
  const target = Math.round(fan.yawPhase / Math.PI) * Math.PI
  fan.yawPhase = approach(fan.yawPhase, target, 2, dt)
}
// 首振りは stepFan が進めるので、ここではスイッチを入れるだけ
function oscillate(_dt: number) {
  fan.osc = true
}

const D1 = curve([[-0.72, 0.24, -0.67], [-0.72, 0.1, -0.66], [-0.62, 0.012, -0.64], [-0.3, 0.012, -0.5], [0, 0.012, -0.28], [0, 0.025, -0.17]])
const D2 = curve([[0, 0.025, -0.17], [0, 0.03, -0.05], [0, 0.035, 0.08], [0.05, 0.035, 0.05], [0.07, 0.038, -0.04], [0.02, 0.05, -0.01], [0, 0.09, 0]])
const D3 = curve([[0, 0.09, 0], [0, 0.4, 0], [0, 0.76, 0], [0, 0.79, -0.05], [0, 0.82, -0.09]])
const D4 = new THREE.CatmullRomCurve3(Array.from({ length: 25 }, (_, i) => {
  const a = (i / 24) * Math.PI * 3 - Math.PI / 2
  return new THREE.Vector3(Math.cos(a) * 0.05, 0.82 + Math.sin(a) * 0.05, -0.12 + (i / 24) * 0.06)
}))
const D5 = curve([[0.06, 0.98, -0.5], [0.04, 0.88, -0.3], [0.02, 0.84, -0.1], [0.04, 0.83, 0.02]])
const D6 = curve([[0.06, 0.84, 0.04], [0.1, 0.86, 0.28], [0.14, 0.85, 0.6], [0.2, 0.83, 0.95]])
const D8 = curve([[0.12, 0.84, 0.4], [0.44, 0.82, 0.7], [0.2, 0.98, 0.95], [-0.2, 1.08, 0.9], [-0.42, 1.08, 0.74]])
const D9 = curve([[-0.42, 1.06, 0.76], [-0.18, 0.96, 0.8], [-0.02, 0.9, 0.94], [0.02, 0.9, 1.1]])
const C10 = curve([[0.12, 0.92, 0.85], [0.3, 1.0, 1.4], [0.55, 1.15, 2.3]])

export const FAN_CHAPTERS: FanChapter[] = [
  {
    icon: '🔌',
    title: 'コンセントから しゅっぱつ！',
    short: 'コードを とおって せんぷうきへ',
    text: 'きみは でんきの つぶ。かべの コンセントから、ながい コードを とおって せんぷうきへ むかうよ。',
    dur: 8,
    xray: true,
    fov: 44,
    spark: true,
    ...chase(D1, [0.3, 0.34, 0.6]),
    demo: (_t, _d, dt) => {
      faceFront(dt)
      fan.level = 0
      stepFan(dt)
      fan.power = 1
    },
    map: [[4, 72], [4, 95], [12, 95], [17, 94]],
    focus: [4, 72],
    labels: [{ text: '🔌 コンセント', pos: [-0.72, 0.38, -0.66] }],
  },
  {
    icon: '🎚️',
    title: 'スイッチを とおる',
    short: 'スイッチで つよさを えらぶ',
    text: 'だいの なかの スイッチで、まわる つよさが きまるよ。きょうは いちばん つよい「つよ」で いこう！',
    dur: 8,
    xray: true,
    fov: 44,
    spark: true,
    ...chase(D2, [0.16, 0.26, 0.42]),
    demo: (t, _d, dt) => {
      faceFront(dt)
      fan.level = t > 3 ? 3 : 0
      stepFan(dt)
      fan.rpm = 0
      fan.power = 1
    },
    map: [[17, 94], [21, 93], [27, 93], [24, 92]],
    focus: [26, 93],
    labels: [{ text: '🎚️ スイッチ', pos: [0, 0.1, 0.13] }],
  },
  {
    icon: '⬆️',
    title: 'ぼうの なかを のぼる',
    short: 'ぼうを のぼって モーターへ',
    text: 'ほそい ぼうの なかを、でんきの みちが まっすぐ のびているよ。うえの モーターまで のぼろう！',
    dur: 7,
    xray: true,
    fov: 44,
    spark: true,
    ...chase(D3, [0.34, 0.06, 0.42]),
    fx: 'speed',
    demo: (_t, _d, dt) => {
      faceFront(dt)
      fan.level = 3
      stepFan(dt)
      fan.rpm = 0
      fan.power = 1
    },
    map: [[21, 92], [21, 46], [17, 40]],
    focus: [21, 66],
    labels: [{ text: '📏 でんきの みち', pos: [0.05, 0.45, 0] }],
  },
  {
    icon: '🧲',
    title: 'モーターが まわりだす',
    short: 'コイルが じしゃくに なって まわる',
    text: 'コイルに でんきが ながれると じしゃくに なる。じしゃくの ちからが ぐるぐる まわって、まんなかが まわりだすよ！',
    dur: 10,
    xray: true,
    fov: 44,
    spark: true,
    ...chase(D4, [0.26, 0.1, 0.26]),
    demo: (t, _d, dt) => {
      faceFront(dt)
      fan.level = t > 1.5 ? 3 : 0
      stepFan(dt)
      fan.power = 1
    },
    map: ring(15, 38, 3, 20, 1.5),
    focus: [15, 38],
    labels: [{ text: '🧲 モーター', pos: [0, 0.93, -0.09] }],
  },
  {
    icon: '🌬️',
    title: 'かぜの つぶに へんしん！',
    short: 'うしろから すいこまれる',
    text: 'ここからは かぜの つぶ。せんぷうきの うしろの あみから、はねに すいこまれていくよ。',
    dur: 8,
    xray: false,
    fov: 44,
    spark: false,
    ...chase(D5, [0.32, 0.08, 0.06]),
    demo: (_t, _d, dt) => {
      faceFront(dt)
      fan.level = 3
      stepFan(dt)
    },
    map: [[2, 30], [8, 34], [18, 38], [24, 38]],
    focus: [10, 36],
    labels: [{ text: '🛡️ うしろの ガード', pos: [0.0, 0.95, -0.1] }],
  },
  {
    icon: '🌀',
    title: 'はねに おされて びゅーん！',
    short: 'ななめの はねが くうきを おす',
    text: 'ななめに ねじれた はねが、くうきを まえへ おしだす。うちわで あおぐのと おなじ しくみだよ。',
    dur: 9,
    xray: false,
    fov: 44,
    spark: false,
    fx: 'speed',
    ...chase(D6, [0.14, 0.08, 0.34]),
    demo: (_t, _d, dt) => {
      faceFront(dt)
      fan.level = 3
      stepFan(dt)
    },
    map: [[25, 38], [40, 37], [55, 39]],
    focus: [26, 38],
    labels: [{ text: '🌀 はね', pos: [0, 1.0, 0.04] }],
  },
  {
    icon: '⚙️',
    title: 'くびふりの ひみつ',
    short: 'はぐるまで くびを ふる',
    text: 'モーターの じくの うしろに、ねじの ような はぐるま。おおきな はぐるまを ゆっくり まわして、うでで くびを みぎ・ひだりに ふるよ。',
    dur: 11,
    xray: true,
    fov: 44,
    spark: false,
    pos: (u, out) => void out.set(0.38 - u * 0.1, 1.04, -0.5 + u * 0.05),
    look: (_u, out) => void out.set(0, 0.8, -0.17),
    demo: (_t, _d, dt) => {
      fan.level = 3
      stepFan(dt)
      oscillate(dt)
    },
    map: ring(12, 38, 5, 20),
    focus: [11, 40],
    labels: [{ text: '⚙️ はぐるま', pos: [0, 0.9, -0.27] }],
  },
  {
    icon: '🎐',
    title: 'へやを たびしよう',
    short: 'かざぐるまと ふうりんへ',
    text: 'くびを ふるから、へやの あちこちに かぜが とどく。かざぐるまが くるくる、ふうりんが チリーン！',
    dur: 11,
    xray: false,
    fov: 46,
    spark: false,
    ...chase(D8, [0.05, 0.24, 0.8]),
    demo: (_t, _d, dt) => {
      fan.level = 3
      stepFan(dt)
      oscillate(dt)
    },
    map: [[45, 38], [62, 40], [58, 28], [55, 24]],
    focus: [62, 40],
    labels: [
      { text: '🎡 かざぐるま', pos: [0.5, 0.94, 0.78] },
      { text: '🎐 ふうりん', pos: [-0.42, 1.27, 0.72] },
    ],
  },
  {
    icon: '💧',
    title: 'はだが すずしい ひみつ',
    short: 'あせが かわいて すずしい',
    text: 'かぜが あせを かわかすとき、からだの あつさを いっしょに もっていく。だから すずしく かんじるんだ。',
    dur: 11,
    xray: false,
    fov: 44,
    spark: false,
    // うでを ずっと がめんに いれたまま、かぜの つぶが とんでくるのを まつ
    drop: D9,
    pos: (u, out) => void out.set(0.17 - 0.02 * u, 1.0, 1.66 - 0.05 * u),
    look: (_u, out) => void out.set(0.05, 0.86, 1.02),
    demo: (_t, _d, dt) => {
      faceFront(dt)
      fan.level = 3
      stepFan(dt)
    },
    map: [[55, 24], [75, 32], [86, 40]],
    focus: [88, 40],
    labels: [{ text: '✋ きみの うで（イメージ）', pos: [0.085, 0.95, 1.28] }],
  },
  {
    icon: '🏁',
    title: 'ゴール！ すずしい〜',
    short: 'かぜの だいぼうけん クリア！',
    text: 'でんきが モーターを まわし、はねが かぜを つくり、かぜが きみを すずしく する。せんぷうきの しくみ、ぜんぶ わかったね！',
    dur: 7,
    xray: false,
    fov: 40,
    spark: false,
    pos: (u, out) => void C10.getPointAt(ease(u), out),
    look: (_u, out) => void out.set(0, 0.65, 0.2),
    demo: (_t, _d, dt) => {
      fan.level = 2
      stepFan(dt)
      oscillate(dt)
    },
    map: [[86, 40], [60, 60]],
    focus: [50, 50],
    labels: [],
  },
]

// ---- 進行 ----
export const fanTour = {
  ch: 0,
  t: 0,
  done: false,
  snapshot: null as null | { level: typeof fan.level; osc: boolean; yawPhase: number },
}

export function beginFanTour() {
  fanTour.snapshot = { level: fan.level, osc: fan.osc, yawPhase: fan.yawPhase }
  fanTour.ch = 0
  fanTour.t = 0
  fanTour.done = false
  fan.tourOverride = true
}
export function endFanTour() {
  const s = fanTour.snapshot
  if (s) {
    fan.level = s.level
    fan.osc = s.osc
  }
  fanTour.snapshot = null
  fan.tourOverride = false
}
export function jumpFanChapter(ch: number) {
  fanTour.ch = Math.max(0, Math.min(FAN_CHAPTERS.length - 1, ch))
  fanTour.t = 0
  fanTour.done = false
}
export function stepFanTour(dt: number) {
  const c = FAN_CHAPTERS[fanTour.ch]
  fanTour.t = Math.min(c.dur, fanTour.t + dt)
  c.demo(fanTour.t, c.dur, dt)
  fan.yaw = 0.7 * Math.sin(fan.yawPhase)
  if (fanTour.t >= c.dur) {
    if (fanTour.ch < FAN_CHAPTERS.length - 1) {
      fanTour.ch++
      fanTour.t = 0
      useFan.getState().setTourChapter(fanTour.ch)
    } else if (!fanTour.done) {
      fanTour.done = true
      useFan.getState().finishTour()
    }
  }
}

// 「いまここ地図」
function polyAt(pts: XY[], u: number): XY {
  if (pts.length === 1) return pts[0]
  const seg: number[] = []
  let total = 0
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
    seg.push(d)
    total += d
  }
  let target = Math.min(1, Math.max(0, u)) * total
  for (let i = 0; i < seg.length; i++) {
    if (target <= seg[i] || i === seg.length - 1) {
      const k = seg[i] ? Math.min(1, target / seg[i]) : 0
      return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k]
    }
    target -= seg[i]
  }
  return pts[pts.length - 1]
}
export function fanMapProgress(ch: number, u: number) {
  const e = ease(Math.min(1, Math.max(0, u)))
  const here = polyAt(FAN_CHAPTERS[ch].map, e)
  const trail: XY[] = []
  for (let i = 0; i < ch; i++) trail.push(...FAN_CHAPTERS[i].map)
  for (let i = 0; i <= 12; i++) trail.push(polyAt(FAN_CHAPTERS[ch].map, (e * i) / 12))
  return { here, trail: trail.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') }
}
export const fanRoute = () =>
  FAN_CHAPTERS.flatMap((c) => c.map)
    .map((p) => p.join(','))
    .join(' ')
