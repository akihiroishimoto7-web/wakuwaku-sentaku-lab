import * as THREE from 'three'

// ---- 扇風機の寸法（m）。台の中心が原点、羽根は +z を向く ----
export const PIVOT = new THREE.Vector3(0, 0.78, 0) // 首振りの軸
export const HEAD_OFFSET = new THREE.Vector3(0, 0.04, 0) // 軸からモーター中心まで
export const BLADE_R = 0.15
export const GUARD_R = 0.175
export const BLADE_Z = 0.035
export const MOTOR_R = 0.072

export type Level = 0 | 1 | 2 | 3
export const LEVELS: { id: Level; name: string; rpm: number; word: string; color: string }[] = [
  { id: 0, name: 'きる', rpm: 0, word: 'ボタンを おして かぜを だそう', color: '#ff8db3' },
  { id: 1, name: 'よわ', rpm: 650, word: 'そよそよ〜', color: '#8fd8ff' },
  { id: 2, name: 'ちゅう', rpm: 950, word: 'ひゅーひゅー', color: '#45b6ff' },
  { id: 3, name: 'つよ', rpm: 1250, word: 'びゅーびゅー！', color: '#1f86e0' },
]

// ---- 部品（なかをみる） ----
export type FanPartId = 'guard' | 'blades' | 'motor' | 'capacitor' | 'gear' | 'switch' | 'cord'

export interface FanPart {
  name: string
  short: string
  icon: string
  desc: string
  pos: [number, number, number] // inHead のときは首の中の座標
  inHead: boolean
  dir: [number, number, number]
  dist: number
}

export const FAN_PARTS: Record<FanPartId, FanPart> = {
  guard: {
    name: 'ガード',
    short: 'ガード',
    icon: '🛡️',
    desc: 'はねに ゆびが さわらないように まもる あみ。うしろから くうきを すいこんで、まえに ふきだすよ。',
    pos: [0, 0.04, 0.1],
    inHead: true,
    dir: [0.4, 0.25, 1],
    dist: 0.6,
  },
  blades: {
    name: 'はね',
    short: 'はね',
    icon: '🌀',
    desc: 'すこし ななめに ねじれた はね。まわると くうきを うしろから まえへ おしだして、かぜが うまれるよ。',
    pos: [0, 0.04, BLADE_Z],
    inHead: true,
    dir: [0.6, 0.3, 0.9],
    dist: 0.5,
  },
  motor: {
    name: 'モーター',
    short: 'モーター',
    icon: '🧲',
    desc: 'コイルに でんきが ながれると じしゃくに なって、まんなかの かいてんしを ぐるぐる まわすよ。その じくに はねが ついているんだ。',
    pos: [0, 0.04, -0.09],
    inHead: true,
    dir: [1, 0.35, 0.2],
    dist: 0.45,
  },
  capacitor: {
    name: 'コンデンサー',
    short: 'コンデンサー',
    icon: '🔋',
    desc: 'でんきを すこしずつ ためたり だしたり して、モーターが まわりはじめる むきを きめる てつだいを するよ。',
    pos: [0.07, 0.035, -0.06],
    inHead: false,
    dir: [0.8, 0.6, 0.6],
    dist: 0.42,
  },
  gear: {
    name: 'くびふりの はぐるま',
    short: 'くびふり',
    icon: '⚙️',
    desc: 'じくの うしろの ねじの ような はぐるま（ウォームギア）が、おおきな はぐるまを ゆっくり まわす。うでが ひっぱって、くびが みぎ・ひだりに ふれるよ。',
    pos: [0, 0.03, -0.185],
    inHead: true,
    dir: [0.7, 0.6, -0.7],
    dist: 0.42,
  },
  switch: {
    name: 'スイッチ',
    short: 'スイッチ',
    icon: '🎚️',
    desc: 'よわ・ちゅう・つよの ボタンで、モーターに おくる でんきの ちからを かえて、まわる はやさを えらぶよ。',
    pos: [0, 0.06, 0.12],
    inHead: false,
    dir: [0.3, 0.7, 1],
    dist: 0.45,
  },
  cord: {
    name: 'でんきの みち（コード）',
    short: 'コード',
    icon: '🔌',
    desc: 'コンセントから コードを とおって でんきが くるよ。だいの なかの スイッチを とおり、ぼうの なかを のぼって モーターへ。',
    pos: [0, 0.35, 0],
    inHead: false,
    dir: [1, 0.4, 0.9],
    dist: 0.9,
  },
}
export const FAN_PART_IDS = Object.keys(FAN_PARTS) as FanPartId[]

// ---- まわりの小物の位置 ----
export const PINWHEEL_POS = new THREE.Vector3(0.5, 0.8, 0.78)
export const CHIME_POS = new THREE.Vector3(-0.52, 1.1, 0.72)
export const SKIN_POS = new THREE.Vector3(0.02, 0.84, 1.2)
export const OUTLET_POS = new THREE.Vector3(-0.72, 0.26, -0.69)
