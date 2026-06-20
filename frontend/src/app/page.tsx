"use client"
import { useEffect, useRef, useState, useCallback } from "react"
import Link from "next/link"

/* ─────────────────────────────────────────────────────────────────────────────
   HOOKS
───────────────────────────────────────────────────────────────────────────── */

/** Typewriter effect cycling through words */
function useTypewriter(words: string[]) {
  const [idx, setIdx] = useState(0)
  const [display, setDisplay] = useState("")
  const [deleting, setDeleting] = useState(false)
  useEffect(() => {
    const word = words[idx]
    const delay = deleting ? 45 : 80
    const t = setTimeout(() => {
      if (deleting) {
        setDisplay(p => p.slice(0, -1))
        if (display.length === 1) { setDeleting(false); setIdx(x => (x + 1) % words.length) }
      } else {
        setDisplay(word.slice(0, display.length + 1))
        if (display.length === word.length) setTimeout(() => setDeleting(true), 2000)
      }
    }, delay)
    return () => clearTimeout(t)
  }, [display, deleting, idx, words])
  return display
}

/** Scroll-triggered fade-in */
function useFade(delay = 0) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true) }, { threshold: 0.1 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])
  return {
    ref,
    style: {
      transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(32px)",
    },
  }
}

/** Particle mesh background */
function ParticleBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!
    let raf: number
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener("resize", resize)
    const COUNT = 55
    const pts = Array.from({ length: COUNT }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
    }))
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1
        ctx.beginPath()
        ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2)
        ctx.fillStyle = "rgba(96,165,250,0.35)"
        ctx.fill()
      })
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 130) {
            ctx.beginPath()
            ctx.moveTo(pts[i].x, pts[i].y)
            ctx.lineTo(pts[j].x, pts[j].y)
            ctx.strokeStyle = `rgba(96,165,250,${0.08 * (1 - dist / 130)})`
            ctx.stroke()
          }
        }
      }
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { window.removeEventListener("resize", resize); cancelAnimationFrame(raf) }
  }, [])
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
}

/* ─────────────────────────────────────────────────────────────────────────────
   DEMO CHAT COMPONENT
───────────────────────────────────────────────────────────────────────────── */
const QA = [
  {
    q: "Quels sont mes concurrents à Montréal ?",
    a: "D'après votre fichier d'analyse :\n\n• **Wedge Studio** — Awards Dieline, positionnement premium\n• **Baboon Creation** — Spécialiste motion design\n• **ROYALTRI** — Agence complète marketing digital\n\n*📄 Source : Concurrence_Thibaut_Affo.csv*",
  },
  {
    q: "Résume mes emails importants",
    a: "**5 emails clés cette semaine :**\n\n• Stripe — Paiement 1 200€ reçu ✅\n• GitHub — Alerte sécurité résolue ✅\n• Adobe Express — Invitation événement créatif\n• Client — Demande de devis branding\n• Notion — Mise à jour équipe\n\n*📄 Source : Gmail (23 emails analysés)*",
  },
  {
    q: "Comment surpasser Wedge Studio ?",
    a: "**Stratégie recommandée :**\n\n1. Miser sur votre avantage IA génératif unique\n2. Tarifs 3-5x plus accessibles → cibler les PME\n3. Développer votre portfolio packaging\n\n*Score de menace Wedge : 6/10 — gérable*\n\n*📄 Source : Concurrence_Thibaut_Affo.csv*",
  },
]

function renderMsg(t: string) {
  return t.split("\n").map((l, i) => {
    const h = l.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\*(.*?)\*/g, "<em class='text-slate-400'>$1</em>")
    if (l.startsWith("•")) return <li key={i} className="ml-4 list-disc text-xs text-slate-300 leading-relaxed" dangerouslySetInnerHTML={{ __html: h.slice(1) }} />
    if (/^\d\./.test(l)) return <li key={i} className="ml-4 list-decimal text-xs text-slate-300 leading-relaxed" dangerouslySetInnerHTML={{ __html: h }} />
    if (!l.trim()) return <div key={i} className="h-1.5" />
    return <p key={i} className="text-xs text-slate-200 leading-relaxed" dangerouslySetInnerHTML={{ __html: h }} />
  })
}

function DemoChat() {
  const [msgs, setMsgs] = useState<{ r: "u" | "a"; t: string }[]>([])
  const [inp, setInp] = useState("")
  const [typing, setTyping] = useState(false)
  const [qi, setQi] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [msgs])

  const send = useCallback((txt?: string) => {
    const m = txt || inp.trim()
    if (!m || typing) return
    setInp("")
    setMsgs(p => [...p, { r: "u", t: m }])
    setTyping(true)
    const qa = QA.find(q => q.q === m) || QA[qi % QA.length]
    setQi(x => x + 1)
    setTimeout(() => { setMsgs(p => [...p, { r: "a", t: qa.a }]); setTyping(false) }, 950)
  }, [inp, typing, qi])

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(5,8,18,0.97)", border: "1px solid rgba(96,165,250,0.15)", boxShadow: "0 0 0 1px rgba(255,255,255,0.04), 0 40px 80px rgba(0,0,0,0.7)" }}>
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-3" style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
        <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
        <span className="ml-2 text-xs text-slate-500 font-medium">cortexos — assistant</span>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" style={{ animation: "pulse 2s infinite" }} />
          <span className="text-xs text-emerald-400 font-medium">démo live</span>
        </div>
      </div>
      {/* Messages */}
      <div className="h-72 overflow-y-auto p-4 space-y-3">
        {msgs.length === 0 && (
          <div className="space-y-2">
            <p className="text-xs text-slate-600 mb-3 font-medium">Essayez une question ↓</p>
            {QA.map((q, i) => (
              <button key={i} onClick={() => send(q.q)}
                className="w-full text-left px-3.5 py-2.5 rounded-xl text-xs text-slate-400 hover:text-white transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                {q.q}
              </button>
            ))}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.r === "u" ? "justify-end" : "justify-start"}`}>
            <div className="max-w-[88%] px-3.5 py-2.5"
              style={m.r === "u"
                ? { background: "linear-gradient(135deg,#2563eb,#4f46e5)", borderRadius: "14px 14px 3px 14px", boxShadow: "0 4px 16px rgba(37,99,235,0.3)" }
                : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px 14px 14px 3px" }
              }>
              {m.r === "a" && <p className="text-blue-400 text-xs font-semibold mb-1.5">⬡ CortexOS</p>}
              {renderMsg(m.t)}
            </div>
          </div>
        ))}
        {typing && (
          <div className="flex">
            <div className="px-3 py-2.5 rounded-2xl flex gap-1 items-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
              {[0, 1, 2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-blue-400 typing-dot" />)}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      {/* Input */}
      <div className="flex gap-2 p-3" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <input value={inp} onChange={e => setInp(e.target.value)} onKeyDown={e => e.key === "Enter" && send()}
          placeholder="Posez une question sur vos données…"
          className="flex-1 bg-transparent text-xs text-white placeholder-slate-600 focus:outline-none" />
        <button onClick={() => send()}
          className="px-4 py-1.5 rounded-xl text-xs font-bold text-white transition-all hover:scale-105 hover:brightness-110"
          style={{ background: "linear-gradient(135deg,#2563eb,#4f46e5)" }}>→</button>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   DATA
───────────────────────────────────────────────────────────────────────────── */
const FEATURES = [
  {
    icon: "💬",
    title: "Chat en langage naturel",
    desc: "Posez vos questions comme à un collègue. CortexOS comprend le contexte, les dates, les comparaisons.",
    gradient: "from-blue-500/20 to-cyan-500/10",
    accent: "#60a5fa",
  },
  {
    icon: "🔗",
    title: "Sources toujours citées",
    desc: "Chaque réponse indique précisément quel fichier, email ou document a servi — zéro hallucination.",
    gradient: "from-violet-500/20 to-purple-500/10",
    accent: "#a78bfa",
  },
  {
    icon: "📁",
    title: "Toutes vos données unifiées",
    desc: "Gmail, Drive, CSV, Excel, PDF — connectez vos sources en quelques clics sans code.",
    gradient: "from-emerald-500/20 to-teal-500/10",
    accent: "#34d399",
  },
  {
    icon: "⚡",
    title: "Réponses en secondes",
    desc: "Moteur vectoriel optimisé. Même sur des milliers de documents, les résultats arrivent instantanément.",
    gradient: "from-orange-500/20 to-amber-500/10",
    accent: "#fb923c",
  },
  {
    icon: "👥",
    title: "Multi-utilisateurs",
    desc: "Invitez votre équipe, gérez les permissions par source. Chacun accède uniquement à ce qui le concerne.",
    gradient: "from-pink-500/20 to-rose-500/10",
    accent: "#f472b6",
  },
  {
    icon: "🔒",
    title: "100% privé & sécurisé",
    desc: "Vos données restent les vôtres. Chiffrement AES-256, isolation par espace de travail.",
    gradient: "from-slate-500/20 to-gray-500/10",
    accent: "#94a3b8",
  },
]

const STEPS = [
  { n: "01", title: "Connectez vos sources", desc: "Liez Gmail, Drive, CSV ou Excel en quelques clics. Aucun code requis." },
  { n: "02", title: "CortexOS indexe tout", desc: "L'IA analyse, structure et vectorise vos données automatiquement." },
  { n: "03", title: "Posez vos questions", desc: "Interrogez vos données en français, comme si vous parliez à un collègue." },
  { n: "04", title: "Recevez des réponses sourcées", desc: "Chaque réponse cite sa source précise. Fiable, traçable, actionnable." },
]

const TESTIMONIALS = [
  {
    name: "Marie Dubois",
    role: "Directrice Ops · Startup SaaS",
    avatar: "MD",
    color: "#2563eb",
    text: "En 2 semaines, mon équipe a économisé +8h par semaine sur la recherche d'infos. CortexOS est devenu indispensable.",
  },
  {
    name: "Karim Benali",
    role: "CEO · Agence créative",
    avatar: "KB",
    color: "#7c3aed",
    text: "La fonction veille concurrentielle est bluffante. Je pose une question le matin, j'ai une synthèse complète en 3 secondes.",
  },
  {
    name: "Sophie Laurent",
    role: "Analyste · Cabinet conseil",
    avatar: "SL",
    color: "#059669",
    text: "Ce qui m'a convaincu : les sources citées à chaque réponse. Zéro risque d'hallucination, on peut se fier aux résultats.",
  },
]

const LOGOS = ["Stripe", "Notion", "Figma", "Vercel", "Linear", "Supabase"]

const TYPEWRITER_WORDS = ["Gmail", "Drive", "fichiers CSV", "données clients", "rapports Excel", "PDFs"]

const PLANS = [
  {
    name: "Starter",
    price: "Gratuit",
    sub: "Pour toujours",
    features: ["1 espace de travail", "3 sources connectées", "500 questions / mois", "Support communauté"],
    cta: "Commencer gratuitement",
    highlight: false,
  },
  {
    name: "Pro",
    price: "29€",
    sub: "par mois",
    features: ["Espaces de travail illimités", "Sources illimitées", "Questions illimitées", "Membres d'équipe", "Support prioritaire", "API Access"],
    cta: "Essayer 14 jours gratuits",
    highlight: true,
  },
  {
    name: "Entreprise",
    price: "Sur devis",
    sub: "à partir de 5 utilisateurs",
    features: ["Tout Pro inclus", "SSO / SAML", "SLA garanti 99.9%", "Déploiement on-premise", "Customer Success dédié"],
    cta: "Nous contacter",
    highlight: false,
  },
]

/* ─────────────────────────────────────────────────────────────────────────────
   NAVBAR
───────────────────────────────────────────────────────────────────────────── */
function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", h)
    return () => window.removeEventListener("scroll", h)
  }, [])
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? "rgba(5,8,18,0.92)" : "transparent",
        backdropFilter: scrolled ? "blur(20px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(255,255,255,0.06)" : "none",
      }}>
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold"
            style={{ background: "linear-gradient(135deg,#2563eb,#7c3aed)" }}>⬡</div>
          <span className="font-bold text-white text-lg tracking-tight">CortexOS</span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          {["Fonctionnalités", "Comment ça marche", "Tarifs"].map(l => (
            <a key={l} href={`#${l.toLowerCase().replace(/\s/g, "-").replace(/[éè]/g, "e").replace(/ç/g, "c")}`}
              className="text-sm text-slate-400 hover:text-white transition-colors">{l}</a>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-slate-400 hover:text-white transition-colors">Connexion</Link>
          <Link href="/signup"
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:scale-105 hover:brightness-110"
            style={{ background: "linear-gradient(135deg,#2563eb,#7c3aed)" }}>
            Démarrer
          </Link>
        </div>
      </div>
    </nav>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   HERO SECTION
───────────────────────────────────────────────────────────────────────────── */
function Hero() {
  const word = useTypewriter(TYPEWRITER_WORDS)
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden"
      style={{ background: "linear-gradient(135deg, #020510 0%, #050d1a 40%, #08061a 100%)" }}>
      <ParticleBg />
      {/* Glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(37,99,235,0.12) 0%, transparent 70%)", filter: "blur(40px)" }} />
      <div className="absolute top-1/3 right-1/4 w-80 h-80 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(124,58,237,0.1) 0%, transparent 70%)", filter: "blur(40px)" }} />

      <div className="relative max-w-7xl mx-auto px-6 pt-24 pb-16 w-full">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left — copy */}
          <div>
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8 text-xs font-semibold"
              style={{ background: "rgba(37,99,235,0.12)", border: "1px solid rgba(37,99,235,0.25)", color: "#93c5fd" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" style={{ animation: "pulse 2s infinite" }} />
              Maintenant disponible · Accès gratuit
            </div>

            <h1 className="text-5xl lg:text-6xl font-extrabold text-white leading-[1.1] mb-6 tracking-tight">
              Interrogez toutes{" "}
              <br />
              vos données comme{" "}
              <br />
              <span style={{ background: "linear-gradient(90deg,#60a5fa,#a78bfa,#34d399)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                si vous parliez
              </span>
              <br />à un collègue.
            </h1>

            <p className="text-lg text-slate-400 mb-4 leading-relaxed max-w-xl">
              CortexOS centralise{" "}
              <span className="text-white font-medium">{word}<span className="text-blue-400 animate-pulse">|</span></span>
              {" "}et répond en langage naturel avec des sources citées.
            </p>
            <p className="text-slate-500 text-sm mb-10">Zéro hallucination. Zéro code. Résultats en secondes.</p>

            {/* CTAs */}
            <div className="flex flex-wrap gap-4 mb-8">
              <Link href="/signup"
                className="group flex items-center gap-3 px-7 py-4 rounded-2xl font-bold text-white transition-all duration-300 hover:scale-105"
                style={{ background: "linear-gradient(135deg,#2563eb,#7c3aed)", boxShadow: "0 0 30px rgba(37,99,235,0.4), 0 8px 24px rgba(0,0,0,0.3)" }}>
                <span>Créer mon espace gratuitement</span>
                <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
              </Link>
              <a href="#demo"
                className="flex items-center gap-2 px-7 py-4 rounded-2xl font-semibold text-slate-300 transition-all duration-200 hover:text-white hover:scale-105"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}>
                ▶ Voir la démo
              </a>
            </div>

            {/* Trust badge */}
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {["#2563eb","#7c3aed","#059669","#dc2626"].map((c, i) => (
                  <div key={i} className="w-7 h-7 rounded-full border-2 border-slate-900 flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: c }}>
                    {["M","K","S","A"][i]}
                  </div>
                ))}
              </div>
              <div>
                <span className="text-sm font-semibold text-white">+2 400 équipes</span>
                <span className="text-sm text-slate-500"> déjà actives cette semaine</span>
              </div>
            </div>
            <p className="text-xs text-slate-600 mt-2">✓ Aucune carte requise &nbsp;·&nbsp; ✓ Configuration en 2 minutes &nbsp;·&nbsp; ✓ Résiliable à tout moment</p>
          </div>

          {/* Right — demo chat */}
          <div className="relative">
            <div className="absolute -inset-4 rounded-3xl pointer-events-none"
              style={{ background: "radial-gradient(ellipse at center, rgba(37,99,235,0.08) 0%, transparent 70%)" }} />
            <DemoChat />
            {/* Floating badges */}
            <div className="absolute -top-4 -right-4 px-3 py-2 rounded-xl text-xs font-semibold text-emerald-300"
              style={{ background: "rgba(5,150,105,0.15)", border: "1px solid rgba(5,150,105,0.3)", backdropFilter: "blur(12px)" }}>
              ✓ Sources citées
            </div>
            <div className="absolute -bottom-4 -left-4 px-3 py-2 rounded-xl text-xs font-semibold text-blue-300"
              style={{ background: "rgba(37,99,235,0.15)", border: "1px solid rgba(37,99,235,0.3)", backdropFilter: "blur(12px)" }}>
              ⚡ Réponse en 1.2s
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   SOCIAL PROOF LOGOS BAR
───────────────────────────────────────────────────────────────────────────── */
function LogosBar() {
  return (
    <section style={{ background: "rgba(5,8,18,1)", borderTop: "1px solid rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <div className="max-w-7xl mx-auto px-6 py-10">
        <p className="text-center text-xs text-slate-600 uppercase tracking-widest font-semibold mb-7">
          Déjà utilisé par des équipes dans des entreprises comme
        </p>
        <div className="flex flex-wrap justify-center items-center gap-10">
          {LOGOS.map(l => (
            <span key={l} className="text-slate-600 font-semibold text-base tracking-tight hover:text-slate-400 transition-colors cursor-default">
              {l}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   FEATURES SECTION
───────────────────────────────────────────────────────────────────────────── */
function Features() {
  const s0 = useFade(0), s1 = useFade(100), s2 = useFade(200), s3 = useFade(300), s4 = useFade(400), s5 = useFade(500)
  const title = useFade(0)
  const fades = [s0, s1, s2, s3, s4, s5]
  return (
    <section id="fonctionnalites" style={{ background: "linear-gradient(180deg, #020510 0%, #040815 100%)" }} className="py-28">
      <div className="max-w-7xl mx-auto px-6">
        <div ref={title.ref} style={title.style} className="text-center mb-18">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-5"
            style={{ background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.25)", color: "#c4b5fd" }}>
            ✦ Fonctionnalités
          </div>
          <h2 className="text-4xl lg:text-5xl font-extrabold text-white mb-4 tracking-tight">
            Tout ce dont votre équipe{" "}
            <span style={{ background: "linear-gradient(90deg,#60a5fa,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              a besoin
            </span>
          </h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Un seul outil pour centraliser, interroger et exploiter toutes vos données internes.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-14">
          {FEATURES.map((f, i) => (
            <div key={i} ref={fades[i].ref}
              className="group relative p-6 rounded-2xl transition-all duration-300 hover:scale-[1.02] cursor-default"
              style={{ ...fades[i].style, border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${f.gradient} opacity-100`} />
              <div className="absolute inset-0 rounded-2xl" style={{ background: "rgba(5,8,18,0.7)" }} />
              <div className="relative">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4"
                  style={{ background: `${f.accent}18`, border: `1px solid ${f.accent}30` }}>
                  {f.icon}
                </div>
                <h3 className="font-bold text-white text-base mb-2">{f.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
                <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold transition-all duration-200"
                  style={{ color: f.accent, opacity: 0.7 }}>
                  En savoir plus <span className="transition-transform group-hover:translate-x-1 inline-block">→</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   DEMO LIVE SECTION
───────────────────────────────────────────────────────────────────────────── */
function DemoSection() {
  const title = useFade(0)
  const chat = useFade(150)
  return (
    <section id="demo" className="py-28" style={{ background: "linear-gradient(180deg, #040815 0%, #060b1c 100%)" }}>
      <div className="max-w-6xl mx-auto px-6">
        <div ref={title.ref} style={title.style} className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-5"
            style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.25)", color: "#6ee7b7" }}>
            ▶ Démo interactive
          </div>
          <h2 className="text-4xl lg:text-5xl font-extrabold text-white mb-4 tracking-tight">
            Essayez-le{" "}
            <span style={{ background: "linear-gradient(90deg,#34d399,#60a5fa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              maintenant
            </span>
          </h2>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Posez une question ci-dessous — CortexOS répond en temps réel avec les sources.
          </p>
        </div>
        <div ref={chat.ref} style={chat.style} className="max-w-2xl mx-auto">
          <DemoChat />
          <p className="text-center text-xs text-slate-600 mt-4">
            Données fictives pour la démo · Vos vraies données restent privées
          </p>
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   HOW IT WORKS
───────────────────────────────────────────────────────────────────────────── */
function HowItWorks() {
  const title = useFade(0)
  const s0 = useFade(0), s1 = useFade(150), s2 = useFade(300), s3 = useFade(450)
  const steps = [s0, s1, s2, s3]
  return (
    <section id="comment-ca-marche" className="py-28" style={{ background: "linear-gradient(180deg, #060b1c 0%, #040815 100%)" }}>
      <div className="max-w-6xl mx-auto px-6">
        <div ref={title.ref} style={title.style} className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-5"
            style={{ background: "rgba(251,146,60,0.1)", border: "1px solid rgba(251,146,60,0.25)", color: "#fdba74" }}>
            ⚙ Comment ça marche
          </div>
          <h2 className="text-4xl lg:text-5xl font-extrabold text-white mb-4 tracking-tight">
            Opérationnel en{" "}
            <span style={{ background: "linear-gradient(90deg,#fb923c,#f472b6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              2 minutes
            </span>
          </h2>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">Pas de complexité. Pas de code. Juste vos données et vos questions.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {STEPS.map((step, i) => (
            <div key={i} ref={steps[i].ref}
              className="relative p-6 rounded-2xl"
              style={{ ...steps[i].style, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="text-5xl font-extrabold mb-4 leading-none"
                style={{ background: "linear-gradient(135deg,rgba(96,165,250,0.3),rgba(167,139,250,0.3))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                {step.n}
              </div>
              <h3 className="font-bold text-white text-base mb-2">{step.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{step.desc}</p>
              {i < STEPS.length - 1 && (
                <div className="hidden lg:block absolute top-10 -right-2.5 text-slate-700 text-lg z-10">→</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   TESTIMONIALS
───────────────────────────────────────────────────────────────────────────── */
function Testimonials() {
  const title = useFade(0)
  const s0 = useFade(0), s1 = useFade(150), s2 = useFade(300)
  const cards = [s0, s1, s2]
  return (
    <section className="py-28" style={{ background: "linear-gradient(180deg, #040815 0%, #06091a 100%)" }}>
      <div className="max-w-6xl mx-auto px-6">
        <div ref={title.ref} style={title.style} className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-5"
            style={{ background: "rgba(244,114,182,0.1)", border: "1px solid rgba(244,114,182,0.25)", color: "#f9a8d4" }}>
            ⭐ Témoignages
          </div>
          <h2 className="text-4xl lg:text-5xl font-extrabold text-white mb-4 tracking-tight">
            Ils ont transformé{" "}
            <span style={{ background: "linear-gradient(90deg,#f472b6,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              leur façon de travailler
            </span>
          </h2>
          {/* Social stats */}
          <div className="flex justify-center gap-8 mt-6">
            {[["2 400+","équipes actives"],["4.9/5","satisfaction"],["< 2min","pour démarrer"]].map(([n, l]) => (
              <div key={l} className="text-center">
                <div className="text-2xl font-extrabold text-white">{n}</div>
                <div className="text-xs text-slate-500">{l}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t, i) => (
            <div key={i} ref={cards[i].ref}
              className="p-6 rounded-2xl transition-all duration-300 hover:scale-[1.02]"
              style={{ ...cards[i].style, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, j) => <span key={j} className="text-amber-400 text-sm">★</span>)}
              </div>
              <p className="text-slate-300 text-sm leading-relaxed mb-5">&ldquo;{t.text}&rdquo;</p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: t.color }}>
                  {t.avatar}
                </div>
                <div>
                  <div className="text-white text-sm font-semibold">{t.name}</div>
                  <div className="text-slate-500 text-xs">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   PRICING
───────────────────────────────────────────────────────────────────────────── */
function Pricing() {
  const title = useFade(0)
  const s0 = useFade(0), s1 = useFade(150), s2 = useFade(300)
  const cards = [s0, s1, s2]
  return (
    <section id="tarifs" className="py-28" style={{ background: "linear-gradient(180deg, #06091a 0%, #040815 100%)" }}>
      <div className="max-w-6xl mx-auto px-6">
        <div ref={title.ref} style={title.style} className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-5"
            style={{ background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.25)", color: "#93c5fd" }}>
            💎 Tarifs
          </div>
          <h2 className="text-4xl lg:text-5xl font-extrabold text-white mb-4 tracking-tight">
            Simple,{" "}
            <span style={{ background: "linear-gradient(90deg,#60a5fa,#34d399)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              transparent
            </span>
          </h2>
          <p className="text-slate-400 text-lg">Commencez gratuitement. Passez au Pro quand vous êtes prêt.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {PLANS.map((plan, i) => (
            <div key={i} ref={cards[i].ref}
              className="relative p-7 rounded-2xl transition-all duration-300 hover:scale-[1.02]"
              style={plan.highlight
                ? { ...cards[i].style, background: "linear-gradient(135deg,rgba(37,99,235,0.15),rgba(124,58,237,0.1))", border: "1px solid rgba(96,165,250,0.3)", boxShadow: "0 0 40px rgba(37,99,235,0.15)" }
                : { ...cards[i].style, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
              {plan.highlight && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold text-white"
                  style={{ background: "linear-gradient(135deg,#2563eb,#7c3aed)" }}>
                  Le plus populaire
                </div>
              )}
              <div className="mb-6">
                <h3 className="font-bold text-white text-lg mb-1">{plan.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-white">{plan.price}</span>
                  {plan.sub && <span className="text-slate-500 text-sm">/ {plan.sub}</span>}
                </div>
              </div>
              <ul className="space-y-3 mb-8">
                {plan.features.map((f, j) => (
                  <li key={j} className="flex items-start gap-2.5 text-sm text-slate-300">
                    <span className="text-emerald-400 font-bold mt-0.5 shrink-0">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/signup"
                className="block w-full text-center py-3 rounded-xl font-semibold text-sm transition-all duration-200 hover:scale-[1.02]"
                style={plan.highlight
                  ? { background: "linear-gradient(135deg,#2563eb,#7c3aed)", color: "white", boxShadow: "0 4px 20px rgba(37,99,235,0.3)" }
                  : { background: "rgba(255,255,255,0.06)", color: "#e2e8f0", border: "1px solid rgba(255,255,255,0.1)" }}>
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-slate-600 mt-8">
          ✓ Aucune carte bancaire pour le plan Starter &nbsp;·&nbsp; ✓ Résiliez à tout moment &nbsp;·&nbsp; ✓ Données hébergées en Europe
        </p>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   CTA BANNER
───────────────────────────────────────────────────────────────────────────── */
function CTABanner() {
  const s = useFade(0)
  return (
    <section className="py-24" style={{ background: "#040815" }}>
      <div className="max-w-4xl mx-auto px-6">
        <div ref={s.ref}
          className="relative rounded-3xl p-12 text-center overflow-hidden"
          style={{ ...s.style, background: "linear-gradient(135deg,rgba(37,99,235,0.2),rgba(124,58,237,0.15))", border: "1px solid rgba(96,165,250,0.2)", boxShadow: "0 0 80px rgba(37,99,235,0.1)" }}>
          <div className="absolute inset-0 rounded-3xl pointer-events-none"
            style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(37,99,235,0.15) 0%, transparent 60%)" }} />
          <div className="relative">
            <h2 className="text-4xl lg:text-5xl font-extrabold text-white mb-4 tracking-tight">
              Prêt à reprendre le contrôle{" "}
              <br />
              <span style={{ background: "linear-gradient(90deg,#60a5fa,#a78bfa,#34d399)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                de vos données ?
              </span>
            </h2>
            <p className="text-slate-400 text-lg mb-8 max-w-xl mx-auto">
              Rejoignez 2 400+ équipes qui gagnent des heures chaque semaine. Configurez votre espace en 2 minutes.
            </p>
            <Link href="/signup"
              className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-white text-lg transition-all duration-300 hover:scale-105"
              style={{ background: "linear-gradient(135deg,#2563eb,#7c3aed)", boxShadow: "0 0 40px rgba(37,99,235,0.4)" }}>
              Créer mon espace gratuitement →
            </Link>
            <p className="text-xs text-slate-600 mt-4">✓ Gratuit pour toujours &nbsp;·&nbsp; ✓ Aucune carte requise &nbsp;·&nbsp; ✓ 2 min de setup</p>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   FOOTER
───────────────────────────────────────────────────────────────────────────── */
function Footer() {
  return (
    <footer style={{ background: "#020510", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
      <div className="max-w-7xl mx-auto px-6 py-14">
        <div className="grid md:grid-cols-4 gap-10 mb-10">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold"
                style={{ background: "linear-gradient(135deg,#2563eb,#7c3aed)" }}>⬡</div>
              <span className="font-bold text-white text-lg">CortexOS</span>
            </div>
            <p className="text-slate-500 text-sm leading-relaxed max-w-xs">
              Interrogez toutes vos données d'entreprise en langage naturel. Sources citées, zéro hallucination.
            </p>
            <div className="flex gap-3 mt-5">
              {["Twitter", "LinkedIn", "GitHub"].map(n => (
                <a key={n} href="#"
                  className="text-xs text-slate-600 hover:text-white transition-colors px-3 py-1.5 rounded-lg"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  {n}
                </a>
              ))}
            </div>
          </div>
          {/* Links */}
          {[
            { title: "Produit", links: ["Fonctionnalités", "Démo", "Tarifs", "Roadmap"] },
            { title: "Légal", links: ["Confidentialité", "CGU", "Cookies", "Contact"] },
          ].map(col => (
            <div key={col.title}>
              <h4 className="text-white font-semibold text-sm mb-4">{col.title}</h4>
              <ul className="space-y-2.5">
                {col.links.map(l => (
                  <li key={l}>
                    <a href="#" className="text-slate-500 text-sm hover:text-slate-300 transition-colors">{l}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="pt-6 flex flex-col md:flex-row justify-between items-center gap-3"
          style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <p className="text-slate-600 text-xs">© {new Date().getFullYear()} CortexOS. Tous droits réservés.</p>
          <p className="text-slate-700 text-xs">Fabriqué avec ♥ — Données hébergées en Europe 🇪🇺</p>
        </div>
      </div>
    </footer>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   ROOT PAGE
───────────────────────────────────────────────────────────────────────────── */
export default function LandingPage() {
  return (
    <main className="min-h-screen" style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
      <Navbar />
      <Hero />
      <LogosBar />
      <Features />
      <DemoSection />
      <HowItWorks />
      <Testimonials />
      <Pricing />
      <CTABanner />
      <Footer />
    </main>
  )
}
