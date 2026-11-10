# Development Status — Viximate CRM

Track every phase. Do not mark a feature complete unless it is implemented and tested.

## Separation invariant

Frontend and backend remain **independent**. No HTTP integration until explicitly approved.

---

## Phase checklist

| Phase | Description | Status | Notes |
|------:|-------------|--------|-------|
| 1 | Workspace inspection and project foundation | **Complete** | Empty workspace → `viximate-crm/` scaffold |
| 2 | Django setup, PostgreSQL, database architecture | **Complete** | All models migrated on Docker Postgres `:5433` |
| 3 | Authentication, approved emails, email OTP | **Complete (tested)** | 11/11 auth tests passing |
| 4 | Team management and availability | **API complete** | List/detail/availability + history + audit |
| 5 | CRM clients, lead creation, first-call workflow | **Complete (tested)** | 5/5 client tests passing |
| 6 | Kanban stages and stage history | **API complete** | Board + stage move + history seeded |
| 7 | Responsibility assignments and history | **API complete** | Assign/reassign with mandatory reason |
| 8 | Contacts, calls, comments | **API complete** | CRUD + comment edit history |
| 9 | Tasks and meetings | **API complete** | Task delete requires reason; meeting participants |
| 10 | Manual follow-up and attachments | **API complete** | Manual follow-ups; secure download; typed upload |
| 11 | Central audit logging and activity logs | **Core complete** | `write_audit_log` + `/api/activity/` |
| 12 | Dynamic custom fields and Django Admin | **Partial** | Definitions/values API + Admin for core models |
| 13 | Dashboard, search and filters | **API complete** | Dashboard aggregations + client search/filters |
| 14 | Backend testing and API documentation | **Partial** | 18 backend tests green; Spectacular wired; expand remaining cases |
| 15 | Independent Next.js frontend (mock data) | **Functional mock UI** | Next.js app builds; mock CRUD/DnD/auth screens; 3 vitest tests green |
| 16 | Frontend testing and responsive UI | Pending | |
| 17 | Docker and deployment preparation | **Partial** | Compose DB + Dockerfiles + nginx draft |

---

## Verified now

### Backend run

```bash
cd viximate-crm
docker compose up -d db

cd backend
.venv\Scripts\activate
pip install -r requirements\dev.txt
# .env uses POSTGRES_PORT=5433
python manage.py migrate
python manage.py seed_configuration
python manage.py createsuperuser
python manage.py runserver
```

- Swagger: http://127.0.0.1:8000/api/docs/
- Admin: http://127.0.0.1:8000/admin/

### Tests executed

```
pytest apps/accounts/tests/test_auth.py apps/crm/tests/test_clients.py -q
→ 16 passed
```

Coverage includes: approved login, invalid login, deactivation, OTP hash/expiry/resend limits, password reset enumeration safety, client create, Other-source validation, stage history, soft-delete reason, first-call workflow.

### Migrations applied

All app `0001_initial` migrations + Django built-ins on PostgreSQL (`viximate_crm` via Docker on host port **5433**).

### Seeded configuration

- Stages (exact order): New Lead → Call Back → In Progress → Qualified → Meeting → Negotiation → Loss → Won
- 9 lead sources, 8 services, industries, 5 responsibility types

### APIs implemented (independent of frontend)

- `/api/auth/*`
- `/api/team/*`
- `/api/clients/*`
- `/api/kanban/*`
- `/api/dashboard/`
- `/api/assignments/*`
- `/api/contacts/*`
- `/api/calls/*`
- `/api/comments/*`
- `/api/tasks/*`
- `/api/meetings/*`
- `/api/followups/*`
- `/api/attachments/*`
- `/api/activity/`
- `/api/custom-fields/*`
- `/api/configuration/`

---

## Remaining work (honest)

1. Expand automated tests for assignments, meetings, attachments, audit immutability, custom fields, Admin audit path.
2. Harden Django Admin so every mutation goes through the same service/reason rules (partial today).
3. Complete independent Next.js mock UI (Phase 15–16).
4. Finalize production Docker/nginx docs (Phase 17).
5. Watch OneDrive sync — some files briefly disappeared during development; prefer keeping the repo outside aggressive sync if issues recur.

---

## Change log

| Date | Phase | Summary |
|------|------:|---------|
| 2026-11-10 | 1 | Inspected empty workspace; created foundation |
| 2026-11-10 | 2 | Django + Postgres models/migrations; seed_configuration |
| 2026-11-10 | 3–13 | Auth + CRM domain APIs; 16 core tests green |


### Frontend (Phase 15 progress)

- Next.js 15 App Router mock UI under `frontend/`
- Demo login: `siva@viximate.local` / `MemberPass123!`
- `npm run dev` / `npm test` / `npm run build` (build verified)
- Still separate from Django — no API integration
