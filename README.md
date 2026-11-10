# Viximate CRM & Kanban Management System

Internal CRM and Kanban system for Viximate. Backend and frontend are **fully independent** applications and are **not integrated** in this phase.

```
viximate-crm/
├── backend/          # Django REST Framework + PostgreSQL
├── frontend/         # Next.js App Router (mock data only)
├── deployment/       # Docker / nginx assets
├── docker-compose.yml
├── DEVELOPMENT_STATUS.md
└── README.md
```

## Important separation rule

| Application | Runs independently | Talks to the other? |
|-------------|--------------------|---------------------|
| Backend     | Yes (Swagger / Postman) | **No** |
| Frontend    | Yes (mock services)     | **No** |

Do not connect the Next.js app to Django APIs until integration is explicitly approved.

---

## Backend (Django)

### Stack

- Python 3.12+
- Django + Django REST Framework
- PostgreSQL
- drf-spectacular (Swagger / OpenAPI)
- pytest / Django test framework

### Setup

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate

pip install -r requirements/base.txt
cp .env.example .env
# Edit .env with PostgreSQL and email settings

python manage.py migrate
python manage.py seed_configuration   # stages, sources, services, responsibilities
python manage.py createsuperuser
python manage.py runserver
```

### API documentation

- Swagger UI: http://127.0.0.1:8000/api/docs/
- OpenAPI schema: http://127.0.0.1:8000/api/schema/

### Tests

```bash
cd backend
pytest
```

### Environment

Copy `backend/.env.example` to `backend/.env`. Never commit real secrets.

---

## Frontend (Next.js)

### Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- Lucide icons, dnd-kit, React Hook Form, Zod, Recharts

### Mock-only mode

All screens use local mock data and mock services. There is **no** Axios/fetch client pointed at Django, no API base URL for the backend, and no backend authentication integration.

### Setup

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000

### Tests

```bash
cd frontend
npm test
```

---

## Docker (optional)

```bash
docker compose up --build
```

See `deployment/` for Docker and nginx assets. Compose starts PostgreSQL and the backend; the frontend remains a separate process unless you opt into the frontend service later.

---

## Development status

Track phase-by-phase progress in [DEVELOPMENT_STATUS.md](./DEVELOPMENT_STATUS.md).
