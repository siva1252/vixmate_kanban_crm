# Jenkins deploy — Viximate Leads CRM

## Ports (from `docs/domains.md`)

| Service | Host port | Domain |
|---------|-----------|--------|
| Frontend | **6018** | `leads.internal.viximate.com`, `www.leads.internal.viximate.com` |
| Backend | **6019** | `leads-api.internal.viximate.com` |

Local URLs stay available (`127.0.0.1:6018` / `6019`). Database is **local Postgres on the host** only.

## Jenkins credential IDs (Secret file)

| ID | Template |
|----|----------|
| `vix-leads-frontend-env` | `deployment/env/frontend.env.example` |
| `vix-leads-backend-env` | `deployment/env/backend.env.example` |

1. Jenkins → Manage → Credentials → Add → **Secret file**
2. Upload filled env files with the IDs above (exact spelling)
3. Multibranch / Pipeline job on this repo; agent must run Docker
4. Point nginx at `deployment/nginx/nginx.conf` (or equivalent) for the three hostnames

## Pipeline shape

**One fullstack job only** — each run builds + deploys **backend then frontend** together (no separate FE/BE jobs, no change-detection skip).

## Containers

- Network: `vix-leads-net`
- Images: `vix-leads-frontend`, `vix-leads-backend`
- Backend reaches local DB via `POSTGRES_HOST=host.docker.internal`

## Smoke

- FE: `curl http://127.0.0.1:6018/`
- BE: `curl http://127.0.0.1:6019/api/health/`

## Go-live checklist

1. Fill Secret files (strong `DJANGO_SECRET_KEY`, `DJANGO_DEBUG=False`)
2. Ensure Postgres on the Jenkins host accepts connections from Docker
3. DNS / hosts for the three domains → this server
4. Run pipeline; confirm smoke green
5. Change seed passwords after first login
