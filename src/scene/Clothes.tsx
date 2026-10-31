import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { addBody, bodies } from '../clothSim'
import { CLOTH_IDS, CLOTH_MAP, type ClothId } from '../data'
import { makeClothMaterial } from '../clothMaterial'
import { sim } from '../sim'
import { useStore } from '../store'

export function Clothes() {
  const items = useStore((s) => s.items)
  return (
    <>
      {CLOTH_IDS.filter((id) => items[id] !== 'basket').map((id) => (
        <ClothItem key={id} id={id} />
      ))}
    </>
  )
}

function ClothItem({ id }: { id: ClothId }) {
  const def = CLOTH_MAP[id]
  const group = useRef<THREE.Group>(null)
  const quality = useStore((s) => s.quality)
  const { mat, uniforms } = useMemo(() => makeClothMaterial(def.color, def.shape, Math.random() * 10, def.size), [def])
  const seg = quality === 'high' ? 22 : 12
  const geo = useMemo(() => new THREE.PlaneGeometry(def.size[0], def.size[1], seg, seg), [def, seg])
  const eyeMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2b1d14', roughness: 0.3 }), [])
  useMemo(() => addBody(id), [id])
  useEffect(
    () => () => {
      mat.dispose()
      eyeMat.dispose()
    },
    [mat, eyeMat],
  )
  useEffect(() => () => geo.dispose(), [geo])

  useFrame(() => {
    const b = bodies.get(id)
    const g = group.current
    if (!b || !g) return
    g.position.copy(b.world)
    g.quaternion.copy(b.quat)
    g.scale.copy(b.scale)
    const u = uniforms
    u.uTime.value = sim.time
    u.uBend.value = b.bend
    u.uFold.value = b.fold
    u.uFlutter.value = b.flutter
    u.uMud.value = Math.min(1, sim.dirtMud * def.dirt)
    u.uOil.value = Math.min(1, sim.dirtOil * def.dirt)
    u.uWet.value = b.mode === 'in' ? 0 : sim.wet
    u.uGlow.value = b.glow
  })

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    const st = useStore.getState()
    if (e.delta > 10 || st.mode !== 'wash') return
    const b = bodies.get(id)
    if (!b || b.mode !== 'drum') return
    e.stopPropagation()
    st.startZoom(id)
  }

  if (def.shape === 4) {
    // くまちゃん（ぬいぐるみ風の布製品）
    return (
      <group ref={group} onClick={onClick}>
        <Teddy mat={mat} eyeMat={eyeMat} />
      </group>
    )
  }
  return (
    <group ref={group} onClick={onClick}>
      <mesh geometry={geo} material={mat} />
    </group>
  )
}

const sphere = new THREE.SphereGeometry(1, 18, 12)
function Teddy({ mat, eyeMat }: { mat: THREE.Material; eyeMat: THREE.Material }) {
  const parts: [number, number, number, number, number?][] = [
    [0, -0.015, 0, 0.048, 1.12],
    [0, 0.055, 0.004, 0.038],
    [-0.03, 0.085, 0, 0.014],
    [0.03, 0.085, 0, 0.014],
    [-0.047, 0.0, 0.005, 0.017],
    [0.047, 0.0, 0.005, 0.017],
    [-0.025, -0.062, 0.008, 0.02],
    [0.025, -0.062, 0.008, 0.02],
    [0, 0.046, 0.034, 0.014],
  ]
  return (
    <group>
      {parts.map(([x, y, z, r, sy = 1], i) => (
        <mesh key={i} geometry={sphere} material={mat} position={[x, y, z]} scale={[r, r * sy, r * 0.9]} />
      ))}
      <mesh geometry={sphere} material={eyeMat} position={[-0.013, 0.062, 0.035]} scale={0.005} />
      <mesh geometry={sphere} material={eyeMat} position={[0.013, 0.062, 0.035]} scale={0.005} />
      <mesh geometry={sphere} material={eyeMat} position={[0, 0.05, 0.047]} scale={0.0055} />
    </group>
  )
}
