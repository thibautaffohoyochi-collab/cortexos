"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

export default function OfflinePage() {
  const router = useRouter()
  const [checking, setChecking] = useState(false)

  const retry = async () => {
    setChecking(true)
    try {
      await fetch("/api/health-check", { cache: "no-store" })
      router.back()
    } catch {
      // Still offline
    } finally {
      setChecking(false)
    }
  }

  // Auto-retry when connection comes back
  useEffect(() => {
    const handler = () => router.back()
    window.addEventListener("online", handler)
    return () => window.removeEventListener("online", handler)
  }, [])

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center text-white px-6 text-center"
      style={{ background: "radial-gradient(ellipse at center, rgba(37,99,235,0.1) 0%, #030712 60%)" }}
    >
      <div className="space-y-6 max-w-sm">
        {/* Icon */}
        <div className="relative mx-auto w-24 h-24">
          <div className="text-7xl">📡</div>
          <div className="absolute -bottom-1 -right-1 text-2xl">❌</div>
        </div>

        {/* Text */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Pas de connexion</h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            CortexOS nécessite une connexion internet pour accéder à vos données et à l&apos;IA.
          </p>
        </div>

        {/* What's available offline */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 text-left space-y-2">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Disponible hors ligne</p>
          <div className="space-y-1.5">
            {[
              "📱 Interface de l'application",
              "💬 Historique des conversations (en cache)",
              "🔖 Pages déjà visitées",
            ].map(item => (
              <div key={item} className="flex items-center gap-2 text-sm text-gray-300">
                <span className="text-green-400 text-xs">✓</span>
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* Retry button */}
        <button
          onClick={retry}
          disabled={checking}
          className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-semibold transition-all hover:scale-[1.01] active:scale-[0.99]"
        >
          {checking ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Vérification...
            </span>
          ) : (
            "🔄 Réessayer"
          )}
        </button>

        <p className="text-xs text-gray-600">
          La page se rechargera automatiquement dès que la connexion sera rétablie.
        </p>
      </div>
    </div>
  )
}
