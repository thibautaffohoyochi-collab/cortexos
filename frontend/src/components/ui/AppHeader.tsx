"use client"

import { useSession, signOut } from "next-auth/react"
import { useRouter, usePathname } from "next/navigation"
import { useState } from "react"

const NAV_ITEMS = [
  { label: "Dashboard", path: "/dashboard" },
  { label: "Chat", path: "/chat" },
  { label: "Sources", path: "/sources" },
  { label: "Agents", path: "/agents" },
  { label: "Projets", path: "/projects" },
  { label: "Veille", path: "/competitive" },
  { label: "Équipe", path: "/team" },
]

export function AppHeader() {
  const { data: session } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  const userInitial = ((session?.user as any)?.name ?? (session?.user?.email ?? "U"))[0].toUpperCase()

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between px-4 md:px-6 py-3 border-b border-gray-800"
      style={{ background: "rgba(3,7,18,0.9)", backdropFilter: "blur(16px)" }}>

      {/* Logo */}
      <button onClick={() => router.push("/dashboard")} className="flex items-center gap-2 shrink-0">
        <span className="logo-animated text-base">⬡</span>
        <span className="font-bold text-white text-sm tracking-tight hidden sm:block">CortexOS</span>
      </button>

      {/* Desktop nav */}
      <nav className="hidden lg:flex items-center gap-1">
        {NAV_ITEMS.map(item => (
          <button key={item.path} onClick={() => router.push(item.path)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              pathname === item.path
                ? "bg-gray-800 text-white"
                : "text-gray-400 hover:text-white hover:bg-gray-800/60"
            }`}>
            {item.label}
          </button>
        ))}
      </nav>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {/* Settings avatar */}
        <button onClick={() => router.push("/settings")}
          className="w-7 h-7 rounded-full bg-blue-600 hover:bg-blue-500 flex items-center justify-center text-xs font-bold text-white transition-colors shadow-sm"
          title="Paramètres">
          {userInitial}
        </button>

        {/* Logout */}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 transition-all hidden sm:block"
          style={{ background: "rgba(255,255,255,0.03)" }}
          title="Déconnexion">
          Déconnexion
        </button>

        {/* Mobile hamburger */}
        <button onClick={() => setMenuOpen(!menuOpen)}
          className="lg:hidden w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors">
          {menuOpen ? "×" : "☰"}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setMenuOpen(false)} />
          <div className="fixed top-14 left-0 right-0 z-50 border-b border-gray-800 p-3 space-y-1"
            style={{ background: "rgba(3,7,18,0.98)", backdropFilter: "blur(16px)" }}>
            {NAV_ITEMS.map(item => (
              <button key={item.path} onClick={() => { router.push(item.path); setMenuOpen(false) }}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  pathname === item.path ? "bg-gray-800 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800/60"
                }`}>
                {item.label}
              </button>
            ))}
            <button onClick={() => { signOut({ callbackUrl: "/login" }) }}
              className="w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-950/30 transition-all">
              Déconnexion
            </button>
          </div>
        </>
      )}
    </header>
  )
}
