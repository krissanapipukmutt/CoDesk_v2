# CoDesk

CoDesk is a Thai-first web application for reserving office attendance. It supports all-day and date/time-range reservations, cross-day bookings, department capacity control, holiday acknowledgement, a monthly calendar, role-aware administration, and five database-backed reports.

The approved Chapter 1–3 paper and ERD remain unchanged in `Doc/`. PostgreSQL scripts are the authoritative schema source; Entity Framework migrations are intentionally not used.

## Features

- Single-day storage as `[00:00 department-local date, 00:00 next date)` and arbitrary date/time ranges.
- Database exclusion constraint preventing overlapping active bookings per employee.
- Per-day department capacity validation in each department's IANA timezone, serialized with a department row lock.
- Global holiday detection across every department-local date touched by a booking, with explicit acknowledgement.
- Searchable IANA timezone management, Bangkok defaults, profile inheritance on creation/transfer, and profile-timezone calendar display without browser-timezone drift.
- Transactional create, update, cancel, and immutable audit logging.
- Employee, HR, and admin authorization in the API plus role-aware menus.
- Monthly FullCalendar view with same-department visibility or admin global visibility.
- Soft-delete department, profile, and holiday management.
- Department assignment history maintained by a database trigger.
- Five real PostgreSQL reporting views with per-column UI filters, sorting, pagination, and a capacity chart.
- Demo Mode using seeded database identities and the real API/database.
- Production Supabase Auth JWT validation and server-only Admin user creation, verified against the hosted project with ES256/JWKS tokens and disposable Auth users.

## Roles

| Capability | Employee | HR | Admin |
|---|---:|---:|---:|
| Book for self | Yes | Yes | Yes |
| Book for another active employee | No | No | Yes |
| Same-department calendar | Yes | Yes | All departments |
| Edit/cancel own booking | Yes | Yes | Any booking |
| Manage departments | No | Yes | Yes |
| Manage existing employee profiles | No | Yes, employee role only | Yes |
| Change roles / create login users | No | No | Yes |
| Manage holidays | No | No | Yes |
| View reports | No | Yes | Yes |

The frontend menu is only a usability layer. ASP.NET authorization policies and application rules enforce these permissions independently.

## Technology stack

- Frontend: React 19, TypeScript strict mode, Vite, Tailwind CSS, shadcn-style Radix primitives, React Hook Form, Zod, TanStack Query/Table, FullCalendar, Recharts, and dayjs.
- Backend: .NET 10 ASP.NET Core Web API, Npgsql, Entity Framework Core mappings, Swagger/OpenAPI, JWT bearer authentication, ProblemDetails, and xUnit.
- Database: Supabase PostgreSQL, `pgcrypto`, `btree_gist`, RLS, PL/pgSQL RPC functions, triggers, and views.
- Tests: xUnit, ASP.NET in-process integration tests, Vitest, React Testing Library, and Playwright.

## Architecture

```mermaid
flowchart LR
    Browser[React / TypeScript\nThai + English UI] -->|Bearer JWT or Demo header| API[ASP.NET Core API\nAuthorization + ProblemDetails]
    Browser -. production login only .-> Auth[Supabase Auth]
    API -->|Npgsql / EF mappings| DB[(Supabase PostgreSQL\nco_desk schema)]
    API -->|Admin create/delete only\nserver Secret key| Auth
    DB --> Tables[7 approved tables]
    DB --> RPC[Transactional booking functions]
    DB --> Views[5 reporting views]
    DB --> RLS[RLS defense in depth]
```

The browser never queries application tables directly. Supabase in React is used only for production authentication.

## Folder structure

```text
Codesk_v2/
├── Doc/                         # approved paper and ERD; read-only
├── database/sql/                # authoritative ordered PostgreSQL scripts
├── backend/
│   ├── CoDesk.sln
│   ├── src/                     # Domain, Application, Infrastructure, API
│   └── tests/                   # unit and in-process integration tests
├── frontend/
│   ├── src/                     # API, auth, UI, pages, features, tests
│   └── tests/e2e/               # Playwright Demo Mode flows
├── docs/ai-context/             # continuation and decision records
├── docs/CHAPTER_4_EVIDENCE_GUIDE.md
├── AGENTS.md
└── README.md
```

## Prerequisites

- .NET SDK 10.0 or newer in the .NET 10 line.
- Node.js 22+ and npm 10+.
- PostgreSQL `psql` client 14+.
- A Supabase project named `codesk` for production/live testing.
- Optional: Chromium installed by Playwright for browser tests.

Verify the local tools:

```bash
dotnet --version
node --version
npm --version
psql --version
```

## Supabase database setup

1. Create or select the Supabase project `codesk`.
2. Copy its direct PostgreSQL or session-pooler connection string. Prefer the session pooler if the local network has no IPv6 route.
3. Set a shell variable without checking it into source control:

```bash
export CODESK_DATABASE_URL='postgresql://postgres.PROJECT_REF:PASSWORD@HOST:5432/postgres?sslmode=require'
cd "/Users/krissanap/Document/KMUTT/Short Paper/Codesk_v2"
```

4. Run the scripts in this exact order:

```bash
psql "$CODESK_DATABASE_URL" -v ON_ERROR_STOP=1 -f "database/sql/00_extensions_and_schema.sql"
psql "$CODESK_DATABASE_URL" -v ON_ERROR_STOP=1 -f "database/sql/01_create_tables.sql"
psql "$CODESK_DATABASE_URL" -v ON_ERROR_STOP=1 -f "database/sql/02_create_constraints_and_indexes.sql"
psql "$CODESK_DATABASE_URL" -v ON_ERROR_STOP=1 -f "database/sql/03_create_common_functions_and_triggers.sql"
psql "$CODESK_DATABASE_URL" -v ON_ERROR_STOP=1 -f "database/sql/04_create_booking_functions.sql"
psql "$CODESK_DATABASE_URL" -v ON_ERROR_STOP=1 -f "database/sql/05_create_rls_policies.sql"
psql "$CODESK_DATABASE_URL" -v ON_ERROR_STOP=1 -f "database/sql/06_create_reporting_views.sql"
psql "$CODESK_DATABASE_URL" -v ON_ERROR_STOP=1 -f "database/sql/07_seed_demo_data.sql"
psql "$CODESK_DATABASE_URL" -v ON_ERROR_STOP=1 -f "database/sql/08_database_smoke_tests.sql"
```

`08_database_smoke_tests.sql` runs inside a transaction and rolls back its temporary test records. `99_reset_development_database.sql` drops the entire schema and is for explicitly selected development databases only; it is never run automatically.

### Database schema

The schema is `co_desk` and has exactly these seven application tables:

1. `roles` — required roles and permission flags.
2. `departments` — active state, limited/unlimited mode, daily capacity, and the effective IANA business timezone.
3. `profiles` — one current department, one primary role, and an inherited display timezone per profile.
4. `holidays` — active/inactive business dates requiring booking acknowledgement.
5. `bookings` — half-open UTC-backed intervals, immutable stored business dates, status, and cancellation metadata.
6. `booking_audit_logs` — immutable create/update/cancel snapshots, booking-time business-timezone context, and request metadata.
7. `user_department_history` — closed and current department assignments.

There is no `department_capacity_policies`, employee, seat, office, room, or workspace table. No `__EFMigrationsHistory` table is created.

### Reporting views

- `co_desk.vw_daily_department_bookings`
- `co_desk.vw_department_capacity_utilization`
- `co_desk.vw_employee_booking_frequency`
- `co_desk.vw_holiday_bookings`
- `co_desk.vw_booking_cancellation_summary`

The views are not granted directly to Supabase's `authenticated` role. HR/admin access them through the authorized backend API.

## Backend configuration

Create the ignored local environment file:

```bash
cd "/Users/krissanap/Document/KMUTT/Short Paper/Codesk_v2"
cp "backend/.env.example" "backend/.env"
```

Edit `backend/.env`, then load it into the shell before starting .NET:

```bash
set -a
source "backend/.env"
set +a
```

Important variables:

| Variable | Purpose |
|---|---|
| `ConnectionStrings__CoDesk` | Server-only PostgreSQL connection string |
| `DemoMode__Enabled` | Enables the demo header only when `true` |
| `Supabase__Url` | Supabase project URL |
| `Supabase__JwtIssuer` | Usually `https://PROJECT_REF.supabase.co/auth/v1` |
| `Supabase__JwtAudience` | Normally `authenticated` |
| `Supabase__SecretKey` | Server-only Supabase Secret key for the Admin API; never expose to Vite |
| `Cors__AllowedOrigins__0` | Frontend origin, normally `http://localhost:5173` |

Build and test:

```bash
cd "/Users/krissanap/Document/KMUTT/Short Paper/Codesk_v2/backend"
dotnet restore
dotnet build "CoDesk.sln"
dotnet test "CoDesk.sln"
```

Run:

```bash
cd "/Users/krissanap/Document/KMUTT/Short Paper/Codesk_v2/backend"
set -a
source ".env"
set +a
dotnet run --project "src/CoDesk.Api/CoDesk.Api.csproj"
```

Default API: `http://localhost:5080`  
Swagger in Development: `http://localhost:5080/swagger`  
Health check: `http://localhost:5080/health`

## Frontend configuration

```bash
#ไม่ต้อง Run แล้ว ไม่งั้น Public Key จะหาย
cd "/Users/krissanap/Document/KMUTT/Short Paper/Codesk_v2"
cp "frontend/.env.example" "frontend/.env"
cd "frontend"
npm install
```

For Demo Mode, keep:

```dotenv
VITE_DEMO_MODE=true
VITE_API_BASE_URL=http://localhost:5080
```

For production auth, use `VITE_DEMO_MODE=false`, the Supabase project URL, and `VITE_SUPABASE_PUBLISHABLE_KEY`. Never put the Supabase Secret key in a `VITE_` variable.

Run the UI:

```bash
cd "/Users/krissanap/Document/KMUTT/Short Paper/Codesk_v2/frontend"
npm run dev
```

Default UI: `http://localhost:5173`

### UI language

CoDesk supports Thai and English throughout the frontend. Thai is the explicit first-visit default; browser-language detection is not used. The header switcher updates the current screen and `<html lang>` immediately, is available on desktop and mobile, and persists the choice in local storage under `codesk.language`. Language selection is display-only: it does not change role codes, authorization, database content, IANA timezone identifiers, or timezone-aware booking calculations.

Build and test:

```bash
cd "/Users/krissanap/Document/KMUTT/Short Paper/Codesk_v2/frontend"
npm run typecheck
npm run lint
npm run test
npm run build
```

Run Playwright after the database, backend, and frontend are running in Demo Mode:

```bash
cd "/Users/krissanap/Document/KMUTT/Short Paper/Codesk_v2/frontend"
npx playwright install chromium
npm run test:e2e
```

## Demo Mode

The selection screen reads three deterministic seeded profiles from the API:

- Employee: `30000000-0000-0000-0000-000000000003`
- HR: `30000000-0000-0000-0000-000000000002`
- Admin: `30000000-0000-0000-0000-000000000001`

React stores the selected UUID locally and sends it as `X-Demo-Profile-Id`. The backend accepts only the three allowlisted seeded profiles and only while `DemoMode:Enabled=true`. When disabled, the demo endpoint/header cannot authenticate a request. Use **สลับบทบาทสาธิต** to return to role selection.

## Production Supabase Auth

1. Run SQL scripts `00` through `06`. Seed script `07` is optional for a production tenant.
2. Set `DemoMode__Enabled=false`.
3. Configure the Supabase issuer/audience in the backend.
4. Configure the project URL and Publishable key in the frontend.
5. Create or reconcile an initial admin Auth user and `co_desk.profiles` row with the same UUID.
6. Start the backend and frontend using production environment settings.

React signs in with Supabase Auth, obtains the access token, and sends it as a Bearer token. ASP.NET validates it and resolves `co_desk.profiles`. Only `/api/admin/users` uses the server-side Supabase Secret key. If Auth creation succeeds but profile insertion fails, the backend attempts to delete the new Auth user and logs a reconciliation identifier if compensation also fails.

The API uses the issuer's OIDC discovery document and JWKS, so the Supabase project must use an asymmetric JWT signing key. The hosted project was migrated from the Legacy HS256 signer to ECC P-256 / ES256 on 2026-08-04. A newly issued access token was cryptographically verified against the published JWKS, and its issuer, `authenticated` audience, subject, expiry, and application profile were accepted by ASP.NET. Do not replace issuer/audience/lifetime validation with token decoding.

The unused legacy Supabase Edge Function `admin_create_user` was deleted. User creation remains `React -> POST /api/admin/users -> ASP.NET Core -> Supabase Admin API + co_desk.profiles`; the current architecture does not require or use an Edge Function for this flow.

The Supabase Dashboard may continue to show the old HS256 key as the Previous Legacy key. Do not revoke it until all old HS256 access tokens have expired and every active client has refreshed to an ES256 token. That later revocation is a manual Dashboard action and is not automated by CoDesk.

## API areas

- `/api/me`, `/api/demo/profiles`
- `/api/bookings`, `/api/bookings/validate`, `/api/bookings/{id}/cancel`
- `/api/calendar`
- `/api/departments`, `/api/departments/timezones`, `/api/profiles`, `/api/profiles/{id}/department-history`
- `/api/holidays`
- `/api/reports/{report-code}`
- `/api/admin/users`, `/api/admin/users/roles`
- `/api/bookings/{id}/audit` (admin)

Errors use ProblemDetails-compatible JSON and meaningful 400, 401, 403, 404, 409, and 503/500 statuses. Responses include `X-Request-ID`.

## Troubleshooting

- **401 in Demo Mode:** ensure both frontend `VITE_DEMO_MODE=true` and backend `DemoMode__Enabled=true`; reselect a demo role.
- **Database connection refused:** verify the Supabase host/port, SSL mode, firewall, and whether a pooler endpoint is required.
- **`btree_gist` permission error:** run script `00` as the Supabase database owner.
- **Duplicate/overlap 409:** cancel or move the existing active booking; cancelled bookings do not conflict.
- **Capacity 409:** choose another date/department or increase a limited department's capacity.
- **Holiday 409:** show the holiday dialog and resubmit with acknowledgement.
- **Invalid department timezone:** choose an exact value returned by `GET /api/departments/timezones`; PostgreSQL and the API both reject unsupported names.
- **Admin user creation 503:** configure the server-only Supabase URL and Secret key; Demo Mode intentionally does not fabricate Auth accounts.
- **Playwright browser missing:** run `npx playwright install chromium` inside `frontend/`.

## Security notes

- Secrets and `.env` files are ignored; only placeholder examples are committed.
- **Resolved credential incident:** an earlier audit found a backend credential in a stale frontend bundle. The local frontend now uses only `VITE_SUPABASE_PUBLISHABLE_KEY`, the backend uses only `Supabase__SecretKey`, the legacy JWT-based API keys are disabled, and the rebuilt bundle contains the Publishable key but no Secret key or legacy `service_role` credential.
- Demo identity headers are disabled outside explicit Demo Mode.
- The backend is the primary authorization boundary; RLS adds table-level defense in depth.
- Security-definer database functions set a safe `search_path`; critical booking/check functions are revoked from `PUBLIC`, `anon`, and `authenticated`, and write RPC actors are bound to request identity when a request context is present.
- Audit logs are immutable through a database trigger and unavailable in normal management UI.
- Report views are backend-only and not granted to browser-authenticated database users.
- Current `npm audit --omit=dev` reports three moderate vulnerable packages in the React Router dependency chain, covering protocol-relative/backslash redirect, open-redirect/XSS, and SSR-hydration constructor-injection advisories. CoDesk is a client-only SPA with fixed internal navigation and no React Router SSR hydration, which reduces exposure but does not remove the findings. The offered fix is the breaking React Router 7 migration and was not applied automatically; plan and test that migration separately.

## Chapter 4 evidence checklist

Use [docs/CHAPTER_4_EVIDENCE_GUIDE.md](docs/CHAPTER_4_EVIDENCE_GUIDE.md) for exact setup, screenshot order, demo dates, database evidence, and test-output capture. The seeded August/October 2026 records cover active, cross-day, cancelled, holiday, capacity, audit, history, and reporting cases.

## Current status and known limitations

The production-auth/RBAC baseline was independently verified against the hosted Supabase project on 2026-08-04. Complete multi-timezone support and Thai/English UI support were implemented and verified on isolated local stacks on 2026-08-09; this session did not modify or redeploy the hosted project.

- Department timezones are selected from PostgreSQL's IANA catalog and validated in both API and database layers. New profiles inherit their department timezone, transfers synchronize it, and later department timezone edits intentionally do not bulk-rewrite existing profiles or historical bookings.
- New and updated bookings use the target department's current timezone for normalization, capacity, and global-holiday matching. Stored booking business dates remain historical; the booking-time timezone is preserved in the existing immutable audit JSON without adding a table or column.
- Holiday definitions remain global across CoDesk; multi-timezone support does not introduce country-specific holiday calendars.
- Calendar timed events render in the signed-in profile timezone with FullCalendar fixed to UTC-shaped wall times, so the browser's own timezone cannot reinterpret them. Booking list/detail timestamps use the booking's historical business timezone.

- Ordered SQL scripts executed on a fresh PostgreSQL 14.21 database and again after population; the expanded rollback-only smoke suite passed both times.
- A two-session capacity race committed exactly one booking and rejected the second with `capacity_exceeded`.
- .NET solution built with zero warnings; 25 tests passed (11 unit + 14 in-process API tests).
- Frontend strict typecheck, lint, 39 component tests, and production build passed after the final audit fixes, including rejection of nonexistent New York spring-forward wall times.
- Seventeen Playwright journeys passed against the real temporary PostgreSQL + API + UI stack, including Thai default, two-way language switching, refresh persistence, unchanged RBAC/timezone behavior, mobile access, and department/employee/holiday management.
- Direct live API probes verified 400, 401, 403, 404, 409, duplicate preflight, and the expected unconfigured-Auth 503.
- NuGet reported no vulnerable packages; the current frontend audit retains three moderate React Router dependency-chain packages covering four advisories.
- The hosted project published two ECC P-256 / ES256 JWKS keys. A disposable real Auth login produced a valid ES256 signature and matching `kid`, issuer, `authenticated` audience, Auth subject, and active profile UUID; `GET /api/me` returned 200 with the database role and department.
- Admin user creation through `/api/admin/users` returned 201 and created matching `auth.users.id` / `co_desk.profiles.profile_id` values plus the initial department-history row. Duplicate email/code, inactive department, invalid role, and short password requests returned 409/400 as designed.
- Disposable employee, HR, and admin Auth users verified real UI menus and direct API boundaries. Hosted booking probes covered ownership, same-department calendar scope, admin cross-user booking, overlap, limited/unlimited capacity, holiday acknowledgement, audit access, and department history.
- Hosted catalog and privilege inspection returned exactly seven tables, five report views, RLS on all seven tables, no forbidden table, no browser-role execution of critical booking functions, and no browser-role access to reporting views. Normal-role and owner audit-tampering attempts were rejected.
- All disposable Auth identities were deleted, their retained audit/history profiles were inactive, their bookings were cancelled, and the temporarily changed limited capacity was restored. The real administrator was not modified.
- The final independent audit reran restore/install, backend and frontend builds, typecheck, lint, 25/25 xUnit tests, 39/39 Vitest tests, and the checked-in 17/17 Demo Mode Playwright suite against disposable PostgreSQL/API/UI ports.

Remaining manual evidence work:

- Preserve the verified Publishable/Secret key separation in all future environment and deployment configuration; never serve or redeploy the superseded credential-bearing bundle recorded by the historical audit.
- Capture the final Chapter 4 screenshots in the intended Supabase project without credentials, tokens, UUIDs, or real email addresses.
- Complete a connected-browser manual visual pass for English overflow at desktop/tablet/mobile when a browser-control instance is available; automated responsive flows passed, but the browser connector was unavailable during the bilingual implementation session.
- Apply and verify the multi-timezone SQL/API/UI release in the intended hosted environment only when deployment is explicitly authorized; no hosted data or secrets were touched in this implementation session.
- After all legacy HS256 tokens have expired and clients have refreshed, decide manually in the Supabase Dashboard whether to revoke the Previous Legacy key.

See [docs/VERIFICATION_AND_REQUIREMENT_MATRIX.md](docs/VERIFICATION_AND_REQUIREMENT_MATRIX.md) for the 108-row independent traceability matrix and [docs/ai-context/HANDOFF.md](docs/ai-context/HANDOFF.md) for the exact handoff state.
