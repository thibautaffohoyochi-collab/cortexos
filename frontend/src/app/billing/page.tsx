"use client"
import { useState, useEffect, Suspense } from "react"
import { useSession } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import { AppHeader } from "@/components/ui/AppHeader"

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"

const PLANS = [
  {
    id: "starter", name: "Starter", price: "Gratuit", sub: "Pour toujours", hot: false,
    features: ["1 espace de travail", "3 sources connectées", "500 messages / mois", "Support communauté"],
    cta: null,
  },
  {
    id: "pro", name: "Pro", price: "29€", sub: "/mois", hot: true,
    features: ["Sources illimitées", "5 000 messages / mois", "Recherche web", "Veille concurrentielle", "10 membres d'équipe", "10 workflows", "Support prioritaire"],
    cta: "Passer au Pro",
  },
  {
    id: "business", name: "Business", price: "99€", sub: "/mois", hot: false,
    features: ["Tout illimité", "Équipe illimitée", "Workflows illimités", "SLA 99.9%", "Customer Success", "On-premise option"],
    cta: "Passer au Business",
  },
]

function BillingContent() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const token = (session?.user as any)?.accessToken

  const [currentPlan, setCurrentPlan] = useState("starter")
  const [hasSubscription, setHasSubscription] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)

  useEffect(() => {
    const upgrade = searchParams.get("upgrade")
    const plan = searchParams.get("plan")
    if (upgrade === "success" && plan) {
      setMsg({ type: "success", text: `✅ Félicitations ! Votre plan ${plan === "pro" ? "Pro" : "Business"} est actif.` })
    } else if (upgrade === "cancelled") {
      setMsg({ type: "error", text: "❌ Paiement annulé. Aucun montant débité." })
    }
  }, [searchParams])

  useEffect(() => {
    if (!token) return
    fetch(`${API}/billing/status`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { setCurrentPlan(data.plan ?? "starter"); setHasSubscription(data.has_active_subscription ?? false) })
      .catch(() => {})
  }, [token])

  const handleUpgrade = async (planId: string) => {
    if (!token) return
    setLoading(planId); setMsg(null)
    try {
      const res = await fetch(`${API}/billing/checkout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail)
      window.location.href = data.url
    } catch (err: any) {
      setMsg({ type: "error", text: `❌ ${err.message}` })
    } finally { setLoading(null) }
  }

  const handlePortal = async () => {
    if (!token) return
    setLoading("portal")
    try {
      const res = await fetch(`${API}/billing/portal`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail)
      window.location.href = data.url
    } catch (err: any) {
      setMsg({ type: "error", text: `❌ ${err.message}` })
    } finally { setLoading(null) }
  }

  return (
    <main className="max-w-5xl mx-auto px-6 py-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Abonnement</h1>
          <p className="text-gray-500 text-sm mt-1">Gérez votre plan CortexOS</p>
        </div>
        {hasSubscription && (
          <button onClick={handlePortal} disabled={loading === "portal"}
            className="px-4 py-2 rounded-xl border border-gray-700 text-sm text-gray-300 hover:bg-gray-800 transition-all disabled:opacity-50">
            {loading === "portal" ? "Chargement..." : "⚙️ Gérer l'abonnement"}
          </button>
        )}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Plan actuel</p>
          <p className="text-lg font-bold text-white capitalize">{currentPlan}</p>
        </div>
        {currentPlan !== "starter"
          ? <span className="text-xs text-green-400 bg-green-950/50 border border-green-800 px-3 py-1 rounded-full">✓ Abonnement actif</span>
          : <span className="text-xs text-gray-500 bg-gray-800 border border-gray-700 px-3 py-1 rounded-full">Gratuit</span>
        }
      </div>

      {msg && (
        <div className={`px-4 py-3 rounded-xl border text-sm ${msg.type === "success" ? "text-green-400 bg-green-950/40 border-green-800" : "text-red-400 bg-red-950/40 border-red-800"}`}>
          {msg.text}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-5">
        {PLANS.map(plan => {
          const isCurrent = currentPlan === plan.id
          const isUpgrade = plan.id !== "starter" && !isCurrent
          return (
            <div key={plan.id} className={`relative rounded-2xl border p-6 flex flex-col gap-4 ${
              isCurrent ? "border-blue-500 bg-blue-950/10" : plan.hot ? "border-blue-600/50 bg-gray-900" : "border-gray-800 bg-gray-900"
            }`}>
              {plan.hot && !isCurrent && <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-bold bg-blue-600 text-white">Populaire</div>}
              {isCurrent && <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-bold bg-green-600 text-white">Plan actuel</div>}
              <div>
                <h3 className="font-bold text-white text-base">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-3xl font-extrabold text-white">{plan.price}</span>
                  {plan.sub && <span className="text-sm text-gray-500">{plan.sub}</span>}
                </div>
              </div>
              <ul className="space-y-2 flex-1">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                    <span className="text-green-400 shrink-0">✓</span>{f}
                  </li>
                ))}
              </ul>
              {plan.cta && isUpgrade && (
                <button onClick={() => handleUpgrade(plan.id)} disabled={loading === plan.id}
                  className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50 ${plan.id === "pro" ? "bg-blue-600 text-white" : "bg-purple-600 text-white"}`}>
                  {loading === plan.id ? "Redirection..." : plan.cta}
                </button>
              )}
              {isCurrent && plan.id !== "starter" && (
                <button onClick={handlePortal} disabled={loading === "portal"}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold border border-gray-700 text-gray-400 hover:bg-gray-800 transition-all disabled:opacity-50">
                  {loading === "portal" ? "Chargement..." : "Gérer l'abonnement"}
                </button>
              )}
              {plan.id === "starter" && isCurrent && (
                <div className="text-center text-xs text-gray-600 py-1">Plan gratuit actif</div>
              )}
            </div>
          )
        })}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-300">Questions fréquentes</h2>
        <div className="space-y-3 text-sm">
          {[
            { q: "Comment annuler ?", a: "Cliquez sur 'Gérer l'abonnement' → Annuler. Vous gardez l'accès jusqu'à la fin de la période." },
            { q: "Est-ce que je suis débité immédiatement ?", a: "Oui, dès que vous confirmez le paiement. La facturation est mensuelle." },
            { q: "Puis-je changer de plan ?", a: "Oui, à tout moment. Le montant est calculé au prorata." },
            { q: "Quels moyens de paiement ?", a: "Carte bancaire (Visa, Mastercard, Amex) via Stripe — sécurisé et chiffré." },
          ].map((item, i) => (
            <div key={i} className="border-b border-gray-800 pb-3 last:border-0 last:pb-0">
              <p className="text-gray-300 font-medium">{item.q}</p>
              <p className="text-gray-500 mt-1">{item.a}</p>
            </div>
          ))}
        </div>
      </div>

      <p className="text-center text-xs text-gray-700">
        Paiements sécurisés par <span className="text-gray-500">Stripe</span> · Données hébergées en Europe 🇪🇺
      </p>
    </main>
  )
}

export default function BillingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <AppHeader />
      <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><p className="text-gray-500 text-sm">Chargement...</p></div>}>
        <BillingContent />
      </Suspense>
    </div>
  )
}
