# Master Context

## Current state

CoDesk is a greenfield implementation created on 2026-08-03 from the approved five-page Chapter 1–3 paper and one-page ERD. It was independently audited and corrected on 2026-08-04, then extended with complete multi-timezone behavior on 2026-08-09 without changing the approved seven-table/five-view model. The repository contains authoritative PostgreSQL SQL, a .NET 10 API, a React/TypeScript frontend, Demo Mode, production Supabase Auth integration, automated tests, and project/evidence documentation.

Current local functional verification is complete: authoritative SQL scripts `00`–`08` and the expanded timezone smoke suite passed twice on a disposable PostgreSQL 14.21 database; the .NET solution built cleanly with 25 passing tests; the frontend typechecked/linted/built with 39 passing component tests; and 17 Playwright journeys passed against the disposable database/API/UI stack. The final audit also reproduced and fixed department status lookup beyond the first 100 rows, malformed report filters returning 500 instead of 400, two language-specific booking audit reasons outside the centralized catalog, and silent normalization of a nonexistent New York spring-forward wall time. The later credential remediation separated the frontend Publishable key from the backend Secret key, disabled the legacy JWT-based API keys, and produced a frontend bundle containing no backend or legacy `service_role` credential. The 2026-08-04 hosted Supabase Auth/RBAC/database baseline remains recorded, but the 2026-08-09 multi-timezone/bilingual release was not deployed to or reverified against the hosted tenant. Final screenshots and the connected-browser manual visual pass remain manual.

## Non-negotiable requirements

- Schema: `co_desk`.
- Exactly seven application tables: roles, departments, profiles, holidays, bookings, booking_audit_logs, user_department_history.
- No capacity-policy, employee, seat, workspace, office, room, or migration-history table.
- SQL files create the database; do not add EF migrations.
- Department effective IANA timezone for booking business dates, Asia/Bangkok as the default, UTC-backed `timestamptz`, and half-open booking intervals.
- Admin alone creates Auth users and changes roles. HR manages existing employee profiles only.
- Demo headers authenticate only while the backend Demo Mode option is enabled.
- React uses Supabase only for production authentication and calls ASP.NET for all application data.
- Files in `Doc/` are approved and must not be edited.

## Architecture and stack

- `database/sql/`: ordered schema, constraints, functions, RLS, views, seed, and smoke scripts.
- `backend/src/CoDesk.Domain`: entities/constants.
- `backend/src/CoDesk.Application`: DTOs, interfaces, and authorization rules.
- `backend/src/CoDesk.Infrastructure`: EF mappings, Npgsql query/RPC service, Supabase Admin service.
- `backend/src/CoDesk.Api`: auth schemes, claims enrichment, policies, middleware, controllers, Swagger.
- `frontend/src`: API client, auth context, centralized Thai/English UI, reusable UI primitives, FullCalendar, and reports.

Technologies: PostgreSQL/Supabase, .NET 10, Npgsql/EF Core, React 19, TypeScript strict, Vite/Tailwind, TanStack Query/Table, FullCalendar, Recharts, xUnit, Vitest/RTL, Playwright.

## Key paths

- Setup and commands: `README.md`
- Independent traceability: `docs/VERIFICATION_AND_REQUIREMENT_MATRIX.md`
- Exact current handoff: `docs/ai-context/HANDOFF.md`
- Database explanation: `docs/ai-context/DATABASE_DESIGN.md`
- Permission rules: `docs/ai-context/ROLE_PERMISSION_MATRIX.md`
- Screenshot workflow: `docs/CHAPTER_4_EVIDENCE_GUIDE.md`
- API startup: `backend/src/CoDesk.Api/Program.cs`
- Booking database rules: `database/sql/04_create_booking_functions.sql`
- Timezone validation/inheritance rules: `database/sql/03_create_common_functions_and_triggers.sql`
- Frontend routes: `frontend/src/App.tsx`

## How to continue

1. Read `AGENTS.md`, this file, `HANDOFF.md`, and `OPEN_TASKS.md`.
2. Preserve `Doc/` and the seven-table boundary.
3. Make SQL/API/UI changes together when a contract changes.
4. Run SQL smoke tests on an isolated database, `dotnet test`, and all frontend checks.
5. Update README, SESSION_LOG, HANDOFF, and OPEN_TASKS with actual—not assumed—results.
