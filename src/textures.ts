import * as THREE from 'three'

// キャンバスで生成する共有テクスチャ（アプリ全体で1つずつ使い回す）
const cache = new Map<string, THREE.Texture>()

function canvasTexture(
  key: string,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
  setup?: (t: THREE.CanvasTexture) => void,
) {
  const hit = cache.get(key)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  draw(ctx)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 4
  setup?.(t)
  cache.set(key, t)
  return t
}

export const weaveTexture = () =>
  canvasTexture(
    'weave',
    128,
    128,
    (ctx) => {
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, 128, 128)
      const n = 16
      const s = 128 / n
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) {
          const over = (x + y) % 2 === 0
          const g = ctx.createLinearGradient(x * s, y * s, over ? x * s + s : x * s, over ? y * s : y * s + s)
          g.addColorStop(0, '#d9d9d9')
          g.addColorStop(0.5, '#ffffff')
          g.addColorStop(1, '#d4d4d4')
          ctx.fillStyle = g
          ctx.fillRect(x * s + 0.5, y * s + 0.5, s - 1, s - 1)
        }
    },
    (t) => {
      t.repeat.set(5, 5)
      t.colorSpace = THREE.SRGBColorSpace
    },
  )

// ドラムの穴（白=不透明 / 黒=穴）
export const perforationTexture = () =>
  canvasTexture(
    'perf',
    256,
    256,
    (ctx) => {
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, 256, 256)
      ctx.fillStyle = '#000'
      const n = 16
      const s = 256 / n
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) {
          ctx.beginPath()
          ctx.arc(x * s + s / 2 + (y % 2) * (s / 2), y * s + s / 2, s * 0.2, 0, Math.PI * 2)
          ctx.fill()
        }
    },
    (t) => t.repeat.set(10, 3),
  )

export const woodTexture = () =>
  canvasTexture(
    'wood',
    512,
    512,
    (ctx) => {
      const planks = 6
      const h = 512 / planks
      for (let i = 0; i < planks; i++) {
        const base = 200 + Math.random() * 20
        ctx.fillStyle = `hsl(32, 45%, ${70 + Math.random() * 6}%)`
        ctx.fillRect(0, i * h, 512, h)
        for (let k = 0; k < 40; k++) {
          ctx.strokeStyle = `rgba(${base - 70},${base - 110},${base - 150},0.08)`
          ctx.lineWidth = 1 + Math.random() * 2
          ctx.beginPath()
          const y = i * h + Math.random() * h
          ctx.moveTo(0, y)
          ctx.bezierCurveTo(170, y + Math.random() * 8 - 4, 340, y + Math.random() * 8 - 4, 512, y)
          ctx.stroke()
        }
        ctx.fillStyle = 'rgba(90,60,30,0.35)'
        ctx.fillRect(0, i * h, 512, 2)
        const off = (i % 2) * 256 + 128
        ctx.fillRect(off, i * h, 2, h)
      }
    },
    (t) => {
      t.repeat.set(3, 3)
      t.colorSpace = THREE.SRGBColorSpace
    },
  )

export const tileTexture = () =>
  canvasTexture(
    'tile',
    256,
    256,
    (ctx) => {
      ctx.fillStyle = '#e8f6f3'
      ctx.fillRect(0, 0, 256, 256)
      const n = 4
      const s = 256 / n
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) {
          ctx.fillStyle = (x + y) % 3 === 0 ? '#d8f0ec' : '#f4fbfa'
          ctx.fillRect(x * s + 3, y * s + 3, s - 6, s - 6)
        }
    },
    (t) => {
      t.repeat.set(10, 3)
      t.colorSpace = THREE.SRGBColorSpace
    },
  )

// 配管の流れ（矢じり模様）
export const flowTexture = () =>
  canvasTexture('flow', 128, 32, (ctx) => {
    ctx.clearRect(0, 0, 128, 32)
    const g = ctx.createLinearGradient(0, 0, 128, 0)
    g.addColorStop(0, 'rgba(255,255,255,0.15)')
    g.addColorStop(0.55, 'rgba(255,255,255,1)')
    g.addColorStop(0.7, 'rgba(255,255,255,0.15)')
    g.addColorStop(1, 'rgba(255,255,255,0.15)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 128, 32)
  })

export const softDotTexture = () =>
  canvasTexture('dot', 64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.4, 'rgba(255,255,255,0.6)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 64, 64)
  })
