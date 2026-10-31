import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { sound } from '../sound'
import { useStore } from '../store'

// 洗濯終了：虹色のシャボン玉＋きらきら
export function Celebration() {
  const N = 28
  const mesh = useRef<THREE.InstancedMesh>(null)
  const sparks = useRef<THREE.InstancedMesh>(null)
  const geo = useMemo(() => new THREE.SphereGeometry(1, 24, 16), [])
  const mat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#ffffff',
        roughness: 0,
        metalness: 0,
        transparent: true,
        opacity: 0.3,
        emissive: '#cfeaff',
        emissiveIntensity: 0.18,
        iridescence: 1,
        iridescenceIOR: 1.3,
        iridescenceThicknessRange: [120, 700],
        clearcoat: 1,
        envMapIntensity: 2.2,
        depthWrite: false,
      }),
    [],
  )
  const sgeo = useMemo(() => new THREE.OctahedronGeometry(0.008, 0), [])
  const smat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#fff3a6', toneMapped: false }), [])
  useEffect(
    () => () => {
      geo.dispose()
      mat.dispose()
      sgeo.dispose()
      smat.dispose()
    },
    [geo, mat, sgeo, smat],
  )
  const seeds = useMemo(
    () =>
      Array.from({ length: N }, () => ({
        x: (Math.random() - 0.5) * 0.7,
        z: 0.3 + Math.random() * 0.5,
        delay: Math.random() * 3,
        speed: 0.12 + Math.random() * 0.1,
        r: 0.025 + Math.random() * 0.04,
        ph: Math.random() * 6,
        popped: false,
      })),
    [],
  )
  const m4 = useMemo(() => new THREE.Matrix4(), [])
  const lastAt = useRef(0)

  useFrame(() => {
    const st = useStore.getState()
    const m = mesh.current
    const sp = sparks.current
    if (!m || !sp) return
    const at = st.celebrateAt
    if (at !== lastAt.current) {
      lastAt.current = at
      seeds.forEach((s) => (s.popped = false))
    }
    const t = at ? (performance.now() - at) / 1000 : 99
    const active = at > 0 && t < 14 && st.mode === 'wash'
    m.visible = active
    if (active) {
      seeds.forEach((s, i) => {
        const l = t - s.delay
        let sc = 0
        if (l > 0) {
          const life = l * s.speed
          const y = 0.25 + life * 1.6
          sc = s.r * Math.min(1, l * 2)
          if (y > 1.6 || l > 9) {
            sc = 0
            if (!s.popped) {
              s.popped = true
              sound.pop()
            }
          }
          m4.makeScale(sc, sc, sc).setPosition(s.x + Math.sin(l * 1.3 + s.ph) * 0.06, y, s.z + Math.cos(l + s.ph) * 0.03)
        } else m4.makeScale(0, 0, 0)
        m.setMatrixAt(i, m4)
      })
      m.instanceMatrix.needsUpdate = true
    }

    // 取り出した服のまわりのきらきら
    const shown = st.step === 'finished' && st.mode === 'wash'
    sp.visible = shown
    if (shown) {
      const time = performance.now() / 1000
      for (let i = 0; i < 40; i++) {
        const a = i * 2.39996 + time * 0.4
        const r = 0.12 + (i % 7) * 0.04
        const tw = Math.max(0, Math.sin(time * 4 + i * 1.7))
        m4.makeRotationZ(time + i).scale(new THREE.Vector3(tw, tw * 1.6, tw))
        m4.setPosition(Math.cos(a) * r * 1.6, 0.55 + Math.sin(a * 1.3) * 0.17, 0.5 + Math.sin(a) * 0.05)
        sp.setMatrixAt(i, m4)
      }
      sp.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <>
      <instancedMesh ref={mesh} args={[geo, mat, N]} frustumCulled={false} renderOrder={10} />
      <instancedMesh ref={sparks} args={[sgeo, smat, 40]} frustumCulled={false} />
    </>
  )
}
