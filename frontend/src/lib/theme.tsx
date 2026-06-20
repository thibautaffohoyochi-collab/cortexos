"use client"

import { createContext, useContext, useEffect, useState } from "react"

export type Theme = "dark" | "light" | "corporate"

const THEME_CLASSES: Record<Theme, string> = {
  dark: "dark",
  light: "light",
  corporate: "corporate",
}

// Tailwind classes applied to <html> for each theme
const THEME_STYLES: Record<Theme, { bg: string; text: string; card: string; border: string; accent: string }> = {
  dark: {
    bg: "bg-gray-950",
    text: "text-white",
    card: "bg-gray-900",
    border: "border-gray-800",
    accent: "bg-blue-600",
  },
  light: {
    bg: "bg-gray-50",
    text: "text-gray-900",
    card: "bg-white",
    border: "border-gray-200",
    accent: "bg-blue-600",
  },
  corporate: {
    bg: "bg-slate-900",
    text: "text-slate-100",
    card: "bg-slate-800",
    border: "border-slate-700",
    accent: "bg-sky-500",
  },
}

const THEMES = [
  { value: "dark" as Theme, label: "Sombre", icon: "🌙", desc: "Interface sombre — par défaut", preview: "bg-gray-950 border-gray-800" },
  { value: "light" as Theme, label: "Clair", icon: "☀️", desc: "Interface claire pour la journée", preview: "bg-white border-gray-300" },
  { value: "corporate" as Theme, label: "Corporate", icon: "🏢", desc: "Bleu pro pour les présentations", preview: "bg-slate-900 border-slate-600" },
]

type ThemeContextType = {
  theme: Theme
  setTheme: (t: Theme) => void
  themes: typeof THEMES
  styles: typeof THEME_STYLES[Theme]
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  setTheme: () => {},
  themes: THEMES,
  styles: THEME_STYLES.dark,
})

function applyTheme(t: Theme) {
  const html = document.documentElement
  // Remove all theme classes
  html.classList.remove("dark", "light", "corporate")
  html.classList.add(t)
  html.setAttribute("data-theme", t)

  // Apply body background immediately
  const bodyStyles: Record<Theme, { bg: string; color: string }> = {
    dark: { bg: "#030712", color: "#f9fafb" },
    light: { bg: "#f9fafb", color: "#111827" },
    corporate: { bg: "#0f172a", color: "#f1f5f9" },
  }
  document.body.style.backgroundColor = bodyStyles[t].bg
  document.body.style.color = bodyStyles[t].color
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark")

  useEffect(() => {
    const saved = localStorage.getItem("cortexos-theme") as Theme | null
    const initial = (saved && ["dark", "light", "corporate"].includes(saved)) ? saved : "dark"
    setThemeState(initial)
    applyTheme(initial)
  }, [])

  const setTheme = (t: Theme) => {
    setThemeState(t)
    localStorage.setItem("cortexos-theme", t)
    applyTheme(t)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES, styles: THEME_STYLES[theme] }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}

export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme, themes } = useTheme()

  if (compact) {
    return (
      <div className="flex items-center gap-0.5 rounded-lg border border-gray-700 bg-gray-800 p-0.5">
        {themes.map(t => (
          <button
            key={t.value}
            onClick={() => setTheme(t.value)}
            title={t.label}
            className={`px-2 py-1 rounded-md text-sm transition-all ${
              theme === t.value
                ? "bg-gray-600 text-white shadow"
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
          className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
            theme === t.value
              ? "border-blue-500 ring-2 ring-blue-500/30"
              : "border-gray-700 hover:border-gray-500"
          }`}
        >
          {/* Preview */}
          <div className={`w-full h-10 rounded-lg border ${t.preview} flex items-center justify-center gap-1`}>
            <div className="w-2 h-2 rounded-full bg-gray-400" />
            <div className="w-6 h-1 rounded bg-gray-400" />
          </div>
          <span className="text-2xl">{t.icon}</span>
          <span className="text-sm font-medium">{t.label}</span>
          <span className="text-xs text-gray-500 text-center leading-tight">{t.desc}</span>
          {theme === t.value && (
            <span className="absolute top-2 right-2 text-xs text-blue-400 font-bold">✓</span>
          )}
        </button>
      ))}
    </div>
  )
}
