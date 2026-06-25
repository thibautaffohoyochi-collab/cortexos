"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { ThemeSwitcher } from "@/lib/theme"
import { LangSwitcher, useLang } from "@/lib/i18n"
import { AppHeader } from "@/components/ui/AppHeader"

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"

// ─── Types ────────────────────────────────────────────────────────────────────
type UsageStat = { used: number; limit: number; limit_display: string; pct: number; period?: string }
type UsageData = {
  plan: string
  plan_label: string
  plan_price: number
  features: { web_search: boolean; api_access: boolean; competitive: boolean }
  usage: {
    messages: UsageStat
    sources: UsageStat
    workflows: UsageStat
    members: UsageStat
  }
}
type Memory = {
  profile?: { sector?: string; company?: string; role?: string; language?: string }
  preferences?: { response_style?: string; output_format?: string }
  facts?: string[]
  projects?: string[]
  last_updated?: string
}

// ─── Usage bar ────────────────────────────────────────────────────────────────
function UsageBar({ label, stat, icon }: { label: string; stat: UsageStat; icon: string }) {
  const isUnlimited = stat.limit === -1
  const danger = stat.pct >= 90
  const warning = stat.pct >= 70

  const barColor = danger ? "bg-red-500" : warning ? "bg-orange-400" : "bg-blue-500"

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-400 flex items-center gap-1.5">
          <span>{icon}</span> {label}
          {stat.period && <span className="text-gray-600">({stat.period})</span>}
        </span>
        <span className={`font-medium ${danger ? "text-red-400" : warning ? "text-orange-400" : "text-gray-300"}`}>
          {stat.used.toLocaleString("fr-FR")} / {isUnlimited ? "∞" : stat.limit_display}
        </span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${isUnlimited ? "bg-green-500" : barColor}`}
          style={{ width: isUnlimited ? "8%" : `${stat.pct}%` }}
        />
      </div>
    </div>
  )
}

// ─── Plan badge ───────────────────────────────────────────────────────────────
const PLAN_STYLES: Record<string, string> = {
  starter:  "text-gray-300 bg-gray-800 border-gray-700",
  pro:      "text-blue-300 bg-blue-950/60 border-blue-700",
  business: "text-purple-300 bg-purple-950/60 border-purple-700",
}

export default function SettingsPage() {
  const { data: session, update } = useSession()
  const router = useRouter()
  const token = (session?.user as any)?.accessToken
  const { t } = useLang()

  const [fullName, setFullName] = useState((session?.user?.name as string) ?? "")
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const [currentPwd, setCurrentPwd] = useState("")
  const [newPwd, setNewPwd] = useState("")
  const [confirmPwd, setConfirmPwd] = useState("")
  const [savingPwd, setSavingPwd] = useState(false)
  const [pwdMsg, setPwdMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const [usage, setUsage] = useState<UsageData | null>(null)
  const [memory, setMemory] = useState<Memory | null>(null)
  const [clearingMemory, setClearingMemory] = useState(false)
  const [memoryMsg, setMemoryMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    setFullName((session?.user?.name as string) ?? "")
    fetch(`${API}/settings/usage`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        console.log("[Usage API response]", data)
        // Handle both old format { sessions, messages, sources }
        // and new format { plan, usage: { messages, sources, ... } }
        if (data && data.usage) {
          setUsage(data)
        } else if (data && typeof data.messages === "number") {
          // Old format — build compatible structure
          setUsage({
            plan: "starter",
            plan_label: "Starter",
            plan_price: 0,
            features: { web_search: false, api_access: false, competitive: false },
            usage: {
              messages: { used: data.messages ?? 0, limit: 500, limit_display: "500", pct: Math.min(Math.round((data.messages / 500) * 100), 100), period: "30 derniers jours" },
              sources:  { used: data.sources ?? 0,  limit: 3,   limit_display: "3",   pct: Math.min(Math.round((data.sources / 3) * 100), 100) },
              workflows:{ used: 0, limit: 1, limit_display: "1", pct: 0 },
              members:  { used: 1, limit: 1, limit_display: "1", pct: 100 },
            }
          })
        }
      })
      .catch(() => {})
    fetch(`${API}/settings/memory`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(data => setMemory(Object.keys(data).length ? data : null)).catch(() => {})
  }, [token])

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    setSavingProfile(true); setProfileMsg(null)
    try {
      const res = await fetch(`${API}/settings/profile`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail)
      setProfileMsg({ type: "success", text: "✅ Profil mis à jour" })
      await update({ name: fullName })
    } catch (err: any) {
      setProfileMsg({ type: "error", text: `❌ ${err.message}` })
    } finally { setSavingProfile(false) }
  }

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    if (newPwd !== confirmPwd) { setPwdMsg({ type: "error", text: "❌ Les mots de passe ne correspondent pas" }); return }
    setSavingPwd(true); setPwdMsg(null)
    try {
      const res = await fetch(`${API}/settings/password`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: currentPwd, new_password: newPwd }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail)
      setPwdMsg({ type: "success", text: "✅ Mot de passe mis à jour" })
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd("")
    } catch (err: any) {
      setPwdMsg({ type: "error", text: `❌ ${err.message}` })
    } finally { setSavingPwd(false) }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <AppHeader />
      <main className="max-w-2xl mx-auto px-6 py-10 space-y-8">

        <h1 className="text-2xl font-bold">{t.settings_title}</h1>

        {/* ── Plan & Usage ─────────────────────────────────────────────── */}
        {usage && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">

            {/* Plan header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Mon abonnement</h2>
                <p className="text-xs text-gray-500 mt-0.5">Utilisation sur les 30 derniers jours</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-3 py-1 rounded-full border font-semibold ${PLAN_STYLES[usage.plan] ?? PLAN_STYLES.starter}`}>
                  {usage.plan_label} {usage.plan_price > 0 ? `· ${usage.plan_price}€/mois` : "· Gratuit"}
                </span>
              </div>
            </div>

            {/* Usage bars */}
            <div className="space-y-4">
              <UsageBar label="Messages IA" icon="💬" stat={usage.usage.messages} />
              <UsageBar label="Sources de données" icon="🗄️" stat={usage.usage.sources} />
              <UsageBar label="Workflows" icon="🤖" stat={usage.usage.workflows} />
              <UsageBar label="Membres de l'équipe" icon="👥" stat={usage.usage.members} />
            </div>

            {/* Features included */}
            <div className="pt-3 border-t border-gray-800">
              <p className="text-xs text-gray-500 mb-3">Fonctionnalités incluses</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: "web_search", label: "Recherche web", icon: "🌐" },
                  { key: "competitive", label: "Veille concurrentielle", icon: "🔍" },
                  { key: "api_access", label: "Accès API", icon: "⚡" },
                ].map(f => {
                  const active = usage.features[f.key as keyof typeof usage.features]
                  return (
                    <span key={f.key} className={`text-xs px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${
                      active ? "text-green-400 bg-green-950/40 border-green-800" : "text-gray-600 bg-gray-800/40 border-gray-700"
                    }`}>
                      {f.icon} {f.label}
                      {active ? " ✓" : " ✗"}
                    </span>
                  )
                })}
              </div>
            </div>

            {/* Upgrade CTA — only for non-business */}
            {usage.plan !== "business" && (
              <div className={`rounded-xl p-4 border ${usage.plan === "starter" ? "border-blue-800 bg-blue-950/20" : "border-purple-800 bg-purple-950/20"}`}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    {usage.plan === "starter" ? (
                      <>
                        <p className="text-sm font-semibold text-white">Passez au plan Pro 🚀</p>
                        <p className="text-xs text-gray-400 mt-0.5">Messages illimités, recherche web, veille concurrentielle — 29€/mois</p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-white">Passez au plan Business 💼</p>
                        <p className="text-xs text-gray-400 mt-0.5">Tout illimité, équipe, SLA 99.9% — 99€/mois</p>
                      </>
                    )}
                  </div>
                  <a
                    href="mailto:thibautaffo01@gmail.com?subject=Upgrade CortexOS"
                    className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90 whitespace-nowrap ${
                      usage.plan === "starter"
                        ? "bg-blue-600 text-white hover:bg-blue-500"
                        : "bg-purple-600 text-white hover:bg-purple-500"
                    }`}
                  >
                    Upgrader →
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Language ─────────────────────────────────────────────────── */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold">{t.settings_lang}</h2>
          <LangSwitcher />
        </div>

        {/* ── Theme ────────────────────────────────────────────────────── */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold">{t.settings_theme}</h2>
          <ThemeSwitcher />
        </div>

        {/* ── Profile ──────────────────────────────────────────────────── */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold">{t.settings_profile}</h2>
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider">Email</label>
            <div className="mt-1 w-full rounded-lg bg-gray-800/50 border border-gray-700 px-4 py-2.5 text-sm text-gray-400">
              {session?.user?.email}
            </div>
          </div>
          <form onSubmit={saveProfile} className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider">Nom complet</label>
              <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)}
                className="mt-1 w-full rounded-lg bg-gray-800 border border-gray-700 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500" />
            </div>
            {profileMsg && (
              <p className={`text-sm px-3 py-2 rounded-lg border ${profileMsg.type === "success" ? "text-green-400 bg-green-950 border-green-800" : "text-red-400 bg-red-950 border-red-800"}`}>
                {profileMsg.text}
              </p>
            )}
            <button type="submit" disabled={savingProfile}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-medium transition-colors">
              {savingProfile ? "Enregistrement..." : "Enregistrer"}
            </button>
          </form>
        </div>

        {/* ── Password ─────────────────────────────────────────────────── */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold">{t.settings_password}</h2>
          <form onSubmit={savePassword} className="space-y-3">
            {[
              { label: "Mot de passe actuel", value: currentPwd, set: setCurrentPwd },
              { label: "Nouveau mot de passe", value: newPwd, set: setNewPwd },
              { label: "Confirmer le nouveau mot de passe", value: confirmPwd, set: setConfirmPwd },
            ].map(f => (
              <div key={f.label}>
                <label className="text-xs text-gray-400 uppercase tracking-wider">{f.label}</label>
                <input type="password" required value={f.value} onChange={e => f.set(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-gray-800 border border-gray-700 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  placeholder="••••••••" />
              </div>
            ))}
            {pwdMsg && (
              <p className={`text-sm px-3 py-2 rounded-lg border ${pwdMsg.type === "success" ? "text-green-400 bg-green-950 border-green-800" : "text-red-400 bg-red-950 border-red-800"}`}>
                {pwdMsg.text}
              </p>
            )}
            <button type="submit" disabled={savingPwd}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-medium transition-colors">
              {savingPwd ? "Mise à jour..." : "Changer le mot de passe"}
            </button>
          </form>
        </div>

        {/* ── Account info ─────────────────────────────────────────────── */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-base font-semibold mb-3">Mon compte</h2>
          <div className="space-y-2 text-sm text-gray-400">
            <div className="flex justify-between">
              <span>Rôle</span>
              <span className="text-white">{(session?.user as any)?.isAdmin ? "Administrateur" : "Membre"}</span>
            </div>
            <div className="flex justify-between">
              <span>Espace de travail</span>
              <span className="text-white">{(session?.user as any)?.tenantName}</span>
            </div>
            <div className="flex justify-between">
              <span>Plan actuel</span>
              <span className={`font-medium ${PLAN_STYLES[usage?.plan ?? "starter"]?.split(" ")[0]}`}>
                {usage?.plan_label ?? "—"}
              </span>
            </div>
          </div>
        </div>

        {/* ── Memory ───────────────────────────────────────────────────── */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Mémoire de l&apos;IA</h2>
              <p className="text-xs text-gray-500 mt-0.5">Ce que Cortex a appris sur vous</p>
            </div>
            {memory && (
              <button onClick={async () => {
                if (!token) return
                setClearingMemory(true)
                try {
                  await fetch(`${API}/settings/memory`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } })
                  setMemory(null); setMemoryMsg("✅ Mémoire effacée")
                  setTimeout(() => setMemoryMsg(null), 3000)
                } catch {}
                setClearingMemory(false)
              }} disabled={clearingMemory}
                className="px-3 py-1.5 rounded-lg text-xs text-red-400 border border-red-800 hover:bg-red-950/40 transition-colors disabled:opacity-50">
                {clearingMemory ? "⏳" : "🗑️ Effacer"}
              </button>
            )}
          </div>
          {memoryMsg && <p className="text-sm text-green-400">{memoryMsg}</p>}
          {!memory ? (
            <div className="text-center py-6 text-gray-600 text-sm">
              <p className="text-3xl mb-2">🧠</p>
              Pas encore de mémoire.<br />
              <span className="text-xs">Cortex apprend au fil de vos conversations.</span>
            </div>
          ) : (
            <div className="space-y-4 text-sm">
              {memory.profile && Object.values(memory.profile).some(Boolean) && (
                <div>
                  <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Profil</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {[{key:"sector",label:"Secteur"},{key:"company",label:"Entreprise"},{key:"role",label:"Rôle"},{key:"language",label:"Langue"}]
                      .map(f => memory.profile?.[f.key as keyof typeof memory.profile] ? (
                        <div key={f.key} className="bg-gray-800 rounded-lg px-3 py-2">
                          <p className="text-[11px] text-gray-500">{f.label}</p>
                          <p className="text-gray-200">{memory.profile[f.key as keyof typeof memory.profile]}</p>
                        </div>
                      ) : null)}
                  </div>
                </div>
              )}
              {memory.facts && memory.facts.length > 0 && (
                <div>
                  <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Faits mémorisés</h3>
                  <ul className="space-y-1.5">
                    {memory.facts.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-gray-300">
                        <span className="text-blue-400 shrink-0 mt-0.5">•</span>{f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {memory.projects && memory.projects.length > 0 && (
                <div>
                  <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Projets en cours</h3>
                  <ul className="space-y-1.5">
                    {memory.projects.map((p, i) => (
                      <li key={i} className="flex items-start gap-2 text-gray-300">
                        <span className="text-purple-400 shrink-0 mt-0.5">▸</span>{p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {memory.last_updated && (
                <p className="text-[11px] text-gray-600">
                  Mise à jour : {new Date(memory.last_updated).toLocaleString("fr-FR")}
                </p>
              )}
            </div>
          )}
        </div>

      </main>
    </div>
  )
}

type Memory = {
  profile?: { sector?: string; company?: string; role?: string; language?: string }
  preferences?: { response_style?: string; output_format?: string }
  facts?: string[]
  projects?: string[]
  last_updated?: string
}

export default function SettingsPage() {
  const { data: session, update } = useSession()
  const router = useRouter()
  const token = (session?.user as any)?.accessToken
  const { t } = useLang()

  const [fullName, setFullName] = useState((session?.user?.name as string) ?? "")
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const [currentPwd, setCurrentPwd] = useState("")
  const [newPwd, setNewPwd] = useState("")
  const [confirmPwd, setConfirmPwd] = useState("")
  const [savingPwd, setSavingPwd] = useState(false)
  const [pwdMsg, setPwdMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const [usage, setUsage] = useState<Usage | null>(null)
  const [memory, setMemory] = useState<Memory | null>(null)
  const [clearingMemory, setClearingMemory] = useState(false)
  const [memoryMsg, setMemoryMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    setFullName((session?.user?.name as string) ?? "")
    fetch(`${API}/settings/usage`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(setUsage)
      .catch(() => {})
    fetch(`${API}/settings/memory`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setMemory(Object.keys(data).length ? data : null))
      .catch(() => {})
  }, [token])

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    setSavingProfile(true)
    setProfileMsg(null)
    try {
      const res = await fetch(`${API}/settings/profile`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail)
      setProfileMsg({ type: "success", text: "✅ Profil mis à jour" })
      await update({ name: fullName })
    } catch (err: any) {
      setProfileMsg({ type: "error", text: `❌ ${err.message}` })
    } finally {
      setSavingProfile(false)
    }
  }

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    if (newPwd !== confirmPwd) {
      setPwdMsg({ type: "error", text: "❌ Les mots de passe ne correspondent pas" })
      return
    }
    setSavingPwd(true)
    setPwdMsg(null)
    try {
      const res = await fetch(`${API}/settings/password`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: currentPwd, new_password: newPwd }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail)
      setPwdMsg({ type: "success", text: "✅ Mot de passe mis à jour" })
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd("")
    } catch (err: any) {
      setPwdMsg({ type: "error", text: `❌ ${err.message}` })
    } finally {
      setSavingPwd(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <AppHeader />
      <main className="max-w-2xl mx-auto px-6 py-10 space-y-8">

        <h1 className="text-2xl font-bold">{t.settings_title}</h1>

        {/* Usage stats */}
        {usage && (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Conversations", value: usage.sessions, icon: "💬" },
              { label: "Messages", value: usage.messages, icon: "✉️" },
              { label: "Sources", value: usage.sources, icon: "📄" },
            ].map(s => (
              <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
                <div className="text-2xl mb-1">{s.icon}</div>
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-xs text-gray-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Language */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold">{t.settings_lang}</h2>
          <LangSwitcher />
        </div>

        {/* Theme */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold">{t.settings_theme}</h2>
          <ThemeSwitcher />
        </div>

        {/* Profile */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold">{t.settings_profile}</h2>

          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider">Email</label>
            <div className="mt-1 w-full rounded-lg bg-gray-800/50 border border-gray-700 px-4 py-2.5 text-sm text-gray-400">
              {session?.user?.email}
            </div>
          </div>

          <form onSubmit={saveProfile} className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider">Nom complet</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="mt-1 w-full rounded-lg bg-gray-800 border border-gray-700 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            {profileMsg && (
              <p className={`text-sm px-3 py-2 rounded-lg border ${
                profileMsg.type === "success" ? "text-green-400 bg-green-950 border-green-800" : "text-red-400 bg-red-950 border-red-800"
              }`}>{profileMsg.text}</p>
            )}
            <button
              type="submit"
              disabled={savingProfile}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-medium transition-colors"
            >
              {savingProfile ? "Enregistrement..." : "Enregistrer"}
            </button>
          </form>
        </div>

        {/* Password */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold">{t.settings_password}</h2>
          <form onSubmit={savePassword} className="space-y-3">
            {[
              { label: "Mot de passe actuel", value: currentPwd, set: setCurrentPwd },
              { label: "Nouveau mot de passe", value: newPwd, set: setNewPwd },
              { label: "Confirmer le nouveau mot de passe", value: confirmPwd, set: setConfirmPwd },
            ].map(f => (
              <div key={f.label}>
                <label className="text-xs text-gray-400 uppercase tracking-wider">{f.label}</label>
                <input
                  type="password"
                  required
                  value={f.value}
                  onChange={e => f.set(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-gray-800 border border-gray-700 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  placeholder="••••••••"
                />
              </div>
            ))}
            {pwdMsg && (
              <p className={`text-sm px-3 py-2 rounded-lg border ${
                pwdMsg.type === "success" ? "text-green-400 bg-green-950 border-green-800" : "text-red-400 bg-red-950 border-red-800"
              }`}>{pwdMsg.text}</p>
            )}
            <button
              type="submit"
              disabled={savingPwd}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-medium transition-colors"
            >
              {savingPwd ? "Mise à jour..." : "Changer le mot de passe"}
            </button>
          </form>
        </div>

        {/* Account info */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-base font-semibold mb-3">Mon compte</h2>
          <div className="space-y-2 text-sm text-gray-400">
            <div className="flex justify-between">
              <span>Rôle</span>
              <span className="text-white">{(session?.user as any)?.isAdmin ? "Administrateur" : "Membre"}</span>
            </div>
            <div className="flex justify-between">
              <span>Espace</span>
              <span className="text-white">{(session?.user as any)?.tenantName}</span>
            </div>
          </div>
        </div>

        {/* Memory */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Mémoire de l&apos;IA</h2>
              <p className="text-xs text-gray-500 mt-0.5">Ce que Cortex a appris sur vous au fil des conversations</p>
            </div>
            {memory && (
              <button
                onClick={async () => {
                  if (!token) return
                  setClearingMemory(true)
                  try {
                    await fetch(`${API}/settings/memory`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } })
                    setMemory(null)
                    setMemoryMsg("✅ Mémoire effacée")
                    setTimeout(() => setMemoryMsg(null), 3000)
                  } catch {}
                  setClearingMemory(false)
                }}
                disabled={clearingMemory}
                className="px-3 py-1.5 rounded-lg text-xs text-red-400 border border-red-800 hover:bg-red-950/40 transition-colors disabled:opacity-50"
              >
                {clearingMemory ? "⏳" : "🗑️ Effacer"}
              </button>
            )}
          </div>

          {memoryMsg && <p className="text-sm text-green-400">{memoryMsg}</p>}

          {!memory ? (
            <div className="text-center py-6 text-gray-600 text-sm">
              <p className="text-3xl mb-2">🧠</p>
              Pas encore de mémoire.<br />
              <span className="text-xs">Cortex apprend au fil de vos conversations.</span>
            </div>
          ) : (
            <div className="space-y-4 text-sm">
              {/* Profile */}
              {memory.profile && Object.values(memory.profile).some(Boolean) && (
                <div>
                  <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Profil</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: "sector", label: "Secteur" },
                      { key: "company", label: "Entreprise" },
                      { key: "role", label: "Rôle" },
                      { key: "language", label: "Langue" },
                    ].map(f => memory.profile?.[f.key as keyof typeof memory.profile] ? (
                      <div key={f.key} className="bg-gray-800 rounded-lg px-3 py-2">
                        <p className="text-[11px] text-gray-500">{f.label}</p>
                        <p className="text-gray-200">{memory.profile[f.key as keyof typeof memory.profile]}</p>
                      </div>
                    ) : null)}
                  </div>
                </div>
              )}

              {/* Facts */}
              {memory.facts && memory.facts.length > 0 && (
                <div>
                  <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Faits mémorisés</h3>
                  <ul className="space-y-1.5">
                    {memory.facts.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-gray-300">
                        <span className="text-blue-400 shrink-0 mt-0.5">•</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Projects */}
              {memory.projects && memory.projects.length > 0 && (
                <div>
                  <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Projets en cours</h3>
                  <ul className="space-y-1.5">
                    {memory.projects.map((p, i) => (
                      <li key={i} className="flex items-start gap-2 text-gray-300">
                        <span className="text-purple-400 shrink-0 mt-0.5">▸</span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {memory.last_updated && (
                <p className="text-[11px] text-gray-600">
                  Dernière mise à jour : {new Date(memory.last_updated).toLocaleString("fr-FR")}
                </p>
              )}
            </div>
          )}
        </div>

      </main>
    </div>
  )
}
