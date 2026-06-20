"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

// ─── Particle background ──────────────────────────────────────────────────────
function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext("2d")!
    let W = canvas.width = window.innerWidth
    let H = canvas.height = window.innerHeight
    const resize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight }
    window.addEventListener("resize", resize)
    const particles = Array.from({ length: 80 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 1.5 + 0.5, alpha: Math.random() * 0.4 + 0.1,
    }))
    let frame = 0
    const loop = () => {
      ctx.clearRect(0, 0, W, H)
      frame++
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(96,165,250,${p.alpha})`
        ctx.fill()
      })
      // Connect nearby
      particles.forEach((a, i) => particles.slice(i+1).forEach(b => {
        const d = Math.hypot(a.x-b.x, a.y-b.y)
        if (d < 120) {
          ctx.strokeStyle = `rgba(96,165,250,${0.08*(1-d/120)})`
          ctx.lineWidth = 0.5
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
        }
      }))
      requestAnimationFrame(loop)
    }
    const id = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(id); window.removeEventListener("resize", resize) }
  }, [])
  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0 opacity-40" />
}

// ─── Typewriter ───────────────────────────────────────────────────────────────
const WORDS = ["emails Gmail", "fichiers Drive", "données clients", "rapports", "contrats"]
function useTypewriter(words: string[]) {
  const [i, setI] = useState(0)
  const [displayed, setDisplayed] = useState("")
  const [deleting, setDeleting] = useState(false)
  useEffect(() => {
    const word = words[i]
    const t = deleting
      ? setTimeout(() => { setDisplayed(p => p.slice(0,-1)); if (displayed.length===1){setDeleting(false);setI(x=>(x+1)%words.length)} }, 55)
      : setTimeout(() => { setDisplayed(word.slice(0,displayed.length+1)); if (displayed.length===word.length) setTimeout(()=>setDeleting(true),1800) }, 90)
    return () => clearTimeout(t)
  }, [displayed, deleting, i, words])
  return displayed
}

// ─── Scroll fade ──────────────────────────────────────────────────────────────
function useFade(delay=0) {
  const ref = useRef<HTMLDivElement>(null)
  const [v, setV] = useState(false)
  useEffect(() => {
    const obs = new IntersectionObserver(([e])=>{ if(e.isIntersecting) setV(true) },{threshold:0.1})
    if(ref.current) obs.observe(ref.current)
    return ()=>obs.disconnect()
  }, [])
  return { ref, style: { transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`, opacity: v?1:0, transform: v?"translateY(0)":"translateY(24px)" } }
}

// ─── Demo chat ────────────────────────────────────────────────────────────────
const DEMO_QA = [
  { q:"Quels sont mes concurrents à Montréal ?", a:"D'après votre fichier, vos 3 principaux concurrents sont :\n\n**Wedge Studio** — Awards Dieline, premium\n**Baboon Creation** — Motion design\n**ROYALTRI** — Agence complète\n\n📄 *Concurrence_Thibaut_Affo.csv*" },
  { q:"Compare mes tarifs avec la concurrence", a:"Vos tarifs sont **3-5x plus accessibles** que Wedge Studio (premium) tout en offrant l'IA génératif — un avantage unique sur le marché montréalais.\n\n📄 *Concurrence_Thibaut_Affo.csv*" },
  { q:"Résume mes derniers emails", a:"**3 emails importants :**\n- Adobe Express — Invitation créative\n- GitHub — Alerte sécurité\n- Stripe — Paiement reçu 1 200€\n\n📄 *Gmail (10 emails)*" },
]

function DemoChat() {
  const [msgs, setMsgs] = useState<{role:"u"|"ai";text:string}[]>([])
  const [input, setInput] = useState("")
  const [typing, setTyping] = useState(false)
  const [qi, setQi] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(()=>{ ref.current?.scrollIntoView({behavior:"smooth"}) },[msgs])
  const send = (txt?: string) => {
    const m = txt||input.trim(); if(!m||typing) return
    setInput("")
    setMsgs(p=>[...p,{role:"u",text:m}])
    setTyping(true)
    const qa = DEMO_QA.find(d=>d.q===m)||DEMO_QA[qi%DEMO_QA.length]
    setQi(i=>i+1)
    setTimeout(()=>{ setMsgs(p=>[...p,{role:"ai",text:qa.a}]); setTyping(false) },1100)
  }
  return (
    <div className="rounded-2xl overflow-hidden shadow-2xl" style={{background:"rgba(10,15,28,0.85)",backdropFilter:"blur(20px)",border:"1px solid rgba(255,255,255,0.08)"}}>
      <div className="flex items-center gap-2 px-4 py-3" style={{background:"rgba(255,255,255,0.04)",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
        <div className="w-3 h-3 rounded-full bg-red-500/80"/><div className="w-3 h-3 rounded-full bg-yellow-500/80"/><div className="w-3 h-3 rounded-full bg-green-500/80"/>
        <span className="ml-2 text-xs text-gray-400">CortexOS — Chat</span>
        <span className="ml-auto text-xs text-green-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block"/>Démo live</span>
      </div>
      <div className="h-56 overflow-y-auto p-4 space-y-3">
        {msgs.length===0&&<div className="text-center pt-2">
          <p className="text-xs text-gray-600 mb-3">Essayez :</p>
          <div className="flex flex-col gap-1.5">
            {DEMO_QA.map((d,i)=><button key={i} onClick={()=>send(d.q)} className="text-left px-3 py-2 rounded-xl text-xs text-gray-400 hover:text-white transition-all" style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.06)"}}>{d.q}</button>)}
          </div>
        </div>}
        {msgs.map((m,i)=>(
          <div key={i} className={`flex ${m.role==="u"?"justify-end":"justify-start"}`}>
            <div className={`max-w-[82%] px-3 py-2 text-xs rounded-xl whitespace-pre-wrap ${m.role==="u"?"text-white":"text-gray-200"}`}
              style={m.role==="u"?{background:"linear-gradient(135deg,#2563eb,#1d4ed8)",borderRadius:"12px 12px 3px 12px"}:{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:"12px 12px 12px 3px"}}>
              {m.role==="ai"&&<span className="text-blue-400 text-xs block mb-1">⬡ CortexOS</span>}
              {m.text.replace(/\*\*(.*?)\*\*/g,"$1")}
            </div>
          </div>
        ))}
        {typing&&<div className="flex justify-start"><div className="px-3 py-2 rounded-xl flex gap-1" style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.07)"}}>
          {[0,1,2].map(i=><div key={i} className="w-1.5 h-1.5 rounded-full bg-blue-400 typing-dot"/>)}</div></div>}
        <div ref={ref}/>
      </div>
      <div className="p-3 flex gap-2" style={{borderTop:"1px solid rgba(255,255,255,0.06)"}}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()}
          placeholder="Posez une question..." className="flex-1 bg-transparent text-xs text-white placeholder-gray-600 focus:outline-none"/>
        <button onClick={()=>send()} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all hover:scale-105" style={{background:"linear-gradient(135deg,#2563eb,#1d4ed8)"}}>→</button>
      </div>
    </div>
  )
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const FEATURES = [
  { icon:"💬", title:"Chat naturel", desc:"Interrogez comme vous parlez. L'IA comprend le contexte.", size:"col-span-1" },
  { icon:"🔍", title:"RAG vectoriel", desc:"Sources citées à chaque réponse. Zéro hallucination.", size:"col-span-1" },
  { icon:"📧", title:"Gmail + Drive", desc:"Connectez en 1 clic. L'IA lit vos vrais emails.", size:"col-span-2" },
  { icon:"🤖", title:"Agents autonomes", desc:"Créez des workflows multi-étapes automatisés.", size:"col-span-2" },
  { icon:"👥", title:"Multi-utilisateurs", desc:"Invitez votre équipe avec liens d'invitation.", size:"col-span-1" },
  { icon:"🔒", title:"Privé & sécurisé", desc:"JWT, isolation par tenant, vos données restent les vôtres.", size:"col-span-1" },
]
const PRICING = [
  { name:"Free", price:"0€", desc:"Pour tester", features:["5 Go","1 utilisateur","50 questions/j","CSV & TXT"], cta:"Commencer", hot:false },
  { name:"Starter", price:"9€", per:"/mois HT", desc:"Pour les indépendants", features:["50 Go","5 utilisateurs","Illimité","Gmail + Drive"], cta:"Essayer 14j", hot:true },
  { name:"Pro", price:"29€", per:"/mois HT", desc:"Pour les équipes", features:["Illimité","Illimité","Agents","Tout inclus"], cta:"Nous contacter", hot:false },
]
const TESTIMONIALS = [
  { name:"Sophie M.", role:"Fondatrice, Studio", av:"SM", color:"#7c3aed", text:"J'ai connecté Gmail en 5 min. Je retrouve n'importe quelle info en secondes." },
  { name:"Karim B.", role:"CEO, SaaS B2B", av:"KB", color:"#2563eb", text:"3 ans de données clients analysés en 30 secondes. Bluffant." },
  { name:"Marie-Claire D.", role:"Directrice Commerciale", av:"MC", color:"#059669", text:"Les sources citées dans chaque réponse nous donnent confiance totale." },
]

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const router = useRouter()
  const word = useTypewriter(WORDS)
  const [heroV, setHeroV] = useState(false)
  const f1 = useFade(0), f2 = useFade(100), f3 = useFade(200), f4 = useFade(0)
  useEffect(()=>{ setTimeout(()=>setHeroV(true),80) },[])

  return (
    <div className="relative min-h-screen text-white overflow-x-hidden" style={{background:"#050a14"}}>
      <ParticleBackground/>
      {/* Gradient orbs */}
      <div className="fixed pointer-events-none z-0" style={{top:-200,left:-200,width:600,height:600,borderRadius:"50%",background:"radial-gradient(circle,rgba(37,99,235,0.12) 0%,transparent 70%)"}}/>
      <div className="fixed pointer-events-none z-0" style={{bottom:-200,right:-200,width:500,height:500,borderRadius:"50%",background:"radial-gradient(circle,rgba(124,58,237,0.1) 0%,transparent 70%)"}}/>

      {/* Nav */}
      <nav className="relative z-50 flex items-center justify-between px-6 py-4" style={{borderBottom:"1px solid rgba(255,255,255,0.06)",background:"rgba(5,10,20,0.8)",backdropFilter:"blur(16px)",position:"sticky",top:0}}>
        <span className="text-lg font-bold" style={{background:"linear-gradient(135deg,#60a5fa,#a78bfa)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
          <span className="logo-animated">⬡</span> CortexOS
        </span>
        <div className="hidden md:flex items-center gap-6 text-sm text-gray-400">
          {["#features","#demo","#pricing"].map(h=><a key={h} href={h} className="hover:text-white transition-colors capitalize">{h.slice(1)}</a>)}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={()=>router.push("/login")} className="text-sm text-gray-400 hover:text-white px-3 py-1.5 transition-colors">Connexion</button>
          <button onClick={()=>router.push("/register")} className="text-sm px-4 py-2 rounded-xl font-medium text-white transition-all hover:scale-105"
            style={{background:"linear-gradient(135deg,#2563eb,#1d4ed8)",boxShadow:"0 4px 20px rgba(37,99,235,0.35)"}}>
            Commencer →
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 px-6 pt-24 pb-16 text-center max-w-5xl mx-auto">
        <div style={{opacity:heroV?1:0,transform:heroV?"none":"translateY(16px)",transition:"all 0.8s ease"}}>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs text-blue-300 mb-8"
            style={{background:"rgba(37,99,235,0.12)",border:"1px solid rgba(37,99,235,0.25)"}}>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"/>
            100+ fondateurs & PME l'utilisent déjà
          </div>
          <h1 className="text-5xl md:text-7xl font-black leading-tight mb-6 tracking-tight">
            Interrogez vos{" "}
            <span style={{background:"linear-gradient(135deg,#60a5fa,#a78bfa,#34d399)",backgroundSize:"200%",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",borderRight:"2px solid #60a5fa",paddingRight:"4px"}}>
              {word}
            </span>
            <br/><span className="text-gray-300">en langage naturel</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            CortexOS connecte Gmail, Drive, CSV et toutes vos données à une IA.<br/>
            Réponses instantanées avec sources citées.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <button onClick={()=>router.push("/register")}
              className="px-8 py-4 rounded-2xl text-base font-bold text-white transition-all hover:scale-105 active:scale-95"
              style={{background:"linear-gradient(135deg,#2563eb,#1d4ed8)",boxShadow:"0 8px 32px rgba(37,99,235,0.4)"}}>
              Créer mon espace gratuitement →
            </button>
            <a href="#demo" className="px-8 py-4 rounded-2xl text-base font-medium text-gray-300 hover:text-white transition-all text-center"
              style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)"}}>
              Voir la démo ↓
            </a>
          </div>
          <p className="text-sm text-gray-600">✓ Gratuit &nbsp;·&nbsp; ✓ Aucune carte &nbsp;·&nbsp; ✓ 2 minutes</p>
        </div>
      </section>

      {/* Social proof */}
      <div className="relative z-10 py-4" style={{borderTop:"1px solid rgba(255,255,255,0.05)",borderBottom:"1px solid rgba(255,255,255,0.05)",background:"rgba(255,255,255,0.02)"}}>
        <div className="max-w-4xl mx-auto flex flex-wrap justify-center gap-8 text-sm text-gray-500 px-6">
          {["🏆 100+ utilisateurs","📧 Gmail & Drive","⚡ Gemini 2.5 Flash","🔒 Données sécurisées","🌍 Déployé en production"].map(t=><span key={t}>{t}</span>)}
        </div>
      </div>

      {/* Video */}
      <section className="relative z-10 px-6 py-16 max-w-4xl mx-auto">
        <div ref={f1.ref} style={f1.style}>
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-2">Voir en 90 secondes</h2>
            <p className="text-gray-500 text-sm">Démo complète — Gmail → CSV → Chat avec sources</p>
          </div>
          <div className="rounded-2xl overflow-hidden" style={{boxShadow:"0 24px 64px rgba(0,0,0,0.6)",border:"1px solid rgba(255,255,255,0.08)",paddingBottom:"56.25%",position:"relative"}}>
            <iframe src="https://www.loom.com/embed/487712d1c1474d33aea29e318960f9e1?autoplay=0&hideEmbedTopBar=true"
              frameBorder="0" allowFullScreen className="absolute inset-0 w-full h-full"/>
          </div>
        </div>
      </section>

      {/* Demo */}
      <section id="demo" className="relative z-10 px-6 py-16 max-w-3xl mx-auto">
        <div ref={f2.ref} style={f2.style}>
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-2">Essayez maintenant</h2>
            <p className="text-gray-500 text-sm">Démo interactive — données fictives pré-chargées</p>
          </div>
          <DemoChat/>
          <p className="text-center text-xs text-gray-700 mt-3">* Démo avec données fictives. Vos données restent privées.</p>
        </div>
      </section>

      {/* Features bento */}
      <section id="features" className="relative z-10 px-6 py-16 max-w-5xl mx-auto">
        <div ref={f3.ref} style={f3.style}>
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">Tout ce qu&apos;il vous faut</h2>
            <p className="text-gray-500">Connectez, interrogez, automatisez.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {FEATURES.map((f,i)=>(
              <div key={i} className={`p-5 rounded-2xl transition-all hover:scale-[1.02] cursor-default ${f.size}`}
                style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",backdropFilter:"blur(8px)",boxShadow:"0 4px 24px rgba(0,0,0,0.3)"}}>
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="text-sm font-bold mb-1">{f.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="relative z-10 px-6 py-16">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">Ce qu&apos;ils en disent</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t,i)=>(
              <div key={i} className="p-6 rounded-2xl space-y-4" style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)"}}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold" style={{background:t.color}}>{t.av}</div>
                  <div><p className="text-sm font-medium">{t.name}</p><p className="text-xs text-gray-500">{t.role}</p></div>
                </div>
                <div className="text-yellow-400 text-xs">★★★★★</div>
                <p className="text-gray-300 text-sm leading-relaxed">&ldquo;{t.text}&rdquo;</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative z-10 px-6 py-16 max-w-5xl mx-auto">
        <div ref={f4.ref} style={f4.style}>
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">Tarifs simples</h2>
            <p className="text-gray-500">Commencez gratuitement, évoluez quand vous voulez.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PRICING.map((p,i)=>(
              <div key={i} className="relative p-6 rounded-2xl space-y-6"
                style={p.hot ? {background:"rgba(37,99,235,0.08)",border:"1px solid rgba(37,99,235,0.4)",boxShadow:"0 0 40px rgba(37,99,235,0.15)"} : {background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)"}}>
                {p.hot&&<div className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs px-3 py-1 rounded-full font-medium text-white" style={{background:"linear-gradient(135deg,#2563eb,#7c3aed)"}}>Populaire</div>}
                <div><h3 className="text-lg font-bold">{p.name}</h3><p className="text-gray-500 text-sm">{p.desc}</p></div>
                <div className="flex items-end gap-1"><span className="text-4xl font-black">{p.price}</span>{p.per&&<span className="text-gray-500 text-sm mb-1">{p.per}</span>}</div>
                <ul className="space-y-2">{p.features.map((f,j)=><li key={j} className="flex items-center gap-2 text-sm text-gray-300"><span className="text-green-400">✓</span>{f}</li>)}</ul>
                <button onClick={()=>router.push("/register")}
                  className="w-full py-3 rounded-xl text-sm font-medium transition-all hover:scale-105 active:scale-95"
                  style={p.hot?{background:"linear-gradient(135deg,#2563eb,#1d4ed8)",color:"white",boxShadow:"0 4px 20px rgba(37,99,235,0.3)"}:{background:"rgba(255,255,255,0.06)",color:"white",border:"1px solid rgba(255,255,255,0.1)"}}>
                  {p.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 px-6 py-24 text-center">
        <div className="max-w-2xl mx-auto p-12 rounded-3xl" style={{background:"linear-gradient(135deg,rgba(37,99,235,0.15),rgba(124,58,237,0.1))",border:"1px solid rgba(255,255,255,0.08)",boxShadow:"0 24px 64px rgba(37,99,235,0.15)"}}>
          <div className="text-5xl mb-4" style={{filter:"drop-shadow(0 0 20px rgba(96,165,250,0.5))"}}>
            <span className="logo-animated" style={{fontSize:"inherit"}}>⬡</span>
          </div>
          <h2 className="text-3xl font-bold mb-4">Prêt à commencer ?</h2>
          <p className="text-gray-400 mb-8">2 minutes. Aucune carte. Gratuit pour toujours.</p>
          <button onClick={()=>router.push("/register")}
            className="px-8 py-4 rounded-2xl text-base font-bold text-white transition-all hover:scale-105 active:scale-95"
            style={{background:"linear-gradient(135deg,#2563eb,#1d4ed8)",boxShadow:"0 8px 32px rgba(37,99,235,0.4)"}}>
            Créer mon compte gratuitement →
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-6" style={{borderTop:"1px solid rgba(255,255,255,0.05)"}}>
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-600">
          <span>⬡ CortexOS — © 2026 Thibaut Affo</span>
          <div className="flex gap-6">{[["Connexion","/login"],["Inscription","/register"],["Chat","/chat"]].map(([l,h])=><a key={h} href={h} className="hover:text-gray-300 transition-colors">{l}</a>)}</div>
        </div>
      </footer>
    </div>
  )
}
