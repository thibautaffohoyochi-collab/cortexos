"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

// ─── Animated gradient mesh background ───────────────────────────────────────
function MeshBackground() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      <div style={{position:"absolute",width:"60vw",height:"60vw",borderRadius:"50%",top:"-20vw",left:"50%",transform:"translateX(-50%)",background:"radial-gradient(circle,rgba(37,99,235,0.08) 0%,transparent 65%)",filter:"blur(40px)"}}/>
      <div style={{position:"absolute",width:"40vw",height:"40vw",borderRadius:"50%",bottom:"0",left:"-10vw",background:"radial-gradient(circle,rgba(124,58,237,0.06) 0%,transparent 65%)",filter:"blur(40px)"}}/>
      <div style={{position:"absolute",width:"30vw",height:"30vw",borderRadius:"50%",bottom:"10vh",right:"-5vw",background:"radial-gradient(circle,rgba(5,150,105,0.05) 0%,transparent 65%)",filter:"blur(40px)"}}/>
    </div>
  )
}

// ─── Typewriter ───────────────────────────────────────────────────────────────
const WORDS = ["emails", "fichiers Drive", "données clients", "rapports"]
function useTypewriter(words: string[]) {
  const [i, setI] = useState(0); const [d, setD] = useState(""); const [del, setDel] = useState(false)
  useEffect(() => {
    const w = words[i]
    const t = del ? setTimeout(() => { setD(p=>p.slice(0,-1)); if(d.length===1){setDel(false);setI(x=>(x+1)%words.length)} },50)
               : setTimeout(() => { setD(w.slice(0,d.length+1)); if(d.length===w.length) setTimeout(()=>setDel(true),2000) },95)
    return ()=>clearTimeout(t)
  },[d,del,i,words])
  return d
}

// ─── Demo chat ────────────────────────────────────────────────────────────────
const QA = [
  {q:"Quels sont mes concurrents ?", a:"D'après votre fichier d'analyse :\n\n• **Wedge Studio** — Awards Dieline, premium\n• **Baboon Creation** — Motion design\n• **ROYALTRI** — Agence complète\n\n*Source : Concurrence_Thibaut_Affo.csv*"},
  {q:"Résume mes emails de la semaine", a:"**5 emails importants :**\n\n• Stripe — Paiement 1 200€ reçu\n• GitHub — Alerte sécurité résolue\n• Adobe — Invitation événement créatif\n\n*Source : Gmail (18 emails)*"},
  {q:"Analyse ma position vs Wedge Studio", a:"**Vos avantages :**\n• Prix 3-5x plus accessibles\n• Intégration IA génératif unique\n\n**Leur avantage :**\n• Awards internationaux\n\n*Score de menace : 6/10*"},
]

function DemoChat() {
  const [msgs, setMsgs] = useState<{r:"u"|"a";t:string}[]>([])
  const [inp, setInp] = useState(""); const [typing, setTyping] = useState(false); const [qi, setQi] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(()=>{ref.current?.scrollIntoView({behavior:"smooth"})},[msgs])

  const send = (txt?: string) => {
    const m = txt||inp.trim(); if(!m||typing) return
    setInp(""); setMsgs(p=>[...p,{r:"u",t:m}]); setTyping(true)
    const qa = QA.find(q=>q.q===m)||QA[qi%QA.length]; setQi(x=>x+1)
    setTimeout(()=>{setMsgs(p=>[...p,{r:"a",t:qa.a}]);setTyping(false)},1000)
  }

  const renderMsg = (t: string) => t.split("\n").map((l,i)=>{
    const h = l.replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/\*(.*?)\*/g,"<em style='color:#94a3b8'>$1</em>")
    if(l.startsWith("•")) return <li key={i} className="ml-3 text-xs text-gray-300 list-disc" dangerouslySetInnerHTML={{__html:h.slice(1)}}/>
    if(!l.trim()) return <div key={i} className="h-1.5"/>
    return <p key={i} className="text-xs text-gray-200 leading-relaxed" dangerouslySetInnerHTML={{__html:h}}/>
  })

  return (
    <div className="relative rounded-2xl overflow-hidden" style={{background:"rgba(8,12,22,0.9)",border:"1px solid rgba(255,255,255,0.07)",boxShadow:"0 32px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)"}}>
      {/* Top bar */}
      <div className="flex items-center gap-2 px-4 py-3" style={{borderBottom:"1px solid rgba(255,255,255,0.05)",background:"rgba(255,255,255,0.02)"}}>
        <div className="w-2.5 h-2.5 rounded-full bg-red-500/70"/><div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70"/><div className="w-2.5 h-2.5 rounded-full bg-green-500/70"/>
        <span className="ml-2 text-xs text-gray-500">cortexos — chat</span>
        <div className="ml-auto flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"/><span className="text-xs text-green-400">live demo</span></div>
      </div>
      {/* Messages */}
      <div className="h-52 overflow-y-auto p-4 space-y-3">
        {msgs.length===0 && (
          <div className="space-y-1.5 pt-1">
            <p className="text-xs text-gray-600 mb-3">Essayez une question :</p>
            {QA.map((q,i)=>(
              <button key={i} onClick={()=>send(q.q)} className="w-full text-left px-3 py-2 rounded-xl text-xs text-gray-400 hover:text-white transition-all hover:scale-[1.01]" style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)"}}>
                {q.q}
              </button>
            ))}
          </div>
        )}
        {msgs.map((m,i)=>(
          <div key={i} className={`flex ${m.r==="u"?"justify-end":"justify-start"}`}>
            <div className={`max-w-[85%] px-3 py-2.5 rounded-2xl ${m.r==="u"?"text-white":"text-gray-200"}`}
              style={m.r==="u"?{background:"linear-gradient(135deg,#2563eb,#1d4ed8)",borderRadius:"14px 14px 3px 14px"}:{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:"14px 14px 14px 3px"}}>
              {m.r==="a"&&<p className="text-blue-400 text-xs font-medium mb-1.5">⬡ CortexOS</p>}
              {renderMsg(m.t)}
            </div>
          </div>
        ))}
        {typing&&<div className="flex"><div className="px-3 py-2 rounded-2xl flex gap-1" style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.06)"}}>{[0,1,2].map(i=><div key={i} className="w-1.5 h-1.5 rounded-full bg-blue-400 typing-dot"/>)}</div></div>}
        <div ref={ref}/>
      </div>
      {/* Input */}
      <div className="p-3 flex gap-2" style={{borderTop:"1px solid rgba(255,255,255,0.05)"}}>
        <input value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()}
          placeholder="Posez une question sur vos données..." className="flex-1 bg-transparent text-xs text-white placeholder-gray-600 focus:outline-none"/>
        <button onClick={()=>send()} className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition-all hover:scale-105 active:scale-95" style={{background:"linear-gradient(135deg,#2563eb,#1d4ed8)"}}>→</button>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Landing() {
  const router = useRouter()
  const word = useTypewriter(WORDS)
  const [v, setV] = useState(false)
  useEffect(()=>{setTimeout(()=>setV(true),60)},[])

  return (
    <div className="min-h-screen text-white overflow-x-hidden" style={{background:"#060a14"}}>
      <MeshBackground/>

      {/* ── Nav ── */}
      <nav className="relative z-50 flex items-center justify-between px-8 py-5" style={{position:"sticky",top:0,background:"rgba(6,10,20,0.85)",backdropFilter:"blur(20px)",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
        <div className="flex items-center gap-2">
          <span className="logo-animated text-xl">⬡</span>
          <span className="text-base font-bold tracking-tight" style={{background:"linear-gradient(135deg,#e2e8f0,#94a3b8)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>CortexOS</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm text-gray-400">
          <a href="#demo" className="hover:text-white transition-colors">Démo</a>
          <a href="#features" className="hover:text-white transition-colors">Fonctionnalités</a>
          <a href="#pricing" className="hover:text-white transition-colors">Tarifs</a>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={()=>router.push("/login")} className="text-sm text-gray-400 hover:text-white px-4 py-2 transition-colors">Connexion</button>
          <button onClick={()=>router.push("/register")} className="text-sm font-semibold px-5 py-2 rounded-xl text-white transition-all hover:scale-105 active:scale-95"
            style={{background:"linear-gradient(135deg,#2563eb,#1d4ed8)",boxShadow:"0 4px 20px rgba(37,99,235,0.3)"}}>
            Commencer →
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative z-10 max-w-4xl mx-auto px-8 pt-28 pb-20 text-center">
        <div style={{opacity:v?1:0,transform:v?"none":"translateY(20px)",transition:"all 0.9s cubic-bezier(0.16,1,0.3,1)"}}>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-10"
            style={{background:"rgba(37,99,235,0.1)",border:"1px solid rgba(37,99,235,0.2)",color:"#93c5fd"}}>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"/>
            Nouveau · Gemini 2.5 Flash intégré
          </div>

          <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-[1.05] mb-8" style={{letterSpacing:"-0.03em"}}>
            <span style={{background:"linear-gradient(180deg,#f1f5f9 0%,#94a3b8 100%)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
              Interrogez vos
            </span>
            <br/>
            <span style={{background:"linear-gradient(135deg,#60a5fa 0%,#a78bfa 50%,#34d399 100%)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",borderRight:"3px solid #60a5fa",paddingRight:"6px"}}>
              {word}
            </span>
          </h1>

          <p className="text-lg text-gray-400 max-w-xl mx-auto mb-12 leading-relaxed" style={{fontWeight:400}}>
            Connectez Gmail, Drive et vos fichiers. Posez n&apos;importe quelle question.<br/>
            Obtenez des réponses avec les sources citées, en secondes.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button onClick={()=>router.push("/register")}
              className="px-8 py-4 rounded-2xl text-base font-bold text-white transition-all hover:scale-105 active:scale-95 w-full sm:w-auto"
              style={{background:"linear-gradient(135deg,#2563eb,#1d4ed8)",boxShadow:"0 8px 40px rgba(37,99,235,0.35)"}}>
              Commencer gratuitement
            </button>
            <a href="#demo" className="flex items-center gap-2 px-6 py-4 rounded-2xl text-sm font-medium text-gray-400 hover:text-white transition-all w-full sm:w-auto justify-center"
              style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)"}}>
              <span>Voir la démo</span> <span>↓</span>
            </a>
          </div>

          <p className="text-xs text-gray-600 mt-8">Gratuit pour commencer · Aucune carte requise · Setup en 2 min</p>
        </div>
      </section>

      {/* ── Demo ── */}
      <section id="demo" className="relative z-10 max-w-2xl mx-auto px-8 pb-24">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-2" style={{color:"#f1f5f9"}}>Essayez maintenant</h2>
          <p className="text-sm text-gray-500">Démo interactive · données fictives pré-chargées</p>
        </div>
        <DemoChat/>
      </section>

      {/* ── Features ── */}
      <section id="features" className="relative z-10 max-w-4xl mx-auto px-8 pb-24">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold mb-3" style={{color:"#f1f5f9"}}>Tout dans un seul outil</h2>
          <p className="text-gray-500 text-sm">Conçu pour les équipes qui veulent aller vite.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {icon:"💬",title:"Chat naturel",desc:"Posez n'importe quelle question sur vos données. L'IA comprend le contexte et cite ses sources.",color:"#2563eb"},
            {icon:"🔗",title:"Toutes vos sources",desc:"Gmail, Drive, CSV, Excel. Connectez en un clic. Tout est indexé et interrogeable.",color:"#7c3aed"},
            {icon:"🤖",title:"Agents autonomes",desc:"Créez des workflows automatisés. L'IA exécute chaque étape et vous envoie le résultat.",color:"#059669"},
          ].map((f,i)=>(
            <div key={i} className="p-6 rounded-2xl transition-all hover:scale-[1.02] hover:-translate-y-1 cursor-default group"
              style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",boxShadow:"0 4px 24px rgba(0,0,0,0.3)"}}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-4" style={{background:`${f.color}20`,border:`1px solid ${f.color}30`}}>{f.icon}</div>
              <h3 className="text-base font-semibold mb-2" style={{color:"#f1f5f9"}}>{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Social proof ── */}
      <section className="relative z-10 max-w-4xl mx-auto px-8 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {av:"SM",color:"#7c3aed",name:"Sophie M.",role:"Fondatrice, Studio",text:"Gmail connecté en 5 min. Je retrouve n'importe quelle info instantanément."},
            {av:"KB",color:"#2563eb",name:"Karim B.",role:"CEO, SaaS B2B",text:"3 ans de données clients analysés en 30 secondes. Bluffant."},
            {av:"MD",color:"#059669",name:"Marie D.",role:"Directrice Commerciale",text:"Les sources citées dans chaque réponse nous donnent une confiance totale."},
          ].map((t,i)=>(
            <div key={i} className="p-5 rounded-2xl" style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)"}}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold" style={{background:t.color}}>{t.av}</div>
                <div><p className="text-sm font-medium" style={{color:"#f1f5f9"}}>{t.name}</p><p className="text-xs text-gray-500">{t.role}</p></div>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">&ldquo;{t.text}&rdquo;</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="relative z-10 max-w-4xl mx-auto px-8 pb-24">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-3" style={{color:"#f1f5f9"}}>Tarifs simples</h2>
          <p className="text-sm text-gray-500">Commencez gratuitement, évoluez sans friction.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          {[
            {name:"Free",price:"0€",per:"",features:["5 Go de données","1 utilisateur","50 questions/jour","CSV & TXT"],cta:"Commencer",hot:false},
            {name:"Starter",price:"9€",per:"/mois HT",features:["50 Go de données","5 utilisateurs","Illimité","Gmail + Drive","Agents autonomes"],cta:"Essayer 14 jours",hot:true},
            {name:"Pro",price:"29€",per:"/mois HT",features:["Illimité","Équipe illimitée","Veille concurrentielle","Tout inclus","Support prioritaire"],cta:"Contacter",hot:false},
          ].map((p,i)=>(
            <div key={i} className="relative p-6 rounded-2xl" style={p.hot?{background:"rgba(37,99,235,0.06)",border:"1px solid rgba(37,99,235,0.35)",boxShadow:"0 0 50px rgba(37,99,235,0.1)"}:{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)"}}>
              {p.hot&&<div className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-xs font-bold px-4 py-1 rounded-full" style={{background:"linear-gradient(135deg,#2563eb,#7c3aed)",color:"white"}}>Le plus populaire</div>}
              <p className="text-sm font-semibold mb-1" style={{color:"#94a3b8"}}>{p.name}</p>
              <div className="flex items-end gap-1 mb-6">
                <span className="text-4xl font-black" style={{color:"#f1f5f9"}}>{p.price}</span>
                {p.per&&<span className="text-gray-500 text-sm mb-1">{p.per}</span>}
              </div>
              <ul className="space-y-2.5 mb-6">
                {p.features.map((f,j)=>(
                  <li key={j} className="flex items-center gap-2 text-sm text-gray-400">
                    <span style={{color:"#34d399",fontSize:"12px"}}>✓</span> {f}
                  </li>
                ))}
              </ul>
              <button onClick={()=>router.push("/register")}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={p.hot?{background:"linear-gradient(135deg,#2563eb,#1d4ed8)",color:"white",boxShadow:"0 4px 20px rgba(37,99,235,0.3)"}:{background:"rgba(255,255,255,0.05)",color:"#e2e8f0",border:"1px solid rgba(255,255,255,0.08)"}}>
                {p.cta}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative z-10 max-w-2xl mx-auto px-8 pb-32 text-center">
        <div className="p-12 rounded-3xl" style={{background:"linear-gradient(135deg,rgba(37,99,235,0.08),rgba(124,58,237,0.06))",border:"1px solid rgba(255,255,255,0.07)"}}>
          <span className="logo-animated text-4xl mb-6 block">⬡</span>
          <h2 className="text-3xl font-black mb-4" style={{color:"#f1f5f9",letterSpacing:"-0.02em"}}>Prêt à commencer ?</h2>
          <p className="text-gray-500 mb-8 text-sm">2 minutes. Gratuit. Aucune carte requise.</p>
          <button onClick={()=>router.push("/register")}
            className="px-10 py-4 rounded-2xl text-base font-bold text-white transition-all hover:scale-105 active:scale-95"
            style={{background:"linear-gradient(135deg,#2563eb,#1d4ed8)",boxShadow:"0 8px 40px rgba(37,99,235,0.35)"}}>
            Créer mon espace gratuitement →
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 px-8 py-8" style={{borderTop:"1px solid rgba(255,255,255,0.05)"}}>
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="logo-animated">⬡</span>
            <span className="text-sm font-semibold" style={{color:"#64748b"}}>CortexOS</span>
            <span className="text-xs text-gray-700 ml-2">© 2026 Thibaut Affo</span>
          </div>
          <div className="flex gap-6 text-sm text-gray-600">
            <a href="/login" className="hover:text-gray-400 transition-colors">Connexion</a>
            <a href="/register" className="hover:text-gray-400 transition-colors">Inscription</a>
            <a href="#pricing" className="hover:text-gray-400 transition-colors">Tarifs</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
