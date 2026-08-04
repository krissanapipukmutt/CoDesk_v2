# Decisions

1. The PostgreSQL schema is `co_desk`; every SQL query schema-qualifies application objects.
2. The database has exactly seven application tables approved by the ERD.
3. `department_capacity_policies` is not used. Capacity mode and daily capacity live on departments.
4. Departments, profiles, and holidays use soft deletion (`is_active`). Bookings cancel by status. Audit/history records remain.
5. Single-day booking is stored as Bangkok midnight through next midnight using `[start_at, end_at)` and has equal start/end business dates.
6. Date/time ranges may cross dates; the last touched date uses `end_at - 1 microsecond` so an end exactly at midnight does not consume the next date.
7. Active overlap is protected by a partial GiST exclusion constraint with `btree_gist`; cancelled rows are excluded.
8. A department row `FOR UPDATE` lock serializes capacity checks and writes per department.
9. Critical booking functions return JSON objects with `success`, `code`, message, and structured details.
10. Admin alone creates Auth users and changes roles. HR updates existing employee-role profiles but not HR/admin identities.
11. Holiday management is admin-only because the explicit role section says HR cannot manage holidays.
12. Demo Mode uses `X-Demo-Profile-Id`, three deterministic database profiles, and a backend allowlist. The header is not an auth scheme when Demo Mode is disabled.
13. Production uses Supabase Auth in React, JWT validation/claims enrichment in ASP.NET, and the service-role key only in the backend Admin user service.
14. RLS uses JWT/app request settings for defense in depth. Report views are not granted to browser-authenticated database roles; reports are served by HR/admin API endpoints.
15. EF Core maps the authoritative tables but does not create/migrate them.
16. Report column filters are sent to the backend as an allowlisted JSON map; identifiers never come directly from untrusted input.
17. React Router 6 is retained for the client-only SPA. npm currently reports two moderate router advisories; the relevant SSR/data-router features are not used, and the current 7.x alternative has a high advisory. This must be reassessed on dependency updates.

