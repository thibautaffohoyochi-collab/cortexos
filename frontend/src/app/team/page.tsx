"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { AppHeader } from "@/components/ui/AppHeader"

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"

// ─── Types ────────────────────────────────────────────────────────────────────
type Member = {
  id: string
  email: string
  full_name: string
  is_admin: boolean
  created_at: string
}

type PendingInvite = {
  email: string
  full_name: string
  expires_at: string
  expired: boolean
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  "bg-blue-600", "bg-purple-600", "bg-emerald-600",
  "bg-orange-600", "bg-pink-600", "bg-cyan-600",
]
function Avatar({ name, email, size = "md" }: { name: string; email: string; size?: "sm" | "md" | "lg" }) {
  const idx = email.charCodeAt(0) % AVATAR_COLORS.length
  const sz = size === "lg" ? "w-12 h-12 text-base" : size === "sm" ? "w-7 h-7 text-xs" : "w-9 h-9 text-sm"
  return (
    <div className={`${sz} ${AVATAR_COLORS[idx]} rounded-full flex items-center justify-center font-bold text-white shrink-0`}>
      {(name || email)[0].toUpperCase()}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function TeamPage() {
  const { data: session } = useSession()
  const [members, setMembers] = useState<Member[]>([])
  const [pending, setPending] = useState<PendingInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState("")
  const [fullName, setFullName] = useState("")
  const [inviting, setInviting] = useState(false)
  const [inviteResult, setInviteResult] = useState<{ url: string; email: string; emailSent: boolean } | null>(null)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)
  const [promoting, setPromoting] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [showInviteForm, setShowInviteForm] = useState(false)

  const token = (session?.user as any)?.accessToken
  const currentUserId = (session?.user as any)?.id
  const isAdmin = (session?.user as any)?.isAdmin

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchMembers = async () => {
    if (!token) return
    try {
      const res = await fetch(`${API}/team/members`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setMembers(Array.isArray(data) ? data : [])
    } catch {}
    setLoading(false)
  }

  const fetchPending = async () => {
    if (!token || !isAdmin) return
    try {
      const res = await fetch(`${API}/team/pending-invites`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setPending(Array.isArray(data) ? data : [])
    } catch {}
  }

  useEffect(() => {
    fetchMembers()
    fetchPending()
  }, [token, isAdmin])

  // ── Invite ─────────────────────────────────────────────────────────────────
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !email) return
    setInviting(true)
    setError("")
    setInviteResult(null)
    try {
      const res = await fetch(`${API}/team/invite`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email, full_name: fullName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail ?? "Erreur")
      setInviteResult({ url: data.invite_url, email: data.email, emailSent: data.email_sent })
      setEmail("")
      setFullName("")
      fetchPending()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setInviting(false)
    }
  }

  // ── Remove ─────────────────────────────────────────────────────────────────
  const handleRemove = async (id: string) => {
    if (!token) return
    setRemoving(id)
    try {
      await fetch(`${API}/team/members/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      setMembers(prev => prev.filter(m => m.id !== id))
    } catch {}
    setRemoving(null)
  }

  // ── Promote ────────────────────────────────────────────────────────────────
  const handlePromote = async (id: string) => {
    if (!token) return
    setPromoting(id)
    try {
      const res = await fetch(`${API}/team/members/${id}/promote`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) {
        setMembers(prev => prev.map(m => m.id === id ? { ...m, is_admin: data.is_admin } : m))
      }
    } catch {}
    setPromoting(null)
  }

  // ── Copy link ──────────────────────────────────────────────────────────────
  const copyLink = () => {
    if (!inviteResult) return
    navigator.clipboard.writeText(inviteResult.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const admins = members.filter(m => m.is_admin)
  const regularMembers = members.filter(m => !m.is_admin)

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <AppHeader />
      <main className="max-w-3xl mx-auto px-4 md:px-6 py-8 space-y-8">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Équipe</h1>
            <p className="text-gray-400 text-sm mt-1">
              {members.length} membre{members.length > 1 ? "s" : ""} dans votre espace
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => { setShowInviteForm(f => !f); setInviteResult(null); setError("") }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>{showInviteForm ? "×" : "+"}</span>
              {showInviteForm ? "Fermer" : "Inviter"}
            </button>
          )}
        </div>

        {/* ── Stats bar ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: "👥", label: "Membres", value: members.length },
            { icon: "🛡️", label: "Admins", value: admins.length },
            { icon: "✉️", label: "Invitations", value: pending.filter(p => !p.expired).length },
          ].map(s => (
            <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-center">
              <p className="text-xl">{s.icon}</p>
              <p className="text-2xl font-bold mt-1">{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── Invite form ─────────────────────────────────────────────────── */}
        {isAdmin && showInviteForm && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4 animate-fade-in">
            <h2 className="text-base font-semibold">Inviter un collaborateur</h2>
            <form onSubmit={handleInvite} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-wider">Email *</label>
                  <input
                    type="email" required value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="collegue@entreprise.com"
                    className="mt-1 w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-wider">Nom (optionnel)</label>
                  <input
                    type="text" value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="Jean Dupont"
                    className="mt-1 w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-400 bg-red-950/50 border border-red-800 rounded-lg px-3 py-2">{error}</p>
              )}

              <button
                type="submit" disabled={inviting || !email}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-medium transition-all hover:scale-[1.01] active:scale-[0.99]"
              >
                {inviting ? "⏳ Génération…" : "✉️ Générer le lien d'invitation"}
              </button>
            </form>

            {/* Invite result */}
            {inviteResult && (
              <div className="bg-green-950/50 border border-green-800 rounded-xl p-4 space-y-3 animate-fade-in">
                <div className="flex items-center gap-2">
                  <span className="text-green-400 text-lg">✅</span>
                  <div>
                    <p className="text-sm text-green-400 font-medium">Invitation créée pour {inviteResult.email}</p>
                    <p className="text-xs text-gray-500">
                      {inviteResult.emailSent ? "Email envoyé automatiquement" : "Partagez ce lien manuellement (email non configuré)"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <input
                    readOnly value={inviteResult.url}
                    className="flex-1 rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-xs text-gray-300 font-mono"
                  />
                  <button
                    onClick={copyLink}
                    className="px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-xs transition-colors whitespace-nowrap"
                  >
                    {copied ? "✅ Copié" : "📋 Copier"}
                  </button>
                </div>
                <p className="text-xs text-gray-600">⏱ Valable 7 jours</p>
              </div>
            )}
          </div>
        )}

        {/* ── Members list ────────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Admins section */}
          {admins.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <span>🛡️</span> Administrateurs
              </h2>
              {admins.map(m => (
                <MemberRow
                  key={m.id}
                  member={m}
                  isCurrentUser={m.id === currentUserId}
                  isAdmin={isAdmin}
                  promoting={promoting === m.id}
                  removing={removing === m.id}
                  onPromote={() => handlePromote(m.id)}
                  onRemove={() => handleRemove(m.id)}
                />
              ))}
            </div>
          )}

          {/* Regular members */}
          {regularMembers.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <span>👤</span> Membres
              </h2>
              {regularMembers.map(m => (
                <MemberRow
                  key={m.id}
                  member={m}
                  isCurrentUser={m.id === currentUserId}
                  isAdmin={isAdmin}
                  promoting={promoting === m.id}
                  removing={removing === m.id}
                  onPromote={() => handlePromote(m.id)}
                  onRemove={() => handleRemove(m.id)}
                />
              ))}
            </div>
          )}

          {loading && (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-900 rounded-xl animate-pulse" />)}
            </div>
          )}

          {!loading && members.length === 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center text-gray-500 text-sm">
              <p className="text-3xl mb-2">👥</p>
              Aucun membre pour l&apos;instant.
            </div>
          )}
        </div>

        {/* ── Pending invitations ─────────────────────────────────────────── */}
        {isAdmin && pending.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <span>✉️</span> Invitations en attente
            </h2>
            {pending.map((inv, i) => (
              <div key={i} className={`flex items-center justify-between px-5 py-3 rounded-xl border ${
                inv.expired ? "bg-gray-900/50 border-gray-800 opacity-50" : "bg-gray-900 border-gray-800"
              }`}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm">
                    ✉️
                  </div>
                  <div>
                    <p className="text-sm text-gray-300">{inv.email}</p>
                    {inv.full_name && <p className="text-xs text-gray-500">{inv.full_name}</p>}
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full border ${
                  inv.expired
                    ? "text-red-400 bg-red-950/50 border-red-800"
                    : "text-yellow-400 bg-yellow-950/50 border-yellow-800"
                }`}>
                  {inv.expired ? "Expirée" : "En attente"}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ── Non-admin notice ────────────────────────────────────────────── */}
        {!isAdmin && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 text-sm text-gray-400">
            💡 Seuls les administrateurs peuvent inviter des membres ou modifier les rôles.
          </div>
        )}

      </main>
    </div>
  )
}

// ─── Member row component ─────────────────────────────────────────────────────
function MemberRow({
  member, isCurrentUser, isAdmin, promoting, removing, onPromote, onRemove,
}: {
  member: Member
  isCurrentUser: boolean
  isAdmin: boolean
  promoting: boolean
  removing: boolean
  onPromote: () => void
  onRemove: () => void
}) {
  const [showActions, setShowActions] = useState(false)

  return (
    <div
      className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl px-5 py-4 flex items-center justify-between transition-colors group"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ${
          ["bg-blue-600","bg-purple-600","bg-emerald-600","bg-orange-600","bg-pink-600","bg-cyan-600"][member.email.charCodeAt(0) % 6]
        }`}>
          {(member.full_name || member.email)[0].toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate">{member.full_name || member.email}</p>
            {isCurrentUser && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-950 border border-blue-800 text-blue-400 shrink-0">
                Vous
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 truncate">{member.email}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-4">
        {/* Role badge */}
        <span className={`text-xs px-2 py-1 rounded-full border ${
          member.is_admin
            ? "text-blue-400 bg-blue-950/50 border-blue-800"
            : "text-gray-500 bg-gray-800/50 border-gray-700"
        }`}>
          {member.is_admin ? "🛡️ Admin" : "👤 Membre"}
        </span>

        {/* Admin actions */}
        {isAdmin && !isCurrentUser && (showActions || promoting || removing) && (
          <div className="flex items-center gap-1 animate-fade-in">
            <button
              onClick={onPromote}
              disabled={promoting}
              title={member.is_admin ? "Rétrograder en membre" : "Promouvoir admin"}
              className="px-2 py-1 rounded-lg text-xs text-gray-400 hover:text-blue-400 hover:bg-blue-950/30 transition-all disabled:opacity-50"
            >
              {promoting ? "⏳" : member.is_admin ? "↓" : "↑"}
            </button>
            <button
              onClick={onRemove}
              disabled={removing}
              title="Retirer de l'équipe"
              className="px-2 py-1 rounded-lg text-xs text-gray-500 hover:text-red-400 hover:bg-red-950/30 transition-all disabled:opacity-50"
            >
              {removing ? "⏳" : "×"}
            </button>
          </div>
        )}

        {/* Joined date */}
        <span className="text-xs text-gray-600 hidden sm:block">
          {new Date(member.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
        </span>
      </div>
    </div>
  )
}
