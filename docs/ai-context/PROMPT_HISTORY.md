# Prompt History

## 2026-08-03 — complete CoDesk implementation

The user requested one continuous implementation run by a senior full-stack/database/security/QA/documentation engineer. The request required:

- Inspect and preserve the approved Chapter 1–3 paper and ERD in `Doc/`.
- Build CoDesk with React/TypeScript/Vite/Tailwind/shadcn-style components and a .NET 10 ASP.NET Core/Npgsql/EF Core API.
- Use Supabase PostgreSQL schema `co_desk` and exactly seven approved tables.
- Implement SQL-authoritative constraints, overlap exclusion, concurrency-safe capacity, holidays, transactional booking RPCs, audit/history triggers, RLS, five reporting views, seed data, and smoke tests.
- Support Demo Mode roles via real seeded profiles and production Supabase Auth/JWT plus secure admin user creation.
- Enforce exact employee, HR, and admin permissions in backend and frontend.
- Deliver booking, calendar, department, employee, holiday, user/role, and report screens in Thai.
- Add xUnit, Vitest/RTL, and practical Playwright tests; run supported builds/tests and never fabricate outcomes.
- Create a beginner-usable README, all required `docs/ai-context` files, and a Chapter 4 evidence guide.
- Continue through planning, implementation, debugging, verification, and documentation without stopping for phase approval.

The full original prompt was supplied as an attachment outside the repository. This summary is faithful but avoids duplicating the very long execution prompt verbatim.

