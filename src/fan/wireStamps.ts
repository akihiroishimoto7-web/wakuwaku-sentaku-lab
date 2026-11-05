import { award, markSeen } from '../stamps'
import { useFan } from './store'

// せんぷうき ラボの できごとを みて シールを わたす（ふうりんは Props.tsx で）
useFan.subscribe((s, p) => {
  if (s.level !== p.level && !s.tour) {
    if (s.level > 0) award('fan_on')
    if (s.level === 3) award('fan_strong')
  }
  if (s.osc && !p.osc && !s.tour) award('fan_osc')
  if (s.focus && s.focus !== p.focus && !s.tour) markSeen('fan_parts', s.focus)
  if (s.tourDone && !p.tourDone) award('fan_tour')
  if (s.expState === 'done' && p.expState !== 'done') award('fan_exp')
})
