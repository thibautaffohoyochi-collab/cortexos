"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { AppHeader } from "@/components/ui/AppHeader"
import { ThinkingLoader } from "@/components/ui/animations"
import { useLang } from "@/lib/i18n"

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"

// ─── Types ────────────────────────────────────────────────────────────────────
type Source = { title: string; url: string; snippet: string }
type Message = {
  role: "user" | "assistant"
  content: string
  sources?: Source[]
}
type Session = { id: string; title: string; created_at: string }

// ─── Markdown renderer ────────────────────────────────────────────────────────
function renderMarkdown(text: string) {
  return text.split("\n").map((line, i) => {
    // Convert [text](url) to anchor tags
    const withLinks = line.replace(
      /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-300 underline underline-offset-2">$1</a>'
    )
    const html = withLinks
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")

    if (line.startsWith("### "))
      return <h3 key={i} className="font-semibold text-white mt-3 mb-1 text-sm" dangerouslySetInnerHTML={{ __html: html.slice(4) }} />
    if (line.startsWith("## "))
      return <h2 key={i} className="font-bold text-white mt-4 mb-1" dangerouslySetInnerHTML={{ __html: html.slice(3) }} />
    if (line.startsWith("* ") || line.startsWith("- "))
      return <li key={i} className="ml-5 list-disc text-gray-200" dangerouslySetInnerHTML={{ __html: html.slice(2) }} />
    if (/^\d+\./.test(line))
      return <li key={i} className="ml-5 list-decimal text-gray-200" dangerouslySetInnerHTML={{ __html: html }} />
    if (line.trim() === "") return <div key={i} className="h-1.5" />
    return <p key={i} className="text-gray-200" dangerouslySetInnerHTML={{ __html: html }} />
  })
}

// ─── Source card ──────────────────────────────────────────────────────────────
function SourceCard({ source, index }: { source: Source; index: number }) {
  const domain = (() => {
    try { return new URL(source.url).hostname.replace("www.", "") }
    catch { return source.url }
  })()

  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col gap-1 p-3 rounded-xl bg-gray-800/60 border border-gray-700/50 hover:border-blue-500/40 hover:bg-gray-800 transition-all group min-w-0"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="shrink-0 w-5 h-5 rounded-full bg-blue-600/20 text-blue-400 text-[10px] font-bold flex items-center justify-center border border-blue-500/30">
          {index + 1}
        </span>
        <span className="text-xs text-gray-400 truncate">{domain}</span>
      </div>
      <p className="text-xs font-medium text-gray-200 group-hover:text-white line-clamp-2 leading-relaxed">
        {source.title}
      </p>
      {source.snippet && (
        <p className="text-[11px] text-gray-500 line-clamp-2 leading-relaxed">
          {source.snippet}
        </p>
      )}
    </a>
  )
}

// ─── Suggestion chips ─────────────────────────────────────────────────────────
const SUGGESTIONS = [
  "Dernières actualités IA 2025",
  "Prix du Bitcoin aujourd'hui",
  "Meilleures pratiques SEO 2025",
  "Tendances e-commerce en France",
  "Comparatif outils no-code",
  "Actualités cybersécurité",
]

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonResult() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="flex gap-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 w-36 rounded-xl bg-gray-800" />
        ))}
      </div>
      <div className="bubble-ai px-4 py-3 space-y-2">
        <div className="h-3 rounded bg-gray-700 w-full" />
        <div className="h-3 rounded bg-gray-700 w-5/6" />
        <div className="h-3 rounded bg-gray-700 w-4/6" />
        <div className="h-3 rounded bg-gray-700 w-3/4" />
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function WebSearchPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const token = (session?.user as any)?.accessToken
  const { t } = useLang()

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | undefined>()
  const [sessions, setSessions] = useState<Session[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [fetchPages, setFetchPages] = useState(true)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load sidebar sessions
  const loadSessions = useCallback(() => {
    if (!token) return
    fetch(`${API}/websearch/sessions`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => setSessions(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [token])

  useEffect(() => { loadSessions() }, [loadSessions])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  const loadSession = async (sid: string) => {
    if (!token) return
    setLoadingHistory(true)
    setSessionId(sid)
    setMessages([])
    setSidebarOpen(false)
    try {
      const res = await fetch(`${API}/websearch/sessions/${sid}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const msgs = await res.json()
      setMessages(
        (Array.isArray(msgs) ? msgs : []).map((m: any) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }))
      )
    } catch {}
    setLoadingHistory(false)
  }

  const newSearch = () => {
    setSessionId(undefined)
    setMessages([])
    setInput("")
    setSidebarOpen(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const sendQuery = async (query?: string) => {
    const q = (query ?? input).trim()
    if (!q || loading || !token) return
    setInput("")
    setMessages(prev => [...prev, { role: "user", content: q }])
    setLoading(true)

    try {
      const res = await fetch(`${API}/websearch/ask`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: q,
          session_id: sessionId ?? null,
          fetch_pages: fetchPages,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail ?? "Erreur")

      setSessionId(data.session_id)
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: data.answer,
          sources: data.sources ?? [],
        },
      ])
      loadSessions()
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: `❌ ${err.message ?? "Erreur lors de la recherche"}` },
      ])
    } finally {
      setLoading(false)
    }
  }

  const userName = (session?.user as any)?.name?.split(" ")[0] ?? "vous"

  return (
    <div
      className="flex flex-col h-screen bg-gray-950 text-white overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at top right, rgba(16,185,129,0.05) 0%, transparent 60%), #030712",
      }}
    >
      <AppHeader />

      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        {sidebarOpen && (
          <>
            <div
              className="md:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-20 animate-fade-in"
              onClick={() => setSidebarOpen(false)}
            />
            <aside className="fixed md:relative inset-y-0 left-0 z-30 w-72 flex flex-col border-r border-gray-800/60 glass h-full top-0 md:top-auto animate-fade-in">
              <div className="flex items-center justify-between p-4 border-b border-gray-800/60">
                <span className="text-sm font-semibold text-gray-300">Recherches</span>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="text-gray-500 hover:text-white text-xl md:hidden"
                >
                  ×
                </button>
              </div>
              <div className="p-3">
                <button
                  onClick={newSearch}
                  className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span>+</span> {t.websearch_new.replace("+ ", "")}
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {sessions.length === 0 ? (
                  <p className="text-xs text-gray-600 text-center mt-6">{t.websearch_no_searches}</p>
                ) : (
                  sessions.map(s => (
                    <button
                      key={s.id}
                      onClick={() => loadSession(s.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl text-xs transition-all truncate ${
                        sessionId === s.id
                          ? "glass-card text-white"
                          : "text-gray-500 hover:text-gray-200 hover:bg-gray-800/40"
                      }`}
                      title={s.title}
                    >
                      <span className="mr-1 opacity-60">🌐</span>
                      {s.title.replace("🌐 ", "")}
                    </button>
                  ))
                )}
              </div>
            </aside>
          </>
        )}

        {/* ── Main ────────────────────────────────────────────────────────── */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Topbar */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800/60 glass shrink-0">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 transition-all"
              >
                ☰
              </button>
              <div className="flex items-center gap-2">
                <span className="text-lg">🌐</span>
                <div>
                <h1 className="text-sm font-bold text-white leading-none">{t.websearch_title}</h1>
                <p className="text-[11px] text-gray-500 leading-none mt-0.5">{t.websearch_subtitle}</p>
              </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Fetch pages toggle */}
              <label className="flex items-center gap-2 cursor-pointer group">
                <span className="text-xs text-gray-400 group-hover:text-gray-300 hidden sm:block">
                  {t.websearch_full_content}
                </span>
                <button
                  onClick={() => setFetchPages(p => !p)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${
                    fetchPages ? "bg-emerald-600" : "bg-gray-700"
                  }`}
                  title={fetchPages ? "Désactiver le chargement du contenu des pages" : "Activer le chargement du contenu des pages"}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      fetchPages ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </label>
              <button
                onClick={() => router.push("/chat")}
                className="px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 transition-all"
                style={{ background: "rgba(255,255,255,0.04)" }}
              >
                {t.websearch_internal}
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-6">
            <div className="max-w-2xl mx-auto space-y-6">
              {/* Empty state */}
              {messages.length === 0 && !loadingHistory && (
                <div className="flex flex-col items-center justify-center min-h-[55vh] text-center space-y-6 animate-fade-in">
                  <div className="relative">
                    <div className="text-5xl">🌐</div>
                    <div
                      className="absolute -inset-2 rounded-full opacity-20 blur-xl"
                      style={{ background: "radial-gradient(circle, #10b981, transparent)" }}
                    />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold mb-2">
                      {t.websearch_empty_title},{" "}
                      <span style={{ background: "linear-gradient(135deg, #10b981, #06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                        {userName}
                      </span>
                    </h2>
                    <p className="text-gray-500 text-sm max-w-sm mx-auto">
                      {t.websearch_empty_sub}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 max-w-md w-full">
                    {SUGGESTIONS.map(s => (
                      <button
                        key={s}
                        onClick={() => sendQuery(s)}
                        className="px-3 py-2.5 rounded-xl text-left text-xs text-gray-400 hover:text-white border border-gray-800 hover:border-emerald-500/40 hover:bg-gray-800/60 transition-all leading-relaxed"
                      >
                        🔍 {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {loadingHistory && (
                <div className="space-y-4 pt-8">
                  <SkeletonResult />
                </div>
              )}

              {/* Message thread */}
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex flex-col animate-fade-in-up ${
                    msg.role === "user" ? "items-end" : "items-start"
                  }`}
                  style={{ animationDelay: `${Math.min(i * 0.03, 0.15)}s` }}
                >
                  {msg.role === "user" ? (
                    <div className="flex items-end gap-2">
                      <div className="max-w-[78%] px-4 py-3 rounded-2xl rounded-br-sm text-sm bubble-user text-white">
                        <span className="mr-1.5 opacity-70">🔍</span>
                        {msg.content}
                      </div>
                    </div>
                  ) : (
                    <div className="w-full space-y-3">
                      {/* Sources grid */}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">
                            {msg.sources.length} source{msg.sources.length > 1 ? "s" : ""} trouvée{msg.sources.length > 1 ? "s" : ""}
                          </p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {msg.sources.slice(0, 6).map((src, si) => (
                              <SourceCard key={si} source={src} index={si} />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* AI answer */}
                      <div className="flex items-start gap-2">
                        <div
                          className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm mt-1"
                          style={{ background: "linear-gradient(135deg, #10b981, #06b6d4)" }}
                        >
                          🌐
                        </div>
                        <div className="flex-1 bubble-ai px-4 py-3 text-sm leading-relaxed">
                          <div className="space-y-1">{renderMarkdown(msg.content)}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Thinking */}
              {loading && (
                <div className="flex flex-col items-start gap-3 animate-fade-in-up">
                  <p className="text-[11px] text-gray-500 uppercase tracking-wider font-medium pl-9">
                    Recherche en cours…
                  </p>
                  <div className="flex items-start gap-2">
                    <div
                      className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm animate-pulse"
                      style={{ background: "linear-gradient(135deg, #10b981, #06b6d4)" }}
                    >
                      🌐
                    </div>
                    <div className="bubble-ai px-4 py-3">
                      <ThinkingLoader message={t.websearch_thinking} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          </div>

          {/* Input */}
          <div className="px-4 pb-5 pt-3">
            <div className="max-w-2xl mx-auto">
              <form
                onSubmit={e => { e.preventDefault(); sendQuery() }}
                className="flex items-center gap-3 glass-card rounded-2xl px-4 py-3 focus-within:ring-1 focus-within:ring-emerald-500/30 transition-all"
              >
                <span className="text-gray-500 text-lg shrink-0">🔍</span>
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  disabled={loading}
                  placeholder={t.websearch_placeholder}
                  className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none disabled:opacity-50"
                />
                {input && (
                  <button
                    type="button"
                    onClick={() => setInput("")}
                    className="text-gray-600 hover:text-gray-400 text-lg transition-colors"
                  >
                    ×
                  </button>
                )}
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                    input.trim() && !loading
                      ? "text-white hover:scale-105 active:scale-95"
                      : "bg-gray-700 text-gray-500"
                  }`}
                  style={
                    input.trim() && !loading
                      ? { background: "linear-gradient(135deg, #10b981, #06b6d4)" }
                      : {}
                  }
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-gray-500 border-t-emerald-400 rounded-full animate-spin" />
                  ) : (
                    <span className="text-sm">→</span>
                  )}
                </button>
              </form>
              <p className="text-center text-[11px] text-gray-700 mt-2">
                {t.websearch_footer}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
