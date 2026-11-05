import { useSyncExternalStore } from 'react'

// はっけん ずかん：ふたつの ラボで あつめる シール。
// おなじ サイトの なかなら せんたくき・せんぷうき どちらからも おなじ ずかんが みえる。
// 保存は この端末の ブラウザだけ（localStorage）。使えなくても あそびは そのまま できる。

export type Lab = 'wash' | 'fan'

export interface StampDef {
  id: string
  lab: Lab
  icon: string
  name: string
  hint: string
  color: string
  // ぶひんの ように「ぜんぶ みたら」もらえる シールの かず
  total?: number
}

export const STAMPS: StampDef[] = [
  { id: 'wash_first', lab: 'wash', icon: '🫧', name: 'はじめての せんたく', hint: 'せんたくを さいごまで してみよう', color: '#7cc8ff' },
  { id: 'wash_pika', lab: 'wash', icon: '✨', name: 'ぴかぴか めいじん', hint: 'きれいど 90% いじょうを めざそう', color: '#ffd84d' },
  { id: 'wash_water', lab: 'wash', icon: '💧', name: 'みずだけ チャレンジ', hint: 'せんざいなしで あらってみよう', color: '#9fdcff' },
  { id: 'wash_dry', lab: 'wash', icon: '☀️', name: 'ふかふか かんそう', hint: 'かんそうまで の コースを えらぼう', color: '#ffb36b' },
  { id: 'wash_xray', lab: 'wash', icon: '👀', name: 'なかを のぞいた', hint: '「なかをみる」を おしてみよう', color: '#b9a6ff' },
  { id: 'wash_parts', lab: 'wash', icon: '🔧', name: 'せんたくき ぶひん はかせ', hint: 'なかをみるで ぶひんを ぜんぶ タップ', color: '#8fe0b0', total: 8 },
  { id: 'wash_micro', lab: 'wash', icon: '🔬', name: 'せんいの せかい', hint: '「もっとちかく」で ふくに ちかづこう', color: '#ff9fc4' },
  { id: 'wash_tour', lab: 'wash', icon: '🔦', name: 'みずの つぶの だいぼうけん', hint: 'たんけんを さいごまで いこう', color: '#5fb8ff' },
  { id: 'wash_exp', lab: 'wash', icon: '🧪', name: 'あらいかた じっけん', hint: 'じっけんで あらいかたを くらべよう', color: '#c7e86a' },
  { id: 'fan_on', lab: 'fan', icon: '🍃', name: 'はじめての かぜ', hint: 'せんぷうきの かぜを だそう', color: '#8fe0b0' },
  { id: 'fan_strong', lab: 'fan', icon: '💨', name: 'つよかぜ びゅーん', hint: '「つよ」に してみよう', color: '#7cc8ff' },
  { id: 'fan_osc', lab: 'fan', icon: '↔️', name: 'くびふり ゆらゆら', hint: 'くびふりを ためそう', color: '#ffd84d' },
  { id: 'fan_chime', lab: 'fan', icon: '🎐', name: 'ふうりん ちりーん', hint: 'かぜで ふうりんを ならそう', color: '#9fdcff' },
  { id: 'fan_parts', lab: 'fan', icon: '🔩', name: 'せんぷうき ぶひん はかせ', hint: 'なかをみるで ぶひんを ぜんぶ タップ', color: '#b9a6ff', total: 7 },
  { id: 'fan_tour', lab: 'fan', icon: '⚡', name: 'かぜの つぶの だいぼうけん', hint: 'たんけんを さいごまで いこう', color: '#ffb36b' },
  { id: 'fan_exp', lab: 'fan', icon: '🌀', name: 'はねの じっけん', hint: 'じっけんで はねを くらべよう', color: '#ff9fc4' },
]

const KEY = 'wakuwaku-zukan-v1'

interface Saved {
  got: Record<string, number>
  seen: Record<string, string[]>
}

function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const v = JSON.parse(raw) as Partial<Saved>
      return { got: v.got ?? {}, seen: v.seen ?? {} }
    }
  } catch {
    /* 保存できない ブラウザでも そのまま あそべる */
  }
  return { got: {}, seen: {} }
}

let data = load()
let queue: StampDef[] = []
let book = false
let snap = { got: data.got, seen: data.seen, queue, book }
const listeners = new Set<() => void>()

function emit() {
  snap = { got: data.got, seen: data.seen, queue, book }
  listeners.forEach((l) => l())
}

export function openBook() {
  book = true
  queue = []
  emit()
}
export function closeBook() {
  book = false
  emit()
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    /* noop */
  }
}

// べつの タブ（もう ひとつの ラボ）で シールが ふえたら こちらにも はんえい
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return
    data = load()
    emit()
  })
}

export const STAMP_MAP = Object.fromEntries(STAMPS.map((s) => [s.id, s])) as Record<string, StampDef>

export function hasStamp(id: string) {
  return !!data.got[id]
}

export function award(id: string) {
  const def = STAMP_MAP[id]
  if (!def || data.got[id]) return false
  data = { ...data, got: { ...data.got, [id]: Date.now() } }
  save()
  queue = [...queue, def]
  emit()
  return true
}

// ぶひんなど「ぜんぶ みたら」もらえる シール
export function markSeen(stampId: string, key: string) {
  const def = STAMP_MAP[stampId]
  if (!def?.total) return
  const list = data.seen[stampId] ?? []
  if (!list.includes(key)) {
    data = { ...data, seen: { ...data.seen, [stampId]: [...list, key] } }
    save()
    emit()
  }
  if ((data.seen[stampId]?.length ?? 0) >= def.total) award(stampId)
}

export function shiftToast() {
  if (!queue.length) return
  queue = queue.slice(1)
  emit()
}

export function useStamps() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => snap,
    () => snap,
  )
}

export const countGot = (got: Record<string, number>) => STAMPS.filter((s) => got[s.id]).length
