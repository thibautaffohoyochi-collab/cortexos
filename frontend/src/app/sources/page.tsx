"use client"

import { useEffect, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { DragDropZone, ConfettiSuccess, KnowledgeGraph, AnimatedCheck } from "@/components/ui/animations"
import { AppHeader } from "@/components/ui/AppHeader"

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"

type Source = {
  id: string
  name: string
  source_type: string
  status: "pending" | "syncing" | "active" | "error"
  created_at: string
  error_message: string | null
  format?: string
}

const FORMAT_ICONS: Record<string, string> = {
  PDF:  "📕",
  XLSX: "📗",
  XLS:  "📗",
  CSV:  "📊",
  TXT:  "📄",
  DOCX: "📘",
  DOC:  "📘",
}

const getSourceIcon = (source: Source) => {
  if (source.format) return FORMAT_ICONS[source.format] ?? "📄"
  if (source.source_type === "gmail") return "📧"
  if (source.source_type === "google_drive") return "📁"
  if (source.source_type === "excel") return "📗"
  return "📄"
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
  const [showConfetti, setShowConfetti] = useState(false)
  const [showCheck, setShowCheck] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [syncing, setSyncing] = useState<string | null>(null) // "gmail" | "drive"

  const token = (session?.user as any)?.accessToken

  const fetchSources = () => {
    if (!token) return
    fetch(`${API}/sources`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setSources(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchSources() }, [token])

  const syncGoogle = async (type: "gmail" | "drive") => {
    if (!token) return
    setSyncing(type)
    setUploadMsg({ type: "success", text: `⏳ Synchronisation ${type === "gmail" ? "Gmail" : "Drive"} en cours...` })
    try {
      const res = await fetch(`${API}/google/sync/${type}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail ?? "Erreur")
      setUploadMsg({ type: "success", text: `✅ ${data.message} — ${data.chunk_count} chunks indexés` })
      fetchSources()
    } catch (err: any) {
      setUploadMsg({ type: "error", text: `❌ ${err.message}` })
    } finally {
      setSyncing(null)
    }
  }

  // Auto-sync after Google OAuth redirect
  useEffect(() => {
    if (!token) return
    const params = new URLSearchParams(window.location.search)
    const connected = params.get("google_connected")
    if (connected === "gmail" || connected === "drive") {
      window.history.replaceState({}, "", "/sources")
      syncGoogle(connected as "gmail" | "drive")
    }
  }, [token])

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
      setShowConfetti(true)
      setShowCheck(true)
      setTimeout(() => setShowCheck(false), 3000)
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
      <AppHeader />
      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">

        <div>
          <h1 className="text-2xl font-bold">Sources de données</h1>
          <p className="text-gray-400 text-sm mt-1">
            Importez vos fichiers pour que l&apos;IA puisse répondre à partir de vos données.
            Formats supportés : PDF, Excel, Word, CSV, TXT.
          </p>
        </div>

        {/* Google Connect buttons */}
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
            Connecter vos services
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Gmail */}
            <div className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl px-5 py-4 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📧</span>
                  <div>
                    <p className="text-sm font-medium">Gmail</p>
                    <p className="text-xs text-gray-500">Importer vos emails</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {sources.some(s => s.source_type === "gmail") && (
                    <button
                      onClick={() => syncGoogle("gmail")}
                      disabled={syncing === "gmail"}
                      className="text-xs px-2 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors disabled:opacity-50"
                    >
                      {syncing === "gmail" ? "⏳" : "🔄"}
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      if (!token) return
                      const res = await fetch(`${API}/google/auth-url?source=gmail`, {
                        headers: { Authorization: `Bearer ${token}` }
                      })
                      const data = await res.json()
                      if (data.url) window.location.href = data.url
                    }}
                    className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                  >
                    {sources.some(s => s.source_type === "gmail") ? "Reconnecter" : "Connecter"}
                  </button>
                </div>
              </div>
            </div>

            {/* Google Drive */}
            <div className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl px-5 py-4 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📁</span>
                  <div>
                    <p className="text-sm font-medium">Google Drive</p>
                    <p className="text-xs text-gray-500">Importer vos fichiers</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {sources.some(s => s.source_type === "google_drive") && (
                    <button
                      onClick={() => syncGoogle("drive")}
                      disabled={syncing === "drive"}
                      className="text-xs px-2 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors disabled:opacity-50"
                    >
                      {syncing === "drive" ? "⏳" : "🔄"}
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      if (!token) return
                      const res = await fetch(`${API}/google/auth-url?source=drive`, {
                        headers: { Authorization: `Bearer ${token}` }
                      })
                      const data = await res.json()
                      if (data.url) window.location.href = data.url
                    }}
                    className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                  >
                    {sources.some(s => s.source_type === "google_drive") ? "Reconnecter" : "Connecter"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Upload zone — DragDrop */}
        <div className="space-y-3">
          <DragDropZone onFile={async (file) => {
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
              setUploadMsg({ type: "success", text: `"${data.name}" importé — ${data.chunk_count} chunks indexés` })
              setShowConfetti(true)
              setShowCheck(true)
              setTimeout(() => setShowCheck(false), 3000)
              fetchSources()
            } catch (err: any) {
              setUploadMsg({ type: "error", text: err.message })
            } finally {
              setUploading(false)
            }
          }} />

          {uploading && (
            <div className="flex justify-center py-2">
              <div className="flex items-center gap-2 text-sm text-blue-400 animate-pulse">
                <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                Indexation en cours…
              </div>
            </div>
          )}

          {uploadMsg && (
            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm animate-fade-in-up ${
              uploadMsg.type === "success"
                ? "text-green-400 bg-green-950/50 border-green-800"
                : "text-red-400 bg-red-950/50 border-red-800"
            }`}>
              {uploadMsg.type === "success" && showCheck && <AnimatedCheck size={24} />}
              {uploadMsg.text}
            </div>
          )}
        </div>

        {/* Confetti */}
        <ConfettiSuccess show={showConfetti} onDone={() => setShowConfetti(false)} />

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
                  <span className="text-xl shrink-0">{getSourceIcon(s)}</span>
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
