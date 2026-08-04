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

# Independent Audit and Correction — 2026-08-04

Timezone: Asia/Bangkok.

## Source-of-truth inspection

- Independently reread the five-page Short Paper, extracted all text, rendered and visually inspected the one-page ERD, read `AGENTS.md`, README, Chapter 4 guide, all AI-context files, every ordered SQL script, and the complete backend/frontend/test/configuration source tree.
- Confirmed there is no `skills-lock.json` or installed project skill, and did not modify either approved PDF.
- Recomputed the approved PDF hashes; both exactly match `REQUIREMENTS_SOURCE.md`.
- Created `docs/VERIFICATION_AND_REQUIREMENT_MATRIX.md` with 108 individually traced requirements and explicit evidence/status rules.

## Defects confirmed and fixed

- Proved that `authenticated` could execute a security-definer booking RPC with a forged admin actor UUID. Revoked critical RPC/check/helper execution from public/browser roles and bound the actor to request context when present. The same exploit regression now returns permission denied.
- Added database checks connecting stored booking business dates to Bangkok timestamps and enforcing exact single-day storage; scoped idempotent constraint discovery to the correct relation; changed department-history trigger dating to Bangkok; removed hard-delete RLS intent for soft-delete entities; and revoked trigger/helper execution privileges.
- Expanded SQL smoke tests for cross-day capacity on every date, unlimited capacity, update/cancel audit actions, holiday acknowledgement, audit immutability, history transitions, public privileges, and correctness of all five views including cancelled records.
- Removed the insecure default `postgres/postgres` connection fallback. Startup now requires explicit server configuration.
- Added admin-user duplicate/reference preflight before Supabase Auth, consistent 409/400 exception mapping, actual-admin history attribution, inactive/invalid department and role validation, Auth duplicate mapping, same-UUID verification, and compensation tests.
- Corrected unhandled production-login errors, misleading query-empty states, browser-timezone-sensitive date-only formatting, Bangkok default dates, production calendar month selection, inactive department selection, management sorting/success feedback, and booking-card accessibility/test targeting.
- Replaced weak browser coverage with 15 live-stack journeys and expanded component tests from 8 to 12. The added journeys include department creation/soft-deactivation, employee department history with restoration, and holiday creation/soft-deactivation.

## Final database and live-stack evidence

- Started PostgreSQL 14.21 on `127.0.0.1:55436`, created a fresh `codesk_final` database, and executed scripts `00`–`08` with `ON_ERROR_STOP`. Re-executed the same sequence against the populated database; both runs passed and smoke fixtures rolled back.
- Ran a two-session capacity race with OPS capacity 1. Session A held the department lock and created one booking; session B waited and returned structured `capacity_exceeded`. The final active count was one; the fixture was cancelled and capacity restored to three.
- Ran ASP.NET on port 5080 and Vite on 5173 against `codesk_final`. The final `npx playwright test` passed 15/15 in 17.2 seconds.
- Direct report queries verified pagination (`page=2`, `pageSize=1`, `total=7`) and a combined date/department filter returning only the expected 2026-08-04 OPS row.
- Live direct API probes observed: unauthenticated 401; employee/HR forbidden 403; missing 404; validation 400; duplicate admin profile 409 before Auth; genuinely new admin profile 503 because Supabase Admin was intentionally unconfigured.
- The separate disabled-Demo verification returned 404 for the demo endpoint and 401 for a demo-header identity. The in-process regression test remains in the suite.

## Final build, test and security results

- `dotnet restore CoDesk.sln && dotnet build CoDesk.sln --no-restore && dotnet test CoDesk.sln --no-build`: build 0 warnings/errors; 8 unit + 11 API = 19 passed, 0 failed, 0 skipped.
- `npm run typecheck && npm run lint && npm test -- --run && npm run build`: typecheck/lint/build passed; 12 tests passed, 0 failed.
- `npx playwright test`: 15 passed, 0 failed, 0 skipped against the real database/API/UI stack.
- `dotnet list CoDesk.sln package --vulnerable --include-transitive`: no vulnerable packages for all six projects.
- `npm audit --omit=dev`: exit 1 with two moderate React Router package findings; npm offers only a breaking v7 upgrade. Actual surface and remaining action are recorded in README/DECISIONS/OPEN_TASKS.
- Secret/config scan found no committed credential. The ignored `frontend/.env.test` contains only the Demo flag and localhost API URL.

## Remaining limitations at the local-audit checkpoint

- At this checkpoint no external Supabase tenant/credentials had been supplied, so hosted SQL/RLS roles, real asymmetric JWT validation, and Admin Auth create/delete/compensation were not yet claimed as executed. The later hosted-verification section below supersedes this limitation.
- Final Chapter 4 screenshots were not captured. The exact safe capture sequence remains in `docs/CHAPTER_4_EVIDENCE_GUIDE.md`.
- Optional UI automation gaps are recorded as Partially verified in the matrix rather than overstated.
- Stopped the audit API, Vite server, and PostgreSQL cluster after final verification.

# Hosted Supabase Production Verification — 2026-08-04

Timezone: Asia/Bangkok.

## Production configuration and authentication

- Confirmed the ignored backend/frontend environment files select Production Mode, use one matching Supabase project URL, configure the expected `/auth/v1` issuer and `authenticated` audience, connect through the SSL-required Supabase pooler, keep the service-role credential only in the backend, and expose only the public anon credential to Vite.
- Confirmed the running API/UI returned 200 for health/root, 401 for unauthenticated `/api/me`, and 404 for the disabled Demo endpoint.
- Supabase OIDC discovery matched the configured issuer. JWKS published two ECC P-256 keys, both ES256.
- Created an isolated real Supabase Auth/profile fixture without changing the real administrator. Password login succeeded. The access token used `alg=ES256`; its `kid` matched JWKS; its ES256 signature verified; issuer and `authenticated` audience matched configuration; and its subject matched both the Auth user and active application profile.
- `GET /api/me` returned 200, and its profile UUID, role, active state, and department matched the hosted database.
- The project had already migrated from Legacy HS256 to ECC P-256 / ES256. The Previous Legacy key was not revoked or modified.

## Hosted Admin user creation and RBAC

- An admin opened the real User Management UI, and a UI submission to `POST /api/admin/users` returned 201. Direct authenticated follow-up probes created disposable employee, HR, and admin users through the same ASP.NET endpoint.
- For every completed creation, `auth.users.id` equaled `co_desk.profiles.profile_id`; requested identity/department/role/status fields matched; and exactly one open initial department-history row existed.
- Duplicate email and employee code returned 409. Inactive department, invalid role, and a seven-character temporary password returned 400 before Auth creation.
- Browser request inspection found no direct Supabase Admin API call and no service-role credential. A post-build scan found no service-role credential in frontend source or output.
- Real employee, HR, and admin logins each returned `/api/me` 200 with ES256 tokens. Thai UI menus matched the role matrix.
- Direct API probes verified employee self-only booking/edit/cancel, same-department calendar scope, and denial of reports/departments/users; HR self-only booking, employee-profile/department/report access, and denial of Auth creation/role assignment/holiday/audit access; and admin cross-user booking plus department/holiday/profile/role/user/report/audit access.

## Hosted database and booking rules

- Catalog inspection returned the exact seven approved `co_desk` tables, five report views, RLS enabled on all seven tables, zero forbidden tables, and the three approved role codes.
- `PUBLIC`, `anon`, and `authenticated` had no execution access to the six critical booking/check functions. Browser roles had no direct select access to reporting views.
- Hosted RLS exposed same-department profiles and hid a cross-department profile for an employee subject. Direct report/function access as `authenticated` failed.
- Audit updates failed both as the normal browser role and as the database owner because the immutable trigger rejected mutation.
- Backend operations verified overlap rejection, limited capacity after a temporary capacity-1 setting, restored limited capacity, unlimited capacity, holiday acknowledgement, admin booking for another active employee, and closed/open department-history transitions.

## Cleanup and final commands

- Cancelled all disposable bookings, restored the limited department's original capacity, deactivated every disposable application profile, and deleted every disposable Supabase Auth identity. A final hosted query returned zero active QA profiles, zero active QA bookings, and zero QA Auth users. The real administrator was never changed.
- `dotnet restore && dotnet build CoDesk.sln && dotnet test CoDesk.sln`: build 0 warnings/errors; 8 unit + 11 integration = 19 passed.
- `npm install && npm run typecheck && npm run lint && npm run test && npm run build`: all completed; 12 frontend tests passed; npm retained the two already documented moderate React Router findings.
- Safe production browser probes were executed with Playwright against the real UI/API/Auth/database. The checked-in `demo-mode.spec.ts` suite was not run against Production Mode because it requires the deliberately disabled Demo header.
- No application source defect was reproduced, so no source code or SQL was changed. Documentation was updated only with verified results.
