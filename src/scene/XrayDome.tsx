import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { sim } from '../sim'
import { useStore } from '../store'

// 透視モードでは部屋を消して夜空のような背景＋方眼の床にし、機械の中身を浮かび上がらせる
const ROOM_BG = new THREE.Color('#fbefe2')
const XRAY_BG = new THREE.Color('#1f2d4d')

export function XrayBackdrop({ room }: { room: React.RefObject<THREE.Group | null> }) {
  const scene = useThree((s) => s.scene)
  const grid = useRef<THREE.GridHelper>(null)
  const gridObj = useMemo(() => {
    const g = new THREE.GridHelper(4, 40, '#6fa8ff', '#3b5a8f')
    ;(g.material as THREE.Material).transparent = true
    return g
  }, [])
  useEffect(
    () => () => {
      gridObj.geometry.dispose()
      ;(gridObj.material as THREE.Material).dispose()
    },
    [gridObj],
  )
  useFrame(() => {
    if (useStore.getState().mode !== 'wash') return
    const x = sim.xray
    if (scene.background instanceof THREE.Color) scene.background.copy(ROOM_BG).lerp(XRAY_BG, x)
    if (room.current) room.current.visible = x < 0.5
    gridObj.visible = x > 0.5
    ;(gridObj.material as THREE.Material).opacity = Math.max(0, (x - 0.5) * 2) * 0.6
  })
  return <primitive ref={grid} object={gridObj} position={[0, 0.001, 0]} />
}
