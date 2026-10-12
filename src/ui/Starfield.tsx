import { useEffect, useRef } from 'react'

/** Faint twinkling background stars on a full-screen canvas. */
export function Starfield({ count = 260 }: { count?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    let raf = 0

    const stars = Array.from({ length: count }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.4 + Math.random() * 1.1,
      phase: Math.random() * Math.PI * 2,
      speed: 0.3 + Math.random() * 0.9,
    }))

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const draw = (ms: number) => {
      const t = ms / 1000
      const w = window.innerWidth
      const h = window.innerHeight
      ctx.clearRect(0, 0, w, h)
      for (const s of stars) {
        const a = 0.25 + 0.5 * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase))
        ctx.fillStyle = `rgba(220, 228, 255, ${a})`
        ctx.beginPath()
        ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2)
        ctx.fill()
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [count])

  return <canvas ref={ref} className="starfield" />
}
