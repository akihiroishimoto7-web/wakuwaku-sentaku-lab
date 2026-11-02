// 端末の読み上げ機能（Web Speech API）。字が読めない子どものために説明を声でも伝える。
// 使えない端末やミュート中は何もしない。
let primed = false
let muted = false

export function setSpeechMuted(m: boolean) {
  muted = m
  if (m) stopSpeech()
}

function synth() {
  try {
    return window.speechSynthesis ?? null
  } catch {
    return null
  }
}

function jaVoice(s: SpeechSynthesis) {
  const voices = s.getVoices().filter((v) => v.lang.toLowerCase().startsWith('ja'))
  // 端末に入っている、なるべく自然な声を選ぶ
  return voices.find((v) => /kyoko|o-ren|nanami|google/i.test(v.name)) ?? voices[0] ?? null
}

// iOS ではタップの中で一度しゃべらせないと、その後の読み上げが鳴らない
export function primeSpeech() {
  const s = synth()
  if (!s || primed) return
  primed = true
  try {
    const u = new SpeechSynthesisUtterance(' ')
    u.volume = 0
    s.speak(u)
  } catch {
    /* noop */
  }
}

export function speak(text: string, opts: { rate?: number; pitch?: number } = {}) {
  const s = synth()
  if (!s || muted) return
  try {
    s.cancel()
    const u = new SpeechSynthesisUtterance(text.replace(/（.*?）/g, '').replace(/[！？]/g, '。'))
    u.lang = 'ja-JP'
    u.rate = opts.rate ?? 1.0
    u.pitch = opts.pitch ?? 1.1
    const v = jaVoice(s)
    if (v) u.voice = v
    s.speak(u)
  } catch {
    /* 読み上げが使えない端末では文字だけで進める */
  }
}

export function stopSpeech() {
  try {
    synth()?.cancel()
  } catch {
    /* noop */
  }
}
