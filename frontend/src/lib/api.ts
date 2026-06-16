/**
 * CortexOS API Client
 * Typed wrapper around fetch — automatically injects the JWT token.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  body?: unknown
  token?: string
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = "ApiError"
  }
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, token } = options

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Erreur inconnue" }))
    throw new ApiError(res.status, error.detail ?? "Erreur serveur")
  }

  return res.json() as T
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export type RegisterPayload = {
  company_name: string
  email: string
  password: string
  full_name?: string
}

export type TokenResponse = {
  access_token: string
  refresh_token: string
  token_type: string
}

export type UserProfile = {
  id: string
  email: string
  full_name: string
  is_admin: boolean
  tenant_id: string
  tenant_name: string
}

export const authApi = {
  register: (payload: RegisterPayload) =>
    request<TokenResponse>("/auth/register", { method: "POST", body: payload }),

  me: (token: string) =>
    request<UserProfile>("/auth/me", { token }),
}


// ─── Chat ────────────────────────────────────────────────────────────────────

export type ChatSession = {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export type Message = {
  id: string
  role: "user" | "assistant"
  content: string
  sources_used: string[]
  created_at: string
}

export const chatApi = {
  getSessions: (token: string) =>
    request<ChatSession[]>("/chat/sessions", { token }),

  getMessages: (token: string, sessionId: string) =>
    request<Message[]>(`/chat/sessions/${sessionId}/messages`, { token }),

  sendMessage: (token: string, content: string, sessionId?: string) =>
    request<{ session_id: string; user_message: string; assistant_message: string }>(
      "/chat/message",
      {
        method: "POST",
        token,
        body: { content, session_id: sessionId ?? null },
      }
    ),
}


// ─── Data Sources ─────────────────────────────────────────────────────────────

export type DataSource = {
  id: string
  name: string
  source_type: string
  status: "pending" | "syncing" | "active" | "error"
  last_synced_at: string | null
  error_message: string | null
}

export const sourcesApi = {
  list: (token: string) =>
    request<DataSource[]>("/sources", { token }),

  connect: (token: string, payload: { source_type: string; name: string; config?: object }) =>
    request<DataSource>("/sources", { method: "POST", body: payload, token }),

  sync: (token: string, sourceId: string) =>
    request<void>(`/sources/${sourceId}/sync`, { method: "POST", token }),

  delete: (token: string, sourceId: string) =>
    request<void>(`/sources/${sourceId}`, { method: "DELETE", token }),
}
