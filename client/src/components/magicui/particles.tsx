import { useEffect, useRef } from "react"

import { cn } from "@/lib/utils"

type ParticlesProps = {
  className?: string
  color?: string
  quantity?: number
  ease?: number
  refresh?: boolean
}

type Particle = {
  x: number
  y: number
  radius: number
  vx: number
  vy: number
}

const Particles = ({
  className,
  color = "rgba(59, 130, 246, 0.6)",
  quantity = 120,
  ease = 50,
}: ParticlesProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animationRef = useRef<number | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const context = canvas.getContext("2d")
    if (!context) {
      return
    }

    const ratio = window.devicePixelRatio || 1
    let width = 0
    let height = 0
    let particles: Particle[] = []

    const resize = () => {
      width = window.innerWidth
      height = window.innerHeight

      canvas.width = width * ratio
      canvas.height = height * ratio

      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`

      context.setTransform(ratio, 0, 0, ratio, 0, 0)
    }

    const createParticle = () => {
      const radius = Math.random() * 2 + 0.6
      const angle = Math.random() * Math.PI * 2
      const speed = Math.random() * 0.4 + 0.1

      return {
        x: Math.random() * width,
        y: Math.random() * height,
        radius,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
      }
    }

    const drawParticle = (particle: Particle) => {
      context.beginPath()
      context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2)
      context.fillStyle = color
      context.fill()
    }

    const updateParticles = () => {
      particles.forEach((particle) => {
        particle.x += particle.vx * (ease / 100)
        particle.y += particle.vy * (ease / 100)

        if (particle.x <= 0 || particle.x >= width) {
          particle.vx *= -1
        }
        if (particle.y <= 0 || particle.y >= height) {
          particle.vy *= -1
        }
      })
    }

    const render = () => {
      context.clearRect(0, 0, width, height)
      updateParticles()
      particles.forEach(drawParticle)
      animationRef.current = window.requestAnimationFrame(render)
    }

    const init = () => {
      particles = Array.from({ length: quantity }, createParticle)
      render()
    }

    resize()
    init()

    window.addEventListener("resize", resize)

    return () => {
      window.removeEventListener("resize", resize)
      if (animationRef.current) {
        window.cancelAnimationFrame(animationRef.current)
      }
    }
  }, [color, ease, quantity])

  return <canvas ref={canvasRef} className={cn("pointer-events-none", className)} />
}

export { Particles }
