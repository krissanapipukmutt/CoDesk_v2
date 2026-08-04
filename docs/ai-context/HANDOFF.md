# Handoff

## Exact status

The complete CoDesk implementation is present and locally verified. No user-supplied source existed before this session; both approved PDFs are unchanged.

Works now:

- Exact seven-table SQL model and all ordered setup scripts.
- Booking conflict, capacity, holiday, update/cancel, audit, and history logic.
- Five queryable report views.
- Demo Mode through actual database/API identities with backend role checks.
- Production JWT validation and server-only Supabase Admin user workflow in source.
- All required Thai UI pages and responsive role menus.
- Local automated suites and real-stack browser flows.

Requires external configuration/testing:

- Hosted Supabase SQL/RLS execution.
- Real Supabase JWT login and Admin Auth API calls.
- Chapter 4 screenshot capture.

## Verified results

- PostgreSQL 14: scripts `00`–`08` succeeded; smoke suite completed and rolled back.
- .NET: build 0 warnings/errors; 16/16 tests passed.
- Frontend: strict typecheck passed; lint passed; 8/8 Vitest tests passed; production build passed.
- Playwright: 4/4 passed against real temporary PostgreSQL + API + UI.
- Dependency audit: no high/critical production finding after selecting React Router 6; two moderate advisories remain and are risk-documented in README/DECISIONS.

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

- No live Supabase credentials were available, so hosted Auth/Admin/RLS behavior is implemented but not claimed as executed.
- Admin user creation returns 503 in Demo Mode unless valid server Supabase credentials are intentionally supplied; it does not fabricate Auth users.
- React Router's two moderate audit advisories are documented; the app does not use their SSR/data-action paths or untrusted navigation targets.
- Temporary PostgreSQL data directories created under `/tmp/codesk-v2-*` may remain on the host after the stopped verification servers; they contain only disposable local test data.

