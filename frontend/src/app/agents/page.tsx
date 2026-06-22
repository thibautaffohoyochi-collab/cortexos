"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { AppHeader } from "@/components/ui/AppHeader"

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"

const STEP_TYPES = [
  { type: "search_sources", label: "🔍 Chercher dans les sources", fields: [
    { key: "query", label: "Requête de recherche", placeholder: "Quels sont mes concurrents ?" },
    { key: "limit", label: "Nombre de résultats", placeholder: "5" },
  ]},
  { type: "ask_ai", label: "🤖 Demander à l'IA", fields: [
    { key: "prompt", label: "Prompt", placeholder: "Analyse les données suivantes : {{last_output}}" },
    { key: "use_context", label: "Utiliser le contexte précédent", placeholder: "true" },
  ]},
  { type: "summarize", label: "📝 Résumer", fields: [
    { key: "content", label: "Contenu à résumer", placeholder: "{{last_output}}" },
  ]},
  { type: "send_email", label: "📧 Envoyer par email", fields: [
    { key: "to_email", label: "Destinataire", placeholder: "vous@entreprise.com" },
    { key: "subject", label: "Sujet", placeholder: "Rapport CortexOS — {{workflow_name}}" },
    { key: "body", label: "Corps", placeholder: "{{last_output}}" },
  ]},
  { type: "save_to_chat", label: "💬 Sauvegarder dans le chat", fields: [
    { key: "title", label: "Titre de la conversation", placeholder: "Rapport du {{date}}" },
    { key: "content", label: "Contenu", placeholder: "{{last_output}}" },
  ]},
]

type Step = { name: string; type: string; config: Record<string, string> }
type Workflow = { id: string; name: string; description: string; steps: Step[]; schedule: string | null; is_active: boolean; created_at: string }
type Run = { id: string; status: string; final_output: string | null; error: string | null; started_at: string; completed_at: string | null; steps_results: any[] }

const STATUS_COLORS: Record<string, string> = {
  completed: "text-green-400 bg-green-950 border-green-800",
  running: "text-yellow-400 bg-yellow-950 border-yellow-800",
  failed: "text-red-400 bg-red-950 border-red-800",
  idle: "text-gray-400 bg-gray-800 border-gray-700",
}

export default function AgentsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const token = (session?.user as any)?.accessToken

  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [loading, setLoading] = useState(true)
  const [showBuilder, setShowBuilder] = useState(false)
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null)
  const [runs, setRuns] = useState<Run[]>([])
  const [runningId, setRunningId] = useState<string | null>(null)
  const [pollingRunId, setPollingRunId] = useState<string | null>(null)

  // Form state
  const [wfName, setWfName] = useState("")
  const [wfDesc, setWfDesc] = useState("")
  const [wfSchedule, setWfSchedule] = useState("")
  const [steps, setSteps] = useState<Step[]>([])
  const [saving, setSaving] = useState(false)

  const fetchWorkflows = () => {
    if (!token) return
    fetch(`${API}/workflows`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setWorkflows(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchWorkflows() }, [token])

  // Poll run status
  useEffect(() => {
    if (!pollingRunId || !token) return
    const interval = setInterval(async () => {
      const r = await fetch(`${API}/workflows/runs/${pollingRunId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await r.json()
      if (data.status === "completed" || data.status === "failed") {
        clearInterval(interval)
        setPollingRunId(null)
        setRunningId(null)
        if (selectedWorkflow) {
          loadRuns(selectedWorkflow.id)
        }
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [pollingRunId, token])

  const loadRuns = async (workflowId: string) => {
    if (!token) return
    const r = await fetch(`${API}/workflows/${workflowId}/runs`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const data = await r.json()
    setRuns(Array.isArray(data) ? data : [])
  }

  const selectWorkflow = (w: Workflow) => {
    setSelectedWorkflow(w)
    loadRuns(w.id)
  }

  const addStep = (type: string) => {
    const def = STEP_TYPES.find(s => s.type === type)!
    const config: Record<string, string> = {}
    def.fields.forEach(f => { config[f.key] = "" })
    setSteps(prev => [...prev, { name: def.label, type, config }])
  }

  const updateStepConfig = (i: number, key: string, value: string) => {
    setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, config: { ...s.config, [key]: value } } : s))
  }

  const updateStepName = (i: number, name: string) => {
    setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, name } : s))
  }

  const removeStep = (i: number) => {
    setSteps(prev => prev.filter((_, idx) => idx !== i))
  }

  const moveStep = (i: number, dir: -1 | 1) => {
    const newSteps = [...steps]
    const j = i + dir
    if (j < 0 || j >= newSteps.length) return
    ;[newSteps[i], newSteps[j]] = [newSteps[j], newSteps[i]]
    setSteps(newSteps)
  }

  const saveWorkflow = async () => {
    if (!token || !wfName || steps.length === 0) return
    setSaving(true)
    try {
      const res = await fetch(`${API}/workflows`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: wfName, description: wfDesc, steps, schedule: wfSchedule || null }),
      })
      if (res.ok) {
        fetchWorkflows()
        setShowBuilder(false)
        setWfName(""); setWfDesc(""); setWfSchedule(""); setSteps([])
      }
    } finally {
      setSaving(false)
    }
  }

  const runWorkflow = async (workflowId: string) => {
    if (!token) return
    setRunningId(workflowId)
    const res = await fetch(`${API}/workflows/${workflowId}/run`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (data.run_id) {
      setPollingRunId(data.run_id)
      if (selectedWorkflow?.id === workflowId) {
        loadRuns(workflowId)
      }
    }
  }

  const deleteWorkflow = async (workflowId: string) => {
    if (!token) return
    await fetch(`${API}/workflows/${workflowId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
    setWorkflows(prev => prev.filter(w => w.id !== workflowId))
    if (selectedWorkflow?.id === workflowId) setSelectedWorkflow(null)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <AppHeader />
      <div className="flex h-[calc(100vh-57px)]">

        {/* Left panel — workflow list */}
        <div className="w-72 border-r border-gray-800 flex flex-col">
          <div className="p-4 border-b border-gray-800">
            <button
              onClick={() => { setShowBuilder(true); setSelectedWorkflow(null) }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium transition-colors"
            >
              <span>+</span> Nouveau workflow
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {loading ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-900 rounded-xl animate-pulse" />)}
              </div>
            ) : workflows.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                <div className="text-3xl mb-2">🤖</div>
                Aucun workflow.<br />Créez-en un !
              </div>
            ) : (
              workflows.map(w => (
                <div
                  key={w.id}
                  onClick={() => selectWorkflow(w)}
                  className={`rounded-xl p-3 cursor-pointer transition-colors border ${
                    selectedWorkflow?.id === w.id
                      ? "bg-gray-800 border-blue-600"
                      : "bg-gray-900 border-gray-800 hover:border-gray-700"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{w.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{w.steps.length} étape{w.steps.length > 1 ? "s" : ""}</p>
                      {w.schedule && <p className="text-xs text-blue-400 mt-0.5">⏰ {w.schedule}</p>}
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); runWorkflow(w.id) }}
                      disabled={runningId === w.id}
                      className="shrink-0 px-2 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs transition-colors"
                    >
                      {runningId === w.id ? "⏳" : "▶"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* Builder */}
          {showBuilder && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Créer un workflow</h2>
                <button onClick={() => setShowBuilder(false)} className="text-gray-400 hover:text-white">×</button>
              </div>

              {/* Workflow info */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-wider">Nom du workflow</label>
                  <input
                    value={wfName}
                    onChange={e => setWfName(e.target.value)}
                    placeholder="Analyse concurrentielle hebdo"
                    className="mt-1 w-full rounded-lg bg-gray-800 border border-gray-700 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-wider">Description (optionnel)</label>
                  <input
                    value={wfDesc}
                    onChange={e => setWfDesc(e.target.value)}
                    placeholder="Analyse mes concurrents et envoie un rapport par email"
                    className="mt-1 w-full rounded-lg bg-gray-800 border border-gray-700 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-wider">Planification (cron, optionnel)</label>
                  <input
                    value={wfSchedule}
                    onChange={e => setWfSchedule(e.target.value)}
                    placeholder="0 9 * * 1 (tous les lundis à 9h)"
                    className="mt-1 w-full rounded-lg bg-gray-800 border border-gray-700 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Steps */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Étapes ({steps.length})</h3>

                {steps.map((step, i) => {
                  const def = STEP_TYPES.find(s => s.type === step.type)!
                  return (
                    <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded-full">#{i+1}</span>
                          <input
                            value={step.name}
                            onChange={e => updateStepName(i, e.target.value)}
                            className="bg-transparent text-sm font-medium focus:outline-none border-b border-transparent focus:border-gray-600"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => moveStep(i, -1)} disabled={i === 0} className="text-gray-500 hover:text-white disabled:opacity-30 px-1">↑</button>
                          <button onClick={() => moveStep(i, 1)} disabled={i === steps.length-1} className="text-gray-500 hover:text-white disabled:opacity-30 px-1">↓</button>
                          <button onClick={() => removeStep(i)} className="text-gray-500 hover:text-red-400 px-1">×</button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {def.fields.map(f => (
                          <div key={f.key}>
                            <label className="text-xs text-gray-500">{f.label}</label>
                            <input
                              value={step.config[f.key] ?? ""}
                              onChange={e => updateStepConfig(i, f.key, e.target.value)}
                              placeholder={f.placeholder}
                              className="mt-0.5 w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}

                {/* Add step */}
                <div className="bg-gray-900 border border-dashed border-gray-700 rounded-2xl p-4">
                  <p className="text-xs text-gray-500 mb-3">Ajouter une étape</p>
                  <div className="flex flex-wrap gap-2">
                    {STEP_TYPES.map(s => (
                      <button
                        key={s.type}
                        onClick={() => addStep(s.type)}
                        className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 border border-gray-700 transition-colors"
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Save */}
              <button
                onClick={saveWorkflow}
                disabled={saving || !wfName || steps.length === 0}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-medium transition-colors"
              >
                {saving ? "Enregistrement..." : "Créer le workflow"}
              </button>
            </div>
          )}

          {/* Workflow detail */}
          {selectedWorkflow && !showBuilder && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold">{selectedWorkflow.name}</h2>
                  {selectedWorkflow.description && <p className="text-gray-400 text-sm mt-1">{selectedWorkflow.description}</p>}
                  {selectedWorkflow.schedule && <p className="text-blue-400 text-xs mt-1">⏰ {selectedWorkflow.schedule}</p>}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => runWorkflow(selectedWorkflow.id)}
                    disabled={runningId === selectedWorkflow.id}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-medium transition-colors"
                  >
                    {runningId === selectedWorkflow.id ? "⏳ En cours..." : "▶ Lancer"}
                  </button>
                  <button
                    onClick={() => deleteWorkflow(selectedWorkflow.id)}
                    className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-red-950 hover:border-red-800 border border-gray-700 text-sm text-gray-400 hover:text-red-400 transition-colors"
                  >
                    Supprimer
                  </button>
                </div>
              </div>

              {/* Steps overview */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <h3 className="text-sm font-medium mb-4">Étapes du workflow</h3>
                <div className="space-y-2">
                  {selectedWorkflow.steps.map((step, i) => {
                    const def = STEP_TYPES.find(s => s.type === step.type)
                    return (
                      <div key={i} className="flex items-center gap-3 text-sm">
                        <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded-full w-7 text-center">{i+1}</span>
                        <span>{def?.label ?? step.type}</span>
                        <span className="text-gray-500">—</span>
                        <span className="text-gray-400 truncate">{step.name}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Runs */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
                  Historique des exécutions
                </h3>
                {runs.length === 0 ? (
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center text-gray-500 text-sm">
                    Aucune exécution. Lancez le workflow avec ▶
                  </div>
                ) : (
                  runs.map(run => (
                    <div key={run.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs px-2 py-1 rounded-full border ${STATUS_COLORS[run.status]}`}>
                          {run.status === "completed" ? "✅ Terminé" :
                           run.status === "running" ? "⏳ En cours" :
                           run.status === "failed" ? "❌ Échoué" : "⏸ En attente"}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(run.started_at).toLocaleString("fr-FR")}
                        </span>
                      </div>

                      {/* Step results */}
                      {run.steps_results?.length > 0 && (
                        <div className="space-y-1">
                          {run.steps_results.map((s: any, i: number) => (
                            <div key={i} className="flex items-start gap-2 text-xs">
                              <span>{s.success ? "✅" : "❌"}</span>
                              <span className="text-gray-400">{s.name}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Final output */}
                      {run.final_output && (
                        <div className="bg-gray-800 rounded-lg p-3 text-xs text-gray-300 max-h-40 overflow-y-auto whitespace-pre-wrap">
                          {run.final_output}
                        </div>
                      )}

                      {run.error && (
                        <p className="text-xs text-red-400">{run.error}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!selectedWorkflow && !showBuilder && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
              <div className="text-6xl">🤖</div>
              <h2 className="text-xl font-semibold">Agents & Workflows</h2>
              <p className="text-gray-400 text-sm max-w-md">
                Créez des workflows multi-étapes automatisés. L&apos;IA exécute chaque étape et produit un résultat final.
              </p>
              <button
                onClick={() => setShowBuilder(true)}
                className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm font-medium transition-colors"
              >
                Créer mon premier workflow
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
