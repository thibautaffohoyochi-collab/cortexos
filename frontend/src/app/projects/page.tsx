"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { ExportMenu } from "@/components/ui/ExportMenu"

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"

type Task = { id:string; title:string; description:string; status:string; priority:string; due_date:string|null; tags:string[]; position:number }
type Project = { id:string; name:string; description:string; color:string; emoji:string; tasks:Task[]; task_count:number; done_count:number }

const PRIORITY_COLORS: Record<string,string> = { urgent:"bg-red-950 text-red-400 border-red-800", high:"bg-orange-950 text-orange-400 border-orange-800", medium:"bg-yellow-950 text-yellow-400 border-yellow-800", low:"bg-gray-800 text-gray-400 border-gray-700" }
const STATUS_COLS = [
  { key:"todo", label:"À faire", icon:"⭕", color:"text-gray-400" },
  { key:"in_progress", label:"En cours", icon:"🔵", color:"text-blue-400" },
  { key:"done", label:"Terminé", icon:"✅", color:"text-green-400" },
]
const EMOJIS = ["📁","🚀","💡","🎯","🛒","📊","🔧","🎨","📱","🌐","💼","⚡"]
const COLORS = ["#2563eb","#7c3aed","#059669","#dc2626","#d97706","#0891b2","#be185d"]

export default function ProjectsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const token = (session?.user as any)?.accessToken

  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [showNewProject, setShowNewProject] = useState(false)
  const [showNewTask, setShowNewTask] = useState<string|null>(null) // status
  const [aiPrompt, setAiPrompt] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [dragging, setDragging] = useState<string|null>(null)

  // Forms
  const [pForm, setPForm] = useState({ name:"", description:"", color:"#2563eb", emoji:"📁" })
  const [tForm, setTForm] = useState({ title:"", description:"", priority:"medium", due_date:"" })
  const [saving, setSaving] = useState(false)

  const fetchProjects = async () => {
    if (!token) return
    const r = await fetch(`${API}/projects`, { headers: { Authorization: `Bearer ${token}` } })
    const d = await r.json(); setProjects(Array.isArray(d)?d:[]); setLoading(false)
  }

  useEffect(() => { fetchProjects() }, [token])

  const createProject = async (e: React.FormEvent) => {
    e.preventDefault(); if (!token) return; setSaving(true)
    const r = await fetch(`${API}/projects`, { method:"POST", headers:{ Authorization:`Bearer ${token}`, "Content-Type":"application/json" }, body:JSON.stringify(pForm) })
    if (r.ok) { await fetchProjects(); setShowNewProject(false); setPForm({name:"",description:"",color:"#2563eb",emoji:"📁"}) }
    setSaving(false)
  }

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault(); if (!token||!selectedProject) return; setSaving(true)
    const body = { ...tForm, status: showNewTask||"todo", due_date: tForm.due_date||null }
    const r = await fetch(`${API}/projects/${selectedProject.id}/tasks`, { method:"POST", headers:{ Authorization:`Bearer ${token}`, "Content-Type":"application/json" }, body:JSON.stringify(body) })
    if (r.ok) {
      const newTask = await r.json()
      const updated = { ...selectedProject, tasks: [...selectedProject.tasks, newTask], task_count: selectedProject.task_count+1 }
      setSelectedProject(updated as Project)
      setProjects(prev => prev.map(p => p.id===selectedProject.id ? updated as Project : p))
      setShowNewTask(null); setTForm({title:"",description:"",priority:"medium",due_date:""})
    }
    setSaving(false)
  }

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    if (!token||!selectedProject) return
    await fetch(`${API}/projects/${selectedProject.id}/tasks/${taskId}`, { method:"PUT", headers:{ Authorization:`Bearer ${token}`, "Content-Type":"application/json" }, body:JSON.stringify({status:newStatus}) })
    const updated = { ...selectedProject, tasks: selectedProject.tasks.map(t => t.id===taskId ? {...t,status:newStatus} : t) }
    setSelectedProject(updated as Project)
    setProjects(prev => prev.map(p => p.id===selectedProject.id ? updated as Project : p))
  }

  const deleteTask = async (taskId: string) => {
    if (!token||!selectedProject) return
    await fetch(`${API}/projects/${selectedProject.id}/tasks/${taskId}`, { method:"DELETE", headers:{ Authorization:`Bearer ${token}` } })
    const updated = { ...selectedProject, tasks: selectedProject.tasks.filter(t=>t.id!==taskId), task_count: selectedProject.task_count-1 }
    setSelectedProject(updated as Project)
    setProjects(prev => prev.map(p => p.id===selectedProject.id ? updated as Project : p))
  }

  const generateAITasks = async () => {
    if (!token||!selectedProject||!aiPrompt) return; setAiLoading(true)
    const r = await fetch(`${API}/projects/${selectedProject.id}/ai-tasks`, { method:"POST", headers:{ Authorization:`Bearer ${token}`, "Content-Type":"application/json" }, body:JSON.stringify({prompt:aiPrompt}) })
    const data = await r.json()
    if (data.tasks) {
      const updated = { ...selectedProject, tasks:[...selectedProject.tasks,...data.tasks], task_count:selectedProject.task_count+data.count }
      setSelectedProject(updated as Project)
      setProjects(prev => prev.map(p => p.id===selectedProject.id ? updated as Project : p))
      setAiPrompt("")
    }
    setAiLoading(false)
  }

  const progress = selectedProject ? Math.round((selectedProject.tasks.filter(t=>t.status==="done").length / Math.max(selectedProject.tasks.length,1))*100) : 0

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800 glass sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <span className="logo-animated text-lg">⬡</span>
          <span className="font-bold gradient-text"> CortexOS</span>
        </div>
        <nav className="flex items-center gap-4 text-sm text-gray-400">
          <button onClick={()=>router.push("/dashboard")} className="hover:text-white transition-colors">Dashboard</button>
          <button onClick={()=>router.push("/chat")} className="hover:text-white transition-colors">Chat</button>
          <button onClick={()=>router.push("/agents")} className="hover:text-white transition-colors">Agents</button>
          <span className="text-white font-medium">Projets</span>
        </nav>
      </header>

      <div className="flex h-[calc(100vh-65px)]">
        {/* Sidebar projects */}
        <div className="w-64 border-r border-gray-800 flex flex-col">
          <div className="p-3 border-b border-gray-800">
            <button onClick={()=>setShowNewProject(!showNewProject)}
              className="w-full px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm font-medium transition-all hover:scale-[1.02]">
              + Nouveau projet
            </button>
          </div>

          {showNewProject && (
            <form onSubmit={createProject} className="p-3 border-b border-gray-800 space-y-2 animate-fade-in-up">
              <div className="flex gap-2">
                <div className="relative">
                  <button type="button" className="w-10 h-10 rounded-lg border border-gray-700 bg-gray-800 text-xl flex items-center justify-center" onClick={()=>{}}>
                    {pForm.emoji}
                  </button>
                </div>
                <input required value={pForm.name} onChange={e=>setPForm(p=>({...p,name:e.target.value}))} placeholder="Nom du projet"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"/>
              </div>
              <div className="flex flex-wrap gap-1">
                {EMOJIS.map(e=><button key={e} type="button" onClick={()=>setPForm(p=>({...p,emoji:e}))} className={`w-7 h-7 rounded text-sm ${pForm.emoji===e?"ring-2 ring-blue-500":""}`}>{e}</button>)}
              </div>
              <div className="flex gap-1">
                {COLORS.map(c=><button key={c} type="button" onClick={()=>setPForm(p=>({...p,color:c}))} className={`w-6 h-6 rounded-full ${pForm.color===c?"ring-2 ring-white ring-offset-1 ring-offset-gray-900":""}`} style={{background:c}}/>)}
              </div>
              <input value={pForm.description} onChange={e=>setPForm(p=>({...p,description:e.target.value}))} placeholder="Description (optionnel)"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500"/>
              <div className="flex gap-2">
                <button type="submit" disabled={saving} className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-medium disabled:opacity-50">{saving?"...":"Créer"}</button>
                <button type="button" onClick={()=>setShowNewProject(false)} className="px-3 py-2 rounded-lg border border-gray-700 text-xs text-gray-400">×</button>
              </div>
            </form>
          )}

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loading ? <div className="p-2 space-y-2">{[1,2,3].map(i=><div key={i} className="h-12 rounded-xl bg-gray-900 shimmer"/>)}</div>
            : projects.length===0 ? <div className="text-center py-8 text-gray-600 text-xs"><div className="text-3xl mb-2">📁</div>Aucun projet</div>
            : projects.map(p=>(
              <button key={p.id} onClick={()=>setSelectedProject(p)}
                className={`w-full text-left p-3 rounded-xl transition-all border ${selectedProject?.id===p.id?"border-blue-600 glass-card":"border-transparent hover:border-gray-700 hover:bg-gray-900/50"}`}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{p.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <div className="flex-1 h-1 rounded-full bg-gray-800 overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{width:`${p.task_count>0?Math.round((p.done_count/p.task_count)*100):0}%`,background:p.color}}/>
                      </div>
                      <span className="text-xs text-gray-500">{p.done_count}/{p.task_count}</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Kanban board */}
        <div className="flex-1 overflow-auto p-6">
          {selectedProject ? (
            <div className="space-y-6 min-w-[700px]">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{selectedProject.emoji}</span>
                  <div>
                    <h2 className="text-xl font-bold">{selectedProject.name}</h2>
                    {selectedProject.description && <p className="text-gray-400 text-sm">{selectedProject.description}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <div className="w-24 h-2 rounded-full bg-gray-800 overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{width:`${progress}%`,background:selectedProject.color}}/>
                    </div>
                    <span>{progress}%</span>
                  </div>
                  {token && (
                    <ExportMenu token={token} label="Exporter" exports={[
                      { label: "PDF Projet", icon: "📄", url: `/exports/projects/${selectedProject.id}/pdf`, download: false },
                      { label: "CSV Tâches", icon: "📊", url: `/exports/projects/${selectedProject.id}/csv`, download: true },
                    ]} />
                  )}
                </div>
              </div>

              {/* AI task generator */}
              <div className="flex gap-3 glass-card rounded-2xl p-3">
                <span className="text-xl">🤖</span>
                <input value={aiPrompt} onChange={e=>setAiPrompt(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&generateAITasks()}
                  placeholder="Demandez à l'IA de générer des tâches... ex: 'Crée les tâches pour lancer un site web'"
                  className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none"/>
                <button onClick={generateAITasks} disabled={aiLoading||!aiPrompt}
                  className="px-4 py-1.5 rounded-xl text-xs font-medium transition-all disabled:opacity-40"
                  style={{background:aiLoading?"#374151":"linear-gradient(135deg,#2563eb,#7c3aed)"}}>
                  {aiLoading?"⏳ Génération...":"✨ Générer"}
                </button>
              </div>

              {/* Kanban columns */}
              <div className="grid grid-cols-3 gap-4">
                {STATUS_COLS.map(col=>{
                  const colTasks = selectedProject.tasks.filter(t=>t.status===col.key).sort((a,b)=>a.position-b.position)
                  return (
                    <div key={col.key} className="space-y-3"
                      onDragOver={e=>e.preventDefault()}
                      onDrop={e=>{ e.preventDefault(); if(dragging) updateTaskStatus(dragging,col.key); setDragging(null) }}>
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                          <span>{col.icon}</span>
                          <span className={`text-sm font-semibold ${col.color}`}>{col.label}</span>
                          <span className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full">{colTasks.length}</span>
                        </div>
                        <button onClick={()=>setShowNewTask(col.key)} className="text-gray-600 hover:text-white text-lg transition-colors">+</button>
                      </div>

                      {showNewTask===col.key && (
                        <form onSubmit={createTask} className="glass-card rounded-xl p-3 space-y-2 animate-fade-in-up">
                          <input required value={tForm.title} onChange={e=>setTForm(p=>({...p,title:e.target.value}))} placeholder="Titre de la tâche"
                            autoFocus className="w-full bg-transparent border-b border-gray-700 pb-1 text-sm focus:outline-none focus:border-blue-500"/>
                          <select value={tForm.priority} onChange={e=>setTForm(p=>({...p,priority:e.target.value}))}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-300">
                            {["urgent","high","medium","low"].map(v=><option key={v} value={v}>{v==="urgent"?"🔴 Urgent":v==="high"?"🟠 Haute":v==="medium"?"🟡 Moyenne":"🟢 Basse"}</option>)}
                          </select>
                          <input type="date" value={tForm.due_date} onChange={e=>setTForm(p=>({...p,due_date:e.target.value}))}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-300"/>
                          <div className="flex gap-2">
                            <button type="submit" disabled={saving} className="flex-1 py-1.5 rounded-lg bg-blue-600 text-xs font-medium disabled:opacity-50">Ajouter</button>
                            <button type="button" onClick={()=>setShowNewTask(null)} className="px-2 py-1.5 rounded-lg border border-gray-700 text-xs text-gray-400">×</button>
                          </div>
                        </form>
                      )}

                      <div className="space-y-2 min-h-[100px]">
                        {colTasks.map(task=>(
                          <div key={task.id} draggable onDragStart={()=>setDragging(task.id)} onDragEnd={()=>setDragging(null)}
                            className={`glass-card rounded-xl p-3 cursor-grab active:cursor-grabbing transition-all hover:scale-[1.01] ${dragging===task.id?"opacity-50":""}`}>
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-medium flex-1">{task.title}</p>
                              <button onClick={()=>deleteTask(task.id)} className="text-gray-700 hover:text-red-400 text-xs transition-colors shrink-0">×</button>
                            </div>
                            {task.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{task.description}</p>}
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <span className={`text-xs px-2 py-0.5 rounded-full border ${PRIORITY_COLORS[task.priority]}`}>
                                {task.priority==="urgent"?"🔴":task.priority==="high"?"🟠":task.priority==="medium"?"🟡":"🟢"} {task.priority}
                              </span>
                              {task.due_date && (
                                <span className="text-xs text-gray-500">📅 {new Date(task.due_date).toLocaleDateString("fr-FR",{day:"numeric",month:"short"})}</span>
                              )}
                            </div>
                            <div className="flex gap-1 mt-2">
                              {STATUS_COLS.filter(c=>c.key!==task.status).map(c=>(
                                <button key={c.key} onClick={()=>updateTaskStatus(task.id,c.key)}
                                  className="text-xs px-2 py-0.5 rounded-lg border border-gray-700 text-gray-500 hover:text-white hover:border-gray-500 transition-colors">
                                  → {c.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
              <div className="text-6xl">📋</div>
              <h2 className="text-xl font-semibold">Projets & Tâches</h2>
              <p className="text-gray-400 text-sm max-w-md">Créez des projets, organisez vos tâches en Kanban, et laissez l&apos;IA générer des tâches pour vous.</p>
              <button onClick={()=>setShowNewProject(true)}
                className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm font-medium transition-all hover:scale-105">
                + Créer mon premier projet
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
