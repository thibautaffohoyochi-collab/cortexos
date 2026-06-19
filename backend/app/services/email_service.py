"""
CortexOS — Email Service
Sends transactional emails via Resend API.
"""
import httpx
from app.core.config import settings

RESEND_URL = "https://api.resend.com/emails"
FROM_EMAIL = "CortexOS <onboarding@resend.dev>"


async def send_invite_email(
    to_email: str,
    invite_url: str,
    tenant_name: str,
    invited_by_name: str,
) -> bool:
    """Send invitation email. Returns True on success."""
    if not settings.RESEND_API_KEY:
        print(f"[EMAIL] No RESEND_API_KEY — skipping email to {to_email}")
        print(f"[EMAIL] Invite URL: {invite_url}")
        return False

    html = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: -apple-system, sans-serif; background: #0f172a; color: #f1f5f9; padding: 40px 20px;">
      <div style="max-width: 480px; margin: 0 auto; background: #1e293b; border-radius: 16px; padding: 40px; border: 1px solid #334155;">

        <h1 style="font-size: 24px; font-weight: 700; margin: 0 0 8px;">⬡ CortexOS</h1>
        <p style="color: #94a3b8; margin: 0 0 32px;">Votre IA business</p>

        <h2 style="font-size: 18px; margin: 0 0 12px;">Vous avez été invité 🎉</h2>
        <p style="color: #cbd5e1; margin: 0 0 8px;">
          <strong>{invited_by_name}</strong> vous invite à rejoindre l&apos;espace <strong>{tenant_name}</strong> sur CortexOS.
        </p>
        <p style="color: #94a3b8; font-size: 14px; margin: 0 0 32px;">
          CortexOS est un assistant IA qui vous permet d&apos;interroger vos données d&apos;entreprise en langage naturel.
        </p>

        <a href="{invite_url}"
           style="display: inline-block; background: #2563eb; color: white; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 15px;">
          Rejoindre l&apos;équipe →
        </a>

        <p style="color: #475569; font-size: 12px; margin: 32px 0 0;">
          Ce lien est valable 7 jours. Si vous n&apos;attendiez pas cette invitation, ignorez cet email.
        </p>
      </div>
    </body>
    </html>
    """

    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.post(
            RESEND_URL,
            headers={
                "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "from": FROM_EMAIL,
                "to": [to_email],
                "subject": f"Invitation à rejoindre {tenant_name} sur CortexOS",
                "html": html,
            }
        )
        if r.status_code in (200, 201):
            print(f"[EMAIL] Sent to {to_email} — id: {r.json().get('id')}")
            return True
        else:
            print(f"[EMAIL] Failed: {r.status_code} {r.text}")
            return False
