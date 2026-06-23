"use client"

import { createContext, useContext, useEffect, useState } from "react"

export type Lang = "fr" | "en"

const translations = {
  fr: {
    // Nav
    nav_dashboard: "Dashboard",
    nav_chat: "Chat",
    nav_sources: "Sources",
    nav_agents: "Agents",
    nav_team: "Équipe",
    nav_settings: "Paramètres",
    nav_logout: "Déconnexion",
    nav_login: "Se connecter",
    nav_signup: "Commencer",
    nav_websearch: "🌐 Web Search",
    nav_competitive: "Veille",
    nav_projects: "Projets",

    // Chat
    chat_placeholder: "Posez votre question…",
    chat_placeholder_hybrid: "Posez votre question (données + internet)…",
    chat_send: "Envoyer",
    chat_new: "Nouvelle conversation",
    chat_empty_title: "Bonjour",
    chat_empty_sub: "Posez une question sur vos données d'entreprise",
    chat_thinking: "Cortex analyse votre question…",
    chat_thinking2: "Cortex cherche dans vos données…",
    chat_thinking3: "Cortex rédige une réponse…",
    chat_thinking_hybrid: "Cortex cherche dans vos données et sur internet…",
    chat_focus_hint: "Appuyez sur Échap pour quitter le mode focus",
    chat_suggestions: ["Résume mes derniers emails", "Quels sont mes concurrents ?", "Analyse mes données Drive"],
    chat_mode_data: "📂 Mode données · interroge uniquement vos fichiers importés",
    chat_mode_hybrid: "🌐 Mode hybride · données internes + recherche internet",
    chat_hybrid_active: "Mode hybride actif — vos données + internet",
    chat_sessions: "Conversations",
    chat_no_sessions: "Aucune conversation",
    chat_export_pdf: "PDF / Imprimer",
    chat_export_csv: "CSV",

    // Sources
    sources_title: "Sources de données",
    sources_subtitle: "Importez vos fichiers pour que l'IA puisse répondre à partir de vos données. Formats supportés : PDF, Excel, Word, CSV, TXT.",
    sources_connect: "Connecter vos services",
    sources_imported: "Sources importées",
    sources_none: "Aucune source importée. Commencez par importer un fichier.",
    sources_drop: "Glissez un fichier ici",
    sources_drop_or: "ou cliquez pour choisir · PDF, Excel, Word, CSV, TXT · max 20 MB",
    sources_drop_hover: "Relâchez pour importer",
    sources_indexing: "Indexation en cours…",
    sources_reconnect: "Reconnecter",
    sources_connect_btn: "Connecter",
    sources_active_hint: "💡 Vos données sont indexées. Allez dans le chat et posez une question sur vos données.",
    sources_go_chat: "chat",
    sources_status_active: "✅ Actif",
    sources_status_syncing: "⏳ En cours",
    sources_status_pending: "🕐 En attente",
    sources_status_error: "❌ Erreur",

    // Dashboard
    dash_welcome: "Bonjour",
    dash_sessions: "Conversations",
    dash_messages: "Messages échangés",
    dash_sources_active: "Sources actives",
    dash_workflows: "Workflows",
    dash_this_week: "cette semaine",
    dash_total: "total",
    dash_recent: "Conversations récentes",
    dash_see_all: "Voir tout →",
    dash_start: "Démarrer une conversation",
    dash_quick_access: "Accès rapide",
    dash_activity: "Activité — 7 derniers jours",
    dash_messages_sent: "Messages envoyés",
    dash_no_activity: "Pas encore d'activité",
    dash_sources_panel: "Sources de données",
    dash_manage: "Gérer →",
    dash_no_sources: "Aucune source importée",
    dash_import: "Importer →",
    dash_last_runs: "Dernières exécutions",
    dash_agents: "Agents →",
    dash_no_runs: "Aucune exécution",
    dash_system_health: "Santé du système",
    dash_api: "API Backend",
    dash_db: "Base de données",
    dash_active_sources: "Sources actives",
    dash_success_rate: "Taux de réussite workflows",
    dash_new_chat: "+ Nouveau chat",
    dash_workspace: "Espace",

    // Settings
    settings_title: "Paramètres",
    settings_theme: "Thème de l'interface",
    settings_profile: "Mon profil",
    settings_email: "Email",
    settings_name: "Nom complet",
    settings_save: "Enregistrer",
    settings_saving: "Enregistrement...",
    settings_password: "Changer le mot de passe",
    settings_current_pwd: "Mot de passe actuel",
    settings_new_pwd: "Nouveau mot de passe",
    settings_confirm_pwd: "Confirmer le nouveau mot de passe",
    settings_change_pwd: "Changer le mot de passe",
    settings_account: "Mon compte",
    settings_role: "Rôle",
    settings_role_admin: "Administrateur",
    settings_role_member: "Membre",
    settings_space: "Espace",
    settings_lang: "Langue",
    settings_memory_title: "Mémoire de l'IA",
    settings_memory_sub: "Ce que Cortex a appris sur vous au fil des conversations",
    settings_memory_empty: "Pas encore de mémoire.",
    settings_memory_learn: "Cortex apprend au fil de vos conversations.",
    settings_memory_clear: "🗑️ Effacer",
    settings_memory_profile: "Profil",
    settings_memory_facts: "Faits mémorisés",
    settings_memory_projects: "Projets en cours",
    settings_memory_updated: "Dernière mise à jour",

    // Team
    team_title: "Équipe",
    team_subtitle: "membres dans votre espace",
    team_invite: "Inviter",
    team_invite_title: "Inviter un collaborateur",
    team_invite_btn: "✉️ Générer le lien d'invitation",
    team_invite_generating: "⏳ Génération…",
    team_members: "Membres",
    team_admins: "Administrateurs",
    team_pending: "Invitations en attente",
    team_expires: "⏱ Valable 7 jours",
    team_copy: "📋 Copier",
    team_copied: "✅ Copié",
    team_no_admin: "💡 Seuls les administrateurs peuvent inviter des membres ou modifier les rôles.",
    team_email: "Email *",
    team_fullname: "Nom (optionnel)",
    team_close: "Fermer",
    team_you: "Vous",
    team_role_admin: "🛡️ Admin",
    team_role_member: "👤 Membre",

    // Auth
    auth_login_title: "Votre IA business",
    auth_email: "Email",
    auth_password: "Mot de passe",
    auth_login_btn: "Se connecter",
    auth_login_loading: "Connexion...",
    auth_no_account: "Pas encore de compte ?",
    auth_create: "Créer un espace",
    auth_register_title: "Créer votre espace entreprise",
    auth_company: "Nom de l'entreprise",
    auth_fullname: "Votre nom",
    auth_register_btn: "Créer mon espace",
    auth_register_loading: "Création...",
    auth_has_account: "Déjà un compte ?",

    // Theme names
    theme_dark: "Sombre",
    theme_light: "Clair",
    theme_corporate: "Corporate",
    theme_dark_desc: "Interface sombre — par défaut",
    theme_light_desc: "Interface claire pour la journée",
    theme_corp_desc: "Bleu pro pour les présentations",

    // Agents
    agents_title: "Agents & Workflows",
    agents_subtitle: "Créez des workflows multi-étapes automatisés. L'IA exécute chaque étape et produit un résultat final.",
    agents_new: "+ Nouveau workflow",
    agents_create_first: "Créer mon premier workflow",
    agents_create: "Créer le workflow",
    agents_creating: "Enregistrement...",
    agents_run: "▶ Lancer",
    agents_running: "⏳ En cours...",
    agents_delete: "Supprimer",
    agents_history: "Historique des exécutions",
    agents_no_runs: "Aucune exécution. Lancez le workflow avec ▶",
    agents_no_workflows: "Aucun workflow.\nCréez-en un !",
    agents_steps: "Étapes du workflow",
    agents_add_step: "Ajouter une étape",
    agents_name: "Nom du workflow",
    agents_desc: "Description (optionnel)",
    agents_schedule: "Planification (cron, optionnel)",
    agents_schedule_hint: "Format : minute heure jour mois jour_semaine",
    agents_status_completed: "✅ Terminé",
    agents_status_running: "⏳ En cours",
    agents_status_failed: "❌ Échoué",
    agents_status_idle: "⏸ En attente",

    // Web Search
    websearch_title: "Web Search",
    websearch_subtitle: "Recherche sur internet en temps réel",
    websearch_placeholder: "Rechercher quelque chose sur internet…",
    websearch_footer: "Résultats en temps réel depuis internet · Synthèse par Gemini",
    websearch_sources: "source trouvée",
    websearch_sources_plural: "sources trouvées",
    websearch_searching: "Recherche en cours…",
    websearch_internal: "💬 Chat interne",
    websearch_new: "+ Nouvelle recherche",
    websearch_no_searches: "Aucune recherche",
    websearch_full_content: "Contenu complet",
    websearch_empty_title: "Recherche Web",
    websearch_empty_sub: "Posez n'importe quelle question — je cherche sur internet et synthétise les résultats pour vous.",
    websearch_thinking: "Recherche et synthèse des résultats…",
  },

  en: {
    // Nav
    nav_dashboard: "Dashboard",
    nav_chat: "Chat",
    nav_sources: "Sources",
    nav_agents: "Agents",
    nav_team: "Team",
    nav_settings: "Settings",
    nav_logout: "Sign out",
    nav_login: "Sign in",
    nav_signup: "Get started",
    nav_websearch: "🌐 Web Search",
    nav_competitive: "Intel",
    nav_projects: "Projects",

    // Chat
    chat_placeholder: "Ask a question…",
    chat_placeholder_hybrid: "Ask a question (data + internet)…",
    chat_send: "Send",
    chat_new: "New conversation",
    chat_empty_title: "Hello",
    chat_empty_sub: "Ask a question about your business data",
    chat_thinking: "Cortex is analyzing your question…",
    chat_thinking2: "Cortex is searching your data…",
    chat_thinking3: "Cortex is writing a response…",
    chat_thinking_hybrid: "Cortex is searching your data and the web…",
    chat_focus_hint: "Press Escape to exit focus mode",
    chat_suggestions: ["Summarize my latest emails", "Who are my competitors?", "Analyze my Drive files"],
    chat_mode_data: "📂 Data mode · searches only your imported files",
    chat_mode_hybrid: "🌐 Hybrid mode · internal data + web search",
    chat_hybrid_active: "Hybrid mode active — your data + internet",
    chat_sessions: "Conversations",
    chat_no_sessions: "No conversations",
    chat_export_pdf: "PDF / Print",
    chat_export_csv: "CSV",

    // Sources
    sources_title: "Data Sources",
    sources_subtitle: "Import your files so the AI can answer from your data. Supported formats: PDF, Excel, Word, CSV, TXT.",
    sources_connect: "Connect your services",
    sources_imported: "Imported sources",
    sources_none: "No sources imported yet. Start by importing a file.",
    sources_drop: "Drop a file here",
    sources_drop_or: "or click to choose · PDF, Excel, Word, CSV, TXT · max 20 MB",
    sources_drop_hover: "Release to import",
    sources_indexing: "Indexing…",
    sources_reconnect: "Reconnect",
    sources_connect_btn: "Connect",
    sources_active_hint: "💡 Your data is indexed. Go to chat and ask a question about your data.",
    sources_go_chat: "chat",
    sources_status_active: "✅ Active",
    sources_status_syncing: "⏳ Syncing",
    sources_status_pending: "🕐 Pending",
    sources_status_error: "❌ Error",

    // Dashboard
    dash_welcome: "Hello",
    dash_sessions: "Conversations",
    dash_messages: "Messages exchanged",
    dash_sources_active: "Active sources",
    dash_workflows: "Workflows",
    dash_this_week: "this week",
    dash_total: "total",
    dash_recent: "Recent conversations",
    dash_see_all: "See all →",
    dash_start: "Start a conversation",
    dash_quick_access: "Quick access",
    dash_activity: "Activity — last 7 days",
    dash_messages_sent: "Messages sent",
    dash_no_activity: "No activity yet",
    dash_sources_panel: "Data sources",
    dash_manage: "Manage →",
    dash_no_sources: "No sources imported",
    dash_import: "Import →",
    dash_last_runs: "Latest runs",
    dash_agents: "Agents →",
    dash_no_runs: "No runs yet",
    dash_system_health: "System health",
    dash_api: "Backend API",
    dash_db: "Database",
    dash_active_sources: "Active sources",
    dash_success_rate: "Workflow success rate",
    dash_new_chat: "+ New chat",
    dash_workspace: "Workspace",

    // Settings
    settings_title: "Settings",
    settings_theme: "Interface theme",
    settings_profile: "My profile",
    settings_email: "Email",
    settings_name: "Full name",
    settings_save: "Save",
    settings_saving: "Saving...",
    settings_password: "Change password",
    settings_current_pwd: "Current password",
    settings_new_pwd: "New password",
    settings_confirm_pwd: "Confirm new password",
    settings_change_pwd: "Change password",
    settings_account: "My account",
    settings_role: "Role",
    settings_role_admin: "Administrator",
    settings_role_member: "Member",
    settings_space: "Workspace",
    settings_lang: "Language",
    settings_memory_title: "AI Memory",
    settings_memory_sub: "What Cortex has learned about you over conversations",
    settings_memory_empty: "No memory yet.",
    settings_memory_learn: "Cortex learns as you chat.",
    settings_memory_clear: "🗑️ Clear",
    settings_memory_profile: "Profile",
    settings_memory_facts: "Remembered facts",
    settings_memory_projects: "Active projects",
    settings_memory_updated: "Last updated",

    // Team
    team_title: "Team",
    team_subtitle: "members in your workspace",
    team_invite: "Invite",
    team_invite_title: "Invite a collaborator",
    team_invite_btn: "✉️ Generate invitation link",
    team_invite_generating: "⏳ Generating…",
    team_members: "Members",
    team_admins: "Administrators",
    team_pending: "Pending invitations",
    team_expires: "⏱ Valid for 7 days",
    team_copy: "📋 Copy",
    team_copied: "✅ Copied",
    team_no_admin: "💡 Only administrators can invite members or change roles.",
    team_email: "Email *",
    team_fullname: "Name (optional)",
    team_close: "Close",
    team_you: "You",
    team_role_admin: "🛡️ Admin",
    team_role_member: "👤 Member",

    // Auth
    auth_login_title: "Your business AI",
    auth_email: "Email",
    auth_password: "Password",
    auth_login_btn: "Sign in",
    auth_login_loading: "Signing in...",
    auth_no_account: "No account yet?",
    auth_create: "Create a workspace",
    auth_register_title: "Create your workspace",
    auth_company: "Company name",
    auth_fullname: "Your name",
    auth_register_btn: "Create my workspace",
    auth_register_loading: "Creating...",
    auth_has_account: "Already have an account?",

    // Theme names
    theme_dark: "Dark",
    theme_light: "Light",
    theme_corporate: "Corporate",
    theme_dark_desc: "Dark interface — default",
    theme_light_desc: "Light interface for daytime",
    theme_corp_desc: "Professional blue for presentations",

    // Agents
    agents_title: "Agents & Workflows",
    agents_subtitle: "Create automated multi-step workflows. The AI executes each step and produces a final result.",
    agents_new: "+ New workflow",
    agents_create_first: "Create my first workflow",
    agents_create: "Create workflow",
    agents_creating: "Saving...",
    agents_run: "▶ Run",
    agents_running: "⏳ Running...",
    agents_delete: "Delete",
    agents_history: "Execution history",
    agents_no_runs: "No runs yet. Launch the workflow with ▶",
    agents_no_workflows: "No workflows.\nCreate one!",
    agents_steps: "Workflow steps",
    agents_add_step: "Add a step",
    agents_name: "Workflow name",
    agents_desc: "Description (optional)",
    agents_schedule: "Schedule (cron, optional)",
    agents_schedule_hint: "Format: minute hour day month weekday",
    agents_status_completed: "✅ Completed",
    agents_status_running: "⏳ Running",
    agents_status_failed: "❌ Failed",
    agents_status_idle: "⏸ Idle",

    // Web Search
    websearch_title: "Web Search",
    websearch_subtitle: "Real-time internet search",
    websearch_placeholder: "Search something on the internet…",
    websearch_footer: "Real-time results from the web · Synthesized by Gemini",
    websearch_sources: "source found",
    websearch_sources_plural: "sources found",
    websearch_searching: "Searching…",
    websearch_internal: "💬 Internal chat",
    websearch_new: "+ New search",
    websearch_no_searches: "No searches",
    websearch_full_content: "Full content",
    websearch_empty_title: "Web Search",
    websearch_empty_sub: "Ask any question — I'll search the web and synthesize results for you.",
    websearch_thinking: "Searching and synthesizing results…",
  }
}

type T = typeof translations.fr
type LangContextType = { lang: Lang; setLang: (l: Lang) => void; t: T }

const LangContext = createContext<LangContextType>({ lang: "fr", setLang: () => {}, t: translations.fr })

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("fr")

  useEffect(() => {
    const saved = localStorage.getItem("cortexos-lang") as Lang | null
    if (saved === "fr" || saved === "en") setLangState(saved)
  }, [])

  const setLang = (l: Lang) => {
    setLangState(l)
    localStorage.setItem("cortexos-lang", l)
  }

  return (
    <LangContext.Provider value={{ lang, setLang, t: translations[lang] }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang() { return useContext(LangContext) }

export function LangSwitcher({ compact = false }: { compact?: boolean }) {
  const { lang, setLang } = useLang()
  if (compact) return (
    <button onClick={() => setLang(lang === "fr" ? "en" : "fr")}
      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 transition-all"
      style={{ background: "rgba(255,255,255,0.04)" }}>
      <span>{lang === "fr" ? "🇫🇷" : "🇬🇧"}</span>
      <span>{lang === "fr" ? "FR" : "EN"}</span>
    </button>
  )
  return (
    <div className="flex gap-3">
      {(["fr","en"] as Lang[]).map(l => (
        <button key={l} onClick={() => setLang(l)}
          className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
            lang === l ? "border-blue-500 ring-2 ring-blue-500/20 text-white" : "border-gray-700 text-gray-400 hover:border-gray-500"
          }`} style={{ background: lang === l ? "rgba(37,99,235,0.1)" : "rgba(255,255,255,0.03)" }}>
          <span className="text-xl">{l === "fr" ? "🇫🇷" : "🇬🇧"}</span>
          <div className="text-left">
            <p>{l === "fr" ? "Français" : "English"}</p>
            <p className="text-xs text-gray-500">{l === "fr" ? "Interface en français" : "English interface"}</p>
          </div>
          {lang === l && <span className="ml-auto text-blue-400 font-bold">✓</span>}
        </button>
      ))}
    </div>
  )
}
