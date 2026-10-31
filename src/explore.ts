// 「たんけん」モード：小さくなってドラムの中を探検する。はっけんポイントの定義
export type SpotId = 'lifter' | 'holes' | 'door' | 'back' | 'water' | 'inlet' | 'gasket'

export interface SpotDef {
  id: SpotId
  icon: string
  name: string
  text: string
  pos: [number, number, number] // 外槽ローカル座標
  rotates: boolean // ドラムといっしょに回るか
}

export const SPOTS: SpotDef[] = [
  {
    id: 'lifter',
    icon: '🧗',
    name: 'リフター（でっぱり）',
    text: 'この でっぱりが ふくを ひっかけて もちあげるよ。てっぺんまで くると ストン！と おちて、たたき あらいに なるんだ。',
    pos: [Math.cos(0.3) * 0.19, Math.sin(0.3) * 0.19, 0.02],
    rotates: true,
  },
  {
    id: 'holes',
    icon: '🕳️',
    name: 'ドラムの ちいさな あな',
    text: 'ちいさな あなが びっしり。みずは ここを とおって でたり はいったり。だっすいの ときは、みずが ここから いきおいよく とびだすよ。',
    pos: [Math.cos(0.3 + Math.PI / 3) * 0.215, Math.sin(0.3 + Math.PI / 3) * 0.215, -0.06],
    rotates: true,
  },
  {
    id: 'door',
    icon: '🚪',
    name: 'ガラスの とびら（うちがわ）',
    text: 'なかから みると、とびらは おわんの ような かたち。ふくが すきまに はさまらないように なっているよ。',
    pos: [0.04, 0.05, 0.22],
    rotates: false,
  },
  {
    id: 'back',
    icon: '⚙️',
    name: 'ドラムの おくの じく',
    text: 'うしろの まんなかに ふとい じくが あって、その さきは モーター。モーターが じくを まわして、ドラムが まわるんだ。',
    pos: [0, 0, -0.165],
    rotates: false,
  },
  {
    id: 'water',
    icon: '💧',
    name: 'みずと あわの プール',
    text: 'せんたくの ときは、ここに みずが たまるよ。ドラムが まわると、ふくが みずに ザブン！ あわは せんざいが はたらいている しるし。',
    pos: [0.02, -0.17, 0.03],
    rotates: false,
  },
  {
    id: 'inlet',
    icon: '🚿',
    name: 'みずの いりぐち',
    text: 'きゅうすいの とき、うえの ほうから みずが ながれこんでくるよ。せんざいいれを とおってくるから、せんざいも いっしょ。',
    pos: [-0.09, 0.17, 0.15],
    rotates: false,
  },
  {
    id: 'gasket',
    icon: '⭕',
    name: 'ゴムの パッキン',
    text: 'とびらの まわりの ゴムが ぴったり くっついて、みずが そとに もれないように まもっているよ。',
    pos: [0.13, -0.07, 0.235],
    rotates: false,
  },
]
export const SPOT_MAP = Object.fromEntries(SPOTS.map((s) => [s.id, s])) as Record<SpotId, SpotDef>
