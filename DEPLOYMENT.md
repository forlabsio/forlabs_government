# Deployment Guide

## Local Development (Docker Compose)

### Prerequisites
- Docker and Docker Compose installed
- Copy `backend/.env.example` to `backend/.env` and fill in API keys

### Start All Services

```bash
docker compose up -d
```

This starts:
- **PostgreSQL 16** with pgvector extension on port 5432
- **Redis 7** on port 6379
- **FastAPI backend** on port 8000 (with hot reload)
- **Celery worker** for async tasks
- **Celery beat** for scheduled collection (10am, 1pm, 5pm KST)

### Run Database Migrations

```bash
docker compose exec backend alembic upgrade head
```

### Stop All Services

```bash
docker compose down
```

To also remove the database volume:

```bash
docker compose down -v
```

---

## Railway Deployment (Backend)

### Service Setup

You need **three separate Railway services** from the same repo:

| Service | Type | Start Command |
|---------|------|---------------|
| **web** | Web | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| **worker** | Worker | `celery -A app.celery_app worker --loglevel=info` |
| **beat** | Worker | `celery -A app.celery_app beat --loglevel=info` |

All three services should have their root directory set to `backend`.

### Step-by-Step

1. Create a new Railway project
2. Add a **PostgreSQL plugin** from the Railway dashboard
3. Connect to the database and enable the pgvector extension:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
4. Add a **Redis plugin** from the Railway dashboard
5. Create the **web** service:
   - Connect your GitHub repo
   - Set root directory to `backend`
   - Railway will auto-detect the `railway.toml` config
6. Create the **worker** service:
   - Same repo, root directory `backend`
   - Override start command: `celery -A app.celery_app worker --loglevel=info`
7. Create the **beat** service:
   - Same repo, root directory `backend`
   - Override start command: `celery -A app.celery_app beat --loglevel=info`

### Required Environment Variables

All three backend services need these variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql+asyncpg://user:pass@host:5432/govgrants` |
| `REDIS_URL` | Redis connection string | `redis://default:pass@host:6379/0` |
| `SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_KEY` | Supabase anon key | `eyJ...` |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | `eyJ...` |
| `OPENAI_API_KEY` | OpenAI API key for embeddings | `sk-...` |
| `RESEND_API_KEY` | Resend API key for email curation | `re_...` |
| `ADMIN_EMAIL` | Admin notification email | `admin@example.com` |
| `BIZINFO_API_KEY` | Bizinfo.go.kr API key | |
| `NTIS_API_KEY` | NTIS API key | |
| `KOCCA_API_KEY` | KOCCA API key | |
| `KSTARTUP_API_KEY` | K-Startup API key | |
| `SUBSIDY24_API_KEY` | Subsidy24 API key | |
| `SMES_API_KEY` | SMES API key | |

> **Tip**: Railway auto-injects `DATABASE_URL` and `REDIS_URL` when you link the PostgreSQL and Redis plugins to each service. Make sure the format matches what asyncpg expects (`postgresql+asyncpg://...`).

### Database Migrations

After the first deploy, run migrations via Railway CLI:

```bash
railway run alembic upgrade head
```

---

## Vercel Deployment (Frontend)

### Setup

1. Import the GitHub repo into Vercel
2. Set the **Root Directory** to `frontend`
3. Vercel auto-detects Next.js -- no additional config needed
4. Set the following environment variable:

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `https://your-backend.up.railway.app` |

### Build Settings (auto-detected)

- **Framework**: Next.js
- **Build Command**: `next build`
- **Output Directory**: `.next`

### Custom Domain

After deployment, add your custom domain in Vercel project settings under **Domains**.

---

## Production Checklist

- [ ] PostgreSQL pgvector extension enabled
- [ ] All API keys configured in Railway environment
- [ ] Database migrations applied (`alembic upgrade head`)
- [ ] Health check passing (`GET /health` returns `{"status": "ok"}`)
- [ ] Celery worker running (check Railway service logs)
- [ ] Celery beat running (scheduled tasks firing at 10am, 1pm, 5pm KST)
- [ ] Frontend `NEXT_PUBLIC_API_URL` pointing to Railway backend
- [ ] CORS origins updated in `app/main.py` for production domain
