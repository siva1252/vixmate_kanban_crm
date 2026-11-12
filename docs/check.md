**Goal complete (1m 41s).** Hostile review of current BE + FE — verified against the tree.

### Critical
1. **Forgeable FE session** — `app-shell.tsx` only checks `localStorage` JSON; **no `middleware.ts`**, no `/me` gate. Anyone can set `viximate.crm.session` and open the app shell.
2. **Most CRM writes still mock** — boards/leads/attachments/etc. mutate in-browser store → **no Django auth** on those actions.
3. **Default `SECRET_KEY`** — `settings.py`: `"insecure-dev-only-change-me"` + JWT HS256 → forge tokens if prod ships defaults.

### High
4. **Deactivate ≠ kill sessions** — `deactivate_user` flips `is_active`; `refresh_tokens()` never checks user active → refresh still mints access.
5. **JWTs in `localStorage`** — XSS steals access/refresh.
6. **`DEBUG=True` default** + media served under DEBUG → stack traces / `/media/` bypass.
7. **Logout only blacklists refresh** — access lives until expiry (~60m).
8. **`MOCK_PASSWORD` + seed PII** still in client bundle (`store.ts`).
9. **Reset `verification_id` in URL** (`otp` → `reset-password?vid=`).
10. **`apiRequest` not fail-closed** — `auth: true` with no token still fires fetch.

### Medium
11. **Login/OTP error enumeration** (locked / inactive / no OTP vs generic).
12. **No DRF throttles** on login/OTP/refresh.
13. **Any member**: restore soft-deleted leads, mutate kanban columns, change **any** teammate availability, edit/delete **any** comment (no author check).
14. **`is_staff` bypasses TeamMember** in `IsActiveCRMMember`.
15. First-call flag settable on create; meetings/tasks can target deleted clients; upload = extension-only.

### Fix order
1. Fail closed on bad/missing `SECRET_KEY` when not DEBUG; short JWT + inactive-user refresh reject + blacklist on deactivate.  
2. FE middleware + `/me` gate; httpOnly cookies; fail-closed API client.  
3. Kill mock writes for CRM; remove `MOCK_PASSWORD` from bundles.  
4. Throttles + opaque auth errors.  
5. Role gates: restore / columns / availability / comments.

Want me to start patching Critical → High next?
