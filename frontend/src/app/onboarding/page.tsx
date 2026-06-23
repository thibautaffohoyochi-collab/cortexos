"use client"

import { useState, useRef } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useLang } from "@/lib/i18n"

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i === current ? "w-6 bg-blue-500" : i < current ? "w-3 bg-blue-800" : "w-3 bg-gray-700"
          }`}
        />
      ))}
    </div>
  )
}

// ─── Step 1 — Welcome ─────────────────────────────────────────────────────────
function StepWelcome({ name, onNext }: { name: string; onNext: () => void }) {
  const features = [
    { icon: "💬", title: "Chat sur vos données", desc: "Interrogez vos fichiers, emails et documents en langage naturel." },
    { icon: "🌐", title: "Recherche web hybride", desc: "Combinez vos données internes avec une recherche internet en temps réel." },
    { icon: "🤖", title: "Workflows automatisés", desc: "Créez des agents qui analysent, résument et envoient des rapports." },
    { icon: "📊", title: "Dashboard intelligent", desc: "Suivez votre activité et accédez à tout en un coup d'œil." },
  ]

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="text-center space-y-3">
        <div className="text-6xl animate-pulse" style={{ animationDuration: "3s" }}>⬡</div>
        <h1 className="text-3xl font-bold text-white">
          Bienvenue sur <span style={{ background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>CortexOS</span>
        </h1>
        <p className="text-gray-400 text-base">
          Bonjour <strong className="text-white">{name}</strong> ! Votre IA business est prête. Voici ce que vous pouvez faire.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {features.map((f, i) => (
          <div
            key={i}
            className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex gap-3 items-start animate-fade-in-up"
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <span className="text-2xl shrink-0">{f.icon}</span>
            <div>
              <p className="text-sm font-semibold text-white">{f.title}</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={onNext}
        className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-base transition-all hover:scale-[1.01] active:scale-[0.99] shadow-lg"
      >
        Commencer la configuration →
      </button>
    </div>
  )
}

// ─── Step 2 — Import source ───────────────────────────────────────────────────
function StepSource({ token, onNext, onSkip }: { token: string; onNext: () => void; onSkip: () => void }) {
  const [uploading, setUploading] = useState(false)
  const [done, setDone] = useState(false)
  const [msg, setMsg] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setUploading(true)
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
      if (!res.ok) throw new Error(data.detail)
      setMsg(`✅ "${data.name}" importé — ${data.chunk_count} chunks indexés`)
      setDone(true)
      setTimeout(onNext, 1500)
    } catch (err: any) {
      setMsg(`❌ ${err.message}`)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center space-y-2">
        <div className="text-5xl">📂</div>
        <h2 className="text-2xl font-bold text-white">Importez votre première source</h2>
        <p className="text-gray-400 text-sm">L'IA pourra répondre à partir de vos données.</p>
      </div>

      <div className="space-y-3">
        {/* File upload */}
        <div
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
            done ? "border-green-500 bg-green-950/20" : "border-gray-700 hover:border-blue-500 hover:bg-blue-950/10"
          }`}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt,.pdf,.xlsx,.xls,.docx,.doc"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-blue-400 animate-pulse">Indexation en cours…</p>
            </div>
          ) : done ? (
            <div className="text-green-400 text-4xl">✅</div>
          ) : (
            <div className="space-y-2">
              <div className="text-4xl">📁</div>
              <p className="text-sm font-medium text-gray-300">Glissez un fichier ou cliquez</p>
              <div className="flex justify-center gap-1.5 flex-wrap mt-2">
                {["📕 PDF", "📗 Excel", "📘 Word", "📊 CSV", "📄 TXT"].map(f => (
                  <span key={f} className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700">{f}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {msg && (
          <p className={`text-sm text-center ${msg.startsWith("✅") ? "text-green-400" : "text-red-400"}`}>{msg}</p>
        )}

        {/* Google options */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: "📧", label: "Gmail", type: "gmail" },
            { icon: "📁", label: "Google Drive", type: "drive" },
          ].map(g => (
            <button
              key={g.type}
              onClick={async () => {
                const res = await fetch(`${API}/google/auth-url?source=${g.type}`, {
                  headers: { Authorization: `Bearer ${token}` }
                })
                const data = await res.json()
                if (data.url) window.location.href = data.url
              }}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-gray-900 border border-gray-800 hover:border-gray-600 text-sm text-gray-300 transition-colors"
            >
              <span>{g.icon}</span> Connecter {g.label}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={onSkip}
        className="w-full py-2.5 rounded-xl text-gray-500 hover:text-gray-300 text-sm transition-colors"
      >
        Passer cette étape →
      </button>
    </div>
  )
}

// ─── Step 3 — First chat ──────────────────────────────────────────────────────
function StepChat({ token, onNext, onSkip }: { token: string; onNext: () => void; onSkip: () => void }) {
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [reply, setReply] = useState("")
  const [done, setDone] = useState(false)

  const SUGGESTIONS = [
    "Qui suis-je et que fait mon entreprise ?",
    "Quelles sont mes données disponibles ?",
    "Comment puis-je utiliser CortexOS ?",
  ]

  const sendMessage = async (msg?: string) => {
    const q = msg ?? input
    if (!q.trim() || loading) return
    setLoading(true)
    setReply("")
    try {
      const res = await fetch(`${API}/chat/message`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ content: q, session_id: null }),
      })
      const data = await res.json()
      setReply(data.assistant_message ?? "")
      setDone(true)
    } catch {
      setReply("❌ Erreur lors de la connexion au serveur.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center space-y-2">
        <div className="text-5xl">💬</div>
        <h2 className="text-2xl font-bold text-white">Faites votre premier chat</h2>
        <p className="text-gray-400 text-sm">Posez une question à votre assistant IA.</p>
      </div>

      <div className="space-y-3">
        {/* Suggestions */}
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              onClick={() => { setInput(s); sendMessage(s) }}
              disabled={loading}
              className="px-3 py-2 rounded-xl text-xs text-gray-400 border border-gray-800 hover:border-blue-500/40 hover:text-white hover:bg-gray-800/40 transition-all disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMessage()}
            disabled={loading}
            placeholder="Posez votre première question…"
            className="flex-1 rounded-xl bg-gray-900 border border-gray-800 focus:border-blue-500 px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none"
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            className="px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm transition-colors"
          >
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "→"}
          </button>
        </div>

        {/* Reply */}
        {reply && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 text-sm text-gray-300 animate-fade-in max-h-40 overflow-y-auto">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-[10px]">⬡</div>
              <span className="text-xs text-gray-500">CortexOS</span>
            </div>
            {reply}
          </div>
        )}
      </div>

      {done ? (
        <button
          onClick={onNext}
          className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all hover:scale-[1.01] active:scale-[0.99]"
        >
          Continuer →
        </button>
      ) : (
        <button onClick={onSkip} className="w-full py-2.5 rounded-xl text-gray-500 hover:text-gray-300 text-sm transition-colors">
          Passer cette étape →
        </button>
      )}
    </div>
  )
}

// ─── Step 4 — Done ────────────────────────────────────────────────────────────
function StepDone({ onFinish }: { onFinish: () => void }) {
  const items = [
    { icon: "📊", label: "Dashboard", path: "/dashboard" },
    { icon: "💬", label: "Chat", path: "/chat" },
    { icon: "📂", label: "Sources", path: "/sources" },
    { icon: "🌐", label: "Web Search", path: "/websearch" },
    { icon: "🤖", label: "Agents", path: "/agents" },
  ]

  return (
    <div className="space-y-8 animate-fade-in text-center">
      <div className="space-y-3">
        <div className="text-6xl">🎉</div>
        <h2 className="text-3xl font-bold text-white">Vous êtes prêt !</h2>
        <p className="text-gray-400">CortexOS est configuré. Explorez toutes les fonctionnalités.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {items.map(item => (
          <div
            key={item.path}
            className="bg-gray-900 border border-gray-800 hover:border-blue-500/40 rounded-2xl p-4 text-center transition-all hover:scale-[1.02] cursor-default"
          >
            <div className="text-3xl mb-2">{item.icon}</div>
            <p className="text-sm font-medium text-white">{item.label}</p>
          </div>
        ))}
      </div>

      <button
        onClick={onFinish}
        className="w-full py-4 rounded-2xl text-white font-bold text-lg transition-all hover:scale-[1.01] active:scale-[0.99] shadow-xl"
        style={{ background: "linear-gradient(135deg, #2563eb, #7c3aed)" }}
      >
        Aller sur le Dashboard →
      </button>
    </div>
  )
}

// ─── Main wizard ──────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [step, setStep] = useState(0)

  const token = (session?.user as any)?.accessToken
  const name = (session?.user as any)?.name?.split(" ")[0] ?? "vous"

  const TOTAL_STEPS = 4
  const next = () => setStep(s => Math.min(s + 1, TOTAL_STEPS - 1))
  const skip = () => next()

  const finish = () => {
    localStorage.setItem("cortexos-onboarding-done", "1")
    router.push("/dashboard")
  }

  return (
    <div
      className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4 py-8"
      style={{ background: "radial-gradient(ellipse at top, rgba(37,99,235,0.08) 0%, transparent 60%), #030712" }}
    >
      <div className="w-full max-w-lg space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="logo-animated text-lg">⬡</span>
            <span className="font-bold text-sm text-gray-300">CortexOS</span>
          </div>
          <StepDots current={step} total={TOTAL_STEPS} />
          <button
            onClick={finish}
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
          >
            Passer →
          </button>
        </div>

        {/* Step content */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-3xl p-6 md:p-8 backdrop-blur-sm">
          {step === 0 && <StepWelcome name={name} onNext={next} />}
          {step === 1 && <StepSource token={token} onNext={next} onSkip={skip} />}
          {step === 2 && <StepChat token={token} onNext={next} onSkip={skip} />}
          {step === 3 && <StepDone onFinish={finish} />}
        </div>

        {/* Step label */}
        <p className="text-center text-xs text-gray-700">
          Étape {step + 1} sur {TOTAL_STEPS}
        </p>
      </div>
    </div>
  )
}
