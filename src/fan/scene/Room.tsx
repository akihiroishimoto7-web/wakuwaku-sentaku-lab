import { RoundedBox } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { softDotTexture, woodTexture } from '../../textures'
import { fan } from '../sim'
import { useFan } from '../store'

const ROOM_BG = new THREE.Color('#e8f6ff')
const XRAY_BG = new THREE.Color('#1f2d4d')

// 夏のお部屋：青空の窓、ちゃぶ台にすいかと麦茶
export function FanRoom() {
  const scene = useThree((s) => s.scene)
  const room = useRef<THREE.Group>(null)
  const grid = useMemo(() => {
    const g = new THREE.GridHelper(4, 40, '#6fa8ff', '#3b5a8f')
    ;(g.material as THREE.Material).transparent = true
    return g
  }, [])
  const floor = useMemo(() => new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.55 }), [])
  const sky = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 192
    const ctx = c.getContext('2d')!
    const g = ctx.createLinearGradient(0, 0, 0, 192)
    g.addColorStop(0, '#4fb3ff')
    g.addColorStop(1, '#bfe6ff')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 256, 192)
    ctx.fillStyle = '#ffffff'
    for (const [x, y, s] of [[60, 70, 1], [170, 50, 0.8], [200, 120, 0.6]]) {
      for (let k = 0; k < 5; k++) {
        ctx.beginPath()
        ctx.arc(x + (k - 2) * 16 * s, y - (k % 2) * 10 * s, 18 * s, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.fillStyle = '#5cbf6e'
    ctx.beginPath()
    ctx.ellipse(40, 192, 70, 40, 0, 0, Math.PI * 2)
    ctx.ellipse(230, 192, 60, 30, 0, 0, Math.PI * 2)
    ctx.fill()
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  useEffect(() => {
    const prev = scene.background
    scene.background = ROOM_BG.clone()
    return () => {
      scene.background = prev
      floor.dispose()
      sky.dispose()
      grid.geometry.dispose()
      ;(grid.material as THREE.Material).dispose()
    }
  }, [scene, floor, sky, grid])

  useFrame(() => {
    if (useFan.getState().mode !== 'play') return
    const x = fan.xray
    if (scene.background instanceof THREE.Color) scene.background.copy(ROOM_BG).lerp(XRAY_BG, x)
    if (room.current) room.current.visible = x < 0.5
    grid.visible = x > 0.5
    ;(grid.material as THREE.Material).opacity = Math.max(0, (x - 0.5) * 2) * 0.6
  })

  return (
    <>
      <primitive object={grid} position={[0, 0.001, 0]} />
      <group ref={room}>
        <mesh rotation-x={-Math.PI / 2} material={floor}>
          <planeGeometry args={[8, 8]} />
        </mesh>
        {/* ござ */}
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.002, 0.45]}>
          <planeGeometry args={[1.5, 1.1]} />
          <meshStandardMaterial color="#e6d39a" roughness={1} />
        </mesh>
        {[-0.45, -0.15, 0.15, 0.45].map((z) => (
          <mesh key={z} rotation-x={-Math.PI / 2} position={[0, 0.003, 0.45 + z]}>
            <planeGeometry args={[1.5, 0.008]} />
            <meshStandardMaterial color="#c9b170" roughness={1} />
          </mesh>
        ))}
        {/* 奥の壁と窓 */}
        <mesh position={[0, 1.6, -0.7]}>
          <planeGeometry args={[8, 3.2]} />
          <meshStandardMaterial color="#fff6e8" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.06, -0.695]}>
          <planeGeometry args={[8, 0.12]} />
          <meshStandardMaterial color="#d9b98c" roughness={0.8} />
        </mesh>
        <group position={[0.75, 1.35, -0.69]}>
          <mesh>
            <planeGeometry args={[1.1, 0.8]} />
            <meshBasicMaterial map={sky} toneMapped={false} />
          </mesh>
          {[
            [0, 0.42, 1.18, 0.05],
            [0, -0.42, 1.18, 0.05],
            [-0.57, 0, 0.05, 0.86],
            [0.57, 0, 0.05, 0.86],
            [0, 0, 0.03, 0.8],
          ].map(([x, y, w, h], i) => (
            <mesh key={i} position={[x, y, 0.02]}>
              <boxGeometry args={[w, h, 0.04]} />
              <meshStandardMaterial color="#c79a62" roughness={0.6} />
            </mesh>
          ))}
          <mesh position={[0, -0.47, 0.06]}>
            <boxGeometry args={[1.25, 0.03, 0.12]} />
            <meshStandardMaterial color="#c79a62" />
          </mesh>
          {/* あさがおの鉢 */}
          <group position={[-0.35, -0.455, 0.06]}>
            <mesh position-y={0.05}>
              <cylinderGeometry args={[0.05, 0.04, 0.1, 16]} />
              <meshStandardMaterial color="#5ab8ff" roughness={0.5} />
            </mesh>
            {[0, 1, 2].map((i) => (
              <mesh key={i} position={[(i - 1) * 0.04, 0.17 + (i % 2) * 0.05, 0.01]} rotation-x={Math.PI / 2}>
                <coneGeometry args={[0.025, 0.03, 16, 1, true]} />
                <meshStandardMaterial color={['#8a5cff', '#ff6fb0', '#5f8bff'][i]} side={THREE.DoubleSide} />
              </mesh>
            ))}
            <mesh position-y={0.18}>
              <cylinderGeometry args={[0.003, 0.003, 0.2, 6]} />
              <meshStandardMaterial color="#4caf50" />
            </mesh>
          </group>
        </group>
        {/* 左の壁 */}
        <mesh position={[-1.4, 1.6, 1.5]} rotation-y={Math.PI / 2}>
          <planeGeometry args={[4.4, 3.2]} />
          <meshStandardMaterial color="#fde7d2" roughness={0.9} />
        </mesh>
        {/* ちゃぶ台とすいか */}
        <group position={[-0.85, 0, -0.2]}>
          <mesh position-y={0.3}>
            <cylinderGeometry args={[0.32, 0.32, 0.03, 40]} />
            <meshStandardMaterial color="#b9773f" roughness={0.5} />
          </mesh>
          {[0, 1, 2, 3].map((i) => {
            const a = (i / 4) * Math.PI * 2 + 0.6
            return (
              <mesh key={i} position={[Math.cos(a) * 0.22, 0.15, Math.sin(a) * 0.22]}>
                <cylinderGeometry args={[0.018, 0.018, 0.3, 10]} />
                <meshStandardMaterial color="#9a5e2c" />
              </mesh>
            )
          })}
          <mesh position={[0.05, 0.322, 0.05]}>
            <cylinderGeometry args={[0.12, 0.11, 0.015, 32]} />
            <meshStandardMaterial color="#ffffff" roughness={0.3} />
          </mesh>
          {[0, 1].map((i) => (
            <group key={i} position={[0.0 + i * 0.09, 0.335, 0.05 + i * 0.02]} rotation={[-Math.PI / 2, 0, 0.4 + i * 0.6]}>
              <mesh>
                <circleGeometry args={[0.065, 24, 0, Math.PI]} />
                <meshStandardMaterial color="#ff4d5e" side={THREE.DoubleSide} />
              </mesh>
              <mesh position-z={-0.001}>
                <ringGeometry args={[0.065, 0.075, 24, 1, 0, Math.PI]} />
                <meshStandardMaterial color="#3a9a4a" side={THREE.DoubleSide} />
              </mesh>
            </group>
          ))}
          <mesh position={[-0.14, 0.37, -0.06]}>
            <cylinderGeometry args={[0.03, 0.026, 0.1, 20]} />
            <meshPhysicalMaterial color="#c8742a" roughness={0.1} transparent opacity={0.75} clearcoat={1} />
          </mesh>
        </group>
        <RoundedBox args={[0.5, 0.42, 0.3]} radius={0.02} position={[1.25, 0.21, -0.45]}>
          <meshStandardMaterial color="#f3dcb8" roughness={0.6} />
        </RoundedBox>
        {/* 台の下の影 */}
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.004, 0]}>
          <planeGeometry args={[0.6, 0.6]} />
          <meshBasicMaterial color="#5a4632" map={softDotTexture()} transparent opacity={0.45} depthWrite={false} />
        </mesh>
      </group>
    </>
  )
}
