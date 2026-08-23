# Decisions

1. The PostgreSQL schema is `co_desk`; every SQL query schema-qualifies application objects.
2. The database has exactly seven application tables approved by the ERD.
3. `department_capacity_policies` is not used. Capacity mode and daily capacity live on departments.
4. Departments, profiles, and holidays use soft deletion (`is_active`). Bookings cancel by status. Audit/history records remain.
5. Single-day booking is stored as the target department's local midnight through next local midnight using `[start_at, end_at)` and has equal start/end business dates. New departments default to `Asia/Bangkok`.
6. Date/time ranges may cross dates; the last touched date uses `end_at - 1 microsecond` so an end exactly at midnight does not consume the next date.
7. Active overlap is protected by a partial GiST exclusion constraint with `btree_gist`; cancelled rows are excluded.
8. A department row `FOR UPDATE` lock serializes capacity checks and writes per department.
9. Critical booking functions return JSON objects with `success`, `code`, message, and structured details.
10. Admin alone creates Auth users and changes roles. HR updates existing employee-role profiles but not HR/admin identities.
11. Employees can view active holidays read-only. HR and Admin can view inactive holidays and create, edit, or soft-deactivate holidays; only Admin retains user/role administration.
12. Demo Mode uses `X-Demo-Profile-Id`, three deterministic database profiles, and a backend allowlist. The header is not an auth scheme when Demo Mode is disabled.
13. Production uses Supabase Auth in React, JWT validation/claims enrichment in ASP.NET, a Publishable key in the frontend, and a Secret key only in the backend Admin user service.
14. RLS uses JWT/app request settings for defense in depth. Report views are not granted to browser-authenticated database roles; reports are served by HR/admin API endpoints.
15. EF Core maps the authoritative tables but does not create/migrate them.
16. Report column filters are sent to the backend as an allowlisted JSON map; identifiers never come directly from untrusted input.
17. React Router 6 is retained for the client-only SPA. npm currently reports three moderate vulnerable packages covering protocol-relative/backslash redirect, open-redirect/XSS, and SSR-hydration constructor-injection advisories. CoDesk uses fixed internal navigation and no Router SSR hydration, but the breaking v7 migration must still be planned and tested rather than forced automatically.
18. Critical security-definer booking/check functions are backend-private and explicitly revoked from `PUBLIC`, `anon`, and `authenticated`; RLS is defense in depth, not permission to call write RPCs with a caller-supplied actor UUID.
19. A booking write trigger enforces that business-date columns match `start_at`/`end_at` in the booking department's effective IANA timezone and that single-day storage is exactly local midnight to next midnight. Persisted dates are not recomputed when a department timezone later changes.
20. Admin user creation validates duplicate codes/emails, active departments, and roles before calling Supabase Auth. The Auth UUID is the profile UUID; a failed profile insert triggers Auth deletion compensation, and history attribution uses the actual admin actor.
21. Production JWT validation uses Supabase OIDC/JWKS and requires an asymmetric signing key. Legacy shared-secret HS256 projects must migrate before the hosted path is treated as verified.
22. PostgreSQL `pg_timezone_names` is the single supported-timezone catalog. The API exposes it to the searchable department control; both API and database reject unsupported values.
23. A profile inherits its department timezone when created and synchronizes on department transfer. Editing a department timezone does not bulk-update existing profiles.
24. Holidays remain global. Capacity, holiday matching, and booking date normalization use the booking department's effective timezone.
25. Booking-time timezone and cancellation-local-date context are stored inside the existing immutable audit JSON. This preserves historical interpretation while retaining the approved seven tables and existing columns.
26. Timed calendar events display in the signed-in profile timezone with FullCalendar isolated from the browser timezone. Booking list/detail timestamps use the historical booking-time timezone; all-day events use persisted business dates.
