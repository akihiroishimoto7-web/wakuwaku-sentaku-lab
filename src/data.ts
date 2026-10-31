import * as THREE from 'three'

// ---- 洗濯機の寸法（単位: m）。原点は洗濯機の底面中央 ----
export const CAB_W = 0.6
export const CAB_H = 0.85
export const CAB_D = 0.6
export const FRONT_Z = 0.3
export const TUB_C = new THREE.Vector3(0, 0.46, 0)
export const TUB_R = 0.27
export const TUB_LEN = 0.42
export const DRUM_R = 0.235
export const DRUM_LEN = 0.36
export const DOOR_R = 0.19
export const DOOR_GLASS_R = 0.145

// ---- 衣服 ----
export type ClothId = 'shirt' | 'socks' | 'towel' | 'pants' | 'teddy'

export interface ClothDef {
  id: ClothId
  name: string
  color: string
  shape: number
  size: [number, number]
  r: number
  dirt: number
}

export const CLOTHES: ClothDef[] = [
  { id: 'shirt', name: 'シャツ', color: '#ff6f9f', shape: 0, size: [0.2, 0.2], r: 0.072, dirt: 1 },
  { id: 'socks', name: 'くつした', color: '#ffc93c', shape: 1, size: [0.09, 0.13], r: 0.045, dirt: 1.2 },
  { id: 'towel', name: 'タオル', color: '#38c6f4', shape: 2, size: [0.22, 0.15], r: 0.07, dirt: 0.8 },
  { id: 'pants', name: 'ズボン', color: '#6b7bff', shape: 3, size: [0.16, 0.22], r: 0.075, dirt: 1.1 },
  { id: 'teddy', name: 'くまちゃん', color: '#c99460', shape: 4, size: [0.12, 0.16], r: 0.068, dirt: 0.9 },
]
export const CLOTH_MAP = Object.fromEntries(CLOTHES.map((c) => [c.id, c])) as Record<ClothId, ClothDef>
export const CLOTH_IDS = CLOTHES.map((c) => c.id)

// ---- 部品 ----
export type PartId = 'drum' | 'tub' | 'motor' | 'valve' | 'pump' | 'damper' | 'dryer' | 'drawer'

export interface PartDef {
  name: string
  icon: string
  desc: string
  note?: string
  pos: [number, number, number]
  label: [number, number, number]
  dir: [number, number, number]
  dist: number
}

export const PARTS: Record<PartId, PartDef> = {
  drum: {
    name: 'かいてんドラム',
    icon: '🥁',
    desc: 'ふくを いれる ステンレスの かご。ちいさな あなが たくさん あいていて、みずが とおりぬけるよ。うちがわの でっぱり（リフター）が ふくを もちあげて、ストンと おとすんだ。',
    pos: [0, 0.46, 0.02],
    label: [0, 0.46, 0.22],
    dir: [0.25, 0.2, 1],
    dist: 0.75,
  },
  tub: {
    name: 'がいそう（そとの おけ）',
    icon: '🪣',
    desc: 'ドラムの まわりを かこむ おけ。みずを ためて、そとに もれないように しているよ。ドラムは この なかで まわるんだ。',
    pos: [0, 0.46, 0],
    label: [-0.26, 0.6, 0.05],
    dir: [-1, 0.35, 0.7],
    dist: 0.95,
  },
  motor: {
    name: 'モーター（ダイレクトドライブ）',
    icon: '⚙️',
    desc: 'ドラムの うしろに じかに ついた モーター。ベルトを つかわずに、じしゃくの ちからで ドラムを まわすよ。ゆっくりも はやくも、みぎも ひだりも じゆうじざい！',
    pos: [0, 0.46, -0.25],
    label: [0, 0.62, -0.27],
    dir: [0.7, 0.35, -1],
    dist: 0.7,
  },
  valve: {
    name: 'きゅうすいべん と みずの みち',
    icon: '🚰',
    desc: 'でんきで ひらいたり しまったり する じゃぐち。ひらくと すいどうの みずが せんざいいれを とおって、おけの なかへ ながれこむよ。',
    pos: [0.2, 0.79, -0.24],
    label: [0.2, 0.86, -0.24],
    dir: [0.6, 0.7, -0.6],
    dist: 0.6,
  },
  pump: {
    name: 'はいすいポンプ と はいすいの みち',
    icon: '🌀',
    desc: 'なかの はねが くるくる まわって、よごれた みずを ホースから そとへ おしだすよ。てまえの フィルターが ゴミを キャッチ。',
    pos: [0.17, 0.08, 0.14],
    label: [0.17, 0.16, 0.2],
    dir: [0.7, 0.35, 1],
    dist: 0.6,
  },
  damper: {
    name: 'ダンパー と ばね',
    icon: '🫨',
    desc: 'うえの ばねが おけを つるし、したの ダンパーが ゆれを すいとるよ。だっすいで ものすごく はやく まわっても、ガタガタ しにくいんだ。',
    pos: [0.15, 0.17, 0],
    label: [-0.15, 0.12, 0.05],
    dir: [1, 0.2, 0.75],
    dist: 0.85,
  },
  dryer: {
    name: 'かんそうユニット',
    icon: '♨️',
    desc: 'しめった くうきを ひやして みずを とりだし（じょしつ）、あたためなおして ドラムに もどすよ。あったかい かぜが ぐるぐる めぐって、ふくが かわくんだ。',
    note: 'ヒートポンプしきを かんたんに した もけいだよ。',
    pos: [0, 0.79, -0.12],
    label: [0, 0.87, -0.1],
    dir: [0.3, 1, 0.7],
    dist: 0.75,
  },
  drawer: {
    name: 'せんざい とうにゅうぐち',
    icon: '🧴',
    desc: 'ここに せんざいを いれておくと、きゅうすいの みずと いっしょに おけへ ながれこむよ。',
    pos: [-0.175, 0.78, 0.22],
    label: [-0.175, 0.85, 0.3],
    dir: [-0.2, 0.45, 1],
    dist: 0.55,
  },
}
export const PART_IDS = Object.keys(PARTS) as PartId[]
