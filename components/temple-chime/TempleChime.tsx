'use client'

import { useEffect, useId, useRef } from 'react'
import { playTempleChimeBrush, unlockTempleChimeAudio } from './templeChimeAudio'
import templeMastSrc from './assets/temple-mast.png'

type Node = {
  x: number
  y: number
  px: number
  py: number
  homeX: number
  homeY: number
  char: string
  color: string
  alpha: number
  visible: boolean
  cell: { sx: number; sy: number } | null
}

export type TempleChimeProps = {
  className?: string
  imageSrc?: string
  imageAlt?: string
  charPool?: string
  colors?: string[]
  inkAlpha?: number
  scale?: number
  lengthScale?: number
  raggedness?: number
  mouseRadius?: number
  luminous?: boolean
  roofSpan?: number
  coverage?: number
  colorMode?: 'multi' | 'white'
  muted?: boolean
}

const DEFAULT_CHAR_POOL =
  'ॐ नमः शिवाय गणपतये ह्रीं हं सः वः यं रं लं वं हं ओं आं इं उं ऎं ऐं ओं औं कं खं गं घं चं छं जं झं टं ठं डं ढं तं थं दं धं नं पं फं बं भं मं यं रं लं वं शं षं सं हं क्षं त्रं ज्ञं ཨཱཿཧཱུྃༀབཛྲགུ་རུཔདྨསཱམཱཡཱ'

const DEFAULT_COLORS = ['#e8c46a', '#2f9e8f', '#c0453f', '#3a5fc0', '#e8c46a']

const COL_SPACING = 9
const ROW_SPACING = 10
const FONT_SIZE = 7.5
const DAMPING = 0.96
const HOME_STIFFNESS = 0.012
const CONSTRAINT_ITERATIONS = 2
const ALPHA_THRESHOLD = 24

export default function TempleChime({
  className,
  imageSrc = templeMastSrc,
  imageAlt = 'Gilded Nepali temple roof ridge with a Dharma wheel and deer, flanked by dragon-head finials',
  charPool = DEFAULT_CHAR_POOL,
  colors: rawColors = DEFAULT_COLORS,
  inkAlpha = 0.95,
  scale = 0.75,
  lengthScale = 0.85,
  raggedness = 0.3,
  mouseRadius = 110,
  luminous = true,
  roofSpan = 0.85,
  coverage = 0.64,
  colorMode = 'multi',
  muted = false,
}: TempleChimeProps) {
  const mastWidth = 0.4
  const colors = colorMode === 'white' ? ['#ffffff'] : rawColors
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const reactId = useId()
  const mastId = `temple-chime-mast-${reactId.replace(/[^a-zA-Z0-9]/g, '')}`

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const colSpacing = COL_SPACING * scale
    const rowSpacing = ROW_SPACING * scale
    const fontSize = FONT_SIZE * scale

    let columns: Node[][] = []
    let width = 0
    let height = 0
    let dpr = 1
    let raf = 0
    let running = true
    let time = 0

    const mouse = { x: -9999, y: -9999, vx: 0, vy: 0, active: false }

    let contourPixels: Uint8ClampedArray | null = null
    let contourW = 0
    let contourH = 0

    let atlas: HTMLCanvasElement | null = null
    let atlasMap = new Map<string, { sx: number; sy: number }>()
    const ATLAS_PAD = 3
    let atlasCellCss = 0
    let atlasCellDevice = 0

    function buildAtlas() {
      const inks = Array.from(new Set(colors.length > 0 ? colors : ['#e8c46a']))
      const chars = Array.from(new Set(charPool.split('')))
      const scaleFactor = dpr
      atlasCellCss = fontSize + ATLAS_PAD * 2
      atlasCellDevice = atlasCellCss * scaleFactor

      const total = chars.length * inks.length
      const cols = Math.ceil(Math.sqrt(total))
      const rows = Math.ceil(total / cols)

      atlas = document.createElement('canvas')
      atlas.width = Math.ceil(cols * atlasCellDevice)
      atlas.height = Math.ceil(rows * atlasCellDevice)
      const actx = atlas.getContext('2d')
      if (!actx) {
        atlas = null
        return
      }
      actx.scale(scaleFactor, scaleFactor)
      actx.font = `${luminous ? 500 : 400} ${fontSize}px 'Noto Sans Devanagari', 'Noto Serif Devanagari', 'Tibetan Machine Uni', 'Kokonor', 'Songti SC', 'Noto Serif SC', sans-serif`
      actx.textAlign = 'center'
      actx.textBaseline = 'middle'

      atlasMap = new Map()
      let i = 0
      for (const ink of inks) {
        actx.fillStyle = ink
        for (const ch of chars) {
          const cx = (i % cols) * atlasCellCss
          const cy = Math.floor(i / cols) * atlasCellCss

          if (luminous) {
            actx.shadowColor = ink
            actx.shadowBlur = fontSize * 1.6
          } else {
            actx.shadowColor = 'transparent'
            actx.shadowBlur = 0
          }

          actx.fillText(ch, cx + atlasCellCss / 2, cy + atlasCellCss / 2)
          actx.shadowColor = 'transparent'
          actx.shadowBlur = 0
          atlasMap.set(`${ch}|${ink}`, { sx: cx * scaleFactor, sy: cy * scaleFactor })
          i++
        }
      }
    }

    let reveal = 0
    let revealAt = Infinity

    function rand(seed: number) {
      const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
      return x - Math.floor(x)
    }

    function sampleContourImage(img: HTMLImageElement) {
      const w = img.naturalWidth
      const h = img.naturalHeight
      if (!w || !h) return
      const off = document.createElement('canvas')
      off.width = w
      off.height = h
      const octx = off.getContext('2d', { willReadFrequently: true })
      if (!octx) return
      octx.drawImage(img, 0, 0)
      try {
        contourPixels = octx.getImageData(0, 0, w, h).data
        contourW = w
        contourH = h
      } catch {
        contourPixels = null
      }
    }

    function findInnerRoofBounds(): { left: number; right: number } | null {
      const img = imgRef.current
      if (!img || !contourPixels || !contourW || !contourH) return null
      const imgRect = img.getBoundingClientRect()
      let firstX = -1
      let lastX = -1
      for (let ix = 0; ix < contourW; ix++) {
        for (let iy = contourH - 1; iy >= 0; iy--) {
          if (contourPixels[(iy * contourW + ix) * 4 + 3] > ALPHA_THRESHOLD) {
            if (firstX === -1) firstX = ix
            lastX = ix
            break
          }
        }
      }
      if (firstX === -1 || lastX === -1) return null
      const leftPage = imgRect.left + (firstX / contourW) * imgRect.width
      const rightPage = imgRect.left + (lastX / contourW) * imgRect.width
      return { left: leftPage, right: rightPage }
    }

    let innerBounds: { left: number; right: number } | null = null

    function effectiveRoofBounds(): { left: number; right: number } | null {
      const img = imgRef.current
      if (!img || !innerBounds) return innerBounds
      const imgRect = img.getBoundingClientRect()
      const span = Math.max(0, Math.min(1, roofSpan))
      const left = innerBounds.left + (imgRect.left - innerBounds.left) * (1 - span)
      const right = innerBounds.right + (imgRect.right - innerBounds.right) * (1 - span)
      return { left, right }
    }

    function contourYAt(canvasX: number): number | null {
      const img = imgRef.current
      if (!contourPixels || !img) return 0
      const imgRect = img.getBoundingClientRect()
      const canvasRect = canvas!.getBoundingClientRect()
      const pageX = canvasRect.left + canvasX
      if (pageX < imgRect.left || pageX > imgRect.right) return null

      const bounds = effectiveRoofBounds()
      if (bounds) {
        const margin = (bounds.right - bounds.left) * 0.04
        if (pageX < bounds.left + margin || pageX > bounds.right - margin) return null
      }

      const ix = Math.min(
        contourW - 1,
        Math.max(0, Math.round(((pageX - imgRect.left) / imgRect.width) * contourW)),
      )
      const halfWin = Math.min(
        6,
        Math.max(1, Math.round(((colSpacing / 2) * contourW) / imgRect.width)),
      )
      const x0 = Math.max(0, ix - halfWin)
      const x1 = Math.min(contourW - 1, ix + halfWin)
      for (let iy = contourH - 1; iy >= 0; iy--) {
        const rowBase = iy * contourW
        for (let sx = x0; sx <= x1; sx++) {
          if (contourPixels[(rowBase + sx) * 4 + 3] > ALPHA_THRESHOLD) {
            const pageY = imgRect.top + (iy / contourH) * imgRect.height
            return pageY - canvasRect.top
          }
        }
      }
      return null
    }

    function build() {
      const rect = canvas!.getBoundingClientRect()
      width = rect.width
      height = rect.height
      dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      canvas!.width = Math.round(width * dpr)
      canvas!.height = Math.round(height * dpr)

      buildAtlas()
      innerBounds = findInnerRoofBounds()

      const curtainWidth = width * mastWidth * coverage
      const colCount = Math.max(1, Math.floor(curtainWidth / colSpacing))
      const xOffset = (width - (colCount - 1) * colSpacing) / 2

      columns = []
      for (let c = 0; c < colCount; c++) {
        const colX = xOffset + c * colSpacing
        const topY = contourYAt(colX)
        if (topY === null) continue

        const startY = topY + 4
        const available = height - startY
        if (available < rowSpacing * 3) continue

        const wave = 0.5 + 0.5 * Math.sin(c * 0.55 + rand(c * 2.1) * 1.8)
        const lengthJitter = 1 - raggedness + (rand(c * 7.3) * 0.55 + wave * 0.45) * raggedness
        const colRows = Math.max(
          3,
          Math.floor((available / rowSpacing) * lengthScale * lengthJitter),
        )

        const charOffset = Math.floor(rand(c * 3.7) * charPool.length)

        const chain: Node[] = []
        for (let r = 0; r < colRows; r++) {
          const seed = c * 131 + r * 17
          const homeX = colX + (rand(seed + 3) - 0.5) * 1.6
          const homeY = startY + r * rowSpacing

          const ink =
            colors && colors.length > 0
              ? colors[Math.floor(rand(c * 13.7 + Math.floor(r / 5) * 5.1) * colors.length)]
              : DEFAULT_COLORS[0]

          const ch = charPool[(charOffset + r) % charPool.length] ?? 'ॐ'
          chain.push({
            x: homeX,
            y: startY + r * rowSpacing * 0.45,
            px: homeX,
            py: startY + r * rowSpacing * 0.45,
            homeX,
            homeY,
            char: ch,
            alpha: inkAlpha,
            visible: rand(seed + 2) > 0.04,
            color: ink,
            cell: atlasMap.get(`${ch}|${ink}`) ?? null,
          })
        }
        columns.push(chain)
      }
    }

    function step() {
      time += 1 / 60
      const r2 = mouseRadius * mouseRadius

      for (let c = 0; c < columns.length; c++) {
        const chain = columns[c]
        const breeze = Math.sin(time * 0.7 + c * 0.35) * 0.012

        for (let r = 1; r < chain.length; r++) {
          const n = chain[r]
          const depth = r / chain.length

          let vx = (n.x - n.px) * DAMPING
          let vy = (n.y - n.py) * DAMPING
          n.px = n.x
          n.py = n.y

          vx += (n.homeX - n.x) * HOME_STIFFNESS
          vy += (n.homeY - n.y) * HOME_STIFFNESS

          vx += breeze * depth

          if (mouse.active) {
            const dx = n.x - mouse.x
            const dy = n.y - mouse.y
            const d2 = dx * dx + dy * dy
            if (d2 < r2 && d2 > 0.01) {
              const d = Math.sqrt(d2)
              const falloff = (1 - d / mouseRadius) ** 2
              const push = falloff * 1.4
              vx += (dx / d) * push + mouse.vx * falloff * 0.38
              vy += (dy / d) * push * 0.3 + mouse.vy * falloff * 0.2
            }
          }

          n.x += vx
          n.y += vy
        }

        for (let it = 0; it < CONSTRAINT_ITERATIONS; it++) {
          for (let r = 1; r < chain.length; r++) {
            const a = chain[r - 1]
            const b = chain[r]
            let dx = b.x - a.x
            let dy = b.y - a.y
            let d = Math.sqrt(dx * dx + dy * dy)
            if (d < 0.0001) {
              d = 0.0001
              dx = 0
              dy = 0.0001
            }
            const diff = (d - rowSpacing) / d
            if (r === 1) {
              b.x -= dx * diff
              b.y -= dy * diff
            } else {
              const ox = dx * diff * 0.5
              const oy = dy * diff * 0.5
              a.x += ox
              a.y += oy
              b.x -= ox
              b.y -= oy
            }
          }
        }
      }

      mouse.vx *= 0.85
      mouse.vy *= 0.85
    }

    function draw() {
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx!.clearRect(0, 0, width, height)
      if (reveal <= 0 || !atlas) return

      const half = atlasCellCss / 2

      for (let c = 0; c < columns.length; c++) {
        const chain = columns[c]
        for (let r = 0; r < chain.length; r++) {
          const n = chain[r]
          if (!n.visible || !n.cell) continue

          const tail = r / chain.length
          let edgeFade = tail > 0.75 ? 1 - (tail - 0.75) / 0.25 : 1
          edgeFade *= reveal

          const a = n.alpha * edgeFade
          if (a < 0.02) continue

          let angle = 0
          if (r > 0) {
            const p = chain[r - 1]
            const sdx = n.x - p.x
            const sdy = n.y - p.y
            angle = Math.atan2(sdx, Math.max(sdy, 0.001)) * -1
          }

          ctx!.globalAlpha = a
          if (angle > 0.06 || angle < -0.06) {
            const cos = Math.cos(angle)
            const sin = Math.sin(angle)
            ctx!.setTransform(dpr * cos, dpr * sin, -dpr * sin, dpr * cos, dpr * n.x, dpr * n.y)
            ctx!.drawImage(
              atlas,
              n.cell.sx,
              n.cell.sy,
              atlasCellDevice,
              atlasCellDevice,
              -half,
              -half,
              atlasCellCss,
              atlasCellCss,
            )
            ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
          } else {
            ctx!.drawImage(
              atlas,
              n.cell.sx,
              n.cell.sy,
              atlasCellDevice,
              atlasCellDevice,
              n.x - half,
              n.y - half,
              atlasCellCss,
              atlasCellCss,
            )
          }
        }
      }
      ctx!.globalAlpha = 1
    }

    function loop() {
      if (!running) return
      if (performance.now() >= revealAt) {
        if (reveal < 1) reveal = Math.min(1, reveal + 0.015)
        step()
      }
      draw()
      raf = requestAnimationFrame(loop)
    }

    function onPointerMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      if (mouse.active) {
        mouse.vx = mouse.vx * 0.5 + (x - mouse.x) * 0.5
        mouse.vy = mouse.vy * 0.5 + (y - mouse.y) * 0.5
      }
      mouse.x = x
      mouse.y = y
      mouse.active = true

      if (!muted && reveal > 0.5 && x >= 0 && x <= width && y >= 0 && y <= height) {
        const speed = Math.sqrt(mouse.vx * mouse.vx + mouse.vy * mouse.vy)
        if (speed > 2.5) {
          const topY = contourYAt(x)
          if (topY !== null && y > topY) {
            playTempleChimeBrush(Math.min(1, speed / 26))
          }
        }
      }
    }

    function onPointerDown() {
      if (!muted) unlockTempleChimeAudio()
    }

    function onPointerLeave() {
      mouse.active = false
      mouse.x = -9999
      mouse.y = -9999
    }

    function initContour() {
      const img = imgRef.current
      if (!img) {
        requestAnimationFrame(initContour)
        return
      }
      if (img.complete && img.naturalWidth > 0) {
        sampleContourImage(img)
        innerBounds = findInnerRoofBounds()
        build()
        revealAt = performance.now() + 380
      } else {
        img.addEventListener(
          'load',
          () => {
            sampleContourImage(img)
            innerBounds = findInnerRoofBounds()
            build()
            revealAt = performance.now() + 380
          },
          { once: true },
        )
      }
    }

    initContour()
    loop()

    const ro = new ResizeObserver(() => {
      if (!contourPixels) return
      build()
    })
    ro.observe(canvas)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerleave', onPointerLeave)
    window.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('mouseleave', onPointerLeave)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerleave', onPointerLeave)
      window.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('mouseleave', onPointerLeave)
    }
  }, [
    charPool,
    colors,
    inkAlpha,
    scale,
    lengthScale,
    raggedness,
    mouseRadius,
    luminous,
    imageSrc,
    roofSpan,
    coverage,
    colorMode,
    muted,
  ])

  return (
    <div className={`relative ${className ?? ''}`}>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="absolute inset-0"
        style={{ width: '100%', height: '100%' }}
      />
      <img
        id={mastId}
        ref={imgRef}
        src={imageSrc}
        alt={imageAlt}
        crossOrigin="anonymous"
        className="absolute left-1/2 top-0 h-auto -translate-x-1/2 drop-shadow-[0_10px_24px_rgba(0,0,0,0.45)]"
        style={{ width: `${mastWidth * 100}%` }}
      />
    </div>
  )
}
