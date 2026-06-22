"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { ExportMenu } from "@/components/ui/ExportMenu"
import { AppHeader } from "@/components/ui/AppHeader"

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"

type Competitor = {
  id: string; name: string; website: string; description: string
  last_scraped_at: string | null; last_analysis: string | null
  snapshot: any; created_at: string; updated_at: string
}

function renderMd(text: string) {
  return text.split("\n").map((line, i) => {
    if (line.startsWith("## ")) return <h3 key={i} className="text-base font-bold mt-4 mb-1 text-blue-300">{line.slice(3)}</h3>
    if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="font-semibold text-white">{line.slice(2,-2)}</p>
    const html = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    if (line.startsWith("- ") || line.startsWith("* ")) return <li key={i} className="ml-4 list-disc text-gray-300 text-sm" dangerouslySetInnerHTML={{__html: html.slice(2)}}/>
    if (line.trim() === "") return <div key={i} className="h-1"/>
    return <p key={i} className="text-gray-300 text-sm" dangerouslySetInnerHTML={{__html: html}}/>
  })
}

export default function CompetitivePage() {
  const { data: session } = useSession()
  const router = useRouter()
  const token = (session?.user as any)?.accessToken

  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Competitor | null>(null)
  const [analyzing, setAnalyzing] = useState<string | null>(null)
  const [reporting, setReporting] = useState(false)
  const [report, setReport] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: "", website: "", description: "" })
  const [saving, setSaving] = useState(false)

  const fetchCompetitors = () => {
    if (!token) return
    fetch(`${API}/competitive/competitors`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setCompetitors(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchCompetitors() }, [token])

  const addCompetitor = async (e: React.FormEvent) => {
    e.preventDefault(); if (!token) return
    setSaving(true)
    const res = await fetch(`${API}/competitive/competitors`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    if (res.ok) { fetchCompetitors(); setShowAdd(false); setForm({ name: "", website: "", description: "" }) }
    setSaving(false)
  }

  const analyze = async (id: string) => {
    if (!token) return; setAnalyzing(id)
    const res = await fetch(`${API}/competitive/competitors/${id}/analyze`, {
      method: "POST", headers: { Authorization: `Bearer ${token}` }
    })
    const data = await res.json()
    setCompetitors(prev => prev.map(c => c.id === id ? { ...c, ...data } : c))
    if (selected?.id === id) setSelected(data)
    setAnalyzing(null)
  }

  const deleteCompetitor = async (id: string) => {
    if (!token) return
    await fetch(`${API}/competitive/competitors/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } })
    setCompetitors(prev => prev.filter(c => c.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  const generateReport = async () => {
    if (!token) return; setReporting(true); setReport(null)
    const res = await fetch(`${API}/competitive/report`, { method: "POST", headers: { Authorization: `Bearer ${token}` } })
    const data = await res.json(); setReport(data.report); setReporting(false)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <AppHeader />

      <div className="flex h-[calc(100vh-57px)]">
        {/* Left */}
        <div className="w-72 border-r border-gray-800 flex flex-col">
          <div className="p-4 space-y-2 border-b border-gray-800">
            <button onClick={() => setShowAdd(!showAdd)}
              className="w-full px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm font-medium transition-all hover:scale-[1.02]">
              + Ajouter un concurrent
            </button>
            {competitors.length > 0 && (
                <div className="flex gap-2">
                  <button onClick={generateReport} disabled={reporting}
                    className="flex-1 px-4 py-2 rounded-xl border border-gray-700 hover:border-gray-600 text-sm text-gray-400 hover:text-white transition-all disabled:opacity-50">
                    {reporting ? "⏳ Génération..." : "📊 Rapport global"}
                  </button>
                  <ExportMenu token={token} exports={[
                    { label: "PDF Rapport", icon: "📄", url: "/exports/competitive/pdf", download: false },
                    { label: "CSV Concurrents", icon: "📊", url: "/exports/competitive/csv", download: true },
                  ]} />
                </div>
              )}
          </div>

          {showAdd && (
            <form onSubmit={addCompetitor} className="p-4 border-b border-gray-800 space-y-3 animate-fade-in-up">
              {[
                { k: "name", p: "Nom du concurrent *", t: "text" },
                { k: "website", p: "Site web (ex: wedge.work)", t: "text" },
                { k: "description", p: "Description courte", t: "text" },
              ].map(f => (
                <input key={f.k} required={f.k==="name"} type={f.t} placeholder={f.p} value={(form as any)[f.k]}
                  onChange={e => setForm(prev => ({...prev,[f.k]:e.target.value}))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"/>
              ))}
              <div className="flex gap-2">
                <button type="submit" disabled={saving}
                  className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-medium disabled:opacity-50">
                  {saving ? "..." : "Ajouter"}
                </button>
                <button type="button" onClick={() => setShowAdd(false)}
                  className="px-3 py-2 rounded-lg border border-gray-700 text-xs text-gray-400 hover:text-white">
                  ×
                </button>
              </div>
            </form>
          )}

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loading ? (
              <div className="space-y-2 p-2">{[1,2,3].map(i=><div key={i} className="h-14 bg-gray-900 rounded-xl shimmer"/>)}</div>
            ) : competitors.length === 0 ? (
              <div className="text-center py-8 text-gray-600 text-sm">
                <div className="text-3xl mb-2">🔍</div>
                Aucun concurrent.<br/>Ajoutez-en un !
              </div>
            ) : competitors.map(c => (
              <div key={c.id} onClick={() => setSelected(c)}
                className={`p-3 rounded-xl cursor-pointer transition-all border ${selected?.id===c.id?"border-blue-600 glass-card":"border-transparent hover:border-gray-700 hover:bg-gray-900/50"}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    {c.website && <p className="text-xs text-gray-500 truncate">{c.website}</p>}
                    {c.last_scraped_at && <p className="text-xs text-green-500 mt-0.5">✓ Analysé</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={e=>{e.stopPropagation();analyze(c.id)}} disabled={analyzing===c.id}
                      className="w-7 h-7 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 text-xs transition-colors disabled:opacity-50">
                      {analyzing===c.id?"⏳":"🔍"}
                    </button>
                    <button onClick={e=>{e.stopPropagation();deleteCompetitor(c.id)}}
                      className="w-7 h-7 rounded-lg hover:bg-red-950 text-gray-600 hover:text-red-400 text-xs transition-colors">×</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right */}
        <div className="flex-1 overflow-y-auto p-6">
          {report && (
            <div className="max-w-3xl mx-auto mb-6 glass-card rounded-2xl p-6 animate-fade-in-up">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">📊 Rapport de veille global</h2>
                <button onClick={() => setReport(null)} className="text-gray-500 hover:text-white">×</button>
              </div>
              <div className="space-y-1">{renderMd(report)}</div>
            </div>
          )}

          {selected ? (
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold">{selected.name}</h2>
                  {selected.website && (
                    <a href={selected.website.startsWith("http")?selected.website:"https://"+selected.website}
                      target="_blank" rel="noopener noreferrer"
                      className="text-blue-400 text-sm hover:underline">{selected.website}</a>
                  )}
                  {selected.description && <p className="text-gray-400 text-sm mt-1">{selected.description}</p>}
                </div>
                <button onClick={() => analyze(selected.id)} disabled={analyzing===selected.id}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-medium transition-all hover:scale-105">
                  {analyzing===selected.id ? "⏳ Analyse..." : "🔍 Analyser"}
                </button>
              </div>

              {selected.last_analysis ? (
                <div className="glass-card rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Analyse IA</h3>
                    {selected.last_scraped_at && (
                      <span className="text-xs text-gray-500">
                        Mis à jour le {new Date(selected.last_scraped_at).toLocaleDateString("fr-FR")}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">{renderMd(selected.last_analysis)}</div>
                </div>
              ) : (
                <div className="glass-card rounded-2xl p-8 text-center">
                  <div className="text-4xl mb-3">🔍</div>
                  <p className="text-gray-400 text-sm mb-4">
                    {selected.website ? "Cliquez sur Analyser pour scraper et analyser ce concurrent avec l'IA." : "Ajoutez l'URL du site pour lancer l'analyse."}
                  </p>
                  {selected.website && (
                    <button onClick={() => analyze(selected.id)} disabled={analyzing===selected.id}
                      className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm font-medium transition-all">
                      🔍 Lancer l&apos;analyse
                    </button>
                  )}
                </div>
              )}

              {selected.snapshot?.headings?.length > 0 && (
                <div className="glass-card rounded-2xl p-5">
                  <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">Structure du site</h3>
                  <div className="space-y-1">
                    {selected.snapshot.headings.map((h: string, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-gray-400">
                        <span className="text-blue-500">→</span> {h}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
              <div className="text-6xl">🎯</div>
              <h2 className="text-xl font-semibold">Veille concurrentielle</h2>
              <p className="text-gray-400 text-sm max-w-md">
                Ajoutez vos concurrents, analysez leurs sites avec l&apos;IA, et obtenez des insights stratégiques pour vous différencier.
              </p>
              <button onClick={() => setShowAdd(true)}
                className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm font-medium transition-all hover:scale-105">
                + Ajouter mon premier concurrent
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
