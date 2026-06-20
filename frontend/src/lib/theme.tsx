"use client"

import { createContext, useContext, useEffect, useState } from "react"

export type Theme = "dark" | "light" | "corporate"

const THEMES: { value: Theme; label: string; icon: string; desc: string }[] = [
  { value: "dark", label: "Sombre", icon: "🌙", desc: "Interface sombre — par défaut" },
  { value: "light", label: "Clair", icon: "☀️", desc: "Interface claire pour la journée" },
  { value: "corporate", label: "Corporate", icon: "🏢", desc: "Bleu pro pour les présentations" },
]

type ThemeContextType = {
  theme: Theme
  setTheme: (t: Theme) => void
  themes: typeof THEMES
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  setTheme: () => {},
  themes: THEMES,
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark")

  useEffect(() => {
    const saved = localStorage.getItem("cortexos-theme") as Theme | null
    if (saved && ["dark", "light", "corporate"].includes(saved)) {
      setThemeState(saved)
      document.documentElement.setAttribute("data-theme", saved)
    }
  }, [])

  const setTheme = (t: Theme) => {
    setThemeState(t)
    localStorage.setItem("cortexos-theme", t)
    document.documentElement.setAttribute("data-theme", t)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}

// Theme switcher component
export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme, themes } = useTheme()

  if (compact) {
    return (
      <div className="flex items-center gap-1 bg-gray-800 border border-gray-700 rounded-lg p-1">
        {themes.map(t => (
          <button
            key={t.value}
            onClick={() => setTheme(t.value)}
            title={t.label}
            className={`px-2 py-1 rounded-md text-sm transition-colors ${
              theme === t.value
                ? "bg-gray-700 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {t.icon}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      {themes.map(t => (
        <button
          key={t.value}
          onClick={() => setTheme(t.value)}
          className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
            theme === t.value
              ? "border-blue-500 bg-blue-950/30 text-white"
              : "border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600"
          }`}
        >
          <span className="text-2xl">{t.icon}</span>
          <span className="text-sm font-medium">{t.label}</span>
          <span className="text-xs text-gray-500 text-center">{t.desc}</span>
          {theme === t.value && (
            <span className="text-xs text-blue-400 font-medium">✓ Actif</span>
          )}
        </button>
      ))}
    </div>
  )
}
