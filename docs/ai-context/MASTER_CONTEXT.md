# Master Context

## Current state

CoDesk is a complete greenfield implementation created on 2026-08-03 from the approved five-page Chapter 1–3 paper, one-page ERD, and the execution prompt. The repository contains authoritative PostgreSQL SQL, a .NET 10 API, a React/TypeScript frontend, Demo Mode, production Supabase Auth integration, automated tests, and project/evidence documentation.

Local verification is complete: SQL scripts/smoke tests executed on PostgreSQL 14, the .NET solution built with 16 passing tests, the frontend typechecked/linted/built with 8 passing component tests, and 4 Playwright tests passed against a real temporary database/API/UI stack. External Supabase verification remains because no tenant credentials were supplied.

## Non-negotiable requirements

- Schema: `co_desk`.
- Exactly seven application tables: roles, departments, profiles, holidays, bookings, booking_audit_logs, user_department_history.
- No capacity-policy, employee, seat, workspace, office, room, or migration-history table.
- SQL files create the database; do not add EF migrations.
- Asia/Bangkok business dates; UTC-backed `timestamptz`; half-open booking intervals.
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
- `frontend/src`: API client, auth context, Thai pages, shadcn-style UI primitives, FullCalendar, reports.

Technologies: PostgreSQL/Supabase, .NET 10, Npgsql/EF Core, React 19, TypeScript strict, Vite/Tailwind, TanStack Query/Table, FullCalendar, Recharts, xUnit, Vitest/RTL, Playwright.

## Key paths

- Setup and commands: `README.md`
- Exact current handoff: `docs/ai-context/HANDOFF.md`
- Database explanation: `docs/ai-context/DATABASE_DESIGN.md`
- Permission rules: `docs/ai-context/ROLE_PERMISSION_MATRIX.md`
- Screenshot workflow: `docs/CHAPTER_4_EVIDENCE_GUIDE.md`
- API startup: `backend/src/CoDesk.Api/Program.cs`
- Booking database rules: `database/sql/04_create_booking_functions.sql`
- Frontend routes: `frontend/src/App.tsx`

## How to continue

1. Read `AGENTS.md`, this file, `HANDOFF.md`, and `OPEN_TASKS.md`.
2. Preserve `Doc/` and the seven-table boundary.
3. Make SQL/API/UI changes together when a contract changes.
4. Run SQL smoke tests on an isolated database, `dotnet test`, and all frontend checks.
5. Update README, SESSION_LOG, HANDOFF, and OPEN_TASKS with actual—not assumed—results.

