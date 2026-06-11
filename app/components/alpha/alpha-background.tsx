"use client"

import { useEffect, useRef } from "react"

// Ambient Aqua0 pointillism background — subtle ocean caustics.
// Ported from the prototype (aqua0/project/app/background.js).
// Fixed to the viewport and sits behind all app content (z-0).

function hash2(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}

function vnoise(x: number, y: number): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const a = hash2(xi, yi)
  const b = hash2(xi + 1, yi)
  const c = hash2(xi, yi + 1)
  const d = hash2(xi + 1, yi + 1)
  const u = xf * xf * (3 - 2 * xf)
  const v = yf * yf * (3 - 2 * yf)
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v
}

export function AlphaBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let W = 0
    let H = 0
    let DPR = 1
    let animT = 0
    let lastT = performance.now()

    const DENSITY = 1.2
    const SPEED = 0.6
    const OPACITY = 0.55

    function resize() {
      if (!canvas || !ctx) return
      DPR = Math.min(window.devicePixelRatio || 1, 2)
      W = window.innerWidth
      H = window.innerHeight
      canvas.width = W * DPR
      canvas.height = H * DPR
      canvas.style.width = `${W}px`
      canvas.style.height = `${H}px`
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
    }

    function draw() {
      if (!ctx) return
      const step = Math.max(8, 14 / DENSITY)
      const time = animT * 0.00038
      const rows = Math.ceil(H / step) + 2
      const cols = Math.ceil(W / step) + 2

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const jx = ((r * 131 + c * 7) % 100) / 100 - 0.5
          const jy = ((r * 53 + c * 91) % 100) / 100 - 0.5
          const bx = c * step + jx * step * 0.4
          const by = r * step + jy * step * 0.4

          const nx = bx * 0.005 + time * 0.3
          const ny = by * 0.005 - time * 0.25
          const n1 = vnoise(nx, ny)
          const n2 = vnoise(nx * 2.1 + 5.2, ny * 2.1 - 3.1)
          const ridged = 1 - Math.abs(n1 * 2 - 1)
          let caustic = Math.pow(ridged, 2.2) * 0.9 + n2 * 0.25
          caustic += Math.sin(bx * 0.002 + time * 1.0) * 0.05

          const tdx = (bx - W / 2) / (W / 2)
          const tdy = (by - H / 2) / (H / 2)
          const tr = tdx * tdx + tdy * tdy
          const edgeMask = Math.min(1, Math.max(0.1, tr * 1.1 - 0.1))

          const brightness = Math.max(0, Math.min(1, caustic)) * edgeMask
          if (brightness > 0.05) {
            ctx.globalAlpha = brightness * OPACITY
            ctx.fillStyle = "#fff"
            const size = 1.0 + brightness * 1.4
            ctx.beginPath()
            ctx.arc(bx, by, size / 2, 0, Math.PI * 2)
            ctx.fill()
          }
        }
      }
    }

    function frame(now: number) {
      if (!ctx) return
      const dt = now - lastT
      lastT = now
      animT += dt * SPEED
      ctx.clearRect(0, 0, W, H)
      draw()
      ctx.globalAlpha = 1
      rafRef.current = requestAnimationFrame(frame)
    }

    resize()
    window.addEventListener("resize", resize)
    rafRef.current = requestAnimationFrame(frame)

    return () => {
      window.removeEventListener("resize", resize)
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
        pointerEvents: "none",
        opacity: 0.45,
      }}
    />
  )
}
