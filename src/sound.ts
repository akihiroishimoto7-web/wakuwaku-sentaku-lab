import { setSpeechMuted } from './speech'
import type { SimState } from './sim'

// Web Audio だけで合成する効果音（外部ファイル・外部APIは使わない）
class SoundEngine {
  ctx: AudioContext | null = null
  private master!: GainNode
  private noise!: AudioBuffer
  private motorGain!: GainNode
  private motorOsc!: OscillatorNode
  private motorOsc2!: OscillatorNode
  private motorFilter!: BiquadFilterNode
  private waterGain!: GainNode
  private drainGain!: GainNode
  private pumpGain!: GainNode
  private fanGain!: GainNode
  private sloshGain!: GainNode
  private sloshFilter!: BiquadFilterNode
  private sources: AudioScheduledSourceNode[] = []
  muted = false

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
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {})
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

    const loopNoise = () => {
      const s = ctx.createBufferSource()
      s.buffer = this.noise
      s.loop = true
      s.start()
      this.sources.push(s)
      return s
    }
    const gain = (v = 0) => {
      const g = ctx.createGain()
      g.gain.value = v
      return g
    }

    // モーター
    this.motorFilter = ctx.createBiquadFilter()
    this.motorFilter.type = 'lowpass'
    this.motorFilter.frequency.value = 500
    this.motorGain = gain()
    this.motorOsc = ctx.createOscillator()
    this.motorOsc.type = 'sawtooth'
    this.motorOsc.frequency.value = 50
    this.motorOsc2 = ctx.createOscillator()
    this.motorOsc2.type = 'sine'
    this.motorOsc2.frequency.value = 100
    this.motorOsc.connect(this.motorFilter)
    this.motorOsc2.connect(this.motorFilter)
    this.motorFilter.connect(this.motorGain).connect(this.master)
    this.motorOsc.start()
    this.motorOsc2.start()
    this.sources.push(this.motorOsc, this.motorOsc2)

    // 給水（水が注がれる音）
    const wf = ctx.createBiquadFilter()
    wf.type = 'bandpass'
    wf.frequency.value = 1400
    wf.Q.value = 0.6
    this.waterGain = gain()
    loopNoise().connect(wf).connect(this.waterGain).connect(this.master)

    // 排水（ゴボゴボ）
    const df = ctx.createBiquadFilter()
    df.type = 'lowpass'
    df.frequency.value = 380
    const dlfo = ctx.createOscillator()
    dlfo.frequency.value = 5.5
    const dlfoG = gain(0.5)
    const dmod = gain(0.5)
    dlfo.connect(dlfoG).connect(dmod.gain)
    dlfo.start()
    this.sources.push(dlfo)
    this.drainGain = gain()
    loopNoise().connect(df).connect(dmod).connect(this.drainGain).connect(this.master)
    const pumpOsc = ctx.createOscillator()
    pumpOsc.type = 'triangle'
    pumpOsc.frequency.value = 118
    this.pumpGain = gain()
    pumpOsc.connect(this.pumpGain).connect(this.master)
    pumpOsc.start()
    this.sources.push(pumpOsc)

    // ファン
    const ff = ctx.createBiquadFilter()
    ff.type = 'lowpass'
    ff.frequency.value = 900
    this.fanGain = gain()
    loopNoise().connect(ff).connect(this.fanGain).connect(this.master)

    // 水がゆれる音
    this.sloshFilter = ctx.createBiquadFilter()
    this.sloshFilter.type = 'bandpass'
    this.sloshFilter.frequency.value = 600
    this.sloshFilter.Q.value = 1.2
    this.sloshGain = gain()
    loopNoise().connect(this.sloshFilter).connect(this.sloshGain).connect(this.master)
  }

  setMuted(m: boolean) {
    this.muted = m
    setSpeechMuted(m)
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05)
  }

  update(s: SimState, active: boolean) {
    if (!this.ctx || this.ctx.state !== 'running') return
    const t = this.ctx.currentTime
    const k = active ? 1 : 0
    const rpm = s.rpm
    const w = Math.abs(s.omega)
    this.motorOsc.frequency.setTargetAtTime(38 + rpm * 0.26, t, 0.08)
    this.motorOsc2.frequency.setTargetAtTime(76 + rpm * 0.52, t, 0.08)
    this.motorFilter.frequency.setTargetAtTime(300 + rpm * 1.4, t, 0.1)
    this.motorGain.gain.setTargetAtTime(k * Math.min(0.13, w * 0.012 + Math.min(1, rpm / 600) * 0.06), t, 0.1)
    this.waterGain.gain.setTargetAtTime(k * s.inlet * 0.22, t, 0.1)
    this.drainGain.gain.setTargetAtTime(k * s.pump * s.drainFlow * 0.28, t, 0.1)
    this.pumpGain.gain.setTargetAtTime(k * s.pump * 0.025, t, 0.1)
    this.fanGain.gain.setTargetAtTime(k * s.airflow * 0.09, t, 0.2)
    const slosh = k * Math.min(1, s.level * 3) * Math.min(1, w / 4) * 0.12
    this.sloshGain.gain.setTargetAtTime(slosh * (0.6 + 0.4 * Math.sin(s.time * 3)), t, 0.08)
    this.sloshFilter.frequency.setTargetAtTime(450 + 250 * Math.sin(s.time * 2.1), t, 0.1)
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
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    o.connect(g).connect(this.master)
    o.start(t0)
    o.stop(t0 + dur + 0.05)
  }

  private noiseBurst(dur: number, freq: number, vol: number, when = 0) {
    if (!this.ctx || this.ctx.state !== 'running') return
    const ctx = this.ctx
    const t0 = ctx.currentTime + when
    const s = ctx.createBufferSource()
    s.buffer = this.noise
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = freq
    const g = ctx.createGain()
    g.gain.setValueAtTime(vol, t0)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    s.connect(f).connect(g).connect(this.master)
    s.start(t0, Math.random())
    s.stop(t0 + dur + 0.05)
  }

  click() {
    this.tone(880, 0.09, 'sine', 0.15)
    this.tone(1320, 0.07, 'sine', 0.08, 0.03)
  }
  door(open: boolean) {
    this.noiseBurst(0.12, 900, 0.25)
    this.tone(open ? 300 : 200, 0.12, 'triangle', 0.2, 0.02, open ? 420 : 140)
  }
  plop() {
    this.tone(520, 0.18, 'sine', 0.22, 0, 180)
    this.noiseBurst(0.15, 700, 0.12, 0.04)
  }
  pour() {
    for (let i = 0; i < 7; i++) this.tone(300 + Math.random() * 200, 0.12, 'sine', 0.12, i * 0.13, 600 + Math.random() * 300)
    this.noiseBurst(1.0, 1800, 0.08)
  }
  start() {
    ;[523, 659, 784].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.2, i * 0.09))
  }
  whoosh() {
    this.noiseBurst(0.7, 1200, 0.15)
    this.tone(200, 0.8, 'sine', 0.12, 0, 900)
  }
  pop() {
    this.tone(900 + Math.random() * 500, 0.06, 'sine', 0.08, 0, 1800)
  }
  // たんけんの章が変わったときの「ピンポン」
  chime() {
    this.tone(1046, 0.22, 'triangle', 0.14)
    this.tone(1568, 0.35, 'triangle', 0.12, 0.12)
    this.tone(2093, 0.3, 'sine', 0.05, 0.12)
  }
  sparkle() {
    ;[1568, 2093, 2637, 3136].forEach((f, i) => this.tone(f, 0.25, 'sine', 0.06, i * 0.06))
  }
  melody() {
    const notes: [number, number][] = [
      [784, 0], [659, 0.18], [784, 0.36], [1047, 0.54], [988, 0.9], [880, 1.08], [988, 1.26], [1175, 1.44],
      [1047, 1.8], [1319, 2.0], [1568, 2.2],
    ]
    notes.forEach(([f, w]) => {
      this.tone(f, 0.42, 'triangle', 0.16, w)
      this.tone(f * 2, 0.3, 'sine', 0.04, w)
    })
    ;[262, 392, 330, 523].forEach((f, i) => this.tone(f, 0.6, 'sine', 0.08, i * 0.54))
  }
}

export const sound = new SoundEngine()
