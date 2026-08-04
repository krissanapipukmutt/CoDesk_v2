# Open Tasks

Only unresolved external/follow-up work is listed:

- [ ] Capture the Chapter 4 screenshots/evidence using `docs/CHAPTER_4_EVIDENCE_GUIDE.md`.
- [ ] After all old HS256 access tokens have expired and every active client has refreshed to ES256, decide whether to revoke the Previous Legacy key manually in the Supabase Dashboard. Do not automate rotation or revocation.
- [ ] Plan and test the breaking React Router 7 migration, then rerun `npm audit --omit=dev`; do not use `npm audit fix --force` without migration testing.
- [ ] Optional coverage hardening: add isolated browser assertions for every loading/empty-state branch and a forced client-disconnect cancellation test.
- [ ] Optional staging-only fault injection: force profile insertion to fail after Auth creation and observe hosted compensation. The compensation branch is already covered by in-process tests; do not inject this failure into production.
