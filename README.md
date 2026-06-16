# CortexOS

> AI Operating System for businesses — centralize all company data, query it in natural language.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14, Tailwind CSS, shadcn/ui |
| Backend | FastAPI, Python 3.11 |
| Database | PostgreSQL (Supabase) |
| Cache / Queue | Redis + Celery |
| AI | OpenAI GPT-4o + text-embedding-3-small |
| Vector DB | Qdrant Cloud |
| Auth | NextAuth.js (frontend) + JWT (backend) |
| Hosting | Vercel (front) + Railway (back) |

## Project Structure

```
cortexos/
├── frontend/          # Next.js 14 app
├── backend/           # FastAPI app
├── docs/              # Architecture docs
└── docker-compose.yml # Local dev environment
```

## Quick Start

```bash
# 1. Clone & install
git clone <repo>
cd cortexos

# 2. Start local services
docker-compose up -d

# 3. Frontend
cd frontend && npm install && npm run dev

# 4. Backend
cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload
```

## Environment Variables

See `.env.example` in each sub-project.
