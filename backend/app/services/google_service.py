"""
CortexOS — Google Service
Handles Gmail and Google Drive OAuth + data fetching.
"""
import httpx
from app.core.config import settings

GMAIL_SCOPES = "https://www.googleapis.com/auth/gmail.readonly"
DRIVE_SCOPES = "https://www.googleapis.com/auth/drive.readonly"
TOKEN_URL = "https://oauth2.googleapis.com/token"


async def exchange_code_for_tokens(code: str, redirect_uri: str) -> dict:
    """Exchange OAuth code for access + refresh tokens."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.post(TOKEN_URL, data={
            "code": code,
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        })
        r.raise_for_status()
        return r.json()


async def refresh_access_token(refresh_token: str) -> str:
    """Get a new access token using the refresh token."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.post(TOKEN_URL, data={
            "refresh_token": refresh_token,
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "grant_type": "refresh_token",
        })
        r.raise_for_status()
        return r.json()["access_token"]


async def fetch_gmail_messages(access_token: str, max_results: int = 20) -> list[dict]:
    """Fetch recent Gmail messages."""
    headers = {"Authorization": f"Bearer {access_token}"}

    async with httpx.AsyncClient(timeout=30.0) as client:
        # List message IDs
        r = await client.get(
            "https://gmail.googleapis.com/gmail/v1/users/me/messages",
            headers=headers,
            params={"maxResults": max_results, "q": "in:inbox"}
        )
        r.raise_for_status()
        message_ids = [m["id"] for m in r.json().get("messages", [])]

        messages = []
        for msg_id in message_ids[:10]:  # limit to 10 for now
            r = await client.get(
                f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{msg_id}",
                headers=headers,
                params={"format": "metadata", "metadataHeaders": ["Subject", "From", "Date"]}
            )
            if r.status_code == 200:
                data = r.json()
                headers_list = data.get("payload", {}).get("headers", [])
                subject = next((h["value"] for h in headers_list if h["name"] == "Subject"), "")
                sender = next((h["value"] for h in headers_list if h["name"] == "From"), "")
                date = next((h["value"] for h in headers_list if h["name"] == "Date"), "")
                snippet = data.get("snippet", "")
                messages.append({
                    "id": msg_id,
                    "subject": subject,
                    "from": sender,
                    "date": date,
                    "snippet": snippet,
                })

    return messages


async def fetch_drive_files(access_token: str, max_results: int = 20) -> list[dict]:
    """Fetch recent Google Drive files."""
    headers = {"Authorization": f"Bearer {access_token}"}

    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(
            "https://www.googleapis.com/drive/v3/files",
            headers=headers,
            params={
                "pageSize": max_results,
                "fields": "files(id,name,mimeType,modifiedTime,size)",
                "orderBy": "modifiedTime desc",
                "q": "trashed=false"
            }
        )
        r.raise_for_status()
        return r.json().get("files", [])
