"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"

const FEATURES = [
  {
    icon: "💬",
    title: "Chat en langage naturel",
    desc: "Interrogez vos données d'entreprise comme vous parleriez à un collègue. Pas de SQL, pas de tableaux.",
  },
  {
    icon: "📧",
    title: "Gmail & Google Drive",
    desc: "Connectez vos emails et fichiers en un clic. L'IA lit, analyse et répond sur vos vraies données.",
  },
  {
    icon: "🔍",
    title: "Recherche vectorielle RAG",
    desc: "Chaque réponse est basée sur vos documents. Les sources sont citées, rien n'est inventé.",
  },
  {
    icon: "👥",
    title: "Multi-utilisateurs",
    desc: "Invitez votre équipe. Partagez le même espace de données et collaborez intelligemment.",
  },
  {
    icon: "📊",
    title: "Toutes vos sources",
    desc: "CSV, Excel, TXT, Gmail, Drive — importez n'importe quelle donnée en quelques secondes.",
  },
  {
    icon: "🔒",
    title: "Sécurisé & privé",
    desc: "Vos données restent dans votre espace. Authentification JWT, isolation par tenant.",
  },
]

const WORDS = ["emails", "fichiers Drive", "données clients", "rapports", "contrats", "factures"]

function useTypewriter(words: string[]) {
  const [index, setIndex] = useState(0)
  const [displayed, setDisplayed] = useState("")
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const word = words[index]
    const timeout = deleting
      ? setTimeout(() => {
          setDisplayed(prev => prev.slice(0, -1))
          if (displayed.length === 1) {
            setDeleting(false)
            setIndex(i => (i + 1) % words.length)
          }
        }, 60)
      : setTimeout(() => {
          setDisplayed(word.slice(0, displayed.length + 1))
          if (displayed.length === word.length) {
            setTimeout(() => setDeleting(true), 1500)
          }
        }, 100)
    return () => clearTimeout(timeout)
  }, [displayed, deleting, index, words])

  return displayed
}

function AnimatedCard({ feature, delay }: { feature: typeof FEATURES[0]; delay: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.1 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`bg-gray-900 border border-gray-800 rounded-2xl p-6 transition-all duration-700
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
    >
      <div className="text-3xl mb-3">{feature.icon}</div>
      <h3 className="text-base font-semibold mb-2">{feature.title}</h3>
      <p className="text-gray-400 text-sm leading-relaxed">{feature.desc}</p>
    </div>
  )
}

export default function LandingPage() {
  const router = useRouter()
  const word = useTypewriter(WORDS)
  const [heroVisible, setHeroVisible] = useState(false)

  useEffect(() => {
    setTimeout(() => setHeroVisible(true), 100)
  }, [])

  return (
    <div className="min-h-screen bg-gray-950 text-white overflow-x-hidden">

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-gray-800/50 sticky top-0 bg-gray-950/80 backdrop-blur z-50">
        <span className="text-lg font-bold tracking-tight">⬡ CortexOS</span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/login")}
            className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-1.5"
          >
            Se connecter
          </button>
          <button
            onClick={() => router.push("/register")}
            className="text-sm bg-blue-600 hover:bg-blue-500 px-4 py-1.5 rounded-lg font-medium transition-colors"
          >
            Commencer →
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 py-24 text-center max-w-4xl mx-auto">
        {/* Animated logo */}
        <div className={`transition-all duration-1000 ${heroVisible ? "opacity-100 scale-100" : "opacity-0 scale-75"}`}>
          <div className="text-7xl mb-6 inline-block animate-pulse">⬡</div>
        </div>

        <div className={`transition-all duration-1000 delay-200 ${heroVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
            Interrogez vos{" "}
            <span className="text-blue-400 border-r-2 border-blue-400 pr-1">
              {word}
            </span>
            <br />
            <span className="text-gray-300">en langage naturel</span>
          </h1>
        </div>

        <div className={`transition-all duration-1000 delay-500 ${heroVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            CortexOS centralise toutes vos données d&apos;entreprise et vous permet de les interroger avec une IA.
            Gmail, Drive, CSV — tout en un seul endroit.
          </p>
        </div>

        <div className={`flex flex-col sm:flex-row gap-4 justify-center transition-all duration-1000 delay-700 ${heroVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <button
            onClick={() => router.push("/register")}
            className="px-8 py-4 bg-blue-600 hover:bg-blue-500 rounded-xl text-base font-semibold transition-all hover:scale-105 active:scale-95 shadow-lg shadow-blue-600/20"
          >
            Créer mon espace gratuitement →
          </button>
          <button
            onClick={() => router.push("/login")}
            className="px-8 py-4 bg-gray-800 hover:bg-gray-700 rounded-xl text-base font-medium transition-colors border border-gray-700"
          >
            Se connecter
          </button>
        </div>

        {/* Social proof */}
        <div className={`mt-10 text-sm text-gray-500 transition-all duration-1000 delay-1000 ${heroVisible ? "opacity-100" : "opacity-0"}`}>
          ✓ Gratuit pour commencer &nbsp;·&nbsp; ✓ Aucune carte requise &nbsp;·&nbsp; ✓ Déploiement en 2 minutes
        </div>
      </section>

      {/* Demo preview */}
      <section className="px-6 pb-16 max-w-4xl mx-auto">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="ml-3 text-xs text-gray-500">cortexos — Chat</span>
          </div>
          <div className="space-y-4">
            <div className="flex justify-end">
              <div className="bg-blue-600 rounded-2xl rounded-br-sm px-4 py-2.5 text-sm max-w-xs">
                Quels sont mes concurrents à Montréal ?
              </div>
            </div>
            <div className="flex justify-start">
              <div className="bg-gray-800 rounded-2xl rounded-bl-sm px-4 py-3 text-sm max-w-md">
                <span className="text-xs text-gray-400 block mb-1">⬡ CortexOS</span>
                D&apos;après votre fichier d&apos;analyse, voici vos principaux concurrents à Montréal :
                <br /><br />
                <strong>1. Baboon Creation</strong> — Agence spécialisée motion design<br />
                <strong>2. Wedge Studio</strong> — Awards Dieline, positionnement premium<br />
                <strong>3. ROYALTRI</strong> — Agence complète marketing digital
                <br /><br />
                <span className="text-xs text-gray-500">📄 Source : Concurrence_Thibaut_Affo.csv</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="px-6 py-16 max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Tout ce dont votre équipe a besoin</h2>
          <p className="text-gray-400">Une plateforme complète pour centraliser et interroger vos données.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <AnimatedCard key={i} feature={f} delay={i * 100} />
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-24 text-center">
        <div className="max-w-2xl mx-auto bg-gradient-to-br from-blue-950 to-gray-900 border border-blue-800/50 rounded-3xl p-12">
          <div className="text-5xl mb-4">⬡</div>
          <h2 className="text-3xl font-bold mb-4">Prêt à commencer ?</h2>
          <p className="text-gray-400 mb-8">
            Créez votre espace en 2 minutes et connectez vos premières données.
          </p>
          <button
            onClick={() => router.push("/register")}
            className="px-8 py-4 bg-blue-600 hover:bg-blue-500 rounded-xl text-base font-semibold transition-all hover:scale-105 active:scale-95"
          >
            Créer mon compte gratuitement →
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 px-6 py-6 text-center text-sm text-gray-500">
        © 2026 CortexOS — Construit avec ❤️ par Thibaut Affo
      </footer>

    </div>
  )
}
