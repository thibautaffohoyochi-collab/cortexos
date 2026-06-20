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

    // Chat
    chat_placeholder: "Posez votre question...",
    chat_send: "Envoyer",
    chat_new: "Nouvelle conversation",
    chat_empty_title: "Bonjour",
    chat_empty_sub: "Posez une question sur vos données d'entreprise",
    chat_thinking: "Cortex analyse vos données…",
    chat_thinking2: "Cortex cherche dans vos sources…",
    chat_thinking3: "Cortex rédige une réponse…",
    chat_focus_hint: "Appuyez sur Échap pour quitter le mode focus",
    chat_suggestions: ["Résume mes derniers emails", "Quels sont mes concurrents ?", "Analyse mes données Drive"],

    // Sources
    sources_title: "Sources de données",
    sources_subtitle: "Importez vos fichiers pour que l'IA puisse répondre à partir de vos données.",
    sources_connect: "Connecter vos services",
    sources_imported: "Sources importées",
    sources_none: "Aucune source importée. Commencez par importer un fichier.",
    sources_drop: "Glissez un fichier ici",
    sources_drop_or: "ou cliquez pour choisir · CSV, TXT · max 5 MB",
    sources_drop_hover: "Relâchez pour importer",
    sources_indexing: "Indexation en cours…",
    sources_reconnect: "Reconnecter",
    sources_connect_btn: "Connecter",

    // Dashboard
    dash_welcome: "Bonjour",
    dash_sessions: "Conversations",
    dash_messages: "Messages échangés",
    dash_sources: "Sources connectées",
    dash_recent: "Conversations récentes",
    dash_start: "Démarrer une conversation",
    dash_knowledge: "Graphe de connaissances",
    dash_knowledge_sub: "Les nœuds actifs sont connectés à votre base de connaissances",

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

    // Team
    team_title: "Gestion de l'équipe",
    team_subtitle: "Invitez des collègues dans votre espace entreprise.",
    team_invite: "Inviter un collaborateur",
    team_invite_btn: "Générer un lien d'invitation",
    team_members: "Membres",
    team_expires: "Valable 7 jours",
    team_copy: "Copier",
    team_copied: "✅ Copié",

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
    agents_subtitle: "Créez des workflows multi-étapes automatisés.",
    agents_new: "Nouveau workflow",
    agents_create_first: "Créer mon premier workflow",
    agents_create: "Créer le workflow",
    agents_run: "▶ Lancer",
    agents_running: "⏳ En cours...",
    agents_history: "Historique des exécutions",
    agents_no_runs: "Aucune exécution. Lancez le workflow avec ▶",
    agents_steps: "Étapes du workflow",
    agents_name: "Nom du workflow",
    agents_desc: "Description",
    agents_schedule: "Planification (cron, optionnel)",
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

    // Chat
    chat_placeholder: "Ask a question...",
    chat_send: "Send",
    chat_new: "New conversation",
    chat_empty_title: "Hello",
    chat_empty_sub: "Ask a question about your business data",
    chat_thinking: "Cortex is analyzing your data…",
    chat_thinking2: "Cortex is searching your sources…",
    chat_thinking3: "Cortex is writing a response…",
    chat_focus_hint: "Press Escape to exit focus mode",
    chat_suggestions: ["Summarize my latest emails", "Who are my competitors?", "Analyze my Drive files"],

    // Sources
    sources_title: "Data Sources",
    sources_subtitle: "Import your files so the AI can answer from your data.",
    sources_connect: "Connect your services",
    sources_imported: "Imported sources",
    sources_none: "No sources imported yet. Start by importing a file.",
    sources_drop: "Drop a file here",
    sources_drop_or: "or click to choose · CSV, TXT · max 5 MB",
    sources_drop_hover: "Release to import",
    sources_indexing: "Indexing…",
    sources_reconnect: "Reconnect",
    sources_connect_btn: "Connect",

    // Dashboard
    dash_welcome: "Hello",
    dash_sessions: "Conversations",
    dash_messages: "Messages exchanged",
    dash_sources: "Connected sources",
    dash_recent: "Recent conversations",
    dash_start: "Start a conversation",
    dash_knowledge: "Knowledge graph",
    dash_knowledge_sub: "Active nodes are connected to your knowledge base",

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

    // Team
    team_title: "Team management",
    team_subtitle: "Invite colleagues to your workspace.",
    team_invite: "Invite a collaborator",
    team_invite_btn: "Generate invitation link",
    team_members: "Members",
    team_expires: "Valid for 7 days",
    team_copy: "Copy",
    team_copied: "✅ Copied",

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
    agents_subtitle: "Create automated multi-step workflows.",
    agents_new: "New workflow",
    agents_create_first: "Create my first workflow",
    agents_create: "Create workflow",
    agents_run: "▶ Run",
    agents_running: "⏳ Running...",
    agents_history: "Execution history",
    agents_no_runs: "No runs yet. Launch the workflow with ▶",
    agents_steps: "Workflow steps",
    agents_name: "Workflow name",
    agents_desc: "Description",
    agents_schedule: "Schedule (cron, optional)",
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
