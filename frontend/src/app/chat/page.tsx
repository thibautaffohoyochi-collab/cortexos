"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { chatApi } from "@/lib/api"
import { ThemeSwitcher } from "@/lib/theme"
import { LangSwitcher, useLang } from "@/lib/i18n"
import { ExportMenu } from "@/components/ui/ExportMenu"
import { ThinkingLoader } from "@/components/ui/animations"

// ─── Markdown renderer ────────────────────────────────────────────────────────
function renderMarkdown(text: string) {
  return text.split("\n").map((line, i) => {
    const html = line
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
    if (line.startsWith("* ") || line.startsWith("- "))
      return <li key={i} className="ml-5 list-disc" dangerouslySetInnerHTML={{ __html: html.slice(2) }} />
    if (/^\d+\./.test(line))
      return <li key={i} className="ml-5 list-decimal" dangerouslySetInnerHTML={{ __html: html }} />
    if (line.trim() === "") return <div key={i} className="h-2" />
    return <p key={i} dangerouslySetInnerHTML={{ __html: html }} />
  })
}

// ─── Shimmer skeleton ─────────────────────────────────────────────────────────
function SkeletonMessage() {
  return (
    <div className="flex justify-start animate-fade-in">
      <div className="bubble-ai px-4 py-3 w-64 space-y-2">
        <div className="h-3 rounded shimmer bg-gray-700 w-3/4" />
        <div className="h-3 rounded shimmer bg-gray-700 w-full" />
        <div className="h-3 rounded shimmer bg-gray-700 w-1/2" />
      </div>
    </div>
  )
}

type Message = { role: "user" | "assistant"; content: string; webSearch?: boolean }
type Session = { id: string; title: string; created_at: string }

export default function ChatPage() {
  const { data: session } = useSession()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | undefined>()
  const [sessions, setSessions] = useState<Session[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const [webSearch, setWebSearch] = useState(false) // hybrid mode toggle
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const token = (session?.user as any)?.accessToken
  const { t } = useLang()

  useEffect(() => {
    if (!token) return
    chatApi.getSessions(token).then(d => setSessions(Array.isArray(d) ? d : [])).catch(() => {})
  }, [token])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  // Focus mode: activate when typing
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
    setFocusMode(e.target.value.length > 0)
  }

  const loadSession = async (sid: string) => {
    if (!token) return
    setLoadingHistory(true)
    setSessionId(sid)
    setMessages([])
    setSidebarOpen(false)
    try {
      const msgs = await chatApi.getMessages(token, sid)
      setMessages(msgs.map(m => ({ role: m.role as "user" | "assistant", content: m.content })))
    } catch {}
    setLoadingHistory(false)
  }

  const newChat = () => {
    setSessionId(undefined)
    setMessages([])
    setInput("")
    setSidebarOpen(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!input.trim() || loading || !token) return
    const userMessage = input.trim()
    const isWebSearch = webSearch
    setInput("")
    setFocusMode(false)
    setMessages(prev => [...prev, { role: "user", content: userMessage, webSearch: isWebSearch }])
    setLoading(true)

    // Add empty assistant message that will be filled token by token
    setMessages(prev => [...prev, { role: "assistant", content: "" }])

    try {
      const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"

      // ── Try streaming first ──────────────────────────────────────────────
      const res = await fetch(`${API}/chat/stream`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ content: userMessage, session_id: sessionId ?? null, web_search: isWebSearch }),
      })

      // ── Fallback to non-streaming if stream route not available ──────────
      if (res.status === 404) {
        const fallback = await fetch(`${API}/chat/message`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ content: userMessage, session_id: sessionId ?? null, web_search: isWebSearch }),
        })
        const data = await fallback.json()
        if (!fallback.ok) throw new Error(data.detail ?? "Erreur")
        setSessionId(data.session_id)
        setMessages(prev => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last?.role === "assistant") {
            updated[updated.length - 1] = { ...last, content: data.assistant_message }
          }
          return updated
        })
        chatApi.getSessions(token).then(d => setSessions(Array.isArray(d) ? d : [])).catch(() => {})
        return
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Erreur" }))
        throw new Error(err.detail ?? "Erreur serveur")
      }

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) throw new Error("Stream non supporté")

      let buffer = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          if (!line.startsWith("data:")) continue
          const raw = line.slice(5).trim()
          if (!raw) continue
          try {
            const event = JSON.parse(raw)

            if (event.session_id && !sessionId) {
              setSessionId(event.session_id)
            }

            if (event.token) {
              setMessages(prev => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last?.role === "assistant") {
                  updated[updated.length - 1] = { ...last, content: last.content + event.token }
                }
                return updated
              })
            }

            if (event.done) {
              chatApi.getSessions(token).then(d => setSessions(Array.isArray(d) ? d : [])).catch(() => {})
            }

            if (event.error) {
              setMessages(prev => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last?.role === "assistant") {
                  updated[updated.length - 1] = { ...last, content: `❌ ${event.error}` }
                }
                return updated
              })
            }
          } catch {}
        }
      }
    } catch (err: any) {
      setMessages(prev => {
        const updated = [...prev]
        const last = updated[updated.length - 1]
        if (last?.role === "assistant" && last.content === "") {
          updated[updated.length - 1] = { ...last, content: `❌ ${err.message ?? "Erreur"}` }
        } else {
          updated.push({ role: "assistant", content: `❌ ${err.message ?? "Erreur"}` })
        }
        return updated
      })
    } finally {
      setLoading(false)
    }
  }

  const userName = (session?.user as any)?.name?.split(" ")[0] ?? "vous"
  const userInitial = ((session?.user as any)?.name ?? "U")[0].toUpperCase()

  return (
    <div className={`flex flex-col h-screen bg-gray-950 text-white overflow-hidden ${focusMode ? "focus-mode" : ""}`}
      style={{ background: "radial-gradient(ellipse at top, rgba(37,99,235,0.05) 0%, transparent 60%), #030712" }}>

      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-800/60 shrink-0 glass">
        <div className="flex items-center gap-3">
          <button onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 transition-all">
            ☰
          </button>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold gradient-text">
              <span className="logo-animated" style={{fontSize:"inherit"}}>⬡</span> CortexOS
            </span>
          </div>
        </div>
        <nav className="hidden md:flex items-center gap-3 text-sm">
          {[
            { label: "Dashboard", path: "/dashboard" },
            { label: "Sources", path: "/sources" },
            { label: "Agents", path: "/agents" },
          ].map(item => (
            <button key={item.path} onClick={() => router.push(item.path)}
              className="px-3 py-1.5 text-gray-400 hover:text-white hover:bg-gray-800/60 rounded-lg transition-all text-xs">
              {item.label}
            </button>
          ))}
          <ThemeSwitcher compact />
          <LangSwitcher compact />
          <button onClick={() => router.push("/settings")}
            className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold hover:bg-blue-500 transition-colors shadow-glow-sm">
            {userInitial}
          </button>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 transition-all"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            Déconnexion
          </button>
        </nav>
        {/* Mobile */}
        <div className="flex md:hidden items-center gap-2">
          <ThemeSwitcher compact />
          <LangSwitcher compact />
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="px-2 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 transition-all"
            style={{ background: "rgba(255,255,255,0.04)" }}
            title="Déconnexion"
          >
            ⏻
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        {sidebarOpen && (
          <>
            <div className="md:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-20 animate-fade-in"
              onClick={() => setSidebarOpen(false)} />
            <aside className="fixed md:relative inset-y-0 left-0 z-30 w-72 flex flex-col border-r border-gray-800/60 glass h-full top-0 md:top-auto animate-fade-in sidebar-hide">
              <div className="flex items-center justify-between p-4 border-b border-gray-800/60">
                <span className="text-sm font-semibold text-gray-300">Conversations</span>
                <button onClick={() => setSidebarOpen(false)} className="text-gray-500 hover:text-white text-xl md:hidden">×</button>
              </div>
              <div className="p-3">
                <button onClick={newChat}
                  className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm font-medium transition-all hover:scale-[1.02] active:scale-[0.98] shadow-glow-sm">
                  <span className="text-base">+</span> Nouvelle conversation
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {sessions.length === 0 ? (
                  <p className="text-xs text-gray-600 text-center mt-6">Aucune conversation</p>
                ) : sessions.map(s => (
                  <button key={s.id} onClick={() => loadSession(s.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-xs transition-all truncate group ${
                      sessionId === s.id
                        ? "glass-card text-white"
                        : "text-gray-500 hover:text-gray-200 hover:bg-gray-800/40"
                    }`} title={s.title}>
                    <span className="mr-2 opacity-50">💬</span>
                    {s.title}
                  </button>
                ))}
              </div>
              <div className="p-3 border-t border-gray-800/60">
                <p className="text-xs text-gray-600 text-center">{sessions.length} conversation{sessions.length > 1 ? "s" : ""}</p>
              </div>
            </aside>
          </>
        )}

        {/* Main */}
        <div className="flex flex-col flex-1 overflow-hidden">

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-6">
            <div className="max-w-2xl mx-auto space-y-4">

              {/* Empty state */}
              {messages.length === 0 && !loadingHistory && (
                <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 animate-fade-in">
                  <div className="relative">
                    <div className="text-5xl animate-pulse" style={{ animationDuration: "3s" }}>⬡</div>
                    <div className="absolute inset-0 text-5xl opacity-20 blur-md">⬡</div>
                  </div>
                  <div className="flex flex-col items-center text-center w-full">
                    <h2 className="text-2xl font-bold mb-2">Bonjour, <span className="gradient-text">{userName}</span> 👋</h2>
                    <p className="text-gray-500 text-sm">Posez une question sur vos données d&apos;entreprise</p>
                    {sessionId && token && (
                      <div className="mt-3">
                        <ExportMenu token={token} label="Exporter" exports={[
                          { label: "PDF / Imprimer", icon: "📄", url: `/exports/chat/${sessionId}/pdf`, download: false },
                          { label: "CSV", icon: "📊", url: `/exports/chat/${sessionId}/csv`, download: true },
                        ]} />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                    {["Résume mes derniers emails", "Quels sont mes concurrents ?", "Analyse mes données Drive"].map(s => (
                      <button key={s} onClick={() => { setInput(s); inputRef.current?.focus() }}
                        className="px-4 py-2 rounded-full glass text-sm text-gray-400 hover:text-white hover:border-blue-500/50 transition-all hover:scale-105 active:scale-95">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {loadingHistory && (
                <div className="space-y-4 pt-8">
                  <SkeletonMessage />
                  <SkeletonMessage />
                </div>
              )}

              {/* Messages */}
              {messages.map((msg, i) => (
                <div key={i} className={`flex animate-fade-in-up ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  style={{ animationDelay: `${Math.min(i * 0.03, 0.15)}s` }}>
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-xs font-bold mr-2 shrink-0 mt-1 shadow-glow-sm">
                      ⬡
                    </div>
                  )}
                  <div className={`max-w-[78%] px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "user" ? "bubble-user text-white" : "bubble-ai text-gray-100"
                  }`}>
                    {msg.role === "user" && msg.webSearch && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 mb-1.5 mr-1">
                        🌐 Web
                      </span>
                    )}
                    {msg.role === "assistant"
                      ? msg.content === "" && loading
                        ? <ThinkingLoader message={
                            webSearch
                        ? t.chat_thinking_hybrid
                        : messages.length <= 2 ? t.chat_thinking
                        : t.chat_thinking2
                          } />
                        : <div className="space-y-0.5">{renderMarkdown(msg.content)}</div>
                      : msg.content
                    }
                  </div>
                  {msg.role === "user" && (
                    <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold ml-2 shrink-0 mt-1">
                      {userInitial}
                    </div>
                  )}
                </div>
              ))}

              {loading && messages[messages.length - 1]?.role !== "assistant" && (
                <div className="flex justify-start animate-fade-in-up">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-xs font-bold mr-2 shrink-0 mt-1">⬡</div>
                  <div className="bubble-ai px-4 py-3">
                    <ThinkingLoader message="Cortex réfléchit…" />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          {/* Input */}
          <div className={`px-4 pb-5 pt-3 transition-all duration-300 ${focusMode ? "pb-6" : ""}`}>
            <form onSubmit={sendMessage} className="max-w-2xl mx-auto">
              {/* Mode indicator */}
              {webSearch && (
                <div className="flex items-center gap-2 mb-2 px-1 animate-fade-in">
                  <span className="text-xs text-emerald-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Mode hybride actif — vos données + internet
                  </span>
                </div>
              )}
              <div className={`flex items-center gap-2 glass-card rounded-2xl px-3 py-2.5 transition-all duration-300 ${
                focusMode
                  ? webSearch
                    ? "shadow-[0_0_0_1px_rgba(16,185,129,0.4)] ring-1 ring-emerald-500/30"
                    : "shadow-glow-blue ring-1 ring-blue-500/30"
                  : ""
              }`}>
                {/* Web search toggle */}
                <button
                  type="button"
                  onClick={() => setWebSearch(w => !w)}
                  title={webSearch ? "Désactiver la recherche web" : "Activer la recherche web"}
                  className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-sm transition-all ${
                    webSearch
                      ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-600/30"
                      : "text-gray-500 hover:text-gray-300 hover:bg-gray-800 border border-transparent"
                  }`}
                >
                  🌐
                </button>
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={e => e.key === "Escape" && setFocusMode(false)}
                  disabled={loading}
                  placeholder={webSearch ? "Posez votre question (données + internet)…" : "Posez votre question…"}
                  className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none disabled:opacity-50"
                />
                {input && (
                  <button type="button" onClick={() => { setInput(""); setFocusMode(false) }}
                    className="text-gray-600 hover:text-gray-400 text-lg transition-colors animate-fade-in">
                    ×
                  </button>
                )}
                <button type="submit" disabled={loading || !input.trim()}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all shrink-0 ${
                    input.trim() && !loading
                      ? webSearch
                        ? "text-white hover:scale-105 active:scale-95"
                        : "bg-blue-600 hover:bg-blue-500 text-white shadow-glow-sm hover:scale-105 active:scale-95"
                      : "bg-gray-700 text-gray-500"
                  }`}
                  style={input.trim() && !loading && webSearch
                    ? { background: "linear-gradient(135deg, #10b981, #06b6d4)" }
                    : {}
                  }
                >
                  {loading
                    ? <div className={`w-4 h-4 border-2 rounded-full animate-spin ${webSearch ? "border-emerald-500/30 border-t-emerald-400" : "border-gray-500 border-t-blue-400"}`} />
                    : <span className="text-sm">→</span>
                  }
                </button>
              </div>
              <p className="text-center text-xs text-gray-700 mt-1.5">
                {webSearch ? t.chat_mode_hybrid : t.chat_mode_data}
              </p>
            </form>
          </div>

        </div>
      </div>
    </div>
  )
}
