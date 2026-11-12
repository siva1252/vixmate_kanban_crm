# Viximate CRM API — Security & Robustness

How to explain this API to stakeholders: **what we built, why it resists abuse, and what still must be hardened in production.**

No API is “uncrackable.” Security is layered controls that make unauthorized access expensive, noisy, and detectable. This document states what is already in place and what remains before production.

---

## 1) One-sentence pitch

Viximate CRM is an **internal, authenticated JWT API**: only approved team emails can log in, every mutating action is validated and audited, sensitive secrets never leave the server in clear form, and soft-deletes / reassignments require a **reason** so changes are attributable.

---

## 2) Threat model (think like an attacker)

| Attacker goal | What they try | How we block / detect |
|---------------|---------------|------------------------|
| Steal a session | Replay a stolen access token | Short-lived JWT access (60m); refresh rotation + blacklist on logout |
| Guess passwords | Brute-force login | Failed-attempt lockout; approved-email gate before password check messaging |
| Create fake staff | Call “create user” API | **No public create-user API** — users provisioned in Admin/DB only |
| Outside partner login | Demand credentials for Lead Source people | Lead Source people are **records only** — never Users; zero JWT |
| Change data silently | PATCH/DELETE without justification | Mandatory `reason` on lead edit/delete, working edit/remove, responsibility reassign, column delete |
| Enumerate accounts | Probe forgot-password / OTP | Same generic response for unknown emails; OTP hashed at rest |
| Hijack refresh | Reuse old refresh after logout/rotate | Token blacklist + rotate-on-refresh |
| Inject junk / XSS into API | Oversized or typed-wrong payloads | DRF serializers + field validation on every write |
| Bypass auth | Hit CRM routes without Bearer | Default `IsAuthenticated` + `IsActiveCRMMember` on business APIs |
| Read secrets from logs | Scrape audit trails | Audit sanitizer strips password / OTP / access / refresh / authorization |

---

## 3) What is already secure (current build)

### Authentication & sessions
- **JWT access + refresh** (`djangorestframework-simplejwt`), not a raw DB token string.
- Header: `Authorization: Bearer <access>`.
- Access lifetime: **60 minutes**. Refresh: **7 days**.
- **Refresh rotation** + **blacklist** after rotate/logout.
- Login only for **approved emails** (`ApprovedEmail`) + active users.
- Account **lockout** after repeated failed logins.
- Password change / reset requires **OTP** (hashed, expiry, attempt + resend limits).

### Authorization
- Business routes require **active CRM team membership** (or staff).
- Activate / deactivate users: **staff-only**.
- Team members are **not** created via public API (Admin / `seed_demo_users` only).

### Input & business rules
- Every write goes through **serializers** (types, lengths, required FKs).
- Soft-delete / critical edits require **reason** (min length where defined).
- “Other” lead source / service requires free-text when selected.
- First-call and stage moves are explicit endpoints with validation.

### Audit & accountability
- Central `write_audit_log` on login, lead CRUD, stage moves, working, assignments, etc.
- Reasons stored on sensitive mutations.
- Sensitive keys stripped from audit payloads.

### Transport & docs hygiene (local/dev)
- Swagger documents request bodies so testers send correct auth and fields (reduces accidental insecure workarounds).
- CORS restricted to configured origins (default local frontend).

---

## 4) Working vs responsibility (do not confuse)

| Concept | API | Frontend |
|---------|-----|----------|
| **Lead Working** | `/api/assignments/working/` | Lead detail → **Working** tab (who works on lead + note) |
| **Responsibility assignment** | `/api/assignments/` (+ `/reassign/`) | Responsibility roles (Lead Creation, Technical Mgmt, …) |

These are **different**. Working is what the lead “Working” tab uses.

---

## 5) How to test safely in Swagger

1. Login → copy **`access`** only → Authorize.
2. DELETE client / DELETE working / DELETE column → Request body:
   ```json
   { "reason": "Duplicate / no longer needed" }
   ```
3. Working create: `POST /api/assignments/working/` with `client`, `team_member`, `work_note`.
4. Never paste refresh into Authorize — only **access**.

---

## 6) Production hardening checklist (must-do before public/VPN exposure)

| Priority | Control | Why |
|----------|---------|-----|
| P0 | HTTPS only (TLS 1.2+) | Stops token sniffing |
| P0 | Strong unique `DJANGO_SECRET_KEY` | JWT signing + crypto |
| P0 | Disable `DEBUG`; lock `ALLOWED_HOSTS` | Info leak / host header attacks |
| P0 | Rate-limit login, OTP, refresh (WAF / nginx / DRF throttle) | Brute force & credential stuffing |
| P0 | Postgres least-privilege DB user; no public DB port | Data exfil |
| P1 | Rotate JWT signing key process; shorter access (15–30m) if needed | Blast-radius reduction |
| P1 | IP allowlist / VPN for CRM API | Internal-only surface |
| P1 | Security headers (HSTS, CSP on admin/UI) | Browser attack surface |
| P1 | Backups + restore drill; audit log retention | Integrity / forensics |
| P2 | Dependency scanning (pip-audit) + image scanning | Supply chain |
| P2 | Object-level checks if roles diverge later | IDOR defense as product grows |
| P2 | File upload virus scan + content-type allowlist for attachments | Malware upload |

---

## 7) How to explain “how secure is it?”

**Today (internal CRM, controlled users):**  
Strong for an authenticated internal tool: JWT with expiry/rotation/blacklist, approved-email login, lockout, OTP for password flows, serializer validation, reason-gated destructive edits, and full audit trail. Public user-creation was removed so attackers cannot self-provision staff via API.

**Not yet “bank-grade / internet-exposed”** until HTTPS, rate limits, locked hosts, VPN/allowlist, and ops monitoring from the checklist above are live.

**Honest line for stakeholders:**  
*“We designed it so a black-hat cannot casually create users, guess forever, or delete leads without a logged reason. Stolen short-lived tokens expire; refresh tokens can be revoked. Production still needs TLS, rate limits, and network lock-down.”*

---

## 8) Quick reference — security-relevant endpoints

| Endpoint | Risk control |
|----------|--------------|
| `POST /api/auth/login/` | Approved email + lockout → JWT pair |
| `POST /api/auth/token/refresh/` | Rotating refresh |
| `POST /api/auth/logout/` | Blacklist refresh |
| `PATCH .../activate|deactivate/` | Staff only |
| `DELETE /api/clients/{id}/` | Body `{ "reason": "..." }` + audit |
| `POST /api/assignments/working/` | Working tab assign |
| `PATCH/DELETE .../working/{id}/` | Reason required |
| `POST /api/assignments/reassign/` | Reason required |

---

## 9) Ownership

- Security design owner: backend / platform.
- Provision team members: Admin or `python manage.py seed_demo_users` / `seed_all`.
- Never commit real production secrets; use env vars only.
