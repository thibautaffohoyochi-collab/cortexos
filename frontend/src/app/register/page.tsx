"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { authApi } from "@/lib/api"

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    company_name: "",
    full_name: "",
    email: "",
    password: "",
  })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      await authApi.register(form)
      // Auto-login after registration
      await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
      })
      // Redirect to onboarding for new users
      router.push("/onboarding")
    } catch (err: any) {
      setError(err.message ?? "Une erreur est survenue")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-sm space-y-6 p-8">

        <div className="text-center">
          <h1 className="text-2xl font-bold text-white tracking-tight">⬡ CortexOS</h1>
          <p className="text-sm text-gray-400 mt-1">Créer votre espace entreprise</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { key: "company_name", label: "Nom de l'entreprise", type: "text", placeholder: "Acme Corp" },
            { key: "full_name", label: "Votre nom", type: "text", placeholder: "Jean Dupont" },
            { key: "email", label: "Email professionnel", type: "email", placeholder: "vous@entreprise.com" },
            { key: "password", label: "Mot de passe", type: "password", placeholder: "••••••••" },
          ].map(field => (
            <div key={field.key}>
              <label className="text-xs text-gray-400 uppercase tracking-wider">{field.label}</label>
              <input
                type={field.type}
                required
                value={form[field.key as keyof typeof form]}
                onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                className="mt-1 w-full rounded-lg bg-gray-800 border border-gray-700 px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
                placeholder={field.placeholder}
              />
            </div>
          ))}

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
            {loading ? "Création..." : "Créer mon espace"}
          </button>
        </form>

        <p className="text-center text-xs text-gray-500">
          Déjà un compte ?{" "}
          <a href="/login" className="text-blue-400 hover:underline">Se connecter</a>
        </p>
      </div>
    </div>
  )
}
