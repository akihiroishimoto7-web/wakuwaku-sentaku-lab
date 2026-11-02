import { setSpeechMuted } from '../speech'

// 扇風機ラボの音（Web Audio で合成。音声ファイルは使わない）
class FanSound {
  ctx: AudioContext | null = null
  muted = false
  private master!: GainNode
  private noise!: AudioBuffer
  private hum!: OscillatorNode
  private hum2!: OscillatorNode
  private humGain!: GainNode
  private humFilter!: BiquadFilterNode
  private windGain!: GainNode
  private windFilter!: BiquadFilterNode

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AC) return
      this.ctx = new AC()
      this.build()
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {})
  }
  suspend() {
    this.ctx?.suspend().catch(() => {})
  }
  resume() {
    if (this.ctx?.state === 'suspended') this.ctx.resume().catch(() => {})
  }

  private build() {
    const ctx = this.ctx!
    this.master = ctx.createGain()
    this.master.gain.value = this.muted ? 0 : 0.8
    this.master.connect(ctx.destination)
    const len = ctx.sampleRate * 2
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = this.noise.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1

    this.humFilter = ctx.createBiquadFilter()
    this.humFilter.type = 'lowpass'
    this.humFilter.frequency.value = 300
    this.humGain = ctx.createGain()
    this.humGain.gain.value = 0
    this.hum = ctx.createOscillator()
    this.hum.type = 'sawtooth'
    this.hum.frequency.value = 50
    this.hum2 = ctx.createOscillator()
    this.hum2.type = 'sine'
    this.hum2.frequency.value = 100
    this.hum.connect(this.humFilter)
    this.hum2.connect(this.humFilter)
    this.humFilter.connect(this.humGain).connect(this.master)
    this.hum.start()
    this.hum2.start()

    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.loop = true
    this.windFilter = ctx.createBiquadFilter()
    this.windFilter.type = 'bandpass'
    this.windFilter.frequency.value = 500
    this.windFilter.Q.value = 0.5
    this.windGain = ctx.createGain()
    this.windGain.gain.value = 0
    src.connect(this.windFilter).connect(this.windGain).connect(this.master)
    src.start()
  }

  setMuted(m: boolean) {
    this.muted = m
    setSpeechMuted(m)
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05)
  }

  update(rpm: number, wind: number, active: boolean, time: number) {
    if (!this.ctx || this.ctx.state !== 'running') return
    const t = this.ctx.currentTime
    const k = active ? 1 : 0
    this.hum.frequency.setTargetAtTime(48 + rpm * 0.05, t, 0.1)
    this.hum2.frequency.setTargetAtTime(96 + rpm * 0.1, t, 0.1)
    this.humFilter.frequency.setTargetAtTime(200 + rpm * 0.4, t, 0.1)
    this.humGain.gain.setTargetAtTime(k * Math.min(0.06, rpm * 0.00005), t, 0.15)
    // 風の音：羽根の枚数ぶんの「ふわふわ」した揺れをつける
    const gust = 0.8 + 0.2 * Math.sin(time * 2.3) * Math.sin(time * 0.7)
    this.windGain.gain.setTargetAtTime(k * wind * wind * 0.22 * gust, t, 0.15)
    this.windFilter.frequency.setTargetAtTime(350 + wind * 900, t, 0.2)
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, when = 0, slideTo?: number) {
    if (!this.ctx || this.ctx.state !== 'running') return
    const ctx = this.ctx
    const t0 = ctx.currentTime + when
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(freq, t0)
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    o.connect(g).connect(this.master)
    o.start(t0)
    o.stop(t0 + dur + 0.05)
  }

  click() {
    this.tone(880, 0.08, 'sine', 0.14)
    this.tone(1320, 0.06, 'sine', 0.07, 0.03)
  }
  button(level: number) {
    // 押したボタンの強さで高さが変わる「ピッ」
    this.tone(520 + level * 180, 0.12, 'square', 0.05)
    this.tone(1040 + level * 360, 0.1, 'sine', 0.06, 0.02)
  }
  knob() {
    this.tone(300, 0.06, 'triangle', 0.15)
    this.tone(180, 0.08, 'triangle', 0.12, 0.05)
  }
  // 風鈴：高い音の部分音がきらきら長く残る
  chime(strength = 1) {
    const base = 2100 + Math.random() * 300
    const v = 0.05 * Math.min(1, 0.4 + strength)
    this.tone(base, 2.4, 'sine', v)
    this.tone(base * 2.76, 1.4, 'sine', v * 0.5)
    this.tone(base * 5.4, 0.7, 'sine', v * 0.25)
  }
  whoosh() {
    if (!this.ctx || this.ctx.state !== 'running') return
    const ctx = this.ctx
    const t0 = ctx.currentTime
    const s = ctx.createBufferSource()
    s.buffer = this.noise
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.setValueAtTime(400, t0)
    f.frequency.exponentialRampToValueAtTime(2200, t0 + 0.6)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.2, t0)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.7)
    s.connect(f).connect(g).connect(this.master)
    s.start(t0)
    s.stop(t0 + 0.75)
  }
  chimeTour() {
    this.tone(1046, 0.22, 'triangle', 0.14)
    this.tone(1568, 0.35, 'triangle', 0.12, 0.12)
  }
  sparkle() {
    ;[1568, 2093, 2637, 3136].forEach((f, i) => this.tone(f, 0.25, 'sine', 0.06, i * 0.06))
  }
  melody() {
    ;[
      [784, 0], [880, 0.16], [988, 0.32], [1175, 0.48], [988, 0.8], [1175, 0.96], [1568, 1.2],
    ].forEach(([f, w]) => {
      this.tone(f, 0.4, 'triangle', 0.15, w)
      this.tone(f * 2, 0.25, 'sine', 0.04, w)
    })
  }
}

export const fanSound = new FanSound()
