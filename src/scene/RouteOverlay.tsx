import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

// 「ぜんたいを みてみよう」の とき だけ でる、たんけんの みち（3D）と「いま ここ！」の しるし。
// とおった みち＝あお、いまの みち＝きいろ、これからの みち＝うすい いろ。
export interface OverviewState {
  w: number // 0〜1：みえかた（カメラが ひいている どあい）
  ch: number
  here: THREE.Vector3
}

interface Props {
  curves: (THREE.Curve<THREE.Vector3> | null)[]
  state: OverviewState
  dist: number // ぜんたいを みる カメラの きょり（せんの ふとさや しるしの おおきさに つかう）
  fov: number
  futureColor: string
  hereText: string
}

export function RouteOverlay({ curves, state, dist, fov, futureColor, hereText }: Props) {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const ndc = useMemo(() => new THREE.Vector3(), [])
  const up = useMemo(() => new THREE.Vector3(), [])
  const group = useRef<THREE.Group>(null)
  const meshes = useRef<(THREE.Mesh | null)[]>([])
  const ping = useRef<THREE.Mesh>(null)
  const tag = useRef<THREE.Group>(null)
  const tagEl = useRef<HTMLDivElement>(null)
  const lastCh = useRef(-1)
  // がめんの うえで おなじ くらいの ふとさに なるよう、きょりと がかくから きめる
  const radius = Math.max(0.004, dist * Math.tan(THREE.MathUtils.degToRad(fov / 2)) * 0.0085)

  // いろの せん と、どんな はいけいでも みえるように こい いろの ふちどり
  const geos = useMemo(
    () =>
      curves.map((c) => {
        if (!c) return null
        const closed = (c as THREE.CatmullRomCurve3).closed ?? false
        const segs = Math.max(24, Math.round(c.getLength() * 160))
        return { core: new THREE.TubeGeometry(c, segs, radius, 6, closed), edge: new THREE.TubeGeometry(c, segs, radius * 1.8, 6, closed) }
      }),
    [curves, radius],
  )
  const mats = useMemo(() => {
    const m = (color: string) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthTest: false, depthWrite: false })
    return { past: m('#2fb2ff'), now: m('#ffd23f'), future: m(futureColor), edge: m('#1b2546') }
  }, [futureColor])
  const ringGeo = useMemo(() => new THREE.RingGeometry(0.72, 1, 40), [])
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0, depthTest: false, depthWrite: false, side: THREE.DoubleSide }), [])
  useEffect(() => {
    lastCh.current = -1
    return () =>
      geos.forEach((g) => {
        g?.core.dispose()
        g?.edge.dispose()
      })
  }, [geos])
  useEffect(
    () => () => {
      mats.past.dispose()
      mats.now.dispose()
      mats.future.dispose()
      mats.edge.dispose()
      ringGeo.dispose()
      ringMat.dispose()
    },
    [mats, ringGeo, ringMat],
  )

  useFrame((s3) => {
    const g = group.current
    if (!g) return
    const w = state.w
    g.visible = w > 0.01
    if (tagEl.current) {
      tagEl.current.style.opacity = String(Math.max(0, w * 1.4 - 0.4))
      tagEl.current.style.display = w > 0.02 ? '' : 'none'
    }
    if (!g.visible) return
    if (lastCh.current !== state.ch) {
      lastCh.current = state.ch
      meshes.current.forEach((m, i) => {
        if (m) m.material = i < state.ch ? mats.past : i === state.ch ? mats.now : mats.future
      })
    }
    const t = s3.clock.elapsedTime
    mats.past.opacity = 0.95 * w
    mats.now.opacity = (0.8 + 0.2 * Math.sin(t * 6)) * w
    mats.future.opacity = 0.95 * w
    mats.edge.opacity = 0.55 * w
    if (ping.current) {
      const k = (t * 0.9) % 1
      ping.current.position.copy(state.here)
      ping.current.quaternion.copy(camera.quaternion)
      ping.current.scale.setScalar(dist * (0.012 + 0.03 * k))
      ringMat.opacity = (1 - k) * 0.9 * w
    }
    // なふだは がめんの うえ むきに すこし ずらす（みおろす カメラでも つぶに かさならない）。
    // がめんの うえの みだしに かくれそうな ときは、つぶの したに だす
    if (tag.current) {
      up.set(0, 1, 0).applyQuaternion(camera.quaternion)
      tag.current.position.copy(state.here).addScaledVector(up, dist * 0.045)
      ndc.copy(tag.current.position).project(camera)
      if ((1 - ndc.y) / 2 < 0.22) tag.current.position.copy(state.here).addScaledVector(up, -dist * 0.045)
    }
    // がめんの はしで なふだが きれないように、よこに ずらす
    if (tagEl.current && tag.current) {
      ndc.copy(tag.current.position).project(camera)
      const x = ((ndc.x + 1) / 2) * size.width
      const half = tagEl.current.offsetWidth / 2 + 8
      const shift = Math.min(0, size.width - half - x) + Math.max(0, half - x)
      tagEl.current.style.transform = `translateX(${shift.toFixed(0)}px)`
    }
  })

  return (
    <>
      <group ref={group} visible={false}>
        {geos.map((geo, i) =>
          geo ? (
            <group key={i}>
              <mesh geometry={geo.edge} material={mats.edge} renderOrder={25} frustumCulled={false} />
              <mesh
                ref={(m) => {
                  meshes.current[i] = m
                }}
                geometry={geo.core}
                material={mats.future}
                renderOrder={26}
                frustumCulled={false}
              />
            </group>
          ) : null,
        )}
        <mesh ref={ping} geometry={ringGeo} material={ringMat} renderOrder={28} frustumCulled={false} />
      </group>
      <group ref={tag}>
        <Html center zIndexRange={[22, 0]} style={{ pointerEvents: 'none' }}>
          <div ref={tagEl} className="ov-here" style={{ opacity: 0, display: 'none' }}>
            {hereText}
          </div>
        </Html>
      </group>
    </>
  )
}
