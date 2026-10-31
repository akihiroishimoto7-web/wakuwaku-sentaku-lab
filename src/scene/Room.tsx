import { Detailed, RoundedBox } from '@react-three/drei'
import { useThree, type ThreeElements } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { softDotTexture, tileTexture, woodTexture } from '../textures'

// 明るいランドリールーム
export function Room() {
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    const prev = scene.background
    scene.background = new THREE.Color('#fbefe2')
    return () => {
      scene.background = prev
    }
  }, [scene])

  const floorMat = useMemo(() => new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.55 }), [])
  const tileMat = useMemo(() => new THREE.MeshStandardMaterial({ map: tileTexture(), roughness: 0.3 }), [])
  useEffect(
    () => () => {
      floorMat.dispose()
      tileMat.dispose()
    },
    [floorMat, tileMat],
  )

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} material={floorMat} receiveShadow>
        <planeGeometry args={[8, 8]} />
      </mesh>
      {/* ラグ */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.002, 0.75]}>
        <circleGeometry args={[0.55, 48]} />
        <meshStandardMaterial color="#ffd6e0" roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.003, 0.75]}>
        <ringGeometry args={[0.42, 0.46, 48]} />
        <meshStandardMaterial color="#ffffff" roughness={1} />
      </mesh>
      {/* 奥の壁 */}
      <mesh position={[0, 1.6, -0.45]}>
        <planeGeometry args={[8, 3.2]} />
        <meshStandardMaterial color="#cfeee6" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.45, -0.445]} material={tileMat}>
        <planeGeometry args={[8, 0.9]} />
      </mesh>
      <mesh position={[0, 0.91, -0.44]}>
        <boxGeometry args={[8, 0.03, 0.02]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      {/* 左の壁 */}
      <mesh position={[-1.5, 1.6, 1.5]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[4, 3.2]} />
        <meshStandardMaterial color="#fde3cf" roughness={0.9} />
      </mesh>

      {/* 窓 */}
      <group position={[1.05, 1.45, -0.44]}>
        <mesh position-z={0.001}>
          <planeGeometry args={[0.9, 0.75]} />
          <meshBasicMaterial color="#bfe8ff" toneMapped={false} />
        </mesh>
        <mesh position={[0, -0.12, 0.002]}>
          <circleGeometry args={[0.12, 24]} />
          <meshBasicMaterial color="#fff6d6" toneMapped={false} />
        </mesh>
        {[
          [0, 0.39, 0.96, 0.04],
          [0, -0.39, 0.96, 0.04],
          [-0.46, 0, 0.04, 0.82],
          [0.46, 0, 0.04, 0.82],
          [0, 0, 0.03, 0.75],
          [0, 0, 0.9, 0.03],
        ].map(([x, y, w, h], i) => (
          <mesh key={i} position={[x, y, 0.02]}>
            <boxGeometry args={[w, h, 0.04]} />
            <meshStandardMaterial color="#ffffff" roughness={0.5} />
          </mesh>
        ))}
        <mesh position={[0, -0.42, 0.06]}>
          <boxGeometry args={[1.0, 0.03, 0.12]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <Plant position={[0.3, -0.405, 0.06]} scale={0.6} />
      </group>

      {/* 棚と洗剤ボトル */}
      <group position={[-0.62, 1.22, -0.33]}>
        <RoundedBox args={[0.7, 0.03, 0.22]} radius={0.01}>
          <meshStandardMaterial color="#f3c98b" roughness={0.6} />
        </RoundedBox>
        <Bottle position={[-0.22, 0.015, 0]} color="#5ec8ff" h={0.18} />
        <Bottle position={[-0.08, 0.015, 0.02]} color="#ff8fb3" h={0.14} />
        <Bottle position={[0.05, 0.015, -0.02]} color="#9be37a" h={0.16} />
        <mesh position={[0.22, 0.07, 0]}>
          <boxGeometry args={[0.14, 0.11, 0.12]} />
          <meshStandardMaterial color="#ffe38a" roughness={0.7} />
        </mesh>
      </group>

      {/* 洗濯物ロープ */}
      <mesh position={[0.95, 2.05, -0.2]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.004, 0.004, 1.5, 6]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      {[
        [0.45, '#ffb3c7'],
        [0.8, '#a8e6ff'],
        [1.15, '#ffe28a'],
      ].map(([x, c], i) => (
        <mesh key={i} position={[x as number, 1.93, -0.2]}>
          <planeGeometry args={[0.2, 0.24]} />
          <meshStandardMaterial color={c as string} side={THREE.DoubleSide} roughness={1} />
        </mesh>
      ))}

      <Basket position={[-0.68, 0, 0.25]} />
      <Plant position={[0.72, 0, -0.2]} scale={1.2} />

      {/* 軽量な接地影（影マップを使わない） */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.005, 0.02]} renderOrder={1}>
        <planeGeometry args={[1.05, 1.0]} />
        <meshBasicMaterial color="#5a4632" map={softDotTexture()} transparent opacity={0.55} depthWrite={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[-0.68, 0.005, 0.25]} renderOrder={1}>
        <planeGeometry args={[0.6, 0.6]} />
        <meshBasicMaterial color="#5a4632" map={softDotTexture()} transparent opacity={0.4} depthWrite={false} />
      </mesh>
    </group>
  )
}

function Bottle({ color, h, ...props }: { color: string; h: number } & ThreeElements['group']) {
  return (
    <group {...props}>
      <RoundedBox args={[0.08, h, 0.06]} radius={0.015} position-y={h / 2}>
        <meshPhysicalMaterial color={color} roughness={0.2} clearcoat={1} />
      </RoundedBox>
      <mesh position-y={h + 0.015}>
        <cylinderGeometry args={[0.015, 0.018, 0.03, 12]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0, h * 0.5, 0.031]}>
        <circleGeometry args={[0.022, 20]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
    </group>
  )
}

function Plant(props: ThreeElements['group']) {
  return (
    <group {...props}>
      <mesh position-y={0.09}>
        <cylinderGeometry args={[0.08, 0.06, 0.18, 20]} />
        <meshStandardMaterial color="#ffffff" roughness={0.4} />
      </mesh>
      {Array.from({ length: 7 }).map((_, i) => {
        const a = (i / 7) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(a) * 0.04, 0.26 + (i % 3) * 0.03, Math.sin(a) * 0.04]} rotation={[Math.sin(a) * 0.5, a, Math.cos(a) * 0.5]}>
            <sphereGeometry args={[0.06, 12, 8]} />
            <meshStandardMaterial color={i % 2 ? '#5cbf6e' : '#79d487'} roughness={0.7} />
          </mesh>
        )
      })}
    </group>
  )
}

// かご（距離に応じて細かさを切り替える LOD）
function Basket(props: ThreeElements['group']) {
  return (
    <group {...props}>
      <Detailed distances={[0, 3.2]}>
        <group>
          <mesh position-y={0.11}>
            <cylinderGeometry args={[0.2, 0.17, 0.22, 32, 6, true]} />
            <meshStandardMaterial color="#e9b872" roughness={0.9} side={THREE.DoubleSide} wireframe={false} />
          </mesh>
          {[0.04, 0.09, 0.14, 0.19].map((y) => (
            <mesh key={y} position-y={y} rotation-x={Math.PI / 2}>
              <torusGeometry args={[0.17 + y * 0.14, 0.008, 6, 40]} />
              <meshStandardMaterial color="#d49c55" roughness={0.9} />
            </mesh>
          ))}
          <mesh position-y={0.22} rotation-x={Math.PI / 2}>
            <torusGeometry args={[0.2, 0.014, 8, 40]} />
            <meshStandardMaterial color="#c88c45" roughness={0.8} />
          </mesh>
          <mesh position={[0.02, 0.2, 0.02]} scale={[1, 0.35, 1]}>
            <sphereGeometry args={[0.16, 20, 12]} />
            <meshStandardMaterial color="#ffffff" roughness={1} />
          </mesh>
          <mesh position={[-0.05, 0.24, -0.03]} scale={[1, 0.3, 0.8]}>
            <sphereGeometry args={[0.1, 16, 10]} />
            <meshStandardMaterial color="#ffd0e0" roughness={1} />
          </mesh>
        </group>
        <mesh position-y={0.11}>
          <cylinderGeometry args={[0.2, 0.17, 0.22, 10]} />
          <meshStandardMaterial color="#e9b872" roughness={0.9} />
        </mesh>
      </Detailed>
    </group>
  )
}
