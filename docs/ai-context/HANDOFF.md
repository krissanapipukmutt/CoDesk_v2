# Handoff

## Exact status — independent audit plus hosted verification 2026-08-04

The CoDesk implementation is present, independently reviewed from the approved PDFs and source, corrected, locally reverified, and exercised against the intended hosted Supabase project. Both approved PDFs are unchanged and retain their recorded SHA-256 hashes.

Works now:

- Exact seven-table SQL model and all ordered setup scripts.
- Booking conflict, capacity, holiday, update/cancel, audit, and history logic.
- Five queryable report views.
- Demo Mode through actual database/API identities with backend role checks.
- Production JWT validation with ECC P-256 / ES256, published JWKS, and server-only Supabase Admin user creation through ASP.NET, verified on the hosted project.
- All required Thai UI pages and responsive role menus.
- Local automated suites and real-stack browser flows.

Remaining manual work is Chapter 4 screenshot capture and, only after all old HS256 tokens expire, a later Dashboard decision about the Previous Legacy key.

## Verified results

- PostgreSQL 14.21: scripts `00`–`08` succeeded on a fresh database and again after population; the expanded smoke suite completed and rolled back both times.
- Concurrency: two transactions contending on OPS capacity 1 produced one active booking and one structured `capacity_exceeded` result; the fixture was cancelled and capacity restored.
- Database privilege regression: a forged `authenticated` write-RPC call that succeeded before the fix now returns permission denied.
- .NET: build 0 warnings/errors; 19/19 tests passed (8 unit + 11 in-process API tests).
- Frontend: strict typecheck and lint passed; 12/12 Vitest tests passed; production build passed.
- Playwright: 15/15 passed against a real PostgreSQL + API + UI stack, including live department/employee/holiday management.
- Direct API: 400, 401, 403, 404, 409 and expected unconfigured-Auth 503 responses were observed with structured bodies.
- Production configuration: backend/frontend Demo Mode disabled; project URL aligned; issuer/audience correct; server credential backend-only; frontend public credential only.
- Hosted OIDC/JWKS: two published ECC P-256 / ES256 keys. A newly issued access token had `alg=ES256`, a published `kid`, a valid signature, the configured issuer, `authenticated` audience, and a subject matching both Supabase Auth and the active `co_desk.profiles` UUID.
- Hosted `/api/me`: 200 with role, department, active status, and profile UUID matching the database.
- Hosted Admin user creation: 201 through `/api/admin/users`; matching Auth/profile UUID; correct fields and initial history; duplicate email/code returned 409; inactive department, invalid role, and short password returned 400.
- Real Auth RBAC: employee, HR, and admin menus and direct API boundaries passed. Booking probes covered self/cross-user authorization, calendar scope, reports/management, overlap, limited/unlimited capacity, holiday acknowledgement, audit access, and department history.
- Hosted security: exactly seven tables, five views, RLS on all seven, no forbidden table, critical functions denied to public/browser roles, report views denied to browser roles, and audit mutation rejected.
- Cleanup: disposable Auth identities deleted, retained profiles inactive, bookings cancelled, limited capacity restored, and the real administrator untouched.
- Dependency audit: NuGet found no vulnerable package. npm retains two moderate React Router package findings; the breaking v7 migration was intentionally not forced.
- Requirement matrix: 103/108 Verified (95.4%), 4 Partially verified, 1 Blocked; weighted verification coverage 97.2%.

## Run

Follow the exact commands in `README.md`. In brief:

```bash
cd "/Users/krissanap/Document/KMUTT/Short Paper/Codesk_v2"
export CODESK_DATABASE_URL='your Supabase PostgreSQL URL'
# Execute database/sql/00 through 08 in order with psql.

cp "backend/.env.example" "backend/.env"
cp "frontend/.env.example" "frontend/.env"

cd "backend"
set -a; source ".env"; set +a
dotnet run --project "src/CoDesk.Api/CoDesk.Api.csproj"

# In another terminal:
cd "/Users/krissanap/Document/KMUTT/Short Paper/Codesk_v2/frontend"
npm install
npm run dev
```

API/Swagger: `http://localhost:5080` / `http://localhost:5080/swagger`  
Frontend: `http://localhost:5173`

## Test

```bash
cd "/Users/krissanap/Document/KMUTT/Short Paper/Codesk_v2/backend"
dotnet restore
dotnet build "CoDesk.sln"
dotnet test "CoDesk.sln"

cd "/Users/krissanap/Document/KMUTT/Short Paper/Codesk_v2/frontend"
npm install
npm run typecheck
npm run lint
npm run test
npm run build
# With Demo database/API/UI running:
npm run test:e2e
```

## Important cautions

- Never execute `99_reset_development_database.sql` against an unidentified or production database.
- Never put the service-role key in frontend environment files.
- Do not generate EF migrations or modify files under `Doc/`.
- Preserve the exact table/column names and update SQL, API contracts, UI types, tests, and docs together.

## Known limitations

- Final Chapter 4 screenshots have not been captured. Follow `docs/CHAPTER_4_EVIDENCE_GUIDE.md` and exclude tokens, credentials, UUIDs, and real email addresses.
- The Supabase project has migrated from Legacy HS256 to ECC P-256 / ES256. Do not revoke the Previous Legacy key until old tokens have expired and all active clients have refreshed; any later revocation is manual.
- Admin user creation returns 503 in Demo Mode unless valid server Supabase credentials are intentionally supplied; it does not fabricate Auth users.
- React Router's two moderate package findings are documented; the app does not use SSR hydration or untrusted navigation targets, but a planned breaking upgrade remains open.
- Some loading/empty-state branches and forced client cancellation remain partially rather than fully exercised. Hosted compensation fault injection remains staging-only; its in-process test coverage passed.
- The stopped audit PostgreSQL data directory under `/tmp/codesk-audit-pg.*` may remain on the host; it contains only disposable local test data.
