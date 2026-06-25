"""
CortexOS — Google Service
Handles Gmail and Google Drive OAuth + data fetching + sending.
Full email body + Drive file content reading.
"""
import httpx
import base64
import re
from app.core.config import settings

TOKEN_URL = "https://oauth2.googleapis.com/token"

# ─── Combined scopes — Gmail full read + Drive file content read ──────────────
GMAIL_SCOPES = [
    "openid", "email", "profile",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
]
DRIVE_SCOPES = GMAIL_SCOPES  # same combined scopes for both


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


def _decode_email_body(payload: dict) -> str:
    """
    Recursively extract full plain-text body from a Gmail message payload.
    Handles multipart/mixed, multipart/alternative, text/plain, text/html.
    """
    mime_type = payload.get("mimeType", "")
    body_data = payload.get("body", {}).get("data", "")

    # Direct text/plain part
    if mime_type == "text/plain" and body_data:
        try:
            return base64.urlsafe_b64decode(body_data + "==").decode("utf-8", errors="replace")
        except Exception:
            return ""

    # text/html fallback — strip tags
    if mime_type == "text/html" and body_data:
        try:
            html = base64.urlsafe_b64decode(body_data + "==").decode("utf-8", errors="replace")
            # Remove HTML tags, keep text
            text = re.sub(r"<[^>]+>", " ", html)
            text = re.sub(r"\s+", " ", text).strip()
            return text
        except Exception:
            return ""

    # Recurse into parts
    parts = payload.get("parts", [])
    texts = []
    for part in parts:
        t = _decode_email_body(part)
        if t.strip():
            texts.append(t.strip())
        if texts and mime_type == "multipart/alternative":
            # Prefer first non-empty part (usually text/plain comes first)
            break

    return "\n".join(texts)


async def fetch_gmail_messages(
    access_token: str,
    max_results: int = 200,
    query: str = "",
) -> list[dict]:
    """
    Fetch Gmail messages with FULL body content.
    - Reads all mail (not just inbox) by default
    - Returns subject, sender, date, full body text
    - Handles pagination to fetch up to max_results
    """
    headers = {"Authorization": f"Bearer {access_token}"}
    messages = []
    page_token = None

    async with httpx.AsyncClient(timeout=60.0) as client:
        # Paginate to collect message IDs
        while len(messages) < max_results:
            params: dict = {
                "maxResults": min(100, max_results - len(messages)),
            }
            if query:
                params["q"] = query
            if page_token:
                params["pageToken"] = page_token

            r = await client.get(
                "https://gmail.googleapis.com/gmail/v1/users/me/messages",
                headers=headers,
                params=params,
            )
            if r.status_code != 200:
                break

            data = r.json()
            batch_ids = [m["id"] for m in data.get("messages", [])]
            if not batch_ids:
                break

            # Fetch full content for each message
            for msg_id in batch_ids:
                r2 = await client.get(
                    f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{msg_id}",
                    headers=headers,
                    params={"format": "full"},
                )
                if r2.status_code != 200:
                    continue

                msg_data = r2.json()
                payload = msg_data.get("payload", {})
                msg_headers = payload.get("headers", [])

                subject = next((h["value"] for h in msg_headers if h["name"] == "Subject"), "(Sans sujet)")
                sender  = next((h["value"] for h in msg_headers if h["name"] == "From"), "")
                to      = next((h["value"] for h in msg_headers if h["name"] == "To"), "")
                date    = next((h["value"] for h in msg_headers if h["name"] == "Date"), "")
                snippet = msg_data.get("snippet", "")

                # Extract full body
                body = _decode_email_body(payload)
                # If body is empty, fall back to snippet
                if not body.strip():
                    body = snippet

                # Truncate very long bodies (keep first 3000 chars)
                body = body[:3000].strip()

                messages.append({
                    "id": msg_id,
                    "subject": subject,
                    "from": sender,
                    "to": to,
                    "date": date,
                    "snippet": snippet,
                    "body": body,
                    "label_ids": msg_data.get("labelIds", []),
                })

            page_token = data.get("nextPageToken")
            if not page_token:
                break

    return messages


# ─── Drive MIME types we can export as text ───────────────────────────────────
EXPORTABLE_MIME = {
    "application/vnd.google-apps.document":     ("text/plain", "Google Doc"),
    "application/vnd.google-apps.spreadsheet":  ("text/csv",   "Google Sheet"),
    "application/vnd.google-apps.presentation": ("text/plain", "Google Slides"),
}
READABLE_MIME = {
    "text/plain", "text/csv", "text/html",
    "application/pdf",
}


async def fetch_drive_files(
    access_token: str,
    max_results: int = 100,
) -> list[dict]:
    """
    Fetch Google Drive files with their content when possible.
    - Google Docs/Sheets/Slides → exported as plain text
    - PDF / plain text → downloaded directly
    - Returns name, mimeType, modifiedTime, content (text)
    """
    headers = {"Authorization": f"Bearer {access_token}"}
    files_with_content = []

    async with httpx.AsyncClient(timeout=60.0) as client:
        # List files
        r = await client.get(
            "https://www.googleapis.com/drive/v3/files",
            headers=headers,
            params={
                "pageSize": max_results,
                "fields": "files(id,name,mimeType,modifiedTime,size)",
                "orderBy": "modifiedTime desc",
                "q": "trashed=false",
            },
        )
        r.raise_for_status()
        files = r.json().get("files", [])

        for f in files:
            file_id   = f["id"]
            file_name = f["name"]
            mime      = f.get("mimeType", "")
            content   = ""

            try:
                # Google Workspace files → export as plain text
                if mime in EXPORTABLE_MIME:
                    export_mime, file_kind = EXPORTABLE_MIME[mime]
                    r2 = await client.get(
                        f"https://www.googleapis.com/drive/v3/files/{file_id}/export",
                        headers=headers,
                        params={"mimeType": export_mime},
                    )
                    if r2.status_code == 200:
                        content = r2.text[:5000]  # keep first 5000 chars

                # Plain text / CSV / small binary files → download directly
                elif mime in READABLE_MIME:
                    size = int(f.get("size") or 0)
                    if size <= 5 * 1024 * 1024:  # max 5MB
                        r2 = await client.get(
                            f"https://www.googleapis.com/drive/v3/files/{file_id}",
                            headers=headers,
                            params={"alt": "media"},
                        )
                        if r2.status_code == 200:
                            if "text" in mime:
                                content = r2.text[:5000]
                            elif mime == "application/pdf":
                                # Extract text from PDF bytes
                                try:
                                    import io, PyPDF2
                                    reader = PyPDF2.PdfReader(io.BytesIO(r2.content))
                                    pages = [p.extract_text() or "" for p in reader.pages[:10]]
                                    content = "\n".join(pages)[:5000]
                                except Exception:
                                    content = ""  # PDF parsing failed, skip content

            except Exception as e:
                print(f"[Drive] Could not read {file_name}: {e}")
                content = ""

            files_with_content.append({
                "id": file_id,
                "name": file_name,
                "mimeType": mime,
                "modifiedTime": f.get("modifiedTime", ""),
                "size": f.get("size", 0),
                "content": content,
            })

    return files_with_content
