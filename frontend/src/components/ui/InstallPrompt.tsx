"use client"

import { useEffect, useState } from "react"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [show, setShow] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true)
      return
    }

    // Check if dismissed recently
    const dismissed = localStorage.getItem("cortexos-install-dismissed")
    if (dismissed && Date.now() - Number(dismissed) < 7 * 24 * 60 * 60 * 1000) return

    // iOS detection
    const ua = window.navigator.userAgent
    const isIOSDevice = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream
    if (isIOSDevice) {
      setIsIOS(true)
      setTimeout(() => setShow(true), 3000)
      return
    }

    // Android/Chrome — listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallEvent(e as BeforeInstallPromptEvent)
      setTimeout(() => setShow(true), 3000)
    }
    window.addEventListener("beforeinstallprompt", handler)
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  const handleInstall = async () => {
    if (!installEvent) return
    await installEvent.prompt()
    const { outcome } = await installEvent.userChoice
    if (outcome === "accepted") {
      setShow(false)
      setIsInstalled(true)
    }
  }

  const handleDismiss = () => {
    setShow(false)
    localStorage.setItem("cortexos-install-dismissed", String(Date.now()))
  }

  if (!show || isInstalled) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 animate-fade-in-up md:left-auto md:right-6 md:w-80">
      <div
        className="rounded-2xl border border-blue-500/30 p-4 shadow-2xl"
        style={{
          background: "rgba(3,7,18,0.95)",
          backdropFilter: "blur(20px)",
          boxShadow: "0 0 40px rgba(37,99,235,0.15)",
        }}
      >
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-xl shrink-0">
            ⬡
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">Installer CortexOS</p>
            <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
              {isIOS
                ? "Appuyez sur 📤 puis \"Sur l'écran d'accueil\""
                : "Installez l'app pour un accès rapide depuis votre écran d'accueil"}
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="text-gray-500 hover:text-gray-300 text-lg shrink-0 -mt-0.5"
          >
            ×
          </button>
        </div>

        {!isIOS && (
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleDismiss}
              className="flex-1 py-2 rounded-xl text-xs text-gray-400 border border-gray-700 hover:border-gray-500 transition-colors"
            >
              Plus tard
            </button>
            <button
              onClick={handleInstall}
              className="flex-1 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors"
            >
              📲 Installer
            </button>
          </div>
        )}

        {isIOS && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-800/60 border border-gray-700">
            <span className="text-lg">📤</span>
            <p className="text-xs text-gray-300">Appuyez sur Partager → Sur l&apos;écran d&apos;accueil</p>
          </div>
        )}
      </div>
    </div>
  )
}
