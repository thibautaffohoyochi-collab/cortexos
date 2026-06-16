"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"

type Stats = {
  total_sessions: number
  total_messages: number
  total_sources: number
  tenant_name: string
}

type Session = {
  id: string
  title: string
  created_at: string
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentSessions, setRecentSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  const token = (session?.user as any)?.accessToken

  useEffect(() => {
    if (!token) return
    fetch(`${API}/dashboard/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        setStats(data.stats)
        setRecentSessions(data.recent_sessions)
      })
      .finally(() => setLoading(false))
  }, [token])

  const userName = (session?.user as any)?.name?.split(" ")[0] ?? ""

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <span className="text-lg font-semibold tracking-tight">⬡ CortexOS</span>
        <nav className="flex items-center gap-6 text-sm text-gray-400">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-white font-medium"
          >
            Dashboard
          </button>
          <button
            onClick={() => router.push("/chat")}
            className="hover:text-white transition-colors"
          >
            Chat
          </button>
          <span className="text-gray-600">|</span>
          <span>{session?.user?.name}</span>
        </nav>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-10">

        {/* Welcome */}
        <div>
          <h1 className="text-2xl font-bold">Bonjour, {userName} 👋</h1>
          <p className="text-gray-400 text-sm mt-1">
            {stats?.tenant_name ? `Espace ${stats.tenant_name}` : "Votre tableau de bord"}
          </p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              label: "Conversations",
              value: loading ? "—" : stats?.total_sessions ?? 0,
              icon: "💬",
              action: () => router.push("/chat"),
              actionLabel: "Nouvelle conversation",
            },
            {
              label: "Messages échangés",
              value: loading ? "—" : stats?.total_messages ?? 0,
              icon: "✉️",
              action: null,
              actionLabel: null,
            },
            {
              label: "Sources connectées",
              value: loading ? "—" : stats?.total_sources ?? 0,
              icon: "🗄️",
              action: null,
              actionLabel: "Connecter une source",
            },
          ].map(card => (
            <div
              key={card.label}
              className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">{card.label}</span>
                <span className="text-2xl">{card.icon}</span>
              </div>
              <span className="text-4xl font-bold">{card.value}</span>
              {card.action && (
                <button
                  onClick={card.action}
                  className="text-xs text-blue-400 hover:text-blue-300 text-left mt-1 transition-colors"
                >
                  {card.actionLabel} →
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Recent sessions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Conversations récentes</h2>
            <button
              onClick={() => router.push("/chat")}
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              Voir tout →
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-gray-900 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : recentSessions.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
              <p className="text-gray-400 text-sm">Aucune conversation pour l&apos;instant.</p>
              <button
                onClick={() => router.push("/chat")}
                className="mt-3 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium transition-colors"
              >
                Démarrer une conversation
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {recentSessions.map(s => (
                <div
                  key={s.id}
                  onClick={() => router.push(`/chat`)}
                  className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl px-5 py-4 flex items-center justify-between cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500 group-hover:text-blue-400 transition-colors">💬</span>
                    <span className="text-sm font-medium truncate max-w-sm">{s.title}</span>
                  </div>
                  <span className="text-xs text-gray-500 shrink-0 ml-4">
                    {new Date(s.created_at).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sources placeholder */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Sources de données</h2>
          </div>
          <div className="bg-gray-900 border border-dashed border-gray-700 rounded-2xl p-8 text-center space-y-3">
            <p className="text-gray-400 text-sm">
              Connectez vos données d&apos;entreprise pour interroger Gmail, Google Drive, Excel...
            </p>
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {["📧 Gmail", "📁 Google Drive", "📊 Excel / CSV", "💬 WhatsApp", "🛒 Shopify"].map(s => (
                <span
                  key={s}
                  className="px-3 py-1.5 rounded-full bg-gray-800 text-xs text-gray-400 border border-gray-700"
                >
                  {s}
                </span>
              ))}
            </div>
            <button className="mt-2 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 border border-gray-700 transition-colors"
              onClick={() => router.push("/sources")}
            >
              Connecter une source →
            </button>
          </div>
        </div>

      </main>
    </div>
  )
}
