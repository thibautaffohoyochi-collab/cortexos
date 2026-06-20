"use client"
import { useEffect, useRef, useState, useCallback } from "react"
import Link from "next/link"

/* ── hooks ── */
function useTypewriter(words: string[]) {
  const [i,setI]=useState(0);const[d,setD]=useState("");const[del,setDel]=useState(false)
  useEffect(()=>{
    const w=words[i]
    const t=del?setTimeout(()=>{setD(p=>p.slice(0,-1));if(d.length===1){setDel(false);setI(x=>(x+1)%words.length)}},40)
              :setTimeout(()=>{setD(w.slice(0,d.length+1));if(d.length===w.length)setTimeout(()=>setDel(true),2200)},75)
    return()=>clearTimeout(t)
  },[d,del,i,words])
  return d
}
function useFade(delay=0){
  const ref=useRef<HTMLDivElement>(null);const[v,setV]=useState(false)
  useEffect(()=>{
    const o=new IntersectionObserver(([e])=>{if(e.isIntersecting)setV(true)},{threshold:0.08})
    if(ref.current)o.observe(ref.current);return()=>o.disconnect()
  },[])
  return{ref,style:{transition:`opacity .65s ease ${delay}ms,transform .65s ease ${delay}ms`,opacity:v?1:0,transform:v?"none":"translateY(24px)"}}
}

const WORDS=["Gmail","Google Drive","fichiers CSV","données clients","rapports Excel"]
const QA=[
  {q:"Quels sont mes concurrents à Montréal ?",a:"D'après votre analyse :\n\n• **Wedge Studio** — Awards Dieline, positionnement premium\n• **Baboon Creation** — Spécialiste motion design\n• **ROYALTRI** — Agence complète marketing digital\n\n📄 Concurrence_Thibaut_Affo.csv"},
  {q:"Résume mes emails de la semaine",a:"**5 emails importants :**\n\n• Stripe — Paiement 1 200€ reçu ✓\n• GitHub — Alerte sécurité résolue ✓\n• Adobe Express — Invitation créative\n• Client Dupont — Demande de devis\n• Notion — Mise à jour équipe\n\n📄 Gmail (23 emails analysés)"},
  {q:"Comment me différencier de Wedge Studio ?",a:"**Stratégie recommandée :**\n\n1. Valorisez votre IA génératif — unique sur le marché\n2. Positionnez-vous sur les PME (tarifs 3-5x plus bas)\n3. Développez le packaging comme spécialité\n\nScore de menace : 6/10 — gérable\n\n📄 Concurrence_Thibaut_Affo.csv"},
]

/* ── Demo chat ── */
function DemoChat(){
  const[msgs,setMsgs]=useState<{r:"u"|"a";t:string}[]>([]);const[inp,setInp]=useState("");const[typing,setTyping]=useState(false);const[qi,setQi]=useState(0)
  const ref=useRef<HTMLDivElement>(null)
  useEffect(()=>{ref.current?.scrollIntoView({behavior:"smooth"})},[msgs])
  const send=useCallback((txt?:string)=>{
    const m=txt||inp.trim();if(!m||typing)return
    setInp("");setMsgs(p=>[...p,{r:"u",t:m}]);setTyping(true)
    const qa=QA.find(q=>q.q===m)||QA[qi%QA.length];setQi(x=>x+1)
    setTimeout(()=>{setMsgs(p=>[...p,{r:"a",t:qa.a}]);setTyping(false)},900)
  },[inp,typing,qi])
  const render=(t:string)=>t.split("\n").map((l,i)=>{
    const h=l.replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>")
    if(l.startsWith("•"))return<li key={i} className="ml-4 list-disc text-[13px] text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{__html:h.slice(1)}}/>
    if(/^\d\./.test(l))return<li key={i} className="ml-4 list-decimal text-[13px] text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{__html:h}}/>
    if(!l.trim())return<div key={i} className="h-2"/>
    return<p key={i} className="text-[13px] text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{__html:h}}/>
  })
  return(
    <div className="rounded-3xl overflow-hidden" style={{background:"#fff",border:"1px solid #e5e7eb",boxShadow:"0 32px 80px rgba(0,0,0,0.1),0 0 0 1px rgba(0,0,0,0.04)"}}>
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100 bg-gray-50/80">
        <div className="w-3 h-3 rounded-full bg-red-400/70"/><div className="w-3 h-3 rounded-full bg-amber-400/70"/><div className="w-3 h-3 rounded-full bg-green-400/70"/>
        <span className="ml-2 text-xs text-gray-400 font-medium">CortexOS — assistant</span>
        <div className="ml-auto flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"/><span className="text-xs text-green-600 font-medium">démo live</span></div>
      </div>
      <div className="h-72 overflow-y-auto p-5 space-y-3 bg-gray-50/30">
        {msgs.length===0&&<div className="space-y-2">
          <p className="text-xs text-gray-400 mb-3 font-medium">Essayez une question ↓</p>
          {QA.map((q,i)=><button key={i} onClick={()=>send(q.q)} className="w-full text-left px-4 py-3 rounded-2xl text-sm text-gray-600 hover:text-gray-900 hover:bg-white transition-all hover:shadow-sm border border-gray-200 bg-white/60">{q.q}</button>)}
        </div>}
        {msgs.map((m,i)=>(
          <div key={i} className={`flex ${m.r==="u"?"justify-end":"justify-start"}`}>
            <div className="max-w-[85%] px-4 py-3 rounded-2xl"
              style={m.r==="u"?{background:"#1d1d1f",borderRadius:"18px 18px 4px 18px"}:{background:"#fff",border:"1px solid #e5e7eb",borderRadius:"18px 18px 18px 4px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
              {m.r==="a"&&<p className="text-xs font-semibold text-blue-600 mb-1.5">⬡ CortexOS</p>}
              {m.r==="u"?<p className="text-[13px] text-white">{m.t}</p>:<div>{render(m.t)}</div>}
            </div>
          </div>
        ))}
        {typing&&<div className="flex"><div className="px-4 py-3 rounded-2xl bg-white border border-gray-200 flex gap-1 shadow-sm">{[0,1,2].map(i=><div key={i} className="w-1.5 h-1.5 rounded-full bg-gray-400 typing-dot"/>)}</div></div>}
        <div ref={ref}/>
      </div>
      <div className="flex gap-2 p-4 border-t border-gray-100 bg-white">
        <input value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()}
          placeholder="Posez une question sur vos données…"
          className="flex-1 text-sm text-gray-800 placeholder-gray-400 focus:outline-none bg-transparent"/>
        <button onClick={()=>send()} className="px-5 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90" style={{background:"#1d1d1f",color:"#fff"}}>→</button>
      </div>
    </div>
  )
}

/* ── Navbar ── */
function Navbar(){
  const[scrolled,setScrolled]=useState(false)
  useEffect(()=>{const h=()=>setScrolled(window.scrollY>20);window.addEventListener("scroll",h);return()=>window.removeEventListener("scroll",h)},[])
  return(
    <nav className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{background:scrolled?"rgba(255,255,255,0.9)":"rgba(255,255,255,0.7)",backdropFilter:"blur(20px)",borderBottom:scrolled?"1px solid #e5e7eb":"1px solid transparent"}}>
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-gray-900 tracking-tight">⬡ CortexOS</span>
        </div>
        <div className="hidden md:flex items-center gap-7 text-sm text-gray-500">
          <a href="#fonctionnalites" className="hover:text-gray-900 transition-colors">Fonctionnalités</a>
          <a href="#demo" className="hover:text-gray-900 transition-colors">Démo</a>
          <a href="#comment" className="hover:text-gray-900 transition-colors">Comment ça marche</a>
          <a href="#tarifs" className="hover:text-gray-900 transition-colors">Tarifs</a>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Connexion</Link>
          <Link href="/register" className="px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90" style={{background:"#1d1d1f",color:"#fff"}}>
            Démarrer gratuitement
          </Link>
        </div>
      </div>
    </nav>
  )
}

/* ── Hero ── */
function Hero(){
  const word=useTypewriter(WORDS)
  const[v,setV]=useState(false)
  useEffect(()=>{setTimeout(()=>setV(true),80)},[])
  return(
    <section className="min-h-screen flex flex-col items-center justify-center pt-14 pb-20 px-6 text-center" style={{background:"#fbfbfd"}}>
      <div style={{opacity:v?1:0,transform:v?"none":"translateY(20px)",transition:"all 0.9s cubic-bezier(0.16,1,0.3,1)"}}>
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-8 border" style={{background:"#f5f5f7",borderColor:"#d2d2d7",color:"#6e6e73"}}>
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"/>
          Accès gratuit · Gemini 2.5 Flash
        </div>
        <h1 className="text-6xl md:text-8xl font-black tracking-tight mb-6" style={{color:"#1d1d1f",letterSpacing:"-0.04em",lineHeight:"1.0"}}>
          Interrogez vos<br/>
          <span style={{color:"#0066cc"}}>{word}<span style={{borderRight:"3px solid #0066cc",marginLeft:"2px",animation:"blink 1s infinite"}}>&nbsp;</span></span><br/>
          comme un collègue.
        </h1>
        <p className="text-xl md:text-2xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed" style={{fontWeight:400}}>
          CortexOS centralise Gmail, Drive, CSV et Excel.<br className="hidden md:block"/>
          Réponses instantanées. Sources toujours citées.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link href="/register" className="px-8 py-4 rounded-2xl text-base font-semibold transition-all hover:opacity-90 hover:scale-[1.02]" style={{background:"#1d1d1f",color:"#fff",boxShadow:"0 4px 20px rgba(0,0,0,0.15)"}}>
            Créer mon espace gratuitement
          </Link>
          <a href="#demo" className="flex items-center gap-2 px-7 py-4 rounded-2xl text-base font-semibold transition-all hover:bg-gray-100" style={{color:"#0066cc"}}>
            Voir la démo ↓
          </a>
        </div>
        <p className="text-xs text-gray-400 mt-5">✓ Aucune carte requise · ✓ Configuration en 2 minutes · ✓ Gratuit pour toujours</p>
      </div>

      {/* Floating demo preview */}
      <div className="mt-20 w-full max-w-3xl" style={{opacity:v?1:0,transform:v?"none":"translateY(40px)",transition:"all 1.1s cubic-bezier(0.16,1,0.3,1) 0.2s"}}>
        <div className="relative">
          <div className="absolute -inset-6 rounded-[2.5rem]" style={{background:"linear-gradient(135deg,rgba(0,102,204,0.08),rgba(99,102,241,0.06))",filter:"blur(20px)"}}/>
          <DemoChat/>
        </div>
      </div>

      {/* Trust */}
      <div className="mt-16 flex flex-col items-center gap-4" style={{opacity:v?1:0,transition:"opacity 1s ease 0.5s"}}>
        <div className="flex -space-x-2">
          {["#0066cc","#6366f1","#059669","#dc2626","#d97706"].map((c,i)=>(
            <div key={i} className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold text-white" style={{background:c}}>
              {["M","K","S","A","T"][i]}
            </div>
          ))}
        </div>
        <p className="text-sm text-gray-500"><strong className="text-gray-800">2 400+</strong> équipes font confiance à CortexOS</p>
      </div>
    </section>
  )
}

/* ── Logos bar ── */
function LogosBar(){
  const LOGOS=["Stripe","Notion","Figma","Vercel","Linear","Supabase","GitHub"]
  return(
    <section className="py-10 border-y" style={{background:"#f5f5f7",borderColor:"#e5e7eb"}}>
      <p className="text-center text-xs font-semibold tracking-widest text-gray-400 uppercase mb-6">Utilisé par des équipes dans des entreprises comme</p>
      <div className="flex flex-wrap justify-center gap-10">
        {LOGOS.map(l=><span key={l} className="text-gray-400 font-semibold text-sm hover:text-gray-700 transition-colors cursor-default">{l}</span>)}
      </div>
    </section>
  )
}

/* ── Features ── */
const FEATURES=[
  {icon:"💬",title:"Chat en langage naturel",desc:"Posez vos questions comme à un collègue. CortexOS comprend le contexte, les comparaisons, les dates.",accent:"#0066cc"},
  {icon:"📋",title:"Sources toujours citées",desc:"Chaque réponse indique précisément quel fichier ou email a été utilisé. Zéro hallucination.",accent:"#6366f1"},
  {icon:"🔗",title:"Toutes vos données",desc:"Gmail, Drive, CSV, Excel, PDF. Connectez tout en quelques clics, sans une seule ligne de code.",accent:"#059669"},
  {icon:"⚡",title:"Réponses en secondes",desc:"Moteur vectoriel optimisé. Même sur des milliers de documents, les résultats arrivent instantanément.",accent:"#d97706"},
  {icon:"👥",title:"Multi-utilisateurs",desc:"Invitez votre équipe, gérez les permissions. Chacun accède uniquement à ce qui le concerne.",accent:"#ec4899"},
  {icon:"🔒",title:"Privé & sécurisé",desc:"Chiffrement AES-256, isolation par espace de travail. Vos données restent les vôtres.",accent:"#6b7280"},
]

function Features(){
  const title=useFade(0)
  const s0=useFade(0),s1=useFade(80),s2=useFade(160),s3=useFade(240),s4=useFade(320),s5=useFade(400)
  const fades=[s0,s1,s2,s3,s4,s5]
  return(
    <section id="fonctionnalites" className="py-28" style={{background:"#fbfbfd"}}>
      <div className="max-w-6xl mx-auto px-6">
        <div ref={title.ref} style={title.style} className="text-center mb-16">
          <p className="text-sm font-semibold text-blue-600 mb-3 uppercase tracking-wider">Fonctionnalités</p>
          <h2 className="text-5xl font-black tracking-tight mb-4" style={{color:"#1d1d1f",letterSpacing:"-0.03em"}}>Tout ce dont vous avez besoin.</h2>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto">Un seul outil pour centraliser, interroger et exploiter toutes vos données internes.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f,i)=>(
            <div key={i} ref={fades[i].ref}
              className="group p-7 rounded-3xl border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-default"
              style={{...fades[i].style,background:"#fff",borderColor:"#e5e7eb"}}>
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl mb-5" style={{background:`${f.accent}12`}}>
                {f.icon}
              </div>
              <h3 className="font-bold text-gray-900 text-base mb-2">{f.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── Demo section ── */
function DemoSection(){
  const title=useFade(0);const chat=useFade(150)
  return(
    <section id="demo" className="py-28" style={{background:"#f5f5f7"}}>
      <div className="max-w-4xl mx-auto px-6">
        <div ref={title.ref} style={title.style} className="text-center mb-12">
          <p className="text-sm font-semibold text-blue-600 mb-3 uppercase tracking-wider">Démo interactive</p>
          <h2 className="text-5xl font-black tracking-tight mb-4" style={{color:"#1d1d1f",letterSpacing:"-0.03em"}}>Essayez maintenant.</h2>
          <p className="text-xl text-gray-500 max-w-xl mx-auto">Posez une question — CortexOS répond avec les sources, en temps réel.</p>
        </div>
        <div ref={chat.ref} style={chat.style} className="max-w-2xl mx-auto">
          <DemoChat/>
          <p className="text-center text-xs text-gray-400 mt-4">Données fictives pour la démo · Vos vraies données restent privées</p>
        </div>
      </div>
    </section>
  )
}

/* ── How it works ── */
const STEPS=[
  {n:"01",title:"Connectez vos sources",desc:"Liez Gmail, Drive, CSV ou Excel en quelques clics. Aucun code requis."},
  {n:"02",title:"L'IA indexe tout",desc:"CortexOS analyse, structure et vectorise vos données automatiquement."},
  {n:"03",title:"Posez vos questions",desc:"Interrogez en français comme si vous parliez à un collègue expert."},
  {n:"04",title:"Recevez des réponses sourcées",desc:"Chaque réponse cite sa source précise. Fiable, traçable, actionnable."},
]
function HowItWorks(){
  const title=useFade(0);const s0=useFade(0),s1=useFade(120),s2=useFade(240),s3=useFade(360);const steps=[s0,s1,s2,s3]
  return(
    <section id="comment" className="py-28" style={{background:"#fbfbfd"}}>
      <div className="max-w-6xl mx-auto px-6">
        <div ref={title.ref} style={title.style} className="text-center mb-16">
          <p className="text-sm font-semibold text-blue-600 mb-3 uppercase tracking-wider">Comment ça marche</p>
          <h2 className="text-5xl font-black tracking-tight mb-4" style={{color:"#1d1d1f",letterSpacing:"-0.03em"}}>Opérationnel en 2 minutes.</h2>
          <p className="text-xl text-gray-500 max-w-xl mx-auto">Pas de complexité. Pas de code. Juste vos données et vos questions.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {STEPS.map((step,i)=>(
            <div key={i} ref={steps[i].ref} className="p-7 rounded-3xl border"
              style={{...steps[i].style,background:"#fff",borderColor:"#e5e7eb"}}>
              <div className="text-5xl font-extrabold mb-5" style={{color:"#e5e7eb",letterSpacing:"-0.05em"}}>{step.n}</div>
              <h3 className="font-bold text-gray-900 text-base mb-2">{step.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── Testimonials ── */
const TESTIMONIALS=[
  {name:"Marie Dubois",role:"Directrice Ops · Startup SaaS",av:"MD",color:"#0066cc",text:"En 2 semaines, mon équipe économise +8h par semaine sur la recherche d'infos. Devenu indispensable."},
  {name:"Karim Benali",role:"CEO · Agence créative",av:"KB",color:"#6366f1",text:"La veille concurrentielle est bluffante. Une question le matin, une synthèse complète en 3 secondes."},
  {name:"Sophie Laurent",role:"Analyste · Cabinet conseil",av:"SL",color:"#059669",text:"Les sources citées dans chaque réponse nous donnent une confiance totale. Zéro risque d'erreur."},
]
function Testimonials(){
  const title=useFade(0);const s0=useFade(0),s1=useFade(120),s2=useFade(240);const cards=[s0,s1,s2]
  return(
    <section className="py-28" style={{background:"#f5f5f7"}}>
      <div className="max-w-6xl mx-auto px-6">
        <div ref={title.ref} style={title.style} className="text-center mb-8">
          <p className="text-sm font-semibold text-blue-600 mb-3 uppercase tracking-wider">Témoignages</p>
          <h2 className="text-5xl font-black tracking-tight mb-4" style={{color:"#1d1d1f",letterSpacing:"-0.03em"}}>Ils l'utilisent chaque jour.</h2>
          <div className="flex justify-center gap-10 mt-6">
            {[["2 400+","équipes actives"],["4.9 / 5","satisfaction"],["< 2 min","pour démarrer"]].map(([n,l])=>(
              <div key={l} className="text-center"><div className="text-2xl font-extrabold text-gray-900">{n}</div><div className="text-xs text-gray-500 mt-0.5">{l}</div></div>
            ))}
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-5 mt-10">
          {TESTIMONIALS.map((t,i)=>(
            <div key={i} ref={cards[i].ref} className="p-7 rounded-3xl border transition-all hover:shadow-md"
              style={{...cards[i].style,background:"#fff",borderColor:"#e5e7eb"}}>
              <div className="flex gap-0.5 mb-4">{[...Array(5)].map((_,j)=><span key={j} className="text-amber-400 text-sm">★</span>)}</div>
              <p className="text-gray-700 text-sm leading-relaxed mb-5">&ldquo;{t.text}&rdquo;</p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{background:t.color}}>{t.av}</div>
                <div><div className="text-sm font-semibold text-gray-900">{t.name}</div><div className="text-xs text-gray-400">{t.role}</div></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── Pricing ── */
const PLANS=[
  {name:"Starter",price:"Gratuit",sub:"Pour toujours",features:["1 espace de travail","3 sources connectées","500 questions / mois","Support communauté"],cta:"Commencer gratuitement",hot:false},
  {name:"Pro",price:"29€",sub:"/mois",features:["Espaces illimités","Sources illimitées","Questions illimitées","Membres d'équipe","Support prioritaire","API Access"],cta:"Essayer 14 jours gratuits",hot:true},
  {name:"Entreprise",price:"Sur devis",sub:"5+ utilisateurs",features:["Tout Pro inclus","SSO / SAML","SLA 99.9%","On-premise option","Customer Success"],cta:"Nous contacter",hot:false},
]
function Pricing(){
  const title=useFade(0);const s0=useFade(0),s1=useFade(120),s2=useFade(240);const cards=[s0,s1,s2]
  return(
    <section id="tarifs" className="py-28" style={{background:"#fbfbfd"}}>
      <div className="max-w-5xl mx-auto px-6">
        <div ref={title.ref} style={title.style} className="text-center mb-14">
          <p className="text-sm font-semibold text-blue-600 mb-3 uppercase tracking-wider">Tarifs</p>
          <h2 className="text-5xl font-black tracking-tight mb-4" style={{color:"#1d1d1f",letterSpacing:"-0.03em"}}>Simple et transparent.</h2>
          <p className="text-xl text-gray-500">Commencez gratuitement. Évoluez quand vous êtes prêt.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {PLANS.map((p,i)=>(
            <div key={i} ref={cards[i].ref} className="relative p-8 rounded-3xl border transition-all hover:shadow-lg"
              style={{...cards[i].style,...(p.hot?{background:"#0066cc",borderColor:"#0055aa",boxShadow:"0 8px 40px rgba(0,102,204,0.3)"}:{background:"#fff",borderColor:"#e5e7eb"})}}>
              {p.hot&&<div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold" style={{background:"#0066cc",color:"#fff"}}>Le plus populaire</div>}
              <div className="mb-6">
                <h3 className={`font-bold text-lg mb-1 ${p.hot?"text-white":"text-gray-900"}`}>{p.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className={`text-4xl font-extrabold ${p.hot?"text-white":"text-gray-900"}`}>{p.price}</span>
                  {p.sub&&<span className={`text-sm ${p.hot?"text-blue-100":"text-gray-400"}`}>{p.sub}</span>}
                </div>
              </div>
              <ul className="space-y-3 mb-8">
                {p.features.map((f,j)=>(
                  <li key={j} className={`flex items-start gap-2.5 text-sm ${p.hot?"text-blue-100":"text-gray-600"}`}>
                    <span className={`font-bold shrink-0 ${p.hot?"text-white":"text-green-500"}`}>✓</span>{f}
                  </li>
                ))}
              </ul>
              <Link href="/register"
                className="block w-full text-center py-3 rounded-2xl font-semibold text-sm transition-all hover:opacity-90"
                style={p.hot?{background:"rgba(255,255,255,0.2)",color:"#fff",border:"1px solid rgba(255,255,255,0.3)"}:{background:"#1d1d1f",color:"#fff"}}>
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-gray-400 mt-8">✓ Aucune carte pour le Starter · ✓ Résiliez à tout moment · ✓ Données hébergées en Europe 🇪🇺</p>
      </div>
    </section>
  )
}

/* ── CTA + Footer ── */
function CTABanner(){
  const s=useFade(0)
  return(
    <section className="py-28" style={{background:"#1d1d1f"}}>
      <div className="max-w-3xl mx-auto px-6 text-center">
        <div ref={s.ref} style={s.style}>
          <h2 className="text-5xl font-black text-white tracking-tight mb-5" style={{letterSpacing:"-0.03em"}}>
            Prêt à reprendre le<br/>contrôle de vos données ?
          </h2>
          <p className="text-gray-400 text-xl mb-10">Rejoignez 2 400+ équipes. Configuration en 2 minutes.</p>
          <Link href="/register"
            className="inline-flex items-center gap-3 px-9 py-4 rounded-2xl font-bold text-gray-900 text-base transition-all hover:scale-[1.03] hover:brightness-105"
            style={{background:"#fff",boxShadow:"0 8px 40px rgba(255,255,255,0.15)"}}>
            Créer mon espace gratuitement <span>→</span>
          </Link>
          <p className="text-xs text-gray-600 mt-5">✓ Gratuit pour toujours · ✓ Aucune carte requise · ✓ 2 min de setup</p>
        </div>
      </div>
    </section>
  )
}

function Footer(){
  return(
    <footer style={{background:"#1d1d1f",borderTop:"1px solid rgba(255,255,255,0.08)"}}>
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row justify-between gap-10 mb-10">
          <div>
            <div className="text-white font-bold text-lg mb-3">⬡ CortexOS</div>
            <p className="text-gray-500 text-sm max-w-xs leading-relaxed">Interrogez toutes vos données d'entreprise en langage naturel. Sources citées, zéro hallucination.</p>
          </div>
          <div className="flex gap-16">
            {[{title:"Produit",links:["Fonctionnalités","Démo","Tarifs","Roadmap"]},{title:"Légal",links:["Confidentialité","CGU","Cookies","Contact"]}].map(col=>(
              <div key={col.title}>
                <h4 className="text-white font-semibold text-sm mb-4">{col.title}</h4>
                <ul className="space-y-2.5">{col.links.map(l=><li key={l}><a href="#" className="text-gray-500 text-sm hover:text-gray-300 transition-colors">{l}</a></li>)}</ul>
              </div>
            ))}
          </div>
        </div>
        <div className="pt-6 flex flex-col md:flex-row justify-between items-center gap-2" style={{borderTop:"1px solid rgba(255,255,255,0.08)"}}>
          <p className="text-gray-600 text-xs">© {new Date().getFullYear()} CortexOS — Thibaut Affo</p>
          <p className="text-gray-700 text-xs">Données hébergées en Europe 🇪🇺</p>
        </div>
      </div>
    </footer>
  )
}

/* ── Root ── */
export default function LandingPage(){
  return(
    <main style={{fontFamily:"-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',system-ui,sans-serif"}}>
      <Navbar/>
      <Hero/>
      <LogosBar/>
      <Features/>
      <DemoSection/>
      <HowItWorks/>
      <Testimonials/>
      <Pricing/>
      <CTABanner/>
      <Footer/>
    </main>
  )
}
