"use client"

import { useState, useRef, useEffect } from "react"
import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { chatApi } from "@/lib/api"

function renderMarkdown(text: string) {
  const lines = text.split("\n")
  return lines.map((line, i) => {
    const formatted = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    if (line.startsWith("* ") || line.startsWith("- ")) {
      return <li key={i} className="ml-4 list-disc" dangerouslySetInnerHTML={{ __html: formatted.slice(2) }} />
    }
    if (/^\d+\./.test(line)) {
      return <li key={i} className="ml-4 list-decimal" dangerouslySetInnerHTML={{ __html: formatted }} />
    }
    if (line.trim() === "") return <br key={i} />
    return <p key={i} dangerouslySetInnerHTML={{ __html: formatted }} />
  })
}

type Message = {
  role: "user" | "assistant"
  content: string
}

type Session = {
  id: string
  title: string
  created_at: string
}

export default function ChatPage() {
  const { data: session } = useSession()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | undefined>(undefined)
  const [sessions, setSessions] = useState<Session[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(false) // closed by default on mobile
  const [loadingHistory, setLoadingHistory] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const token = (session?.user as any)?.accessToken

  // Load sessions list
  useEffect(() => {
    if (!token) return
    chatApi.getSessions(token).then(data => {
      setSessions(Array.isArray(data) ? data : [])
    }).catch(() => {})
  }, [token])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const loadSession = async (sid: string) => {
    if (!token) return
    setLoadingHistory(true)
    setSessionId(sid)
    setMessages([])
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
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading || !token) return

    const userMessage = input.trim()
    setInput("")
    setMessages(prev => [...prev, { role: "user", content: userMessage }])
    setLoading(true)

    try {
      const res = await chatApi.sendMessage(token, userMessage, sessionId)
      setSessionId(res.session_id)
      setMessages(prev => [...prev, { role: "assistant", content: res.assistant_message }])

      // Refresh sessions list
      chatApi.getSessions(token).then(data => {
        setSessions(Array.isArray(data) ? data : [])
      }).catch(() => {})
    } catch (err: any) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "❌ Erreur : " + (err.message ?? "Impossible de contacter l'IA"),
      }])
    } finally {
      setLoading(false)
    }
  }

  const userName = (session?.user as any)?.name?.split(" ")[0] ?? "vous"

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white">

      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-gray-400 hover:text-white transition-colors p-1 text-xl"
            title="Toggle sidebar"
          >
            ☰
          </button>
          <span className="text-base font-semibold tracking-tight">⬡ CortexOS</span>
        </div>
        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6 text-sm text-gray-400">
          <button onClick={() => router.push("/dashboard")} className="hover:text-white transition-colors">Dashboard</button>
          <button onClick={() => router.push("/sources")} className="hover:text-white transition-colors">Sources</button>
          <span className="text-white font-medium">Chat</span>
          <span className="text-gray-600">|</span>
          <span>{session?.user?.name}</span>
          <button onClick={() => signOut({ callbackUrl: "/login" })} className="hover:text-white transition-colors">
            Déconnexion
          </button>
        </nav>
        {/* Mobile nav */}
        <div className="flex md:hidden items-center gap-3 text-sm text-gray-400">
          <span className="text-white text-xs">{(session?.user?.name as string)?.split(" ")[0]}</span>
          <button onClick={() => signOut({ callbackUrl: "/login" })} className="text-xs hover:text-white">
            ⏻
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar — overlay on mobile, inline on desktop */}
        {sidebarOpen && (
          <>
            {/* Mobile overlay */}
            <div
              className="md:hidden fixed inset-0 bg-black/60 z-20"
              onClick={() => setSidebarOpen(false)}
            />
            <aside className="fixed md:relative inset-y-0 left-0 z-30 w-72 md:w-64 border-r border-gray-800 flex flex-col bg-gray-950 shrink-0 top-0 md:top-auto h-full md:h-auto">
              {/* Close button on mobile */}
              <div className="flex items-center justify-between p-3 border-b border-gray-800 md:hidden">
                <span className="text-sm font-medium">Conversations</span>
                <button onClick={() => setSidebarOpen(false)} className="text-gray-400 hover:text-white text-xl">×</button>
              </div>
              {/* New chat button */}
              <div className="p-3 border-b border-gray-800 hidden md:block">
                <button
                  onClick={newChat}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium transition-colors"
                >
                  <span className="text-lg">+</span>
                  Nouvelle conversation
                </button>
              </div>
              {/* Mobile new chat */}
              <div className="p-3 md:hidden">
                <button
                  onClick={() => { newChat(); setSidebarOpen(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium transition-colors"
                >
                  <span className="text-lg">+</span>
                  Nouvelle conversation
                </button>
              </div>

              {/* Sessions list */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {sessions.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center mt-4">Aucune conversation</p>
                ) : (
                  sessions.map(s => (
                    <button
                      key={s.id}
                      onClick={() => { loadSession(s.id); setSidebarOpen(false) }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors truncate ${
                        sessionId === s.id
                          ? "bg-gray-800 text-white"
                          : "text-gray-400 hover:bg-gray-900 hover:text-white"
                      }`}
                      title={s.title}
                    >
                      <span className="text-gray-500 mr-2">💬</span>
                      {s.title}
                    </button>
                  ))
                )}
              </div>

              {/* User info */}
              <div className="p-3 border-t border-gray-800 text-xs text-gray-500">
                {sessions.length} conversation{sessions.length > 1 ? "s" : ""}
              </div>
            </aside>
          </>
        )}

        {/* Main chat area */}
        <div className="flex flex-col flex-1 overflow-hidden">

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-6">
            <div className="max-w-2xl mx-auto space-y-6">

              {/* Empty state */}
              {messages.length === 0 && !loadingHistory && (
                <div className="flex flex-col items-center justify-center h-full pt-20 text-center space-y-3">
                  <div className="text-4xl">⬡</div>
                  <h2 className="text-xl font-semibold">Bonjour, {userName} 👋</h2>
                  <p className="text-gray-400 text-sm">Posez une question sur vos données d&apos;entreprise</p>
                  <div className="flex flex-wrap gap-2 justify-center mt-4">
                    {[
                      "Résume mes derniers emails",
                      "Quels sont mes concurrents ?",
                      "Quels fichiers Drive ai-je ?",
                    ].map(s => (
                      <button
                        key={s}
                        onClick={() => setInput(s)}
                        className="px-3 py-1.5 rounded-full bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 transition-colors border border-gray-700"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {loadingHistory && (
                <div className="flex justify-center pt-20">
                  <div className="text-gray-500 text-sm">Chargement...</div>
                </div>
              )}

              {/* Messages */}
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed
                    ${msg.role === "user"
                      ? "bg-blue-600 text-white rounded-br-sm"
                      : "bg-gray-800 text-gray-100 rounded-bl-sm"
                    }`}
                  >
                    {msg.role === "assistant" && (
                      <span className="text-xs text-gray-400 block mb-1 font-medium">⬡ CortexOS</span>
                    )}
                    {msg.role === "assistant"
                      ? <div className="space-y-1">{renderMarkdown(msg.content)}</div>
                      : msg.content
                    }
                  </div>
                </div>
              ))}

              {/* Loading */}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-gray-800 rounded-2xl rounded-bl-sm px-4 py-3">
                    <span className="text-xs text-gray-400 block mb-1 font-medium">⬡ CortexOS</span>
                    <div className="flex gap-1 items-center">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                    </div>
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          </div>

          {/* Input */}
          <div className="px-4 pb-6 pt-2 border-t border-gray-800">
            <form onSubmit={sendMessage} className="max-w-2xl mx-auto flex gap-3">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                disabled={loading}
                placeholder="Posez votre question..."
                className="flex-1 rounded-xl bg-gray-800 border border-gray-700 px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-sm font-medium text-white transition-colors"
              >
                Envoyer
              </button>
            </form>
          </div>

        </div>
      </div>
    </div>
  )
}
