"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { AppHeader } from "@/components/ui/AppHeader"

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"

// ─── Types ────────────────────────────────────────────────────────────────────
type Stats = {
  total_sessions: number
  sessions_this_week: number
  total_messages: number
  messages_this_week: number
  total_sources: number
  active_sources: number
  total_workflows: number
  total_runs: number
  successful_runs: number
  runs_this_week: number
  total_competitors: number
  tenant_name: string
  user_name: string
}

type ActivityDay = { date: string; messages: number }
type RecentSession = { id: string; title: string; created_at: string }
type RecentRun = { id: string; workflow_name: string; status: string; started_at: string }
type Source = { id: string; name: string; source_type: string; status: string; format: string }

// ─── Mini bar chart ───────────────────────────────────────────────────────────
function ActivityChart({ data }: { data: ActivityDay[] }) {
  const max = Math.max(...data.map(d => d.messages), 1)
  return (
    <div className="flex items-end gap-1.5 h-16">
      {data.map((d, i) => {
        const pct = Math.max((d.messages / max) * 100, d.messages > 0 ? 8 : 3)
        return (
          <div key={i} className="flex flex-col items-center gap-1 flex-1 group">
            <div className="relative w-full">
              {d.messages > 0 && (
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-gray-300 bg-gray-800 px-1.5 py-0.5 rounded whitespace-nowrap z-10">
                  {d.messages} msg
                </div>
              )}
              <div
                className="w-full rounded-t-sm transition-all duration-500"
                style={{
                  height: `${pct}%`,
                  minHeight: "3px",
                  maxHeight: "100%",
                  background: d.messages > 0
                    ? "linear-gradient(to top, #2563eb, #60a5fa)"
                    : "#1f2937",
                }}
              />
            </div>
            <span className="text-[9px] text-gray-600">{d.date}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({
  icon, label, value, sub, color = "blue", onClick,
}: {
  icon: string
  label: string
  value: string | number
  sub?: string
  color?: "blue" | "green" | "purple" | "orange" | "emerald"
  onClick?: () => void
}) {
  const colors = {
    blue:    "from-blue-600/10 to-blue-600/5 border-blue-500/20",
    green:   "from-green-600/10 to-green-600/5 border-green-500/20",
    purple:  "from-purple-600/10 to-purple-600/5 border-purple-500/20",
    orange:  "from-orange-600/10 to-orange-600/5 border-orange-500/20",
    emerald: "from-emerald-600/10 to-emerald-600/5 border-emerald-500/20",
  }
  const iconColors = {
    blue: "bg-blue-600/20 text-blue-400",
    green: "bg-green-600/20 text-green-400",
    purple: "bg-purple-600/20 text-purple-400",
    orange: "bg-orange-600/20 text-orange-400",
    emerald: "bg-emerald-600/20 text-emerald-400",
  }
  return (
    <div
      onClick={onClick}
      className={`bg-gradient-to-br ${colors[color]} border rounded-2xl p-5 flex flex-col gap-3 transition-all ${
        onClick ? "cursor-pointer hover:scale-[1.02] hover:shadow-lg" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg ${iconColors[color]}`}>
          {icon}
        </span>
        {sub && (
          <span className="text-xs text-gray-500 bg-gray-800/60 px-2 py-0.5 rounded-full">
            {sub}
          </span>
        )}
      </div>
      <div>
        <p className="text-3xl font-bold text-white">{value}</p>
        <p className="text-xs text-gray-400 mt-0.5">{label}</p>
      </div>
    </div>
  )
}

// ─── Status badge ─────────────────────────────────────────────────────────────
const STATUS = {
  active:    { label: "Actif",      cls: "text-green-400 bg-green-950/60 border-green-800" },
  completed: { label: "Terminé",    cls: "text-green-400 bg-green-950/60 border-green-800" },
  syncing:   { label: "En cours",   cls: "text-yellow-400 bg-yellow-950/60 border-yellow-800" },
  running:   { label: "En cours",   cls: "text-yellow-400 bg-yellow-950/60 border-yellow-800" },
  pending:   { label: "En attente", cls: "text-gray-400 bg-gray-800/60 border-gray-700" },
  idle:      { label: "En attente", cls: "text-gray-400 bg-gray-800/60 border-gray-700" },
  error:     { label: "Erreur",     cls: "text-red-400 bg-red-950/60 border-red-800" },
  failed:    { label: "Échoué",     cls: "text-red-400 bg-red-950/60 border-red-800" },
} as Record<string, { label: string; cls: string }>

function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, cls: "text-gray-400 bg-gray-800 border-gray-700" }
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full border ${s.cls}`}>
      {s.label}
    </span>
  )
}

const FORMAT_ICONS: Record<string, string> = {
  PDF: "📕", XLSX: "📗", XLS: "📗", CSV: "📊", TXT: "📄", DOCX: "📘", DOC: "📘",
  gmail: "📧", google_drive: "📁",
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-800 rounded-xl ${className}`} />
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [activity, setActivity] = useState<ActivityDay[]>([])
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([])
  const [recentRuns, setRecentRuns] = useState<RecentRun[]>([])
  const [sources, setSources] = useState<Source[]>([])
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
        setActivity(data.activity ?? [])
        setRecentSessions(data.recent_sessions ?? [])
        setRecentRuns(data.recent_runs ?? [])
        setSources(data.sources ?? [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [token])

  const userName = stats?.user_name || (session?.user as any)?.name?.split(" ")[0] || "vous"

  // ── Success rate ────────────────────────────────────────────────────────────
  const successRate = stats && stats.total_runs > 0
    ? Math.round((stats.successful_runs / stats.total_runs) * 100)
    : null

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <AppHeader />
      <main className="max-w-6xl mx-auto px-4 md:px-6 py-8 space-y-8">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              Bonjour, <span style={{ background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{userName}</span> 👋
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              {stats?.tenant_name ? `Espace ${stats.tenant_name}` : "Votre tableau de bord"}
            </p>
          </div>
          <button
            onClick={() => router.push("/chat")}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm font-medium transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg"
          >
            <span>+</span> Nouveau chat
          </button>
        </div>

        {/* ── KPI cards ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {loading ? (
            [1,2,3,4].map(i => <Skeleton key={i} className="h-32" />)
          ) : (
            <>
              <StatCard
                icon="💬" label="Conversations" color="blue"
                value={stats?.total_sessions ?? 0}
                sub={stats?.sessions_this_week ? `+${stats.sessions_this_week} cette semaine` : undefined}
                onClick={() => router.push("/chat")}
              />
              <StatCard
                icon="✉️" label="Messages échangés" color="purple"
                value={stats?.total_messages ?? 0}
                sub={stats?.messages_this_week ? `+${stats.messages_this_week} cette semaine` : undefined}
              />
              <StatCard
                icon="🗄️" label="Sources actives" color="green"
                value={stats?.active_sources ?? 0}
                sub={`${stats?.total_sources ?? 0} total`}
                onClick={() => router.push("/sources")}
              />
              <StatCard
                icon="🤖" label="Workflows" color="orange"
                value={stats?.total_workflows ?? 0}
                sub={stats?.runs_this_week ? `${stats.runs_this_week} exéc. cette semaine` : undefined}
                onClick={() => router.push("/agents")}
              />
            </>
          )}
        </div>

        {/* ── Activity + Quick actions ────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Activity chart */}
          <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-300">Activité — 7 derniers jours</h2>
              <span className="text-xs text-gray-500">Messages envoyés</span>
            </div>
            {loading ? (
              <Skeleton className="h-20" />
            ) : activity.length > 0 ? (
              <ActivityChart data={activity} />
            ) : (
              <div className="h-16 flex items-center justify-center text-gray-600 text-sm">
                Pas encore d&apos;activité
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-300">Accès rapide</h2>
            <div className="space-y-2">
              {[
                { icon: "💬", label: "Nouveau chat", sub: "Interroger vos données", path: "/chat", color: "hover:border-blue-500/40" },
                { icon: "🌐", label: "Web Search", sub: "Recherche internet", path: "/websearch", color: "hover:border-emerald-500/40" },
                { icon: "📁", label: "Importer un fichier", sub: "PDF, Excel, Word…", path: "/sources", color: "hover:border-green-500/40" },
                { icon: "🤖", label: "Créer un workflow", sub: "Automatiser des tâches", path: "/agents", color: "hover:border-orange-500/40" },
                { icon: "🔍", label: "Veille concurrentielle", sub: `${stats?.total_competitors ?? 0} concurrent${(stats?.total_competitors ?? 0) > 1 ? "s" : ""} suivis`, path: "/competitive", color: "hover:border-purple-500/40" },
              ].map(item => (
                <button
                  key={item.path}
                  onClick={() => router.push(item.path)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-800 ${item.color} hover:bg-gray-800/40 transition-all text-left group`}
                >
                  <span className="text-lg shrink-0">{item.icon}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-200 group-hover:text-white">{item.label}</p>
                    <p className="text-[11px] text-gray-500 truncate">{item.sub}</p>
                  </div>
                  <span className="ml-auto text-gray-600 group-hover:text-gray-400 text-xs">→</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Bottom grid ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Recent conversations */}
          <div className="lg:col-span-1 bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-300">Conversations récentes</h2>
              <button onClick={() => router.push("/chat")} className="text-xs text-blue-400 hover:text-blue-300">Voir tout →</button>
            </div>
            {loading ? (
              <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12" />)}</div>
            ) : recentSessions.length === 0 ? (
              <div className="text-center py-6 text-gray-600 text-xs">
                <p className="text-2xl mb-1">💬</p>
                Aucune conversation
              </div>
            ) : (
              <div className="space-y-1.5">
                {recentSessions.map(s => (
                  <button
                    key={s.id}
                    onClick={() => router.push("/chat")}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-800/60 transition-colors text-left group"
                  >
                    <span className="text-gray-600 group-hover:text-blue-400 transition-colors shrink-0">💬</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-gray-300 truncate group-hover:text-white">{s.title}</p>
                      <p className="text-[11px] text-gray-600">
                        {new Date(s.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sources */}
          <div className="lg:col-span-1 bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-300">Sources de données</h2>
              <button onClick={() => router.push("/sources")} className="text-xs text-blue-400 hover:text-blue-300">Gérer →</button>
            </div>
            {loading ? (
              <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10" />)}</div>
            ) : sources.length === 0 ? (
              <div className="text-center py-6 text-gray-600 text-xs">
                <p className="text-2xl mb-1">🗄️</p>
                Aucune source importée
                <button onClick={() => router.push("/sources")} className="block mx-auto mt-2 text-blue-400 hover:text-blue-300">
                  Importer →
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                {sources.map(s => {
                  const icon = FORMAT_ICONS[s.format] ?? FORMAT_ICONS[s.source_type] ?? "📄"
                  return (
                    <div key={s.id} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-800/40 transition-colors">
                      <span className="text-base shrink-0">{icon}</span>
                      <p className="text-xs text-gray-300 truncate flex-1">{s.name}</p>
                      <StatusBadge status={s.status} />
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Workflow runs + system health */}
          <div className="lg:col-span-1 space-y-4">

            {/* Workflow runs */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-300">Dernières exécutions</h2>
                <button onClick={() => router.push("/agents")} className="text-xs text-blue-400 hover:text-blue-300">Agents →</button>
              </div>
              {loading ? (
                <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-10" />)}</div>
              ) : recentRuns.length === 0 ? (
                <div className="text-center py-4 text-gray-600 text-xs">
                  <p className="text-2xl mb-1">🤖</p>
                  Aucune exécution
                </div>
              ) : (
                <div className="space-y-1.5">
                  {recentRuns.map(r => (
                    <div key={r.id} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-800/40 transition-colors">
                      <span className="text-base shrink-0">⚡</span>
                      <p className="text-xs text-gray-300 truncate flex-1">{r.workflow_name}</p>
                      <StatusBadge status={r.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* System health */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
              <h2 className="text-sm font-semibold text-gray-300">Santé du système</h2>
              <div className="space-y-2">
                {[
                  { label: "API Backend", ok: true },
                  { label: "Base de données", ok: true },
                  {
                    label: "Sources actives",
                    ok: (stats?.active_sources ?? 0) > 0,
                    note: stats ? `${stats.active_sources}/${stats.total_sources}` : "—",
                  },
                  {
                    label: "Taux de réussite workflows",
                    ok: successRate === null || successRate >= 50,
                    note: successRate !== null ? `${successRate}%` : "—",
                  },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${item.ok ? "bg-green-400" : "bg-red-400"}`} />
                      <span className="text-xs text-gray-400">{item.label}</span>
                    </div>
                    <span className="text-[11px] text-gray-500">{item.note ?? (item.ok ? "OK" : "—")}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

      </main>
    </div>
  )
}
