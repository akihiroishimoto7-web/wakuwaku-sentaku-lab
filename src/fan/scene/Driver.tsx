import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { fan, stepFan } from '../sim'
import { fanSound } from '../sound'
import { useFan } from '../store'
import { stepFanTour } from '../tour'

export const fanHud = { rpm: 0, wind: 0 }

// 毎フレーム：扇風機の動き・たんけん・音・透視の度合い
export function FanDriver() {
  const tick = useRef(0)
  useFrame((_, delta) => {
    const st = useFan.getState()
    const real = Math.min(delta, 0.05)
    let scale = st.slow ? 0.4 : 1
    if (st.tour && st.tourPaused) scale = 0
    if (st.mode !== 'play') scale = 0
    const dt = real * scale
    if (st.tour) stepFanTour(dt)
    else stepFan(dt)
    fan.dt = dt
    fan.xray += ((st.xray && st.mode === 'play' ? 1 : 0) - fan.xray) * Math.min(1, real * 3.5)
    fanSound.update(fan.rpm, fan.wind, st.mode === 'play' && scale > 0, fan.time)
    tick.current += real
    if (tick.current > 0.2) {
      tick.current = 0
      fanHud.rpm = Math.round(fan.rpm)
      fanHud.wind = fan.wind
      if (Math.abs(st.hudRpm - fanHud.rpm) > 4 || (fanHud.rpm === 0 && st.hudRpm !== 0)) useFan.setState({ hudRpm: fanHud.rpm })
    }
  }, -2)
  return null
}
