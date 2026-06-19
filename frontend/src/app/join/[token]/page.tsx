"use client"

import { useEffect, useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useParams } from "next/navigation"

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"

export default function JoinPage() {
  const router = useRouter()
  const params = useParams()
  const token = params.token as string

  const [invite, setInvite] = useState<{ email: string; full_name: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [form, setForm] = useState({ full_name: "", password: "" })
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    fetch(`${API}/team/invite/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.detail) throw new Error(data.detail)
        setInvite(data)
        setForm(f => ({ ...f, full_name: data.full_name || "" }))
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [token])

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    setJoining(true)
    setError("")

    try {
      const res = await fetch(`${API}/team/join/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail ?? "Erreur")

      // Auto login
      await signIn("credentials", {
        email: invite!.email,
        password: form.password,
        redirect: false,
      })
      router.push("/chat")
    } catch (err: any) {
      setError(err.message)
      setJoining(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400">Vérification de l&apos;invitation...</div>
      </div>
    )
  }

  if (error && !invite) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-red-400 text-lg">❌ {error}</p>
          <button onClick={() => router.push("/login")} className="text-blue-400 hover:underline text-sm">
            Retour à la connexion
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-full max-w-sm space-y-6 p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white tracking-tight">⬡ CortexOS</h1>
          <p className="text-sm text-gray-400 mt-1">Rejoindre votre équipe</p>
        </div>

        <div className="bg-blue-950 border border-blue-800 rounded-xl px-4 py-3 text-sm text-blue-300">
          Vous avez été invité avec <strong>{invite?.email}</strong>
        </div>

        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider">Votre nom</label>
            <input
              type="text"
              required
              value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              className="mt-1 w-full rounded-lg bg-gray-800 border border-gray-700 px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
              placeholder="Jean Dupont"
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider">Choisir un mot de passe</label>
            <input
              type="password"
              required
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              className="mt-1 w-full rounded-lg bg-gray-800 border border-gray-700 px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-950 border border-red-800 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={joining}
            className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 py-2.5 text-sm font-medium text-white transition-colors"
          >
            {joining ? "Rejoindre..." : "Rejoindre l'équipe"}
          </button>
        </form>
      </div>
    </div>
  )
}
