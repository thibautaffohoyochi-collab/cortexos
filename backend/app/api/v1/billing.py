"""
CortexOS — Billing Routes (Stripe)
POST /billing/checkout        → create Stripe Checkout Session
POST /billing/webhook         → Stripe webhook handler
GET  /billing/portal          → Stripe Customer Portal (manage/cancel)
GET  /billing/status          → current subscription status
"""
import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.core.database import get_db
from app.core.auth import get_current_user
from app.core.config import settings
from app.models.models import User, Tenant, PlanTier

router = APIRouter(prefix="/billing", tags=["billing"])

# ─── Stripe setup ─────────────────────────────────────────────────────────────
FRONTEND_URL = "https://cortexos-xi.vercel.app"

# Map Stripe Price IDs → PlanTier
# These will be set once you create the products in Stripe dashboard
PRICE_TO_PLAN: dict[str, PlanTier] = {}  # populated dynamically from config

def get_stripe():
    stripe.api_key = settings.STRIPE_SECRET_KEY
    return stripe


def _build_price_map():
    """Build price → plan mapping from config."""
    m: dict[str, PlanTier] = {}
    if settings.STRIPE_PRICE_PRO:
        m[settings.STRIPE_PRICE_PRO] = PlanTier.PRO
    if settings.STRIPE_PRICE_BUSINESS:
        m[settings.STRIPE_PRICE_BUSINESS] = PlanTier.BUSINESS
    return m


# ─── Schemas ──────────────────────────────────────────────────────────────────

class CheckoutRequest(BaseModel):
    plan: str  # "pro" or "business"


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.post("/checkout")
async def create_checkout(
    body: CheckoutRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a Stripe Checkout Session and return the URL."""
    if body.plan not in ("pro", "business"):
        raise HTTPException(status_code=400, detail="Plan invalide. Choisissez 'pro' ou 'business'.")

    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Stripe non configuré.")

    price_id = settings.STRIPE_PRICE_PRO if body.plan == "pro" else settings.STRIPE_PRICE_BUSINESS
    if not price_id:
        raise HTTPException(
            status_code=503,
            detail=f"Prix Stripe pour le plan {body.plan} non configuré. Ajoutez STRIPE_PRICE_{body.plan.upper()} dans les variables d'environnement Railway."
        )

    s = get_stripe()

    # Get or create Stripe customer
    tenant_result = await db.execute(select(Tenant).where(Tenant.id == current_user.tenant_id))
    tenant = tenant_result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Workspace introuvable")

    customer_id = tenant.stripe_customer_id
    if not customer_id:
        customer = s.Customer.create(
            email=current_user.email,
            name=tenant.name,
            metadata={"tenant_id": str(tenant.id)},
        )
        customer_id = customer.id
        tenant.stripe_customer_id = customer_id

    # Create checkout session
    try:
        session = s.checkout.Session.create(
            customer=customer_id,
            payment_method_types=["card"],
            line_items=[{"price": price_id, "quantity": 1}],
            mode="subscription",
            success_url=f"{FRONTEND_URL}/settings?upgrade=success&plan={body.plan}",
            cancel_url=f"{FRONTEND_URL}/settings?upgrade=cancelled",
            metadata={
                "tenant_id": str(tenant.id),
                "plan": body.plan,
            },
            subscription_data={
                "metadata": {
                    "tenant_id": str(tenant.id),
                    "plan": body.plan,
                }
            },
            allow_promotion_codes=True,
        )
        return {"url": session.url, "session_id": session.id}
    except s.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/webhook")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Handle Stripe webhook events.
    Verifies signature and updates tenant plan on successful payment.
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    if not settings.STRIPE_WEBHOOK_SECRET:
        # Dev mode — skip signature verification
        import json
        try:
            event = json.loads(payload)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid payload")
    else:
        s = get_stripe()
        try:
            event = s.Webhook.construct_event(
                payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
            )
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Webhook error: {str(e)}")

    event_type = event.get("type", "")
    data = event.get("data", {}).get("object", {})

    # ── checkout.session.completed ────────────────────────────────────────────
    if event_type == "checkout.session.completed":
        tenant_id = data.get("metadata", {}).get("tenant_id")
        plan_str  = data.get("metadata", {}).get("plan")
        sub_id    = data.get("subscription")

        if tenant_id and plan_str:
            plan = PlanTier.PRO if plan_str == "pro" else PlanTier.BUSINESS
            result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
            tenant = result.scalar_one_or_none()
            if tenant:
                tenant.plan = plan
                tenant.stripe_subscription_id = sub_id
                await db.commit()
                print(f"[Stripe] Tenant {tenant.name} upgraded to {plan}")

    # ── customer.subscription.updated ────────────────────────────────────────
    elif event_type == "customer.subscription.updated":
        sub_id    = data.get("id")
        status    = data.get("status")
        plan_str  = data.get("metadata", {}).get("plan")

        if sub_id:
            result = await db.execute(
                select(Tenant).where(Tenant.stripe_subscription_id == sub_id)
            )
            tenant = result.scalar_one_or_none()
            if tenant:
                if status == "active" and plan_str:
                    tenant.plan = PlanTier.PRO if plan_str == "pro" else PlanTier.BUSINESS
                elif status in ("canceled", "unpaid", "past_due"):
                    tenant.plan = PlanTier.STARTER
                    tenant.stripe_subscription_id = None
                await db.commit()
                print(f"[Stripe] Subscription {sub_id} → {status}, plan → {tenant.plan}")

    # ── customer.subscription.deleted ─────────────────────────────────────────
    elif event_type == "customer.subscription.deleted":
        sub_id = data.get("id")
        if sub_id:
            result = await db.execute(
                select(Tenant).where(Tenant.stripe_subscription_id == sub_id)
            )
            tenant = result.scalar_one_or_none()
            if tenant:
                tenant.plan = PlanTier.STARTER
                tenant.stripe_subscription_id = None
                await db.commit()
                print(f"[Stripe] Subscription {sub_id} cancelled → downgraded to Starter")

    # ── invoice.payment_failed ────────────────────────────────────────────────
    elif event_type == "invoice.payment_failed":
        customer_id = data.get("customer")
        if customer_id:
            result = await db.execute(
                select(Tenant).where(Tenant.stripe_customer_id == customer_id)
            )
            tenant = result.scalar_one_or_none()
            if tenant:
                print(f"[Stripe] Payment failed for {tenant.name} — keeping plan for now")
                # Don't downgrade immediately — Stripe retries

    return JSONResponse({"received": True})


@router.get("/portal")
async def customer_portal(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Redirect to Stripe Customer Portal to manage subscription."""
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Stripe non configuré.")

    tenant_result = await db.execute(select(Tenant).where(Tenant.id == current_user.tenant_id))
    tenant = tenant_result.scalar_one_or_none()

    if not tenant or not tenant.stripe_customer_id:
        raise HTTPException(
            status_code=400,
            detail="Aucun abonnement actif. Souscrivez d'abord à un plan payant."
        )

    s = get_stripe()
    try:
        session = s.billing_portal.Session.create(
            customer=tenant.stripe_customer_id,
            return_url=f"{FRONTEND_URL}/settings",
        )
        return {"url": session.url}
    except s.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/status")
async def billing_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return current billing status for the tenant."""
    tenant_result = await db.execute(select(Tenant).where(Tenant.id == current_user.tenant_id))
    tenant = tenant_result.scalar_one_or_none()

    return {
        "plan":                    tenant.plan if tenant else "starter",
        "stripe_customer_id":      tenant.stripe_customer_id if tenant else None,
        "stripe_subscription_id":  tenant.stripe_subscription_id if tenant else None,
        "has_active_subscription": bool(tenant and tenant.stripe_subscription_id),
    }
