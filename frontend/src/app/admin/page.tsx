"use client"
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"

// ─── Types ────────────────────────────────────────────────────────────────────
type Overview = {
  total_tenants: number
  total_users: number
  new_this_week: number
  new_this_month: number
  total_messages: number
  messages_this_week: number
  messages_this_month: number
  total_sessions: number
  total_sources: number
  mrr_estimate: number
}
type Plans = { starter: number; pro: number; business: number }
type ChartPoint = { date: string; count: number }
type Tenant = {
  id: string
  name: string
  slug: string
  plan: string
  is_active: boolean
  created_at: string
  admin_email: string
  admin_name: string
  user_count: number
  session_count: number
  message_count: number
  source_count: number
  last_activity: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const PLAN_COLORS: Record<string, string> = {
  starter:  "text-gray-400 bg-gray-800 border-gray-700",
  pro:      "text-blue-400 bg-blue-950/60 border-blue-800",
  business: "text-purple-400 bg-purple-950/60 border-purple-800",
}
const PLAN_LABELS: Record<string, string> = {
  starter: "Starter", pro: "Pro", business: "Business"
}

function Badge({ plan }: { plan: string }) {
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${PLAN_COLORS[plan] ?? PLAN_COLORS.starter}`}>
      {PLAN_LABELS[plan] ?? plan}
    </span>
  )
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-800 rounded-xl ${className}`} />
}

// ─── Mini sparkline ───────────────────────────────────────────────────────────
function Sparkline({ data, color = "#3b82f6" }: { data: ChartPoint[]; color?: string }) {
  const last14 = data.slice(-14)
  const max = Math.max(...last14.map(d => d.count), 1)
  return (
    <div className="flex items-end gap-0.5 h-10">
      {last14.map((d, i) => {
        const h = Math.max((d.count / max) * 100, d.count > 0 ? 6 : 2)
        return (
          <div key={i} className="flex-1 rounded-sm transition-all" style={{
            height: `${h}%`, minHeight: "2px",
            background: d.count > 0 ? color : "#1f2937",
          }} title={`${d.date}: ${d.count}`} />
        )
      })}
    </div>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KPI({ icon, label, value, sub, accent = "#3b82f6" }: {
  icon: string; label: string; value: string | number; sub?: string; accent?: string
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xl">{icon}</span>
        {sub && <span className="text-[11px] text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">{sub}</span>}
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const token = (session?.user as any)?.accessToken

  const [overview, setOverview] = useState<Overview | null>(null)
  const [plans, setPlans]       = useState<Plans | null>(null)
  const [activity, setActivity] = useState<ChartPoint[]>([])
  const [signups, setSignups]   = useState<ChartPoint[]>([])
  const [tenants, setTenants]   = useState<Tenant[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState("")
  const [planFilter, setPlanFilter] = useState("all")
  const [updatingPlan, setUpdatingPlan] = useState<string | null>(null)
  const [error, setError]       = useState("")

  const fetchData = async () => {
    if (!token) return
    setLoading(true)
    try {
      const [statsRes, tenantsRes] = await Promise.all([
        fetch(`${API}/admin/stats`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/admin/tenants`, { headers: { Authorization: `Bearer ${token}` } }),
      ])
      if (statsRes.status === 403) { setError("Accès refusé — réservé au propriétaire."); setLoading(false); return }
      const statsData = await statsRes.json()
      setOverview(statsData.overview)
      setPlans(statsData.plans)
      setActivity(statsData.activity ?? [])
      setSignups(statsData.signups ?? [])
      setTenants(await tenantsRes.json())
    } catch (e) {
      setError("Erreur de chargement")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [token])

  const changePlan = async (tenantId: string, plan: string) => {
    setUpdatingPlan(tenantId)
    await fetch(`${API}/admin/tenants/${tenantId}/plan`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    })
    await fetchData()
    setUpdatingPlan(null)
  }

  const toggleTenant = async (tenantId: string) => {
    await fetch(`${API}/admin/tenants/${tenantId}/toggle`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    })
    await fetchData()
  }

  const filtered = tenants.filter(t => {
    const matchSearch = search === "" ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.admin_email.toLowerCase().includes(search.toLowerCase())
    const matchPlan = planFilter === "all" || t.plan === planFilter
    return matchSearch && matchPlan
  })

  const mrr = overview?.mrr_estimate ?? 0

  if (error) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <p className="text-5xl mb-4">🔒</p>
        <p className="text-white text-xl font-bold">{error}</p>
        <button onClick={() => router.push("/dashboard")} className="mt-6 text-blue-400 hover:text-blue-300 text-sm">
          ← Retour au dashboard
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/dashboard")} className="text-gray-500 hover:text-gray-300 text-sm">←</button>
            <span className="text-sm font-bold text-white">⬡ CortexOS</span>
            <span className="text-gray-600">/</span>
            <span className="text-sm text-gray-400 font-medium">Admin</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-xs text-gray-400">Plateforme opérationnelle</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-8">

        {/* ── Title ─────────────────────────────────────────────────────── */}
        <div>
          <h1 className="text-2xl font-bold">Dashboard Owner</h1>
          <p className="text-gray-500 text-sm mt-1">Vue globale de la plateforme CortexOS</p>
        </div>

        {/* ── KPIs ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {loading ? [1,2,3,4].map(i => <Skeleton key={i} className="h-32" />) : <>
            <KPI icon="🏢" label="Espaces de travail" value={overview?.total_tenants ?? 0}
              sub={`+${overview?.new_this_week ?? 0} cette semaine`} />
            <KPI icon="👤" label="Utilisateurs total" value={overview?.total_users ?? 0}
              sub={`+${overview?.new_this_month ?? 0} ce mois`} />
            <KPI icon="💬" label="Messages total" value={(overview?.total_messages ?? 0).toLocaleString("fr-FR")}
              sub={`${overview?.messages_this_week ?? 0} cette semaine`} />
            <KPI icon="💶" label="MRR estimé" value={`${mrr}€`}
              sub={`${plans?.pro ?? 0} Pro · ${plans?.business ?? 0} Business`} accent="#10b981" />
          </>}
        </div>

        {/* ── Plans + Charts ────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Plans donut */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-300">Répartition des plans</h2>
            {loading ? <Skeleton className="h-32" /> : (
              <div className="space-y-3">
                {[
                  { label: "Starter", key: "starter", color: "bg-gray-500", val: plans?.starter ?? 0 },
                  { label: "Pro — 29€/mois", key: "pro", color: "bg-blue-500", val: plans?.pro ?? 0 },
                  { label: "Business — 99€/mois", key: "business", color: "bg-purple-500", val: plans?.business ?? 0 },
                ].map(p => {
                  const total = (plans?.starter ?? 0) + (plans?.pro ?? 0) + (plans?.business ?? 0)
                  const pct = total > 0 ? Math.round((p.val / total) * 100) : 0
                  return (
                    <div key={p.key} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">{p.label}</span>
                        <span className="text-white font-medium">{p.val} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div className={`h-full ${p.color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
                <div className="pt-2 border-t border-gray-800">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">MRR total estimé</span>
                    <span className="text-green-400 font-bold">{mrr}€/mois</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Messages activity */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-300">Messages — 30 derniers jours</h2>
            {loading ? <Skeleton className="h-20" /> : (
              <>
                <Sparkline data={activity} color="#3b82f6" />
                <div className="flex justify-between text-xs text-gray-500 pt-1">
                  <span>{activity[0]?.date}</span>
                  <span className="text-blue-400 font-medium">{overview?.messages_this_month ?? 0} ce mois</span>
                  <span>{activity[activity.length - 1]?.date}</span>
                </div>
              </>
            )}
          </div>

          {/* New signups */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-300">Nouvelles inscriptions — 30 jours</h2>
            {loading ? <Skeleton className="h-20" /> : (
              <>
                <Sparkline data={signups} color="#10b981" />
                <div className="flex justify-between text-xs text-gray-500 pt-1">
                  <span>{signups[0]?.date}</span>
                  <span className="text-green-400 font-medium">{overview?.new_this_month ?? 0} ce mois</span>
                  <span>{signups[signups.length - 1]?.date}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Tenants table ─────────────────────────────────────────────── */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">

          {/* Table header */}
          <div className="p-5 border-b border-gray-800 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-300">Tous les comptes</h2>
              <p className="text-xs text-gray-600">{filtered.length} espace{filtered.length > 1 ? "s" : ""} de travail</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher…"
                className="px-3 py-1.5 rounded-xl bg-gray-800 border border-gray-700 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-48"
              />
              <select
                value={planFilter}
                onChange={e => setPlanFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-gray-800 border border-gray-700 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="all">Tous les plans</option>
                <option value="starter">Starter</option>
                <option value="pro">Pro</option>
                <option value="business">Business</option>
              </select>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="p-5 space-y-3">
              {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-600">
              <p className="text-4xl mb-3">🏢</p>
              <p className="text-sm">Aucun compte trouvé</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-gray-800">
                    <th className="text-left px-5 py-3 font-medium">Compte</th>
                    <th className="text-left px-4 py-3 font-medium">Plan</th>
                    <th className="text-right px-4 py-3 font-medium">Msgs</th>
                    <th className="text-right px-4 py-3 font-medium">Sessions</th>
                    <th className="text-right px-4 py-3 font-medium">Sources</th>
                    <th className="text-left px-4 py-3 font-medium">Dernière activité</th>
                    <th className="text-left px-4 py-3 font-medium">Statut</th>
                    <th className="text-right px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t, i) => (
                    <tr key={t.id} className={`border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors ${!t.is_active ? "opacity-50" : ""}`}>
                      <td className="px-5 py-4">
                        <div>
                          <p className="font-medium text-white">{t.name}</p>
                          <p className="text-xs text-gray-500">{t.admin_email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <select
                          value={t.plan}
                          disabled={updatingPlan === t.id}
                          onChange={e => changePlan(t.id, e.target.value)}
                          className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                        >
                          <option value="starter">Starter</option>
                          <option value="pro">Pro</option>
                          <option value="business">Business</option>
                        </select>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="text-white font-medium">{t.message_count.toLocaleString("fr-FR")}</span>
                      </td>
                      <td className="px-4 py-4 text-right text-gray-400">{t.session_count}</td>
                      <td className="px-4 py-4 text-right text-gray-400">{t.source_count}</td>
                      <td className="px-4 py-4 text-xs text-gray-500">
                        {t.last_activity
                          ? new Date(t.last_activity).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "2-digit" })
                          : "Jamais"}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full border ${t.is_active ? "text-green-400 bg-green-950/50 border-green-800" : "text-red-400 bg-red-950/50 border-red-800"}`}>
                          {t.is_active ? "Actif" : "Suspendu"}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          onClick={() => toggleTenant(t.id)}
                          className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                            t.is_active
                              ? "text-red-400 border-red-800 hover:bg-red-950/40"
                              : "text-green-400 border-green-800 hover:bg-green-950/40"
                          }`}
                        >
                          {t.is_active ? "Suspendre" : "Réactiver"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <p className="text-center text-xs text-gray-700 pb-4">
          CortexOS Admin · Accès réservé · {new Date().toLocaleDateString("fr-FR")}
        </p>

      </main>
    </div>
  )
}
