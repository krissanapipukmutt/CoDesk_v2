# CoDesk Repository Guidance

- Treat every file under `Doc/` as approved, read-only source material.
- Keep application identifiers and database objects in English; user-facing UI defaults to Thai.
- The only application tables are the seven approved tables in schema `co_desk`.
- SQL scripts under `database/sql/` are authoritative. Do not create or run EF Core migrations.
- Never commit credentials. Use the checked-in `.env.example` and backend example settings only.
- Use Asia/Bangkok for business dates and UTC-backed `timestamptz` values for instants.
- Run frontend and backend build/test commands before marking work complete.

