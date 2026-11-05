import { award, markSeen } from './stamps'
import { useStore } from './store'

// せんたくき ラボの できごとを みて シールを わたす
useStore.subscribe((s, p) => {
  if (s.step === 'done' && p.step !== 'done' && s.result) {
    award('wash_first')
    if (s.result.clean >= 0.9) award('wash_pika')
    if (!s.detergent) award('wash_water')
    if (s.course === 'dry') award('wash_dry')
  }
  if (s.xray && !p.xray && !s.tour) award('wash_xray')
  if (s.focus && s.focus !== p.focus && !s.tour) markSeen('wash_parts', s.focus)
  if (s.mode === 'micro' && p.mode !== 'micro') award('wash_micro')
  if (s.tourDone && !p.tourDone) award('wash_tour')
  if (s.expState === 'done' && p.expState !== 'done') award('wash_exp')
})
