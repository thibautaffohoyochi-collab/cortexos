"use client"

import { useEffect, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"

type Source = {
  id: string
  name: string
  source_type: string
  status: "pending" | "syncing" | "active" | "error"
  created_at: string
  error_message: string | null
}

const STATUS_COLORS: Record<string, string> = {
  active: "text-green-400 bg-green-950 border-green-800",
  syncing: "text-yellow-400 bg-yellow-950 border-yellow-800",
  pending: "text-gray-400 bg-gray-800 border-gray-700",
  error: "text-red-400 bg-red-950 border-red-800",
}

const STATUS_LABELS: Record<string, string> = {
  active: "✅ Actif",
  syncing: "⏳ En cours",
  pending: "🕐 En attente",
  error: "❌ Erreur",
}

export default function SourcesPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [sources, setSources] = useState<Source[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const token = (session?.user as any)?.accessToken

  const fetchSources = () => {
    if (!token) return
    fetch(`${API}/sources`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setSources(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchSources() }, [token])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !token) return

    setUploading(true)
    setUploadMsg(null)

    const form = new FormData()
    form.append("file", file)
    form.append("name", file.name.replace(/\.[^.]+$/, ""))

    try {
      const res = await fetch(`${API}/sources/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail ?? "Erreur upload")
      setUploadMsg({ type: "success", text: `✅ "${data.name}" importé — ${data.chunk_count} chunks indexés` })
      fetchSources()
    } catch (err: any) {
      setUploadMsg({ type: "error", text: `❌ ${err.message}` })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const handleDelete = async (id: string) => {
    if (!token) return
    await fetch(`${API}/sources/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
    setSources(prev => prev.filter(s => s.id !== id))
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <span className="text-lg font-semibold tracking-tight">⬡ CortexOS</span>
        <nav className="flex items-center gap-6 text-sm text-gray-400">
          <button onClick={() => router.push("/dashboard")} className="hover:text-white transition-colors">Dashboard</button>
          <button onClick={() => router.push("/chat")} className="hover:text-white transition-colors">Chat</button>
          <span className="text-white font-medium">Sources</span>
        </nav>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">

        <div>
          <h1 className="text-2xl font-bold">Sources de données</h1>
          <p className="text-gray-400 text-sm mt-1">
            Importez vos fichiers pour que l&apos;IA puisse répondre à partir de vos données.
          </p>
        </div>

        {/* Upload zone */}
        <div className="bg-gray-900 border border-dashed border-gray-700 rounded-2xl p-8 text-center space-y-4">
          <div className="text-4xl">📂</div>
          <div>
            <p className="text-sm text-gray-300 font-medium">Importer un fichier</p>
            <p className="text-xs text-gray-500 mt-1">Formats supportés : CSV, TXT — max 5 MB</p>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt"
            className="hidden"
            onChange={handleUpload}
          />

          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-medium transition-colors"
          >
            {uploading ? "Importation en cours..." : "Choisir un fichier"}
          </button>

          {uploadMsg && (
            <p className={`text-sm px-4 py-2 rounded-lg border ${
              uploadMsg.type === "success"
                ? "text-green-400 bg-green-950 border-green-800"
                : "text-red-400 bg-red-950 border-red-800"
            }`}>
              {uploadMsg.text}
            </p>
          )}
        </div>

        {/* Sources list */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
            Sources importées ({sources.length})
          </h2>

          {loading ? (
            <div className="space-y-3">
              {[1, 2].map(i => <div key={i} className="h-16 bg-gray-900 rounded-xl animate-pulse" />)}
            </div>
          ) : sources.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center text-gray-500 text-sm">
              Aucune source importée. Commencez par importer un fichier.
            </div>
          ) : (
            sources.map(s => (
              <div key={s.id} className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xl shrink-0">📄</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{s.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {new Date(s.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                    {s.error_message && (
                      <p className="text-xs text-red-400 mt-0.5 truncate">{s.error_message}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <span className={`text-xs px-2 py-1 rounded-full border ${STATUS_COLORS[s.status]}`}>
                    {STATUS_LABELS[s.status]}
                  </span>
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="text-gray-600 hover:text-red-400 transition-colors text-lg"
                    title="Supprimer"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Info box */}
        {sources.some(s => s.status === "active") && (
          <div className="bg-blue-950 border border-blue-800 rounded-xl px-5 py-4 text-sm text-blue-300">
            💡 Vos données sont indexées. Allez dans le{" "}
            <button onClick={() => router.push("/chat")} className="underline hover:text-blue-200">
              chat
            </button>{" "}
            et posez une question sur vos données.
          </div>
        )}

      </main>
    </div>
  )
}
