# Session Log — 2026-08-03

Timezone: Asia/Bangkok.

## Inspection

- Inventoried the root with `find . -maxdepth 4 -type f | sort`; only the approved PDFs existed.
- Read all five pages of `Short paper Codesk_1_3_v3.pdf` and the extracted ERD text.
- Rendered and visually inspected the one-page ERD.
- Confirmed .NET SDK 10.0.201, Node 22.20.0, npm 10.9.3, psql 14.21, and Docker CLI. Docker daemon was unavailable; an isolated temporary PostgreSQL cluster was used instead.
- Created `AGENTS.md` before source implementation and treated `Doc/` as read-only.

## Database

- Added ordered scripts `00`–`08` and development-only `99`.
- Implemented the exact seven tables, all constraints/indexes, overlap exclusion, triggers, transactional booking functions, RLS, five reports, deterministic demo data, and rollback-only smoke tests.
- Executed scripts `00` through `08` with `psql -v ON_ERROR_STOP=1` against an isolated PostgreSQL 14 cluster.
- Re-executed scripts `00` through `08` against the populated integration database; all rerunnable scripts and rollback-only smoke assertions passed again.
- Result: all files completed; smoke `DO` assertions completed; transaction rolled back. The smoke suite verified seven tables, no forbidden capacity-policy table, uniqueness/checks, overlap/cancel behavior, limited/unlimited capacity, holiday detection, audit, history, and all views.

## Backend

- Scaffolded the .NET 10 solution and four-layer project structure.
- Added Npgsql/EF Core, JWT bearer, Swagger, ProblemDetails, correlation IDs, Demo auth, Supabase claims enrichment, RLS-compatible identity intent, controllers, data/RPC service, and server-only Supabase Admin service.
- Replaced the vulnerable transitive Microsoft.OpenApi 2.4.1 with explicit 2.11.0.
- Added 8 authorization unit tests and 8 in-process API integration tests.
- Command: `dotnet build CoDesk.sln --no-restore` — succeeded with 0 warnings and 0 errors after final fixes.
- Command: `dotnet test CoDesk.sln --no-build` — 16 passed, 0 failed.

## Frontend

- Scaffolded React/TypeScript/Vite and installed all required UI/data/calendar/chart/form/test libraries.
- Implemented Thai Demo selection, production Supabase login, responsive role navigation, dashboard, booking form/list/edit/cancel, monthly calendar, department management, employee/history management, holiday management, admin user creation, and five report tabs with dynamic column filters.
- Added strict TypeScript, centralized API errors/dates/text, shadcn-style reusable primitives, route lazy loading, and responsive states.
- Added 8 Vitest/React Testing Library tests and 4 Playwright tests.
- Final commands/results:
  - `npm run typecheck` — passed.
  - `npm run lint` — passed with no warnings.
  - `npm run test` — 8 passed, 0 failed.
  - `npm run build` — passed; lazy chunks all below the Vite warning threshold.
  - Repeated the complete typecheck/lint/unit-test/build chain after the final router configuration change; all checks passed unchanged.
  - `npm audit --omit=dev` — two moderate React Router advisories remain and are documented; no high/critical finding in the chosen 6.x version.

## Live-stack integration

- Started a fresh temporary PostgreSQL 14 cluster on port 55433, applied scripts `00`–`07`, ran the API on 5080, and Vite on 5173.
- Initial API probing found a missing SQL separator in the anonymous demo-profile query. Fixed and reran .NET build/tests.
- Initial browser booking found Npgsql `inet` metadata receiving a string. Converted it to `IPAddress`, rebuilt, and reran tests.
- Verified health, demo profiles, current user, and an HR report with `curl`.
- Final `npm run test:e2e`: 4 passed, covering employee/admin menus, real booking creation, holiday confirmation, and database-view report data.
- Stopped the temporary API, Vite server, and PostgreSQL server after verification.

## Documentation and preservation

- Replaced generated documentation with the comprehensive root README.
- Added all required AI-context files and Chapter 4 evidence guide.
- Recorded final SHA-256 hashes for the unchanged approved PDFs.
- No source code was written under `Doc/`.
