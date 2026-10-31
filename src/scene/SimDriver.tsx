import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { demoBodies, stepClothes } from '../clothSim'
import { stepTour } from '../tour'
import { cleanRatio, remaining, sim, stepSim, totalProgress } from '../sim'
import { sound } from '../sound'
import { useStore } from '../store'

// シミュレーション・衣服物理・音・HUD更新をまとめて駆動する（描画より先に実行）
// ?speed=4 などで動作確認用に早送りできる（UIには出さない）
const DEBUG_SPEED = Math.min(20, Math.max(1, Number(new URLSearchParams(location.search).get('speed')) || 1))

export function SimDriver() {
  const hudTimer = useRef(0)
  useFrame((_, delta) => {
    const st = useStore.getState()
    const real = Math.min(delta, 0.05) * DEBUG_SPEED
    let scale = st.slow ? 0.3 : 1
    if (st.paused && st.step === 'running') scale = 0
    if (st.mode !== 'wash') scale = 0
    // たんけん中は本物の洗濯をひと休みして、ツアー用の動きを見せる
    if (st.tour && st.mode === 'wash') scale = st.tourPaused ? 0 : st.slow ? 0.4 : 1
    sim.timeScale = scale
    const wasRunning = sim.running
    const dt = real * scale
    const n = Math.max(1, Math.ceil(dt / 0.02))
    for (let i = 0; i < n; i++) {
      if (st.tour) stepTour(dt / n)
      else stepSim(dt / n)
      stepClothes(dt / n)
      if (demoBodies.size) stepClothes(dt / n, demoBodies)
    }
    sim.dt = dt
    sim.xray += ((st.xray && st.mode === 'wash' ? 1 : 0) - sim.xray) * Math.min(1, real * 3.5)
    sound.update(sim, st.mode === 'wash' && scale > 0)

    if (!st.tour && wasRunning && !sim.running && sim.done) st.finishCycle()

    hudTimer.current += real
    if (hudTimer.current > 0.2) {
      hudTimer.current = 0
      if (st.step === 'running' || st.step === 'done') {
        useStore.setState({
          hud: {
            phase: sim.phaseId,
            phaseIdx: sim.idx,
            rpm: Math.round(sim.rpm),
            remain: Math.ceil(remaining()),
            progress: totalProgress(),
            clean: cleanRatio(),
          },
        })
      }
    }
  }, -2)
  return null
}
