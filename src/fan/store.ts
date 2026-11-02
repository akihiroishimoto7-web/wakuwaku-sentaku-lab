import { create } from 'zustand'
import { FAN_PARTS, type FanPartId, type Level } from './data'
import { fan } from './sim'
import { fanSound } from './sound'
import { beginFanTour, endFanTour, fanTour, jumpFanChapter } from './tour'

export type FanCam = { kind: 'home'; dur?: number } | { kind: 'part'; part: FanPartId } | { kind: 'experiment' }
export type Pitch = 'flat' | 'mid' | 'steep'
export interface FanLane {
  blades: 3 | 5 | 7
  pitch: Pitch
  strong: boolean
}

interface FanState {
  mode: 'play' | 'experiment'
  level: Level
  osc: boolean
  xray: boolean
  focus: FanPartId | null
  muted: boolean
  slow: boolean
  quality: 'high' | 'low'
  splash: boolean
  cam: FanCam & { n: number }
  tour: boolean
  tourCh: number
  tourPaused: boolean
  tourDone: boolean
  tourAt: number
  lanes: FanLane[]
  expState: 'idle' | 'running' | 'done'
  expProgress: number[]
  hudRpm: number

  setLevel: (l: Level) => void
  toggleOsc: () => void
  toggleXray: () => void
  setFocus: (p: FanPartId | null) => void
  toggleMute: () => void
  toggleSlow: () => void
  setQuality: (q: 'high' | 'low') => void
  camTo: (c: FanCam) => void
  showSplash: () => void
  closeSplash: (go: 'play' | 'tour' | 'experiment') => void
  startTour: () => void
  exitTour: () => void
  setTourChapter: (ch: number) => void
  gotoChapter: (ch: number) => void
  toggleTourPause: () => void
  finishTour: () => void
  setMode: (m: 'play' | 'experiment') => void
  setLane: (i: number, lane: Partial<FanLane>) => void
  runExperiment: () => void
}

let n = 0

export const useFan = create<FanState>((set, get) => ({
  mode: 'play',
  level: 0,
  osc: false,
  xray: false,
  focus: null,
  muted: false,
  slow: false,
  quality: 'high',
  splash: true,
  cam: { kind: 'home', n: 0 },
  tour: false,
  tourCh: 0,
  tourPaused: false,
  tourDone: false,
  tourAt: 0,
  lanes: [
    { blades: 3, pitch: 'mid', strong: true },
    { blades: 5, pitch: 'mid', strong: true },
    { blades: 5, pitch: 'flat', strong: true },
  ],
  expState: 'idle',
  expProgress: [0, 0, 0],
  hudRpm: 0,

  setLevel: (l) => {
    if (get().tour) return
    fanSound.button(l)
    fan.level = l
    set({ level: l })
  },
  toggleOsc: () => {
    if (get().tour) return
    fanSound.knob()
    fan.osc = !get().osc
    set({ osc: fan.osc })
  },
  toggleXray: () => {
    fanSound.click()
    set({ xray: !get().xray, focus: null })
    get().camTo({ kind: 'home' })
  },
  setFocus: (p) => {
    fanSound.click()
    set({ focus: p })
    get().camTo(p ? { kind: 'part', part: p } : { kind: 'home' })
  },
  toggleMute: () => {
    const m = !get().muted
    fanSound.setMuted(m)
    set({ muted: m })
  },
  toggleSlow: () => {
    fanSound.click()
    set({ slow: !get().slow })
  },
  setQuality: (q) => set({ quality: q }),
  camTo: (c) => set({ cam: { ...c, n: ++n } }),
  showSplash: () => {
    fanSound.click()
    set({ splash: true })
  },
  closeSplash: (go) => {
    fanSound.sparkle()
    set({ splash: false })
    if (go === 'experiment') {
      if (get().mode !== 'experiment') get().setMode('experiment')
      return
    }
    if (get().mode !== 'play') get().setMode('play')
    if (go === 'tour') get().startTour()
    else if (get().tour) get().exitTour()
  },
  startTour: () => {
    if (get().tour || get().mode !== 'play') return
    fanSound.whoosh()
    beginFanTour()
    set({ tour: true, tourCh: 0, tourPaused: false, tourDone: false, tourAt: performance.now(), focus: null })
  },
  exitTour: () => {
    if (!get().tour) return
    fanSound.whoosh()
    endFanTour()
    set({ tour: false, tourDone: false, xray: false, focus: null, level: fan.level, osc: fan.osc })
    get().camTo({ kind: 'home', dur: 1.6 })
  },
  setTourChapter: (ch) => set({ tourCh: ch }),
  gotoChapter: (ch) => {
    fanSound.click()
    jumpFanChapter(ch)
    set({ tourCh: fanTour.ch, tourDone: false, tourPaused: false })
  },
  toggleTourPause: () => {
    fanSound.click()
    set({ tourPaused: !get().tourPaused })
  },
  finishTour: () => {
    fanSound.melody()
    set({ tourDone: true })
  },
  setMode: (m) => {
    fanSound.click()
    if (get().tour) {
      endFanTour()
      set({ tour: false })
    }
    set({ mode: m, xray: false, focus: null })
    get().camTo(m === 'experiment' ? { kind: 'experiment' } : { kind: 'home' })
  },
  setLane: (i, lane) => {
    if (get().expState === 'running') return
    fanSound.click()
    const lanes = get().lanes.slice()
    lanes[i] = { ...lanes[i], ...lane }
    set({ lanes, expState: 'idle', expProgress: [0, 0, 0] })
  },
  runExperiment: () => {
    if (get().expState === 'running') return
    fanSound.button(3)
    set({ expState: 'running', expProgress: [0, 0, 0] })
  },
}))

export const partOf = (id: FanPartId) => FAN_PARTS[id]
