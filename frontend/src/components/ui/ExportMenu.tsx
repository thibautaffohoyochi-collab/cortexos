"use client"

import { useState } from "react"

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"

type ExportType = {
  label: string
  icon: string
  url: string
  download?: boolean // true = CSV download, false = open HTML in new tab
}

type Props = {
  token: string
  exports: ExportType[]
  label?: string
}

export function ExportMenu({ token, exports, label = "Exporter" }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)

  const handleExport = async (exp: ExportType) => {
    setLoading(exp.label)
    setOpen(false)
    try {
      if (exp.download) {
        // CSV — trigger download
        const res = await fetch(`${API}${exp.url}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error("Erreur export")
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        const cd = res.headers.get("content-disposition") || ""
        const match = cd.match(/filename="([^"]+)"/)
        a.download = match ? match[1] : "export.csv"
        a.click()
        URL.revokeObjectURL(url)
      } else {
        // PDF — open HTML in new tab (user prints to PDF)
        const res = await fetch(`${API}${exp.url}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error("Erreur export")
        const html = await res.text()
        const blob = new Blob([html], { type: "text/html" })
        const url = URL.createObjectURL(blob)
        window.open(url, "_blank")
        setTimeout(() => URL.revokeObjectURL(url), 10000)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={!!loading}
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#e2e8f0" }}
      >
        {loading ? "⏳" : "⬇"}
        {loading || label}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 mt-2 z-30 rounded-xl overflow-hidden shadow-2xl min-w-[180px]"
            style={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            {exports.map((exp) => (
              <button
                key={exp.label}
                onClick={() => handleExport(exp)}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-white/5 text-left"
                style={{ color: "#e2e8f0" }}
              >
                <span>{exp.icon}</span>
                <span>{exp.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
