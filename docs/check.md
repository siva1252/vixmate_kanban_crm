**Security re-check (after hardening pass) — local DB / internal CRM.**

### Critical
1. **Forgeable FE session** — **Hardened.** App shell now requires access token + live `GET /api/auth/me/` (not localStorage JSON alone).
2. **Most CRM writes still mock** — **Partly open.** Leads / boards / Working / Lead Source / activity use Django. Comments / docs / follow-ups / tasks / meetings / attachments still mock (product follow-up).
3. **Default `SECRET_KEY`** — **Hardened.** Strong key set in local `.env`; `DJANGO_DEBUG=False` refuses insecure/short keys.

### High
4. **Deactivate ≠ kill sessions** — **Fixed.** Deactivate blacklists outstanding refresh tokens; refresh rejects inactive users / inactive team members.
5. **JWTs in `localStorage`** — **Still true** (acceptable for internal 5-Admin CRM; httpOnly cookies = later).
6. **`DEBUG=True` default** — **Still true for local.** Production must set `DJANGO_DEBUG=False` (fail-closed secret already enforced then).
7. **Logout only blacklists refresh** — **Still true**; access lifetime shortened to **30 minutes** default.
8. **`MOCK_PASSWORD` in client bundle** — **Gone** from FE.
9. **Reset `verification_id` in URL** — **Still true** (lower priority for internal).
10. **`apiRequest` fail-closed** — **Fixed** (no token → 401, no fetch).

### Medium
11. **Login/OTP error enumeration** — **Hardened** for login (locked/inactive → same “Invalid email or password.”).
12. **No DRF throttles** — **Fixed** on login / refresh / OTP / forgot / reset (`10–30/min`).
13. **Any member: restore / columns / availability / comments** — **Still true** (by design for equal Admins).
14. **`is_staff` bypasses TeamMember** — **Still true** (staff = technical admin).
15. Soft edges (first-call / uploads) — **Still true** (later).

### Go-live on server
1. Set `DJANGO_DEBUG=False` and keep a unique long `DJANGO_SECRET_KEY`.
2. Backup the local Postgres DB.
3. Re-login after secret rotate (old JWTs invalid).
