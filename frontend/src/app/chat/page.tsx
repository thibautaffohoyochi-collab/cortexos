"use client"

import { useState, useRef, useEffect } from "react"
import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { chatApi } from "@/lib/api"

function renderMarkdown(text: string) {
  // Convert markdown to styled elements
  const lines = text.split("\n")
  return lines.map((line, i) => {
    // Bold **text**
    const formatted = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    // Bullet points
    if (line.startsWith("* ") || line.startsWith("- ")) {
      return <li key={i} className="ml-4 list-disc" dangerouslySetInnerHTML={{ __html: formatted.slice(2) }} />
    }
    // Numbered list
    if (/^\d+\./.test(line)) {
      return <li key={i} className="ml-4 list-decimal" dangerouslySetInnerHTML={{ __html: formatted }} />
    }
    // Empty line
    if (line.trim() === "") return <br key={i} />
    // Normal line
    return <p key={i} dangerouslySetInnerHTML={{ __html: formatted }} />
  })
}

type Message = {
  role: "user" | "assistant"
  content: string
}

export default function ChatPage() {
  const { data: session } = useSession()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | undefined>(undefined)
  const bottomRef = useRef<HTMLDivElement>(null)

  const token = (session?.user as any)?.accessToken
  const router = useRouter()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

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
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold tracking-tight">⬡ CortexOS</span>
        </div>
        <div className="flex items-center gap-6 text-sm text-gray-400">
          <button onClick={() => router.push("/dashboard")} className="hover:text-white transition-colors">
            Dashboard
          </button>
          <span className="text-white font-medium">Chat</span>
          <span className="text-gray-600">|</span>
          <span>{session?.user?.name}</span>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="hover:text-white transition-colors"
          >
            Déconnexion
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-6">

          {/* Empty state */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full pt-24 text-center space-y-3">
              <div className="text-4xl">⬡</div>
              <h2 className="text-xl font-semibold">Bonjour, {userName} 👋</h2>
              <p className="text-gray-400 text-sm">Posez une question sur vos données d&apos;entreprise</p>
              {/* Suggestion chips */}
              <div className="flex flex-wrap gap-2 justify-center mt-4">
                {[
                  "Résume les derniers emails",
                  "Quelles sont les ventes du mois ?",
                  "Quels documents importants ai-je reçus ?",
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

          {/* Message list */}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap
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

          {/* Loading indicator */}
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
  )
}
