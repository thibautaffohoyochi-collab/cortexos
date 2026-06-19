"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"

type Member = {
  id: string
  email: string
  full_name: string
  is_admin: boolean
  created_at: string
}

export default function TeamPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState("")
  const [fullName, setFullName] = useState("")
  const [inviting, setInviting] = useState(false)
  const [inviteResult, setInviteResult] = useState<{ url: string; email: string } | null>(null)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)

  const token = (session?.user as any)?.accessToken
  const isAdmin = (session?.user as any)?.isAdmin

  const fetchMembers = () => {
    if (!token) return
    fetch(`${API}/team/members`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setMembers(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchMembers() }, [token])

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
      setInviteResult({ url: data.invite_url, email: data.email })
      setEmail("")
      setFullName("")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setInviting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!token) return
    await fetch(`${API}/team/members/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
    setMembers(prev => prev.filter(m => m.id !== id))
  }

  const copyLink = () => {
    if (!inviteResult) return
    navigator.clipboard.writeText(inviteResult.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <span className="text-lg font-semibold tracking-tight">⬡ CortexOS</span>
        <nav className="flex items-center gap-6 text-sm text-gray-400">
          <button onClick={() => router.push("/dashboard")} className="hover:text-white transition-colors">Dashboard</button>
          <button onClick={() => router.push("/chat")} className="hover:text-white transition-colors">Chat</button>
          <button onClick={() => router.push("/sources")} className="hover:text-white transition-colors">Sources</button>
          <span className="text-white font-medium">Équipe</span>
        </nav>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">

        <div>
          <h1 className="text-2xl font-bold">Gestion de l&apos;équipe</h1>
          <p className="text-gray-400 text-sm mt-1">Invitez des collègues dans votre espace entreprise.</p>
        </div>

        {/* Invite form — admin only */}
        {isAdmin && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
            <h2 className="text-base font-semibold">Inviter un collaborateur</h2>
            <form onSubmit={handleInvite} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-wider">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="collegue@entreprise.com"
                    className="mt-1 w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-wider">Nom (optionnel)</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="Jean Dupont"
                    className="mt-1 w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-400 bg-red-950 border border-red-800 rounded-lg px-3 py-2">{error}</p>
              )}

              <button
                type="submit"
                disabled={inviting}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-medium transition-colors"
              >
                {inviting ? "Génération..." : "Générer un lien d'invitation"}
              </button>
            </form>

            {/* Invite result */}
            {inviteResult && (
              <div className="bg-green-950 border border-green-800 rounded-xl p-4 space-y-2">
                <p className="text-sm text-green-400 font-medium">✅ Lien créé pour {inviteResult.email}</p>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={inviteResult.url}
                    className="flex-1 rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-xs text-gray-300"
                  />
                  <button
                    onClick={copyLink}
                    className="px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-xs transition-colors"
                  >
                    {copied ? "✅ Copié" : "Copier"}
                  </button>
                </div>
                <p className="text-xs text-gray-500">Valable 7 jours — partagez ce lien avec votre collègue</p>
              </div>
            )}
          </div>
        )}

        {/* Members list */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
            Membres ({members.length})
          </h2>

          {loading ? (
            <div className="space-y-3">
              {[1, 2].map(i => <div key={i} className="h-16 bg-gray-900 rounded-xl animate-pulse" />)}
            </div>
          ) : (
            members.map(m => (
              <div key={m.id} className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold">
                    {(m.full_name || m.email)[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{m.full_name || m.email}</p>
                    <p className="text-xs text-gray-500">{m.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {m.is_admin && (
                    <span className="text-xs px-2 py-1 rounded-full bg-blue-950 border border-blue-800 text-blue-400">
                      Admin
                    </span>
                  )}
                  {isAdmin && !m.is_admin && (
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="text-gray-600 hover:text-red-400 transition-colors text-lg"
                      title="Retirer"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

      </main>
    </div>
  )
}
