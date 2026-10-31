import * as THREE from 'three'
import type { PartId } from './data'

// 部品ごとのマテリアル登録（タップした部品を光らせるため）
export const partMats = new Map<PartId, Set<THREE.MeshStandardMaterial>>()

export function registerPart(part: PartId, ...mats: THREE.MeshStandardMaterial[]) {
  let set = partMats.get(part)
  if (!set) {
    set = new Set()
    partMats.set(part, set)
  }
  mats.forEach((m) => set!.add(m))
  return () => mats.forEach((m) => set!.delete(m))
}
