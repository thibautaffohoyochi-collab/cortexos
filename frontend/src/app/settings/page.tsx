"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { ThemeSwitcher } from "@/lib/theme"

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"

type Usage = { sessions: number; messages: number; sources: number }

export default function SettingsPage() {
  const { data: session, update } = useSession()
  const router = useRouter()
  const token = (session?.user as any)?.accessToken

  const [fullName, setFullName] = useState((session?.user?.name as string) ?? "")
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const [currentPwd, setCurrentPwd] = useState("")
  const [newPwd, setNewPwd] = useState("")
  const [confirmPwd, setConfirmPwd] = useState("")
  const [savingPwd, setSavingPwd] = useState(false)
  const [pwdMsg, setPwdMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const [usage, setUsage] = useState<Usage | null>(null)

  useEffect(() => {
    if (!token) return
    setFullName((session?.user?.name as string) ?? "")
    fetch(`${API}/settings/usage`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(setUsage)
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
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <span className="text-lg font-semibold tracking-tight">⬡ CortexOS</span>
        <nav className="flex items-center gap-6 text-sm text-gray-400">
          <button onClick={() => router.push("/dashboard")} className="hover:text-white transition-colors">Dashboard</button>
          <button onClick={() => router.push("/chat")} className="hover:text-white transition-colors">Chat</button>
          <button onClick={() => router.push("/team")} className="hover:text-white transition-colors">Équipe</button>
          <span className="text-white font-medium">Paramètres</span>
        </nav>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10 space-y-8">

        <h1 className="text-2xl font-bold">Paramètres</h1>

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

        {/* Theme */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold">Thème de l&apos;interface</h2>
          <ThemeSwitcher />
        </div>

        {/* Profile */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold">Mon profil</h2>

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
          <h2 className="text-base font-semibold">Changer le mot de passe</h2>
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

      </main>
    </div>
  )
}
