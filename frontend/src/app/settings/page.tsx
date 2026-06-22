"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { ThemeSwitcher } from "@/lib/theme"
import { LangSwitcher, useLang } from "@/lib/i18n"
import { AppHeader } from "@/components/ui/AppHeader"

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"

type Usage = { sessions: number; messages: number; sources: number }
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
