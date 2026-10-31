import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sim } from '../sim'

// 「なかをみる」の透明化：sim.xray(0..1) に合わせて不透明度を変える
export function useXrayFade(mats: THREE.Material[], minOpacity: number, baseOpacity = 1) {
  useFrame(() => {
    const x = sim.xray
    const o = baseOpacity + (minOpacity - baseOpacity) * x
    const transparent = o < 0.999
    for (const m of mats) {
      if (m.transparent !== transparent) {
        m.transparent = transparent
        m.needsUpdate = true
      }
      m.opacity = o
      m.depthWrite = o > 0.6
    }
  })
}
