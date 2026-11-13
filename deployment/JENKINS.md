# Jenkins deploy — Viximate Leads CRM

## Ports

| Service | Host port | Domain |
|---------|-----------|--------|
| Frontend | **6018** | `leads.internal.viximate.com`, `www.leads.internal.viximate.com` |
| Backend | **6019** | `leads-api.internal.viximate.com` |

Database is **local Postgres on the Jenkins host** (`host.docker.internal` from containers).

## Env credentials (Secret file) — set these in Jenkins

| Credential ID (exact) | Template to copy |
|-----------------------|------------------|
| `vix-leads-backend-env` | `deployment/env/backend.env.example` |
| `vix-leads-frontend-env` | `deployment/env/frontend.env.example` |

### First-time setup

1. Copy each `.example` file locally and replace `REPLACE_*` values:
   - Backend: `DJANGO_SECRET_KEY`, `POSTGRES_PASSWORD` (and SMTP if you want real email)
   - Frontend: confirm `NEXT_PUBLIC_API_URL` (HTTPS API domain preferred)
2. Jenkins → **Manage Jenkins** → **Credentials** → **System** → **Global** → **Add Credentials**
3. Kind = **Secret file**
4. ID = exact strings above (pipeline reads these IDs)
5. Upload the filled file → Save

### Update later

1. Credentials → find `vix-leads-backend-env` or `vix-leads-frontend-env`
2. **Update** → upload the new file
3. Re-run the pipeline (frontend API URL only applies after rebuild)

### Required values checklist

**Backend (`vix-leads-backend-env`)**

| Key | Prod value |
|-----|------------|
| `DJANGO_SECRET_KEY` | long random (not the local one) |
| `DJANGO_DEBUG` | `False` |
| `DJANGO_ALLOWED_HOSTS` | `leads-api.internal.viximate.com,localhost,127.0.0.1` |
| `POSTGRES_HOST` | `host.docker.internal` |
| `POSTGRES_DB` / `USER` / `PASSWORD` | your host Postgres |
| `MEDIA_ROOT` / `STATIC_ROOT` | `media` / `staticfiles` |

**Frontend (`vix-leads-frontend-env`)**

| Key | Prod value |
|-----|------------|
| `NEXT_PUBLIC_API_URL` | `https://leads-api.internal.viximate.com` |

## Pipeline

**One fullstack job** — each run builds + deploys backend then frontend.

- Network: `vix-leads-net`
- Images: `vix-leads-frontend`, `vix-leads-backend`
- Enable **GitHub hook trigger for GITScm polling** (webhook: `https://jenkins.viximate.com/github-webhook/`)

## Smoke

```bash
curl -fsS http://127.0.0.1:6019/api/health/
curl -fsS http://127.0.0.1:6018/
```

## Go-live

1. Secret files filled (`DEBUG=False`, strong secret, real DB password)
2. Postgres on host allows Docker (`pg_hba` / listen)
3. DNS / hosts for the three domains → this server
4. nginx from `deployment/nginx/nginx.conf`
5. Run pipeline; smoke green
6. Change seed passwords after first login
