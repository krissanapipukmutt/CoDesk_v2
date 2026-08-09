# Architecture

## Request flow

1. React selects a Demo profile or obtains a production Supabase session.
2. The centralized API client sends `X-Demo-Profile-Id` or a Bearer access token.
3. ASP.NET authenticates, resolves the active `co_desk.profiles` row, enriches role/department claims, and applies endpoint policies.
4. Controllers run application authorization rules for resource-specific ownership/department checks.
5. Npgsql performs queries or calls transactional booking functions. EF Core supplies explicit entity mappings without migrations.
6. PostgreSQL applies constraints, capacity locking, overlap protection, audit/history triggers, and RLS defense in depth.

## Backend modules

- Domain: table-shaped entities and stable role/mode/status constants.
- Application: API contracts, data/Auth service boundaries, and pure permission rules.
- Infrastructure: database connection/data service, report allowlists, EF mapping context, Supabase Admin HTTP client.
- API: Demo/JWT auth, correlation ID, ProblemDetails exception mapping, policies, REST controllers, Swagger.

## Frontend modules

- `api`: authentication-aware fetch and uniform API errors.
- `auth`/`demo`: Demo selection, production Supabase session, current profile.
- `features/bookings`: React Hook Form + Zod, validation warnings, holiday confirmation.
- `pages`: booking, calendar, department, employee/history, holiday, user/role, five reports.
- `components/ui`: reusable Tailwind/shadcn-style Button, Card, Dialog, feedback, pagination.
- `i18n`: centralized Thai/English resources, active-language persistence, document-language updates, and localized application-owned labels/messages; code, contracts, IANA identifiers, and database content remain unchanged.

Pages are lazy-loaded. FullCalendar/Recharts/Supabase are split from the initial bundle.
