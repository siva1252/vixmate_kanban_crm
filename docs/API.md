# Viximate CRM API — Integration Guide

Base URL (local): `http://127.0.0.1:8000`

Swagger UI: [http://127.0.0.1:8000/api/docs/](http://127.0.0.1:8000/api/docs/)  
OpenAPI schema: [http://127.0.0.1:8000/api/schema/](http://127.0.0.1:8000/api/schema/)

All successful responses use:

```json
{
  "success": true,
  "message": "OK",
  "data": {}
}
```

Errors use DRF / custom exception format with `success: false` (or validation detail).

Auth header after login (use the **access** JWT):

```http
Authorization: Bearer <access>
```

Access lifetime: 60 minutes. Refresh lifetime: 7 days.  
Refresh: `POST /api/auth/token/refresh/` with `{"refresh": "<refresh>"}`.

---

## 0) Local setup (backend)

```bash
cd backend
# activate venv, ensure .env points at Postgres
python manage.py migrate
python manage.py seed_configuration
python manage.py seed_demo_users
python manage.py runserver 8000
```

Demo login:

| Email | Password |
|-------|----------|
| `siva@viximate.local` | `MemberPass123!` |
| `krishna@viximate.local` | `MemberPass123!` |
| `admin@viximate.local` | `AdminPass123!` |

In Swagger: open **Authorize**, paste **only** the `access` JWT (no `Bearer` prefix).

---

## 1) End-to-end story: one team member + one lead

This is the path the frontend mocks today. Use it to validate every API before wiring Next.js.

### Step A — Login (team member)

`POST /api/auth/login/`

**Request**

```json
{
  "email": "siva@viximate.local",
  "password": "MemberPass123!"
}
```

**Response `data`**

```json
{
  "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…",
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…",
  "token_type": "Bearer",
  "expires_in": 3600,
  "user": {
    "id": "…",
    "email": "siva@viximate.local",
    "full_name": "Siva",
    "phone_number": "",
    "is_active": true,
    "is_staff": false,
    "date_joined": "…",
    "last_login": "…"
  }
}
```

Save `access` + `refresh`. Authorize with `access`. Call `GET /api/auth/me/` to confirm.

### Step B — Load configuration (sources / services)

`GET /api/configuration/`

**Response `data` (trimmed)**

```json
{
  "lead_sources": [
    { "id": "…", "name": "LinkedIn", "slug": "linkedin", "allows_other_text": false }
  ],
  "services": [
    { "id": "…", "name": "Web Development", "slug": "web-development", "allows_other_text": false }
  ],
  "industries": [ { "id": "…", "name": "Technology", "slug": "technology" } ],
  "settings": []
}
```

Also:

- `GET /api/kanban/stages/` → board columns (with `color`)
- `GET /api/team/` → team members (for Working assign)
- `GET /api/assignments/responsibilities/` → responsibility types

### Step C — Create one lead

`POST /api/clients/`

**Request**

```json
{
  "client_name": "Northwind Retail",
  "primary_phone": "9876500001",
  "primary_email": "ops@northwind.test",
  "lead_source": "<lead_source_uuid>",
  "service": "<service_uuid>",
  "first_call_completed": false
}
```

**Response `data` (trimmed)**

```json
{
  "id": "<client_uuid>",
  "client_name": "Northwind Retail",
  "primary_phone": "9876500001",
  "primary_email": "ops@northwind.test",
  "stage": {
    "id": "…",
    "name": "New Lead",
    "slug": "new-lead",
    "display_order": 1,
    "is_terminal": false,
    "is_active": true,
    "color": "#3b82f6"
  },
  "first_call_completed": false,
  "assignees": []
}
```

Audit action written: `client_created`.

### Step D — Drag lead on board (stage move)

`POST /api/clients/<client_uuid>/stage/`

**Request**

```json
{
  "stage": "<qualified_stage_uuid>"
}
```

**Response**: updated client detail.  
Audit: `stage_changed` with old/new stage values.

Board snapshot:

`GET /api/kanban/board/?search=Northwind`

### Step E — Assign team member as Working (note only)

`POST /api/assignments/working/`

**Request**

```json
{
  "client": "<client_uuid>",
  "team_member": "<team_member_uuid>",
  "work_note": "Preparing technical proposal and scope"
}
```

**Response `data`**

```json
{
  "id": "<working_uuid>",
  "client": "<client_uuid>",
  "team_member": "<team_member_uuid>",
  "member_name": "Siva",
  "job_title": "Admin",
  "work_note": "Preparing technical proposal and scope",
  "assigned_by_name": "Siva",
  "is_active": true
}
```

- Assign = **no reason** required  
- List: `GET /api/assignments/working/?client=<client_uuid>`

### Step F — Edit working (reason required)

`PATCH /api/assignments/working/<working_uuid>/`

**Request**

```json
{
  "work_note": "Client follow-up and proposal revisions",
  "reason": "Updated after discovery call"
}
```

### Step G — Edit lead details (reason required)

Matches frontend: Edit → reason → change fields → Save.

`PATCH /api/clients/<client_uuid>/`

**Request**

```json
{
  "reason": "Corrected phone after first call",
  "primary_phone": "9876500099",
  "client_requirements": "Need CRM + automation",
  "estimated_deal_value": "85000.00",
  "next_follow_up_date": "2026-11-20",
  "call_discussion_notes": "Budget tentatively confirmed"
}
```

**Important:** `reason` is **required** (min 3 chars) on every lead update.

### Step H — Comment + follow-up + document

**Comment** — `POST /api/comments/`

```json
{
  "client": "<client_uuid>",
  "body": "Shared proposal draft with technical team."
}
```

**Follow-up** — `POST /api/followups/`

```json
{
  "client": "<client_uuid>",
  "follow_up_date": "2026-11-20",
  "notes": "Awaiting budget confirmation",
  "next_action": "Call decision maker",
  "status": "pending"
}
```

**Attachment** — `POST /api/attachments/` (multipart)

- fields: `client`, `title`, `document_type`, `file`, optional `description` / `document_type_other`
- delete requires reason body

### Step I — Active logs (everyone)

`GET /api/activity/`

Query params:

| Param | Example | Meaning |
|-------|---------|---------|
| `search` | `Northwind` | free text |
| `action` | `client_updated` | filter action |
| `entity_type` | `Client` | filter entity |
| `client` | uuid | lead filter |
| `team_member` | uuid | actor filter |
| `date_from` / `date_to` | `2026-11-01` | range |

**Response item (trimmed)**

```json
{
  "id": "…",
  "actor_name": "Siva",
  "action": "client_updated",
  "entity_type": "Client",
  "entity_id": "…",
  "client_name": "Northwind Retail",
  "old_values": { "primary_phone": "9876500001" },
  "new_values": { "primary_phone": "9876500099" },
  "reason": "Corrected phone after first call",
  "description": "Updated client Northwind Retail",
  "timestamp": "…"
}
```

### Step J — Manage board columns (frontend Columns panel)

| Method | Path | Reason? |
|--------|------|---------|
| GET | `/api/kanban/stages/` | — |
| POST | `/api/kanban/stages/` | No |
| PATCH | `/api/kanban/stages/<stage_id>/` | No |
| POST | `/api/kanban/stages/reorder/` | No |
| DELETE | `/api/kanban/stages/<stage_id>/` | **Yes** (`{"reason":"…"}`) |

**Create column**

```json
{ "name": "No Answer / Retry", "color": "#64748b" }
```

**Reorder**

```json
{ "ordered_ids": ["<uuid1>", "<uuid2>", "<uuid3>"] }
```

**Delete** (leads in that column move to the first remaining active column)

```json
{ "reason": "Merging duplicate callback column" }
```

---

## 2) API map (frontend ↔ backend)

| Frontend area | Backend |
|---------------|---------|
| Login / profile | `/api/auth/*` |
| Teams | `/api/team/` |
| Boards / filters | `/api/kanban/board/` |
| Columns settings | `/api/kanban/stages/` (+ reorder/detail) |
| New lead / details | `/api/clients/` |
| Drag card | `POST /api/clients/{id}/stage/` |
| Working tab | `/api/assignments/working/` |
| Responsibility assignments | `/api/assignments/` |
| Comments | `/api/comments/` |
| Follow-ups | `/api/followups/` |
| Docs | `/api/attachments/` |
| History / Active Logs | `/api/activity/` |
| Sources / services | `/api/configuration/` |
| Dashboard | `/api/dashboard/` |

---

## 3) Reason rules (match frontend)

| Action | Reason required? |
|--------|------------------|
| Create lead | No |
| Update lead details | **Yes** |
| Delete lead | **Yes** |
| Move stage (drag) | No |
| Assign working | No |
| Edit / remove working | **Yes** |
| Add / edit / reorder column | No |
| Delete column | **Yes** |
| Reassign responsibility | **Yes** |
| Delete attachment | **Yes** |

---

## 4) Suggested Swagger test order

1. `POST /api/auth/login/` → Authorize with `access` JWT  
2. `GET /api/configuration/`  
3. `GET /api/kanban/stages/`  
4. `GET /api/team/`  
5. `POST /api/clients/`  
6. `GET /api/kanban/board/`  
7. `POST /api/clients/{id}/stage/`  
8. `POST /api/assignments/working/`  
9. `PATCH /api/clients/{id}/` with `reason`  
10. `POST /api/comments/`  
11. `GET /api/activity/`  
12. `POST /api/kanban/stages/` (add column)  
13. `DELETE /api/kanban/stages/{id}/` with `reason`

When this path is green in Swagger, frontend integration can replace mock services with these endpoints one module at a time (auth → config → clients → kanban → working → activity).
