// 「繊維の世界」のタイムライン（模式図）
export interface MicroStep {
  t: number
  title: string
  text: string
}

export const MICRO_STEPS_DET: MicroStep[] = [
  { t: 0, title: 'せんいの せかい', text: 'ふくの いとを ぐーんと おおきく してみたよ。ちゃいろい どろと きいろい あぶらの よごれが くっついている！' },
  { t: 6, title: 'みずが しみこむ', text: 'みずが せんいの すきまに しみこんで、よごれを ふやかすよ。' },
  { t: 12, title: 'せんざいの つぶ', text: 'あおい あたまは「みずが すき」。オレンジの しっぽは「あぶらが すき」！' },
  { t: 19, title: 'あぶらを かこむ', text: 'しっぽが あぶらに ささって、あたまは そとを むく。よごれを ぐるっと かこむよ。' },
  { t: 25, title: 'はがれて うかぶ', text: 'かこまれた よごれは みずと なかよしに なって、せんいから はなれていく。' },
  { t: 31, title: 'ぐるぐる まぜる', text: 'ドラムが まわって みずが うごくと、よごれが とおくへ はこばれるよ。' },
  { t: 37, title: 'きれいに なった！', text: 'みず ＋ せんざい ＋ うごき の チームワークで よごれが おちたね。' },
]
export const MICRO_END_DET = 44

export const MICRO_STEPS_WATER: MicroStep[] = [
  { t: 0, title: 'せんいの せかい', text: 'ふくの いとを ぐーんと おおきく してみたよ。どろと あぶらの よごれが くっついている！' },
  { t: 6, title: 'みずが しみこむ', text: 'みずが せんいの すきまに しみこんで、よごれを ふやかすよ。' },
  { t: 12, title: 'せんざいが ない…', text: 'こんかいは みずだけ。あぶらは みずを はじいて、なかよく できないんだ。' },
  { t: 19, title: 'ゆすってみると', text: 'うごく みずで どろは すこし はがれた。でも あぶらは くっついた まま…' },
  { t: 26, title: 'あぶらが のこった', text: 'あぶらよごれは みずだけでは おちにくい。つぎは せんざいを いれて ためしてみよう！' },
]
export const MICRO_END_WATER = 33

export const micro = { t: 0 }
export function resetMicro() {
  micro.t = 0
}
export function microSteps(det: boolean) {
  return det ? MICRO_STEPS_DET : MICRO_STEPS_WATER
}
export function microEnd(det: boolean) {
  return det ? MICRO_END_DET : MICRO_END_WATER
}
