import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { BLADE_R, BLADE_Z, HEAD_OFFSET, PIVOT } from '../data'
import { fan } from '../sim'
import { useFan } from '../store'

// 風を見える形に：うしろから吸いこまれ、羽根で押されて前へ広がっていく粒
// 粒は生まれたときの首の向きでまっすぐ進むので、首振りすると風が部屋を「なでて」いく
export function Wind() {
  const quality = useFan((s) => s.quality)
  const N = quality === 'high' ? 280 : 150
  const mesh = useRef<THREE.InstancedMesh>(null)
  const geo = useMemo(() => new THREE.CapsuleGeometry(0.003, 0.034, 2, 6).rotateX(Math.PI / 2), [])
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#46b0f5', transparent: true, opacity: 0.7, depthWrite: false }), [])
  useEffect(
    () => () => {
      geo.dispose()
      mat.dispose()
    },
    [geo, mat],
  )
  const ps = useMemo(
    () => Array.from({ length: N }, () => ({ alive: false, age: 0, yaw: 0, r: 0, th: 0, swirl: 0, speed: 0, spread: 0 })),
    [N],
  )
  const acc = useRef(0)
  const m4 = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const local = useMemo(() => new THREE.Vector3(), [])
  const s = useMemo(() => new THREE.Vector3(), [])
  const Y = useMemo(() => new THREE.Vector3(0, 1, 0), [])

  useFrame(() => {
    const m = mesh.current
    if (!m) return
    const dt = fan.dt
    const w = fan.wind
    acc.current += w * N * 0.55 * dt
    let any = false
    for (let i = 0; i < N; i++) {
      const p = ps[i]
      if (!p.alive && acc.current >= 1) {
        acc.current -= 1
        p.alive = true
        p.age = 0
        p.yaw = fan.yaw
        p.r = Math.sqrt(Math.random()) * BLADE_R * 0.95
        p.th = Math.random() * Math.PI * 2
        p.swirl = 0.8 + Math.random() * 0.8
        p.speed = 0.5 + 1.6 * w * (0.8 + Math.random() * 0.4)
        p.spread = 0.28 + Math.random() * 0.25
      }
      if (!p.alive) {
        m4.makeScale(0, 0, 0)
        m.setMatrixAt(i, m4)
        continue
      }
      any = true
      p.age += dt
      // うしろ（-0.22）から羽根まではゆっくり吸いこまれ、羽根を過ぎると勢いよく前へ
      const zIn = -0.22 + p.age * p.speed * 0.35
      let z = zIn
      let r = p.r * (1 + Math.max(0, -zIn) * 0.6)
      if (zIn > BLADE_Z) {
        const after = (zIn - BLADE_Z) / 0.35
        z = BLADE_Z + after * 1.0 * (1 + after * 0.15)
        r = p.r * (1 + z * p.spread * 2.2)
      }
      const th = p.th + p.swirl * Math.min(p.age, 1.2) * (z > BLADE_Z ? 1 : 0.2)
      if (z > 1.9) {
        p.alive = false
        m4.makeScale(0, 0, 0)
        m.setMatrixAt(i, m4)
        continue
      }
      local.set(Math.cos(th) * r, Math.sin(th) * r, z).add(HEAD_OFFSET).applyAxisAngle(Y, p.yaw).add(PIVOT)
      const fade = Math.min(1, p.age * 4) * (1 - Math.max(0, (z - 1.2) / 0.7))
      const stretch = z > BLADE_Z ? 1 + w * 1.8 : 0.6
      q.setFromAxisAngle(Y, p.yaw)
      s.set(fade, fade, fade * stretch)
      m4.compose(local, q, s)
      m.setMatrixAt(i, m4)
    }
    m.visible = any
    m.instanceMatrix.needsUpdate = true
    mat.opacity = 0.35 + 0.4 * w
  })

  return <instancedMesh key={N} ref={mesh} args={[geo, mat, N]} frustumCulled={false} />
}
