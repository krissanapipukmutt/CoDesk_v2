# Chapter 4 Evidence Guide

## Preparation

1. Execute database scripts `00` through `08` in order.
2. Start the backend at `http://localhost:5080` with Demo Mode enabled.
3. Start the frontend at `http://localhost:5173` with `VITE_DEMO_MODE=true`.
4. Set the browser viewport to 1440×900 for desktop screenshots and 390×844 for a mobile example.
5. Keep database credentials, browser tokens, and service-role keys outside every screenshot.

The seed is centered on August 2026. In the calendar, navigate to August 2026 if it is not already visible.

For production-auth evidence, use the existing ignored Production Mode environment files instead of Demo Mode. The hosted project was verified on 2026-08-04 after migration from Legacy HS256 to ECC P-256 / ES256. Never show an access/refresh token, authorization header, password, UUID, real email address, database connection, anon key, or service-role key in a screenshot.

## UI screenshot checklist

- [ ] Demo Role Selection showing Employee, HR, and Admin cards.
- [ ] Employee menu: overview, booking, calendar; no reports or management menus.
- [ ] HR menu: departments, employees, reports; no holidays or user creation.
- [ ] Admin menu: every menu including holidays and users/roles.
- [ ] Single-day form with one local date and department display.
- [ ] Date/time-range form with 24-hour start/end fields and a cross-day range.
- [ ] Successful single-day booking confirmation.
- [ ] Overlapping booking rejection. Use EMP001 on `2026-08-04`, which overlaps seeded booking `400…001`.
- [ ] Capacity rejection. Temporarily set OPS capacity to 1 in Department Management, then attempt another booking on a date already occupied; restore capacity to 3 afterward.
- [ ] Unlimited capacity success using a DIGI employee/admin target.
- [ ] Holiday warning on `2026-10-23`, followed by explicit confirmation and success.
- [ ] Monthly calendar in August 2026 showing all-day, range, and cross-day events.
- [ ] Employee same-department names visible; DIGI records absent from employee view.
- [ ] Admin calendar showing all departments.
- [ ] Department management table and limited/unlimited edit dialog.
- [ ] Employee management edit dialog and department-history section.
- [ ] Holiday management including the inactive record.
- [ ] Admin user creation form; do not submit unless production Supabase credentials are configured.
- [ ] Each of the five report tabs with actual rows.
- [ ] A per-column report filter, such as `OPS` in the department-code filter.
- [ ] Capacity chart plus the unchanged full source table.
- [ ] Responsive mobile navigation and one booking screen.

## Supabase/database evidence checklist

Capture the Supabase Table Editor or SQL results without connection strings:

- [ ] Exactly seven `co_desk` base tables.
- [ ] No `co_desk.department_capacity_policies` table.
- [ ] Five `co_desk.vw_*` reporting views.
- [ ] Three role rows: employee, HR, admin.
- [ ] Active and cancelled bookings.
- [ ] An acknowledged holiday booking.
- [ ] `booking_audit_logs` create and cancel rows with JSON snapshots.
- [ ] `user_department_history` closed and open rows for EMP003.
- [ ] RLS enabled on all seven tables.
- [ ] `ex_bookings_no_active_overlap` exclusion constraint.

## Production authentication and authorization evidence checklist

- [ ] Supabase Signing Keys page showing the Current key as ECC P-256 / ES256. It is acceptable for the Previous Legacy HS256 key to remain visible; do not revoke it for evidence capture.
- [ ] A redacted OIDC/JWKS result showing ES256/P-256 publication without copying a token or key material into the paper.
- [ ] CoDesk production login screen and a successful admin landing page. Use a disposable evidence identity or redact all personal fields.
- [ ] Redacted browser Network entry for `GET /api/me` showing HTTP 200. Hide the Authorization header and response UUID/email; retain only role/department evidence if it is non-sensitive test data.
- [ ] Employee, HR, and admin menu boundaries using disposable users. Also capture redacted direct API 403 evidence so hidden menus are not the only authorization proof.
- [ ] Admin User Management page and a disposable creation success through `POST /api/admin/users`; do not show the temporary password or email.
- [ ] Redacted database/Auth comparison proving `auth.users.id = co_desk.profiles.profile_id` without publishing the UUID.
- [ ] Initial `user_department_history` row for the disposable user, with identifying columns redacted.
- [ ] Evidence that the frontend request targets `/api/admin/users`, not `/auth/v1/admin/users`, and that no service-role credential is present.
- [ ] Project Functions page or CLI listing showing the unused legacy `admin_create_user` Edge Function is absent. Do not create a replacement; the current architecture requires no Edge Function for user creation.
- [ ] Cleanup evidence: disposable profile inactive, no active disposable booking, and disposable Auth identity removed. Do not delete or modify the real administrator.

Verified hosted results available for Chapter 4 narration (without publishing identifiers): ES256 signature and JWKS `kid` passed; issuer/audience/subject passed; `/api/me` returned 200; Auth/profile UUIDs matched; employee/HR/admin menu and direct API boundaries passed; exactly seven tables/five views/RLS on seven tables passed; critical functions/report views were denied to browser roles; overlap, limited/unlimited capacity, holiday acknowledgement, audit immutability, and department history passed.

The Previous Legacy key may be revoked manually in the Supabase Dashboard only after every old HS256 access token has expired and all active clients have refreshed to ES256. This is not part of automated verification or screenshot capture.

Suggested read-only SQL:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'co_desk' AND table_type = 'BASE TABLE'
ORDER BY table_name;

SELECT viewname FROM pg_views WHERE schemaname = 'co_desk' ORDER BY viewname;

SELECT booking_id, action_code, actor_role_code, action_at, old_values_json, new_values_json
FROM co_desk.booking_audit_logs ORDER BY action_at DESC LIMIT 10;

SELECT p.employee_code, h.department_id, h.assigned_start_date, h.assigned_end_date
FROM co_desk.user_department_history h
JOIN co_desk.profiles p ON p.profile_id = h.profile_id
ORDER BY p.employee_code, h.assigned_start_date;
```

## Build and test evidence

Capture the final summaries from:

```bash
cd "/Users/krissanap/Document/KMUTT/Short Paper/Codesk_v2/backend"
dotnet build "CoDesk.sln"
dotnet test "CoDesk.sln"

cd "/Users/krissanap/Document/KMUTT/Short Paper/Codesk_v2/frontend"
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:e2e
```

Expected local verified totals from the implementation session:

- xUnit: 19 passed (8 unit + 11 in-process API tests).
- Vitest/RTL: 12 passed.
- Playwright: 15 passed against the real temporary database/API/UI stack.
- SQL smoke script: completed and rolled back without errors on both a fresh and populated PostgreSQL 14.21 database.
- Concurrency evidence: one booking committed and the concurrent capacity contender returned `capacity_exceeded`.

Post-hosted-verification rerun on 2026-08-04 produced the same 19 xUnit and 12 Vitest totals, with backend build 0 warnings/errors and frontend typecheck/lint/build passing. Safe isolated Playwright browser probes against Production Mode also passed for real login, role menus, user creation response, and direct API/database flows. Do not run `demo-mode.spec.ts` against Production Mode because its Demo header is intentionally disabled.

These are the independent 2026-08-04 totals. For requirement status and limitations, include `docs/VERIFICATION_AND_REQUIREMENT_MATRIX.md` in the Chapter 4 evidence package.
