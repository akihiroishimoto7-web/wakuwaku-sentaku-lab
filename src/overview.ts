import * as THREE from 'three'

// たんけんの「ぜんたいを みてみよう」：カメラを ひいて、とおってきた みち と いまの ばしょを みせる。
// 洗濯機ラボと扇風機ラボで きょうつうに つかう。

export const OV_TIME = 3.8

export interface OverviewView {
  pos: THREE.Vector3
  look: THREE.Vector3
  dist: number
}

// みちの てんが ぜんぶ、カードに かくれない がめんの うえがわに おさまる きょりを もとめる
export function fitOverview(points: THREE.Vector3[], dir: THREE.Vector3, fovDeg: number, aspect: number): OverviewView {
  const box = new THREE.Box3().setFromPoints(points)
  const center = box.getCenter(new THREE.Vector3())
  const back = dir.clone().normalize()
  const f = back.clone().negate()
  const r = new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0)).normalize()
  const u = new THREE.Vector3().crossVectors(r, f).normalize()
  const tan = Math.tan(THREE.MathUtils.degToRad(fovDeg / 2))
  // したの カード（たかさの 3わりほど）と うえの みだしを よけた ぶんだけ、たてを せまく みつもる
  const tanV = tan * 0.46
  const tanH = tan * aspect * 0.9
  const rel = new THREE.Vector3()
  let d = 0.3
  for (const p of points) {
    rel.subVectors(p, center)
    const x = Math.abs(rel.dot(r))
    const y = Math.abs(rel.dot(u))
    const z = rel.dot(f)
    d = Math.max(d, x / tanH - z, y / tanV - z)
  }
  d = d * 1.05 + 0.05
  // うえの みだしと したの カードの あいだに くるよう、みる てんを すこし あげる
  const look = center.clone().addScaledVector(u, 0.06 * d * tan)
  return { pos: look.clone().addScaledVector(back, d), look, dist: d }
}

// みちの きょくせんから、ふちどり用の てんを とる
export function samplePoints(curves: (THREE.Curve<THREE.Vector3> | null)[], n = 16) {
  const out: THREE.Vector3[] = []
  curves.forEach((c) => {
    if (!c) return
    for (let i = 0; i <= n; i++) out.push(c.getPointAt(i / n))
  })
  return out
}
