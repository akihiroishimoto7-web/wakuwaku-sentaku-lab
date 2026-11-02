import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { BLADE_R, GUARD_R } from './data'

// ねじれた羽根（実験用に枚数と角度を変えられる）
export function makeBlades(count: number, pitchDeg: number, R = BLADE_R, r0 = 0.034) {
  const NR = 12
  const NS = 8
  const pos: number[] = []
  const idx: number[] = []
  const maxHalf = (Math.PI / count) * 0.92
  for (let b = 0; b < count; b++) {
    const base = (b / count) * Math.PI * 2
    const start = pos.length / 3
    for (let i = 0; i <= NR; i++) {
      const tr = i / NR
      const r = r0 + (R - r0) * tr
      const half = Math.min(maxHalf, (0.16 + 0.46 * Math.pow(Math.sin(Math.PI * Math.min(1, tr * 1.05 + 0.05)), 0.7)) * Math.pow(5 / count, 0.5))
      const sweep = 0.32 * tr
      const pitch = THREE.MathUtils.degToRad(pitchDeg * (1.2 - 0.45 * tr))
      for (let j = 0; j <= NS; j++) {
        const s = -1 + (2 * j) / NS
        const th = base + sweep + s * half
        // 回る向きの前側（s=+1）をうしろへ下げて、空気を前へ押し出す
        const z = -s * half * r * Math.tan(pitch) * 0.55
        pos.push(Math.cos(th) * r, Math.sin(th) * r, z)
      }
    }
    for (let i = 0; i < NR; i++)
      for (let j = 0; j < NS; j++) {
        const a = start + i * (NS + 1) + j
        const c = a + NS + 1
        idx.push(a, c, a + 1, a + 1, c, c + 1)
      }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

// 針金のガード（前はドーム、後ろはモーターを包む）
export function makeGuard(R = GUARD_R, quality: 'high' | 'low' = 'high') {
  const geos: THREE.BufferGeometry[] = []
  const wire = 0.0013
  const radial = quality === 'high' ? 4 : 3
  const zRim = 0.012
  const zFront = 0.1
  const frontZ = (r: number) => zRim + (zFront - zRim) * (1 - Math.pow(r / R, 2))
  const backZ = (r: number) => -0.072 * Math.min(1, (R - r) / (R - 0.078))
  const nFront = quality === 'high' ? 40 : 28
  for (let i = 0; i < nFront; i++) {
    const a0 = (i / nFront) * Math.PI * 2
    const pts: THREE.Vector3[] = []
    for (let k = 0; k <= 10; k++) {
      const r = R - (R - 0.042) * (k / 10)
      const a = a0 + 0.55 * (1 - r / R)
      pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, frontZ(r)))
    }
    geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 14, wire, radial))
  }
  const nBack = quality === 'high' ? 32 : 22
  for (let i = 0; i < nBack; i++) {
    const a = (i / nBack) * Math.PI * 2
    const pts = [R, (R + 0.078) / 2, 0.078].map((r) => new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, backZ(r)))
    geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 6, wire, radial))
  }
  for (const r of [0.062, 0.108, 0.15]) {
    const t = new THREE.TorusGeometry(r, wire * 1.1, radial, 64)
    t.translate(0, 0, frontZ(r))
    geos.push(t)
  }
  for (const r of [0.12]) {
    const t = new THREE.TorusGeometry(r, wire * 1.1, radial, 64)
    t.translate(0, 0, backZ(r))
    geos.push(t)
  }
  const rim = new THREE.TorusGeometry(R, 0.005, 8, 96)
  rim.translate(0, 0, 0.008)
  geos.push(rim)
  const merged = mergeGeometries(geos.map((g) => g.toNonIndexed()), false)!
  geos.forEach((g) => g.dispose())
  return merged
}

// まわりを包むモーターのカバー（前が開いたカプセル形）
export function makeHousing() {
  const pts = [
    [0.074, -0.024],
    [0.079, -0.05],
    [0.08, -0.14],
    [0.074, -0.185],
    [0.056, -0.212],
    [0.03, -0.226],
    [0.0, -0.23],
  ].map(([r, z]) => new THREE.Vector2(r, z))
  const g = new THREE.LatheGeometry(pts, 48)
  g.rotateX(Math.PI / 2)
  return g
}

// 台（ふちが丸い円盤）
export function makeBase() {
  const pts = [
    [0, 0],
    [0.17, 0],
    [0.178, 0.008],
    [0.175, 0.03],
    [0.15, 0.052],
    [0.05, 0.062],
    [0, 0.062],
  ].map(([r, y]) => new THREE.Vector2(r, y))
  return new THREE.LatheGeometry(pts, 64)
}

// ねじの形の歯車（ウォーム）
export function makeWorm() {
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= 80; i++) {
    const t = i / 80
    const a = t * Math.PI * 2 * 4
    pts.push(new THREE.Vector3(Math.cos(a) * 0.0085, Math.sin(a) * 0.0085, -0.012 + t * 0.024))
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.0022, 6)
}

// 歯車（歯つきの円盤。軸は x 方向）
export function makeGear(r: number, teeth: number, thick: number) {
  const s = new THREE.Shape()
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2
    const rr = i % 2 ? r : r * 1.12
    const a2 = a + Math.PI / (teeth * 2)
    if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr)
    else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
    s.lineTo(Math.cos(a2) * rr, Math.sin(a2) * rr)
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false })
  g.translate(0, 0, -thick / 2)
  g.rotateY(Math.PI / 2)
  return g
}
