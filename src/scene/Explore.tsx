import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { TUB_C } from '../data'
import { SPOTS, type SpotDef } from '../explore'
import { sim } from '../sim'
import { useStore } from '../store'

// ドラムの中の探検：はっけんポイント・懐中電灯・「いっしょに まわる」
export function Explore() {
  const explore = useStore((s) => s.explore)
  if (!explore) return null
  return <ExploreInner />
}

const AXIS = new THREE.Vector3(0, 0, 1)
const UP = new THREE.Vector3(0, 1, 0)

function ExploreInner() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const gl = useThree((s) => s.gl)
  const controls = useThree((s) => s.controls) as unknown as OrbitControlsImpl | null
  const group = useRef<THREE.Group>(null)
  const spin = useRef<THREE.Group>(null)
  const lamp = useRef<THREE.PointLight>(null)
  const center = useMemo(() => new THREE.Vector3(), [])
  const tmp = useMemo(() => new THREE.Vector3(), [])

  // 中に入っているあいだは近くまで描けるようにし、出るときに元へ戻す
  useEffect(() => {
    camera.near = 0.005
    camera.updateProjectionMatrix()
    // ドラムの中は少し暗くして、ステンレスの光り方を見せる
    const exposure = gl.toneMappingExposure
    gl.toneMappingExposure = exposure * 0.72
    return () => {
      gl.toneMappingExposure = exposure
      camera.near = 0.02
      camera.up.copy(UP)
      camera.updateProjectionMatrix()
    }
  }, [camera, gl])

  useFrame(() => {
    if (group.current) group.current.position.copy(TUB_C).add(sim.vib)
    if (spin.current) spin.current.rotation.z = sim.angle
    if (lamp.current) lamp.current.position.copy(camera.position)

    const st = useStore.getState()
    if (!controls || st.zooming) return
    center.copy(TUB_C).add(sim.vib)
    if (st.ride && controls.enabled) {
      // ドラムといっしょに回る（目が回らないように速さは控えめ）
      const dA = THREE.MathUtils.clamp(sim.omega, -4, 4) * sim.dt
      if (dA !== 0) {
        tmp.copy(camera.position).sub(center).applyAxisAngle(AXIS, dA)
        camera.position.copy(center).add(tmp)
        tmp.copy(controls.target).sub(center).applyAxisAngle(AXIS, dA)
        controls.target.copy(center).add(tmp)
        camera.up.applyAxisAngle(AXIS, dA).normalize()
        controls.update()
      }
    } else if (camera.up.distanceToSquared(UP) > 1e-6) {
      camera.up.lerp(UP, 0.08).normalize()
      controls.update()
    }
  })

  return (
    <>
      <pointLight ref={lamp} intensity={0.7} distance={0.6} decay={2} color="#fff1d6" />
      <pointLight position={[TUB_C.x, TUB_C.y + 0.12, 0.05]} intensity={0.3} distance={0.4} color="#bfe6ff" />
      <group ref={group} position={TUB_C}>
        {SPOTS.filter((s) => !s.rotates).map((s) => (
          <SpotMarker key={s.id} spot={s} />
        ))}
        <group ref={spin}>
          {SPOTS.filter((s) => s.rotates).map((s) => (
            <SpotMarker key={s.id} spot={s} />
          ))}
        </group>
      </group>
    </>
  )
}

function SpotMarker({ spot }: { spot: SpotDef }) {
  const found = useStore((s) => s.found.includes(spot.id))
  const active = useStore((s) => s.spot === spot.id)
  const discover = useStore((s) => s.discover)
  return (
    <Html position={spot.pos} center zIndexRange={[25, 0]}>
      <button
        className={`spot ${found ? 'found' : ''} ${active ? 'active' : ''}`}
        onClick={() => discover(spot.id)}
        aria-label={found ? spot.name : 'なにかが ありそう'}
      >
        {found ? (
          <>
            <b>{spot.icon}</b>
            <span>{spot.name.split('（')[0]}</span>
          </>
        ) : (
          <b>❓</b>
        )}
      </button>
    </Html>
  )
}
