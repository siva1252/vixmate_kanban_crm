# Jenkins deploy — Viximate Leads CRM

## Ports

| Service | Host port | Domain |
|---------|-----------|--------|
| Frontend | **6018** | `leads.internal.viximate.com`, `www.leads.internal.viximate.com` |
| Backend | **6019** | `leads-api.internal.viximate.com` |
| Postgres | *(Docker only)* | container `vix-leads-db`, network alias `db` |

Postgres runs **inside Docker** on `vix-leads-net`. The backend reaches it as `POSTGRES_HOST=db` (not host Postgres / `172.17.0.1`).

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
| `DJANGO_ALLOWED_HOSTS` | `leads-api.internal.viximate.com,localhost,127.0.0.1,backend` |
| `POSTGRES_HOST` | `db` (pipeline also forces this) |
| `POSTGRES_DB` / `USER` / `PASSWORD` | shared with the `vix-leads-db` container |
| `MEDIA_ROOT` / `STATIC_ROOT` | `media` / `staticfiles` |

**Frontend (`vix-leads-frontend-env`)**

| Key | Prod value |
|-----|------------|
| `NEXT_PUBLIC_API_URL` | `https://leads-api.internal.viximate.com` |

## Pipeline

**One fullstack job** — each run starts Postgres (if needed), builds + deploys backend, then frontend.

- Network: `vix-leads-net`
- Containers: `vix-leads-db` (alias `db`), `vix-leads-backend`, `vix-leads-frontend`
- Volumes: `vix-leads-postgres` (DB data), `vix-leads-media`
- Enable **GitHub hook trigger for GITScm polling** (webhook: `https://jenkins.viximate.com/github-webhook/`)

### Password / volume note

`POSTGRES_PASSWORD` is applied only when the `vix-leads-postgres` volume is **first** created. Changing the password later in the secret file without resetting the volume will fail auth. To reset DB data (destructive):

```bash
docker rm -f vix-leads-db
docker volume rm vix-leads-postgres
```

Then re-run the pipeline.

## Smoke

```bash
curl -fsS http://127.0.0.1:6019/api/health/
curl -fsS http://127.0.0.1:6018/
docker exec vix-leads-db pg_isready -U postgres
```

## Seeding (backend entrypoint)

On each backend container start (after migrate), if `SEED_ON_STARTUP=1` (default):

- `seed_configuration` — Kanban stages, lead sources, services, industries, responsibilities
- `seed_demo_users` — 5 CRM admins + `admin@viximate.local` (password `Viximate@high5`)

No dummy leads are created. Set `SEED_ON_STARTUP=0` in `vix-leads-backend-env` after go-live if you do not want seed passwords reset on restart.

Team emails: see `docs/domains.md`.

## Go-live

1. Secret files filled (`DEBUG=False`, strong secret, strong `POSTGRES_PASSWORD`, `SEED_ON_STARTUP=1`)
2. DNS / hosts for the three domains → this server
3. nginx from `deployment/nginx/nginx.conf`
4. Run pipeline; smoke green
5. Login with a seed user; change passwords; then set `SEED_ON_STARTUP=0` and redeploy
