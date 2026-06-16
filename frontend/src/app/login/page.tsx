"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const router = useRouter()
  const [form, setForm] = useState({ email: "", password: "" })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    const result = await signIn("credentials", {
      email: form.email,
      password: form.password,
      redirect: false,
    })

    if (result?.error) {
      setError("Email ou mot de passe incorrect")
      setLoading(false)
    } else {
      router.push("/chat")
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-sm space-y-6 p-8">

        {/* Logo */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white tracking-tight">⬡ CortexOS</h1>
          <p className="text-sm text-gray-400 mt-1">Votre IA business</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="mt-1 w-full rounded-lg bg-gray-800 border border-gray-700 px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
              placeholder="vous@entreprise.com"
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider">Mot de passe</label>
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
            <p className="text-sm text-red-400 bg-red-950 border border-red-800 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 py-2.5 text-sm font-medium text-white transition-colors"
          >
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>

        <p className="text-center text-xs text-gray-500">
          Pas encore de compte ?{" "}
          <a href="/register" className="text-blue-400 hover:underline">Créer un espace</a>
        </p>
      </div>
    </div>
  )
}
