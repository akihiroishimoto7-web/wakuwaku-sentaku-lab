import { create } from 'zustand'
import { CLOTH_IDS, type ClothId, type PartId } from './data'
import { resetSim, sim, startCycle, type CourseId, type PhaseId } from './sim'
import { sound } from './sound'
import { clearBodies, sendOut } from './clothSim'
import { resetMicro } from './microState'
import { SPOTS, type SpotId } from './explore'

export type Step = 'intro' | 'choose' | 'detergent' | 'course' | 'running' | 'done' | 'finished'
export type AppMode = 'wash' | 'micro' | 'experiment'
export type ItemLoc = 'basket' | 'drum' | 'out'

export type CamReq =
  | { kind: 'home'; dur?: number }
  | { kind: 'part'; part: PartId }
  | { kind: 'zoom'; cloth: ClothId }
  | { kind: 'micro' }
  | { kind: 'experiment' }
  | { kind: 'fromCloth'; cloth: ClothId }
  | { kind: 'explore' }

export interface Hud {
  phase: PhaseId | null
  phaseIdx: number
  rpm: number
  remain: number
  progress: number
  clean: number
}

export interface ExpLane {
  det: boolean
  rot: boolean
  long: boolean
}

interface State {
  mode: AppMode
  step: Step
  doorOpen: boolean
  selected: ClothId | null
  items: Record<ClothId, ItemLoc>
  detergent: boolean
  pourStart: number
  course: CourseId | null
  paused: boolean
  slow: boolean
  xray: boolean
  focus: PartId | null
  muted: boolean
  quality: 'high' | 'low'
  hud: Hud
  cam: CamReq & { n: number }
  zooming: ClothId | null
  microCloth: ClothId
  microDetergent: boolean
  microStep: number
  celebrateAt: number
  result: { clean: number; oilLeft: boolean } | null
  expLanes: ExpLane[]
  expState: 'idle' | 'running' | 'done'
  expProgress: number[]
  explore: boolean
  ride: boolean
  found: SpotId[]
  spot: SpotId | null
  exploreAt: number
  masterAt: number

  openDoor: () => void
  closeDoor: () => void
  select: (id: ClothId) => void
  insertSelected: () => void
  pourDetergent: () => void
  skipDetergent: () => void
  finishPour: () => void
  setCourse: (c: CourseId) => void
  start: () => void
  togglePause: () => void
  toggleSlow: () => void
  toggleXray: () => void
  setFocus: (p: PartId | null) => void
  toggleMute: () => void
  setQuality: (q: 'high' | 'low') => void
  camTo: (c: CamReq) => void
  startZoom: (id: ClothId) => void
  enterMicro: () => void
  exitMicro: () => void
  replayMicro: () => void
  finishCycle: () => void
  takeOut: () => void
  again: () => void
  setMode: (m: 'wash' | 'experiment') => void
  setLane: (i: number, lane: Partial<ExpLane>) => void
  runExperiment: () => void
  enterExplore: () => void
  exitExplore: () => void
  toggleRide: () => void
  discover: (id: SpotId) => void
  closeSpot: () => void
}

const allBasket = () => Object.fromEntries(CLOTH_IDS.map((id) => [id, 'basket'])) as Record<ClothId, ItemLoc>
let camCounter = 0

export const useStore = create<State>((set, get) => ({
  mode: 'wash',
  step: 'intro',
  doorOpen: false,
  selected: null,
  items: allBasket(),
  detergent: false,
  pourStart: 0,
  course: null,
  paused: false,
  slow: false,
  xray: false,
  focus: null,
  muted: false,
  quality: 'high',
  hud: { phase: null, phaseIdx: 0, rpm: 0, remain: 0, progress: 0, clean: 0 },
  cam: { kind: 'home', n: 0 },
  zooming: null,
  microCloth: 'shirt',
  microDetergent: true,
  microStep: 0,
  celebrateAt: 0,
  result: null,
  expLanes: [
    { det: false, rot: true, long: false },
    { det: true, rot: true, long: false },
    { det: true, rot: false, long: false },
    { det: true, rot: true, long: true },
  ],
  expState: 'idle',
  expProgress: [0, 0, 0, 0],
  explore: false,
  ride: false,
  found: [],
  spot: null,
  exploreAt: 0,
  masterAt: 0,

  openDoor: () => {
    const { step } = get()
    if (step !== 'intro' && step !== 'choose' && step !== 'done') return
    sound.door(true)
    if (step === 'done') {
      get().takeOut()
      return
    }
    const first = CLOTH_IDS.find((id) => get().items[id] === 'basket') ?? null
    set({ doorOpen: true, step: 'choose', selected: get().selected ?? first })
  },
  closeDoor: () => {
    const { step, items } = get()
    if (step !== 'choose') return
    if (!Object.values(items).includes('drum')) return
    sound.door(false)
    set({ doorOpen: false, step: 'detergent', selected: null })
  },
  select: (id) => {
    if (get().items[id] !== 'basket') return
    sound.click()
    set({ selected: id })
  },
  insertSelected: () => {
    const { selected, items, step } = get()
    if (!selected || step !== 'choose' || items[selected] !== 'basket') return
    sound.whoosh()
    const next = CLOTH_IDS.find((id) => id !== selected && items[id] === 'basket') ?? null
    set({ items: { ...items, [selected]: 'drum' }, selected: next })
  },
  pourDetergent: () => {
    if (get().step !== 'detergent' || get().pourStart) return
    sound.click()
    set({ pourStart: performance.now() })
    get().camTo({ kind: 'part', part: 'drawer' })
    setTimeout(() => sound.pour(), 700)
  },
  skipDetergent: () => {
    if (get().step !== 'detergent') return
    sound.click()
    sim.drawer = 0
    set({ detergent: false, step: 'course' })
  },
  finishPour: () => {
    set({ pourStart: 0, detergent: true, step: 'course' })
    get().camTo({ kind: 'home' })
  },
  setCourse: (c) => {
    if (get().step !== 'course') return
    sound.click()
    set({ course: c })
  },
  start: () => {
    const { step, course, detergent } = get()
    if (step !== 'course' || !course) return
    sound.start()
    startCycle(course, detergent)
    set({ step: 'running', paused: false, result: null })
  },
  togglePause: () => {
    sound.click()
    set({ paused: !get().paused })
  },
  toggleSlow: () => {
    sound.click()
    set({ slow: !get().slow })
  },
  toggleXray: () => {
    sound.click()
    const x = !get().xray
    set({ xray: x, focus: null })
    get().camTo({ kind: 'home' })
  },
  setFocus: (p) => {
    sound.click()
    set({ focus: p })
    get().camTo(p ? { kind: 'part', part: p } : { kind: 'home' })
  },
  toggleMute: () => {
    const m = !get().muted
    sound.setMuted(m)
    set({ muted: m })
  },
  setQuality: (q) => set({ quality: q }),
  camTo: (c) => set({ cam: { ...c, n: ++camCounter } }),
  startZoom: (id) => {
    const { mode, zooming, items, step } = get()
    if (mode !== 'wash' || zooming || items[id] !== 'drum') return
    sound.whoosh()
    const det = step === 'intro' || step === 'choose' || step === 'detergent' ? true : get().detergent
    set({ zooming: id, microCloth: id, microDetergent: det, focus: null, explore: false, ride: false, spot: null })
    get().camTo({ kind: 'zoom', cloth: id })
  },
  enterMicro: () => {
    resetMicro()
    set({ mode: 'micro', zooming: null, microStep: 0 })
    get().camTo({ kind: 'micro' })
  },
  exitMicro: () => {
    sound.click()
    set({ mode: 'wash' })
    get().camTo({ kind: 'fromCloth', cloth: get().microCloth })
  },
  replayMicro: () => {
    sound.click()
    resetMicro()
    set({ microStep: 0 })
  },
  finishCycle: () => {
    const clean = 1 - (0.5 * sim.dirtMud + 0.5 * sim.dirtOil)
    sound.melody()
    set({ step: 'done', celebrateAt: performance.now(), result: { clean, oilLeft: sim.dirtOil > 0.3 }, paused: false })
  },
  takeOut: () => {
    const { items, step } = get()
    if (step !== 'done') return
    sound.door(true)
    setTimeout(() => sound.sparkle(), 900)
    const inDrum = CLOTH_IDS.filter((id) => items[id] === 'drum')
    inDrum.forEach((id, i) => sendOut(id, i, inDrum.length))
    const next = { ...items }
    inDrum.forEach((id) => (next[id] = 'out'))
    set({ doorOpen: true, items: next, step: 'finished', xray: false, focus: null, explore: false, ride: false, spot: null })
    get().camTo({ kind: 'home' })
  },
  again: () => {
    sound.click()
    clearBodies()
    resetSim()
    set({
      step: 'choose',
      doorOpen: true,
      items: allBasket(),
      selected: 'shirt',
      detergent: false,
      course: null,
      paused: false,
      result: null,
      celebrateAt: 0,
      pourStart: 0,
    })
    get().camTo({ kind: 'home' })
  },
  setMode: (m) => {
    sound.click()
    set({ mode: m, xray: false, focus: null, zooming: null, explore: false, ride: false, spot: null })
    get().camTo(m === 'experiment' ? { kind: 'experiment' } : { kind: 'home' })
  },
  setLane: (i, lane) => {
    if (get().expState === 'running') return
    sound.click()
    const lanes = get().expLanes.slice()
    lanes[i] = { ...lanes[i], ...lane }
    set({ expLanes: lanes, expState: 'idle', expProgress: [0, 0, 0, 0] })
  },
  enterExplore: () => {
    const { mode, zooming, explore } = get()
    if (mode !== 'wash' || zooming || explore) return
    sound.whoosh()
    set({ explore: true, ride: false, spot: null, xray: false, focus: null, exploreAt: performance.now() })
    get().camTo({ kind: 'explore' })
  },
  exitExplore: () => {
    if (!get().explore) return
    sound.whoosh()
    set({ explore: false, ride: false, spot: null })
    get().camTo({ kind: 'home', dur: 1.6 })
  },
  toggleRide: () => {
    sound.click()
    set({ ride: !get().ride })
  },
  discover: (id) => {
    const { found } = get()
    const isNew = !found.includes(id)
    const next = isNew ? [...found, id] : found
    if (isNew && next.length === SPOTS.length) {
      sound.melody()
      set({ found: next, spot: id, masterAt: performance.now() })
    } else {
      if (isNew) sound.sparkle()
      else sound.click()
      set({ found: next, spot: id })
    }
  },
  closeSpot: () => {
    sound.click()
    set({ spot: null })
  },
  runExperiment: () => {
    if (get().expState === 'running') return
    sound.start()
    set({ expState: 'running', expProgress: [0, 0, 0, 0] })
  },
}))
