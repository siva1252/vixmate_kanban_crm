# Viximate CRM — Full API List

**Count rule:** each HTTP method on a path = **1 API**.  
Base: `http://127.0.0.1:8000`  
Swagger: `/api/docs/`

---

## How to test in Swagger

1. Open [http://127.0.0.1:8000/api/docs/](http://127.0.0.1:8000/api/docs/)
2. Expand **POST `/api/auth/login/`** → **Try it out**
3. In **Request body**, paste:

```json
{
  "email": "siva@viximate.local",
  "password": "MemberPass123!"
}
```

4. Click **Execute** → copy `data.access` (long JWT string, not `refresh`)
5. Click **Authorize** → paste **only** the `access` value → **Authorize**
6. Call **GET `/api/auth/me/`**
7. When access expires: **POST `/api/auth/token/refresh/`** with `{"refresh": "<data.refresh>"}`
8. For create client: hard-refresh docs after `python manage.py seed_all` — use example **SeededConfig** (real IDs), or copy IDs from `GET /api/configuration/`
9. For **DELETE** client / working / column: Request body must include `{"reason":"..."}` (now visible in Swagger)

### Working vs assignments (important)

| What | Path | UI |
|------|------|----|
| **Lead Working** | `/api/assignments/working/` | Lead detail → **Working** tab |
| **Responsibility** | `/api/assignments/` | Responsibility roles (not the Working tab) |
| **Lead Source person** | `/api/lead-source/` | Nav tab **Lead Source** — external people, **no login** |
| **Channel source** | `configuration.lead_sources` | LinkedIn / Google / … on the lead form |

Team users are **not** created via API — create in Admin/DB (`seed_demo_users`). API only activate/deactivate.

Security overview: [SECURITY.md](./SECURITY.md)

---

## Totals

| Metric | Count |
|--------|------:|
| **Total business APIs** | **79** |
| **CRUD APIs** (Create / Read / Update / Delete only) | **55** |
| **Action / utility APIs** (login, refresh, move stage, reorder, restore, OTP, etc.) | **24** |
| Meta (OpenAPI schema + Swagger UI) | 2 |
| **Grand total including schema/docs** | **81** |

### CRUD break-down (of the 52)

| CRUD type | HTTP | Count |
|-----------|------|------:|
| **C** Create | `POST` (resource create) | 12 |
| **R** Read | `GET` | 24 |
| **U** Update | `PATCH` | 11 |
| **D** Delete | `DELETE` | 5 |
| **CRUD total** | | **52** |

---

## 1) Auth — `/api/auth/` (12 APIs)

| # | Method | Path | Type | Purpose |
|---|--------|------|------|---------|
| 1 | POST | `/api/auth/login/` | Action | Login → JWT access + refresh |
| 2 | POST | `/api/auth/token/refresh/` | Action | Refresh access token |
| 3 | POST | `/api/auth/logout/` | Action | Logout (blacklist refresh) |
| 4 | GET | `/api/auth/me/` | R | Current user |
| 5 | POST | `/api/auth/forgot-password/` | Action | Start reset OTP |
| 6 | POST | `/api/auth/otp/verify/` | Action | Verify OTP |
| 7 | POST | `/api/auth/otp/resend/` | Action | Resend OTP |
| 8 | POST | `/api/auth/password/reset/` | Action | Reset password |
| 9 | POST | `/api/auth/password/change/request/` | Action | Request password change OTP |
| 10 | POST | `/api/auth/password/change/confirm/` | Action | Confirm password change |
| 11 | PATCH | `/api/auth/users/{user_id}/activate/` | U | Activate user (staff; users created in Admin/DB) |
| 12 | PATCH | `/api/auth/users/{user_id}/deactivate/` | U | Deactivate user (staff) |

---

## 2) Team — `/api/team/` (4 APIs)

| # | Method | Path | Type | Purpose |
|---|--------|------|------|---------|
| 14 | GET | `/api/team/` | R | List team members |
| 15 | GET | `/api/team/{member_id}/` | R | Team member detail |
| 16 | PATCH | `/api/team/{member_id}/availability/` | U | Update availability |
| 17 | GET | `/api/team/{member_id}/availability/history/` | R | Availability history |

---

## 2b) Lead Source people — `/api/lead-source/` (8 APIs)

External people only (no login). **Many people per lead.** Assign/edit only here; lead details are read-only. Distinct from channel `lead_sources` in configuration. No `company` field.

| # | Method | Path | Type | Purpose |
|---|--------|------|------|---------|
| 18a | GET | `/api/lead-source/` | R | List (+ filters: search, has_leads, client) |
| 18b | POST | `/api/lead-source/` | C | Create person (no user account) |
| 18c | GET | `/api/lead-source/{id}/` | R | Detail + stats + attributions |
| 18d | PATCH | `/api/lead-source/{id}/` | U | Update / deactivate |
| 18e | GET | `/api/lead-source/{id}/leads/` | R | Leads linked to person |
| 18f | POST | `/api/lead-source/{id}/leads/` | C | Assign one lead to this person |
| 18g | POST | `/api/lead-source/assign/` | C | Assign **multiple people** to one lead |
| 18h | DELETE | `/api/lead-source/attributions/{id}/` | D | Unlink person from lead |
| 18i | GET | `/api/lead-source/by-client/{client_id}/` | R | People on a lead (read-only) |

---

## 3) Clients / Leads — `/api/clients/` (9 APIs)

| # | Method | Path | Type | Purpose |
|---|--------|------|------|---------|
| 18 | GET | `/api/clients/` | R | List leads |
| 19 | POST | `/api/clients/` | C | Create lead |
| 20 | GET | `/api/clients/{client_id}/` | R | Lead detail |
| 21 | PATCH | `/api/clients/{client_id}/` | U | Update lead (**reason required**) |
| 22 | DELETE | `/api/clients/{client_id}/` | D | Soft-delete lead (**reason**) |
| 23 | POST | `/api/clients/{client_id}/restore/` | Action | Restore deleted lead |
| 24 | POST | `/api/clients/{client_id}/first-call/` | Action | Mark first call complete |
| 25 | POST | `/api/clients/{client_id}/stage/` | Action | Move stage (board drag) |
| 26 | GET | `/api/clients/{client_id}/stage-history/` | R | Stage history |

---

## 4) Kanban / Columns — `/api/kanban/` (6 APIs)

| # | Method | Path | Type | Purpose |
|---|--------|------|------|---------|
| 27 | GET | `/api/kanban/board/` | R | Full board columns + cards |
| 28 | GET | `/api/kanban/stages/` | R | List columns |
| 29 | POST | `/api/kanban/stages/` | C | Add column |
| 30 | PATCH | `/api/kanban/stages/{stage_id}/` | U | Edit column |
| 31 | DELETE | `/api/kanban/stages/{stage_id}/` | D | Delete column (**reason**) |
| 32 | POST | `/api/kanban/stages/reorder/` | Action | Reorder columns |

---

## 5) Assignments + Working — `/api/assignments/` (9 APIs)

| # | Method | Path | Type | Purpose |
|---|--------|------|------|---------|
| 33 | GET | `/api/assignments/responsibilities/` | R | Responsibility types |
| 34 | GET | `/api/assignments/` | R | List responsibility assignments |
| 35 | POST | `/api/assignments/` | C | Create assignment |
| 36 | POST | `/api/assignments/reassign/` | Action | Reassign (**reason**) |
| 37 | GET | `/api/assignments/history/` | R | Assignment history |
| 38 | GET | `/api/assignments/working/` | R | List working (by `?client=`) |
| 39 | POST | `/api/assignments/working/` | C | Assign working (note) |
| 40 | PATCH | `/api/assignments/working/{working_id}/` | U | Edit working (**reason**) |
| 41 | DELETE | `/api/assignments/working/{working_id}/` | D | Remove working (**reason**) |

---

## 6) Contacts — `/api/contacts/` (5 APIs)

| # | Method | Path | Type | Purpose |
|---|--------|------|------|---------|
| 42 | GET | `/api/contacts/` | R | List contacts |
| 43 | POST | `/api/contacts/` | C | Create contact |
| 44 | GET | `/api/contacts/{contact_id}/` | R | Contact detail |
| 45 | PATCH | `/api/contacts/{contact_id}/` | U | Update contact |
| 46 | DELETE | `/api/contacts/{contact_id}/` | D | Delete contact |

---

## 7) Calls — `/api/calls/` (5 APIs)

| # | Method | Path | Type | Purpose |
|---|--------|------|------|---------|
| 47 | GET | `/api/calls/` | R | List calls |
| 48 | POST | `/api/calls/` | C | Log call |
| 49 | GET | `/api/calls/{call_id}/` | R | Call detail |
| 50 | PATCH | `/api/calls/{call_id}/` | U | Update call |
| 51 | DELETE | `/api/calls/{call_id}/` | D | Delete call |

---

## 8) Tasks — `/api/tasks/` (4 APIs)

| # | Method | Path | Type | Purpose |
|---|--------|------|------|---------|
| 52 | GET | `/api/tasks/` | R | List tasks |
| 53 | POST | `/api/tasks/` | C | Create task |
| 54 | PATCH | `/api/tasks/{task_id}/` | U | Update task |
| 55 | DELETE | `/api/tasks/{task_id}/` | D | Delete task |

---

## 9) Meetings — `/api/meetings/` (3 APIs)

| # | Method | Path | Type | Purpose |
|---|--------|------|------|---------|
| 56 | GET | `/api/meetings/` | R | List meetings |
| 57 | POST | `/api/meetings/` | C | Create meeting |
| 58 | PATCH | `/api/meetings/{meeting_id}/` | U | Update meeting |

---

## 10) Comments — `/api/comments/` (4 APIs)

| # | Method | Path | Type | Purpose |
|---|--------|------|------|---------|
| 59 | GET | `/api/comments/` | R | List comments |
| 60 | POST | `/api/comments/` | C | Add comment |
| 61 | PATCH | `/api/comments/{comment_id}/` | U | Edit comment |
| 62 | DELETE | `/api/comments/{comment_id}/` | D | Delete comment |

---

## 11) Follow-ups — `/api/followups/` (3 APIs)

| # | Method | Path | Type | Purpose |
|---|--------|------|------|---------|
| 63 | GET | `/api/followups/` | R | List follow-ups |
| 64 | POST | `/api/followups/` | C | Create follow-up |
| 65 | PATCH | `/api/followups/{followup_id}/` | U | Update follow-up |

---

## 12) Attachments / Docs — `/api/attachments/` (4 APIs)

| # | Method | Path | Type | Purpose |
|---|--------|------|------|---------|
| 66 | GET | `/api/attachments/` | R | List attachments |
| 67 | POST | `/api/attachments/` | C | Upload document |
| 68 | GET | `/api/attachments/{attachment_id}/download/` | R | Download file |
| 69 | DELETE | `/api/attachments/{attachment_id}/` | D | Delete (**reason**) |

---

## 13) Activity / Active Logs — `/api/activity/` (1 API)

| # | Method | Path | Type | Purpose |
|---|--------|------|------|---------|
| 70 | GET | `/api/activity/` | R | Global audit logs |

---

## 14) Custom fields — `/api/custom-fields/` (3 APIs)

| # | Method | Path | Type | Purpose |
|---|--------|------|------|---------|
| 71 | GET | `/api/custom-fields/definitions/` | R | Field definitions |
| 72 | GET | `/api/custom-fields/values/` | R | Field values |
| 73 | POST | `/api/custom-fields/values/` | C | Upsert field value |

---

## 15) Configuration — `/api/configuration/` (1 API)

| # | Method | Path | Type | Purpose |
|---|--------|------|------|---------|
| 74 | GET | `/api/configuration/` | R | Sources + services + industries bundle |

---

## 16) Dashboard — `/api/dashboard/` (1 API)

| # | Method | Path | Type | Purpose |
|---|--------|------|------|---------|
| 75 | GET | `/api/dashboard/` | R | Dashboard metrics |

---

## Meta (not business CRUD)

| # | Method | Path | Purpose |
|---|--------|------|---------|
| — | GET | `/api/schema/` | OpenAPI JSON |
| — | GET | `/api/docs/` | Swagger UI |

---

## By module summary

| Module | Total APIs | CRUD | Actions |
|--------|----------:|-----:|--------:|
| Auth | 12 | 2 | 10 |
| Team | 4 | 4 | 0 |
| Clients / Leads | 9 | 5 | 4 |
| Kanban / Columns | 6 | 4 | 2 |
| Assignments + Working | 9 | 6 | 3 |
| Contacts | 5 | 5 | 0 |
| Calls | 5 | 5 | 0 |
| Tasks | 4 | 4 | 0 |
| Meetings | 3 | 3 | 0 |
| Comments | 4 | 4 | 0 |
| Follow-ups | 3 | 3 | 0 |
| Attachments | 4 | 4 | 0 |
| Activity | 1 | 1 | 0 |
| Custom fields | 3 | 3 | 0 |
| Configuration | 1 | 1 | 0 |
| Dashboard | 1 | 1 | 0 |
| **Total** | **74** | **51** | **23** |

---

## Frontend-critical subset (integration first)

These map directly to the UI you built (about **35** of the 74):

1. Auth login / refresh / logout / me  

2. Configuration + team list  
3. Clients list/create/detail/update/delete + stage move  
4. Kanban board + stages CRUD/reorder  
5. Working list/create/update/delete  
6. Comments, follow-ups, attachments  
7. Activity logs  

Full request/response walkthrough: see [API.md](./API.md).
