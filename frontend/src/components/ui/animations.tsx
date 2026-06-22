"use client"

import { useEffect, useRef, useState } from "react"

// ─── 1. Typewriter text effect ────────────────────────────────────────────────
export function TypewriterText({ text, speed = 12, onDone }: { text: string; speed?: number; onDone?: () => void }) {
  const [displayed, setDisplayed] = useState("")
  const [done, setDone] = useState(false)
  const iRef = useRef(0)

  useEffect(() => {
    setDisplayed("")
    setDone(false)
    iRef.current = 0
    if (!text) return
    const interval = setInterval(() => {
      iRef.current++
      setDisplayed(text.slice(0, iRef.current))
      if (iRef.current >= text.length) {
        clearInterval(interval)
        setDone(true)
        onDone?.()
      }
    }, speed)
    return () => clearInterval(interval)
  }, [text])

  return (
    <span>
      {displayed}
      {!done && <span className="inline-block w-0.5 h-4 bg-blue-400 ml-0.5 animate-pulse align-middle" />}
    </span>
  )
}

// ─── 2. Thinking particles (AI is thinking) ───────────────────────────────────
export function ThinkingLoader({ message = "Cortex analyse vos données…" }: { message?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!
    const W = canvas.width = 120
    const H = canvas.height = 60
    let frame = 0

    const particles = Array.from({ length: 18 }, (_, i) => ({
      x: W / 2 + Math.cos((i / 18) * Math.PI * 2) * 28,
      y: H / 2 + Math.sin((i / 18) * Math.PI * 2) * 20,
      r: Math.random() * 2 + 1,
      phase: (i / 18) * Math.PI * 2,
    }))

    const loop = () => {
      ctx.clearRect(0, 0, W, H)
      frame++

      // Brain pulse glow
      const pulse = 0.5 + 0.5 * Math.sin(frame * 0.05)
      ctx.shadowBlur = 8 + pulse * 8
      ctx.shadowColor = "#60a5fa"
      ctx.fillStyle = `rgba(96,165,250,${0.15 + pulse * 0.1})`
      ctx.beginPath()
      ctx.arc(W / 2, H / 2, 12 + pulse * 3, 0, Math.PI * 2)
      ctx.fill()

      // Center symbol
      ctx.shadowBlur = 0
      ctx.fillStyle = "#93c5fd"
      ctx.font = "bold 14px sans-serif"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText("⬡", W / 2, H / 2)

      // Orbiting particles
      particles.forEach((p, i) => {
        const angle = p.phase + frame * 0.025
        const x = W / 2 + Math.cos(angle) * (26 + Math.sin(frame * 0.05 + i) * 4)
        const y = H / 2 + Math.sin(angle) * (18 + Math.cos(frame * 0.05 + i) * 3)
        const alpha = 0.4 + 0.6 * Math.abs(Math.sin(frame * 0.04 + i))
        ctx.shadowBlur = 6
        ctx.shadowColor = "#60a5fa"
        ctx.fillStyle = `rgba(96,165,250,${alpha})`
        ctx.beginPath()
        ctx.arc(x, y, p.r, 0, Math.PI * 2)
        ctx.fill()
      })

      requestAnimationFrame(loop)
    }
    const id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <div className="flex items-center gap-3">
      <canvas ref={canvasRef} className="opacity-90" style={{ width: 60, height: 30 }} />
      <span className="text-sm text-blue-300 animate-pulse">{message}</span>
    </div>
  )
}

// ─── 3. Confetti success ──────────────────────────────────────────────────────
export function ConfettiSuccess({ show, onDone }: { show: boolean; onDone?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!show) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!
    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight

    const pieces = Array.from({ length: 60 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * 0.3,
      vx: (Math.random() - 0.5) * 4,
      vy: Math.random() * 3 + 1,
      r: Math.random() * 6 + 3,
      color: ["#60a5fa","#a78bfa","#34d399","#fbbf24","#f472b6"][Math.floor(Math.random()*5)],
      rot: Math.random() * Math.PI * 2,
      rotV: (Math.random() - 0.5) * 0.2,
      alpha: 1,
    }))

    let frame = 0
    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      frame++
      let alive = false
      pieces.forEach(p => {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.05
        p.rot += p.rotV
        if (frame > 60) p.alpha -= 0.015
        if (p.alpha > 0) {
          alive = true
          ctx.save()
          ctx.globalAlpha = Math.max(0, p.alpha)
          ctx.translate(p.x, p.y)
          ctx.rotate(p.rot)
          ctx.fillStyle = p.color
          ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.5)
          ctx.restore()
        }
      })
      if (alive) requestAnimationFrame(loop)
      else onDone?.()
    }
    requestAnimationFrame(loop)
  }, [show])

  if (!show) return null
  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-50 w-full h-full" />
}

// ─── 4. Animated checkmark ────────────────────────────────────────────────────
export function AnimatedCheck({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className="animate-fade-in-up">
      <circle cx="20" cy="20" r="19" stroke="#22c55e" strokeWidth="2"
        strokeDasharray="120" strokeDashoffset="120"
        style={{ animation: "stroke-draw 0.5s ease forwards" }} />
      <path d="M11 20l7 7 11-13" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray="30" strokeDashoffset="30"
        style={{ animation: "stroke-draw 0.4s ease 0.3s forwards" }} />
      <style>{`
        @keyframes stroke-draw { to { stroke-dashoffset: 0; } }
      `}</style>
    </svg>
  )
}

// ─── 5. Knowledge graph ───────────────────────────────────────────────────────
export function KnowledgeGraph({ nodes }: { nodes: { label: string; active?: boolean }[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!
    const W = canvas.width = canvas.offsetWidth
    const H = canvas.height = canvas.offsetHeight
    const cx = W / 2, cy = H / 2

    const positions = nodes.map((_, i) => {
      const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2
      const r = Math.min(W, H) * 0.35
      return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r }
    })

    let frame = 0
    const loop = () => {
      ctx.clearRect(0, 0, W, H)
      frame++

      // Connections
      nodes.forEach((n, i) => {
        if (!n.active) return
        nodes.forEach((m, j) => {
          if (i >= j || !m.active) return
          const p1 = positions[i], p2 = positions[j]
          const pulse = 0.3 + 0.7 * Math.abs(Math.sin(frame * 0.05 + i + j))
          ctx.strokeStyle = `rgba(96,165,250,${pulse * 0.4})`
          ctx.lineWidth = 1
          ctx.setLineDash([4, 4])
          ctx.lineDashOffset = -frame * 0.5
          ctx.beginPath()
          ctx.moveTo(p1.x, p1.y)
          ctx.lineTo(p2.x, p2.y)
          ctx.stroke()
        })
      })
      ctx.setLineDash([])

      // Center node
      const centerPulse = 0.5 + 0.5 * Math.sin(frame * 0.04)
      ctx.shadowBlur = 10 + centerPulse * 10
      ctx.shadowColor = "#60a5fa"
      ctx.fillStyle = "#1d4ed8"
      ctx.beginPath()
      ctx.arc(cx, cy, 14 + centerPulse * 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
      ctx.fillStyle = "#93c5fd"
      ctx.font = "bold 12px sans-serif"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText("⬡", cx, cy)

      // Outer nodes
      nodes.forEach((n, i) => {
        const pos = positions[i]
        const pulse = 0.5 + 0.5 * Math.sin(frame * 0.06 + i * 1.2)
        const active = n.active

        if (active) {
          ctx.shadowBlur = 8 + pulse * 8
          ctx.shadowColor = "#60a5fa"
        }
        ctx.fillStyle = active ? `rgba(37,99,235,${0.7 + pulse * 0.3})` : "rgba(55,65,81,0.8)"
        ctx.beginPath()
        ctx.arc(pos.x, pos.y, 10, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0

        ctx.fillStyle = active ? "#dbeafe" : "#6b7280"
        ctx.font = "9px sans-serif"
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText(n.label.slice(0, 6), pos.x, pos.y + 18)
      })

      requestAnimationFrame(loop)
    }
    const id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [nodes])

  return <canvas ref={canvasRef} className="w-full h-40" />
}

// ─── 6. Drag drop zone ────────────────────────────────────────────────────────
export function DragDropZone({ onFile, accept = ".csv,.txt,.pdf,.xlsx,.xls,.docx,.doc" }: { onFile: (f: File) => void; accept?: string }) {
  const [dragging, setDragging] = useState(false)
  const [dropping, setDropping] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    setDropping(true)
    const file = e.dataTransfer.files[0]
    if (file) {
      setTimeout(() => { setDropping(false); onFile(file) }, 400)
    }
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`relative rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-300 ${
        dropping
          ? "border-green-500 bg-green-950/30 scale-95"
          : dragging
          ? "border-blue-500 bg-blue-950/30 scale-[1.02] shadow-glow-blue"
          : "border-gray-700 hover:border-gray-500 hover:bg-gray-800/30"
      }`}
    >
      <input ref={inputRef} type="file" accept={accept} className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }} />

      <div className={`transition-all duration-300 ${dragging ? "scale-110" : ""}`}>
        <div className={`text-4xl mb-3 transition-all duration-300 ${dragging ? "animate-bounce" : ""}`}>
          {dropping ? "✅" : dragging ? "📂" : "📁"}
        </div>
        <p className="text-sm font-medium text-gray-300">
          {dropping ? "Fichier reçu !" : dragging ? "Relâchez pour importer" : "Glissez un fichier ici"}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          ou cliquez pour choisir · PDF, Excel, Word, CSV, TXT · max 20 MB
        </p>
        <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
          {["📕 PDF", "📗 Excel", "📘 Word", "📊 CSV", "📄 TXT"].map(f => (
            <span key={f} className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700">
              {f}
            </span>
          ))}
        </div>
      </div>

      {dragging && (
        <div className="absolute inset-0 rounded-2xl border-2 border-blue-500 animate-ping opacity-20 pointer-events-none" />
      )}
    </div>
  )
}
