"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"

// ─── Typewriter ───────────────────────────────────────────────────────────────
const WORDS = ["emails Gmail", "fichiers Drive", "données clients", "rapports", "contrats", "factures"]

function useTypewriter(words: string[]) {
  const [index, setIndex] = useState(0)
  const [displayed, setDisplayed] = useState("")
  const [deleting, setDeleting] = useState(false)
  useEffect(() => {
    const word = words[index]
    const timeout = deleting
      ? setTimeout(() => {
          setDisplayed(p => p.slice(0, -1))
          if (displayed.length === 1) { setDeleting(false); setIndex(i => (i + 1) % words.length) }
        }, 60)
      : setTimeout(() => {
          setDisplayed(word.slice(0, displayed.length + 1))
          if (displayed.length === word.length) setTimeout(() => setDeleting(true), 1800)
        }, 100)
    return () => clearTimeout(timeout)
  }, [displayed, deleting, index, words])
  return displayed
}

// ─── Scroll animation ─────────────────────────────────────────────────────────
function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const observer = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true) }, { threshold: 0.1 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])
  return { ref, visible }
}

// ─── Interactive Demo ─────────────────────────────────────────────────────────
const DEMO_MESSAGES = [
  { q: "Quels sont mes concurrents à Montréal ?", a: "D'après votre fichier d'analyse, voici vos concurrents :\n\n**Baboon Creation** — Motion design, Animation\n**Wedge Studio** — Awards Dieline, positionnement premium\n**ROYALTRI** — Agence complète marketing digital\n\n📄 Source : Concurrence_Thibaut_Affo.csv" },
  { q: "Résume mes derniers emails importants", a: "Voici un résumé de vos 3 derniers emails importants :\n\n**Adobe Express** — Invitation à un événement créatif\n**GitHub** — Alerte de sécurité sur votre dépôt\n**Stripe** — Paiement reçu de 1 200€\n\n📄 Source : Gmail (3 emails)" },
  { q: "Quel est mon positionnement vs Wedge Studio ?", a: "**Vos avantages vs Wedge Studio :**\n\n✅ Prix 3-5x plus accessibles\n✅ Intégration IA génératif unique\n✅ Service personnalisé\n\n**Leurs avantages :**\n⚡ Awards internationaux (Dieline)\n⚡ Positionnement premium\n\n📄 Source : Concurrence_Thibaut_Affo.csv" },
]

function InteractiveDemo() {
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([])
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [demoIndex, setDemoIndex] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages])

  const sendMessage = (text?: string) => {
    const msg = text || input.trim()
    if (!msg || isTyping) return
    setInput("")
    setMessages(p => [...p, { role: "user", text: msg }])
    setIsTyping(true)

    const demo = DEMO_MESSAGES.find(d => d.q === msg) || DEMO_MESSAGES[demoIndex % DEMO_MESSAGES.length]
    setDemoIndex(i => i + 1)

    setTimeout(() => {
      setMessages(p => [...p, { role: "ai", text: demo.a }])
      setIsTyping(false)
    }, 1200)
  }

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden shadow-2xl">
      {/* Window bar */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-800 border-b border-gray-700">
        <div className="w-3 h-3 rounded-full bg-red-500" />
        <div className="w-3 h-3 rounded-full bg-yellow-500" />
        <div className="w-3 h-3 rounded-full bg-green-500" />
        <span className="ml-3 text-xs text-gray-400">CortexOS — Chat</span>
        <span className="ml-auto text-xs text-green-400 flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-400 inline-block animate-pulse" />
          Démo interactive
        </span>
      </div>

      {/* Messages */}
      <div className="h-64 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-4">
            <p className="text-gray-500 text-sm mb-3">Essayez une question :</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {DEMO_MESSAGES.map((d, i) => (
                <button key={i} onClick={() => sendMessage(d.q)}
                  className="px-3 py-1.5 rounded-full bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 border border-gray-700 transition-colors text-left">
                  {d.q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
              m.role === "user" ? "bg-blue-600 text-white rounded-br-sm" : "bg-gray-800 text-gray-100 rounded-bl-sm"
            }`}>
              {m.role === "ai" && <span className="text-xs text-gray-400 block mb-1">⬡ CortexOS</span>}
              {m.text.replace(/\*\*(.*?)\*\*/g, "$1")}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-gray-800 rounded-2xl rounded-bl-sm px-3 py-2">
              <span className="text-xs text-gray-400 block mb-1">⬡ CortexOS</span>
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-700 flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && sendMessage()}
          placeholder="Posez une question à l'IA..."
          className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
        <button onClick={() => sendMessage()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-medium transition-colors">
          →
        </button>
      </div>
    </div>
  )
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const FEATURES = [
  { icon: "💬", title: "Chat en langage naturel", desc: "Interrogez vos données comme vous parleriez à un collègue. Pas de SQL, pas de tableaux." },
  { icon: "📧", title: "Gmail & Google Drive", desc: "Connectez vos emails et fichiers en un clic. L'IA lit, analyse et répond sur vos vraies données." },
  { icon: "🔍", title: "Recherche vectorielle RAG", desc: "Chaque réponse est basée sur vos documents. Les sources sont citées, rien n'est inventé." },
  { icon: "👥", title: "Multi-utilisateurs", desc: "Invitez votre équipe. Partagez le même espace et collaborez intelligemment." },
  { icon: "🤖", title: "Agents autonomes", desc: "Créez des workflows multi-étapes. L'IA exécute chaque étape et produit un résultat final." },
  { icon: "🔒", title: "Sécurisé & privé", desc: "Vos données restent dans votre espace. Authentification JWT, isolation par tenant." },
]

const PRICING = [
  {
    name: "Free",
    price: "0€",
    period: "",
    desc: "Pour tester",
    features: ["5 Go de données", "1 utilisateur", "50 questions/jour", "CSV & TXT", "Support communauté"],
    cta: "Commencer gratuitement",
    highlight: false,
  },
  {
    name: "Starter",
    price: "9€",
    period: "HT/mois",
    desc: "Pour les indépendants",
    features: ["50 Go de données", "5 utilisateurs", "Questions illimitées", "Gmail + Drive", "Support email"],
    cta: "Essayer 14 jours gratuit",
    highlight: true,
  },
  {
    name: "Pro",
    price: "29€",
    period: "HT/mois",
    desc: "Pour les équipes",
    features: ["Données illimitées", "Utilisateurs illimités", "Agents autonomes", "Toutes les intégrations", "Support prioritaire"],
    cta: "Contacter l'équipe",
    highlight: false,
  },
]

const TESTIMONIALS = [
  {
    name: "Sophie M.",
    role: "Fondatrice, Studio Créatif",
    avatar: "SM",
    color: "bg-purple-600",
    text: "J'ai connecté Gmail et mon Drive en 5 minutes. Maintenant je retrouve n'importe quelle info en quelques secondes. Un gain de temps incroyable.",
  },
  {
    name: "Karim B.",
    role: "CEO, SaaS B2B",
    avatar: "KB",
    color: "bg-blue-600",
    text: "On a chargé nos 3 ans de données clients et on peut maintenant faire des analyses qui prenaient 2 heures en moins de 30 secondes.",
  },
  {
    name: "Marie-Claire D.",
    role: "Directrice Commerciale, PME",
    avatar: "MC",
    color: "bg-green-600",
    text: "Le fait que les sources soient citées dans chaque réponse nous donne confiance. On sait exactement d'où vient chaque information.",
  },
]

// ─── Main Component ───────────────────────────────────────────────────────────
export default function LandingPage() {
  const router = useRouter()
  const word = useTypewriter(WORDS)
  const [heroVisible, setHeroVisible] = useState(false)
  const featuresSection = useFadeIn()
  const pricingSection = useFadeIn()
  const testimonialsSection = useFadeIn()

  useEffect(() => { setTimeout(() => setHeroVisible(true), 100) }, [])

  return (
    <div className="min-h-screen bg-gray-950 text-white overflow-x-hidden">

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-gray-800/50 sticky top-0 bg-gray-950/90 backdrop-blur z-50">
        <span className="text-lg font-bold tracking-tight">⬡ CortexOS</span>
        <div className="hidden md:flex items-center gap-6 text-sm text-gray-400">
          <a href="#features" className="hover:text-white transition-colors">Fonctionnalités</a>
          <a href="#demo" className="hover:text-white transition-colors">Démo</a>
          <a href="#pricing" className="hover:text-white transition-colors">Tarifs</a>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/login")} className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-1.5">
            Se connecter
          </button>
          <button onClick={() => router.push("/register")} className="text-sm bg-blue-600 hover:bg-blue-500 px-4 py-1.5 rounded-lg font-medium transition-colors">
            Commencer →
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 py-20 text-center max-w-5xl mx-auto">
        <div className={`transition-all duration-700 ${heroVisible ? "opacity-100 scale-100" : "opacity-0 scale-75"}`}>
          <div className="inline-flex items-center gap-2 bg-blue-950 border border-blue-800 rounded-full px-4 py-1.5 text-xs text-blue-300 mb-6">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            Utilisé par 100+ fondateurs et PME
          </div>
        </div>

        <div className={`transition-all duration-700 delay-200 ${heroVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
            Interrogez vos{" "}
            <span className="text-blue-400 border-r-2 border-blue-400 pr-1 animate-pulse">{word}</span>
            <br /><span className="text-gray-300">en langage naturel</span>
          </h1>
        </div>

        <div className={`transition-all duration-700 delay-400 ${heroVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            CortexOS connecte Gmail, Drive, CSV et toutes vos données d&apos;entreprise à une IA.
            Posez n&apos;importe quelle question, obtenez une réponse avec les sources citées.
          </p>
        </div>

        <div className={`flex flex-col sm:flex-row gap-4 justify-center mb-6 transition-all duration-700 delay-500 ${heroVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <button onClick={() => router.push("/register")}
            className="px-8 py-4 bg-blue-600 hover:bg-blue-500 rounded-xl text-base font-semibold transition-all hover:scale-105 active:scale-95 shadow-lg shadow-blue-600/25">
            Créer mon espace gratuitement →
          </button>
          <a href="#demo"
            className="px-8 py-4 bg-gray-800 hover:bg-gray-700 rounded-xl text-base font-medium transition-colors border border-gray-700 text-center">
            Voir la démo ↓
          </a>
        </div>

        <div className={`text-sm text-gray-500 transition-all duration-700 delay-700 ${heroVisible ? "opacity-100" : "opacity-0"}`}>
          ✓ Gratuit pour commencer &nbsp;·&nbsp; ✓ Aucune carte requise &nbsp;·&nbsp; ✓ Setup en 2 minutes
        </div>
      </section>

      {/* Social proof bar */}
      <div className="border-y border-gray-800 py-4 px-6">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
          <span>🏆 100+ utilisateurs actifs</span>
          <span className="hidden sm:block">·</span>
          <span>📧 Gmail & Google Drive</span>
          <span className="hidden sm:block">·</span>
          <span>🔒 Données sécurisées</span>
          <span className="hidden sm:block">·</span>
          <span>⚡ Gemini 2.5 Flash</span>
        </div>
      </div>

      {/* Video Demo */}
      <section className="px-6 py-12 max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-2">Voir CortexOS en action</h2>
          <p className="text-gray-400 text-sm">Démo complète en 90 secondes</p>
        </div>
        <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-gray-800" style={{ paddingBottom: "56.25%" }}>
          <iframe
            src="https://www.loom.com/embed/487712d1c1474d33aea29e318960f9e1?autoplay=0&hideEmbedTopBar=true"
            frameBorder="0"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
          />
        </div>
      </section>

      {/* Interactive Demo */}
      <section id="demo" className="px-6 py-20 max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold mb-3">Essayez maintenant</h2>
          <p className="text-gray-400">Démo interactive avec données pré-chargées — aucune inscription requise</p>
        </div>
        <InteractiveDemo />
        <p className="text-center text-xs text-gray-600 mt-3">
          * Démo avec données fictives. Vos vraies données restent privées dans votre espace.
        </p>
      </section>

      {/* Features */}
      <section id="features" className="px-6 py-20 max-w-5xl mx-auto">
        <div ref={featuresSection.ref} className={`transition-all duration-700 ${featuresSection.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Tout ce dont votre équipe a besoin</h2>
            <p className="text-gray-400">Une plateforme complète pour centraliser et interroger vos données.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl p-6 transition-colors">
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="text-base font-semibold mb-2">{f.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="px-6 py-20 bg-gray-900/50">
        <div ref={testimonialsSection.ref} className={`max-w-5xl mx-auto transition-all duration-700 ${testimonialsSection.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">Ce que disent nos utilisateurs</h2>
            <p className="text-gray-400">Fondateurs et équipes qui utilisent CortexOS au quotidien</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full ${t.color} flex items-center justify-center text-sm font-bold`}>
                    {t.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-gray-500">{t.role}</p>
                  </div>
                </div>
                <div className="flex gap-0.5 text-yellow-400 text-xs">
                  {"★★★★★"}
                </div>
                <p className="text-gray-300 text-sm leading-relaxed">&ldquo;{t.text}&rdquo;</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-6 py-20 max-w-5xl mx-auto">
        <div ref={pricingSection.ref} className={`transition-all duration-700 ${pricingSection.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">Tarifs simples et transparents</h2>
            <p className="text-gray-400">Commencez gratuitement, passez au plan supérieur quand vous en avez besoin.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PRICING.map((p, i) => (
              <div key={i} className={`rounded-2xl p-6 space-y-6 border ${
                p.highlight
                  ? "bg-blue-950 border-blue-600 shadow-lg shadow-blue-600/20 relative"
                  : "bg-gray-900 border-gray-800"
              }`}>
                {p.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs px-3 py-1 rounded-full font-medium">
                    Populaire
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-bold">{p.name}</h3>
                  <p className="text-gray-400 text-sm">{p.desc}</p>
                </div>
                <div className="flex items-end gap-1">
                  <span className="text-4xl font-bold">{p.price}</span>
                  {p.period && <span className="text-gray-400 text-sm mb-1">{p.period}</span>}
                </div>
                <ul className="space-y-2">
                  {p.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm text-gray-300">
                      <span className="text-green-400">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => router.push("/register")}
                  className={`w-full py-3 rounded-xl text-sm font-medium transition-colors ${
                    p.highlight
                      ? "bg-blue-600 hover:bg-blue-500 text-white"
                      : "bg-gray-800 hover:bg-gray-700 text-white border border-gray-700"
                  }`}
                >
                  {p.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="px-6 py-24 text-center">
        <div className="max-w-2xl mx-auto bg-gradient-to-br from-blue-950 to-gray-900 border border-blue-800/50 rounded-3xl p-12">
          <div className="text-5xl mb-4">⬡</div>
          <h2 className="text-3xl font-bold mb-4">Prêt à commencer ?</h2>
          <p className="text-gray-400 mb-8">Créez votre espace en 2 minutes. Aucune carte requise.</p>
          <button onClick={() => router.push("/register")}
            className="px-8 py-4 bg-blue-600 hover:bg-blue-500 rounded-xl text-base font-semibold transition-all hover:scale-105 active:scale-95">
            Créer mon compte gratuitement →
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 px-6 py-8">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <span>⬡ CortexOS — © 2026 Thibaut Affo</span>
          <div className="flex gap-6">
            <a href="/login" className="hover:text-white transition-colors">Connexion</a>
            <a href="/register" className="hover:text-white transition-colors">Inscription</a>
            <a href="#pricing" className="hover:text-white transition-colors">Tarifs</a>
          </div>
        </div>
      </footer>

    </div>
  )
}
