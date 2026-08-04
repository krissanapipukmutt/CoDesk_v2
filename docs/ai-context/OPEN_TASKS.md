# Open Tasks

Only unresolved external/follow-up work is listed:

- [ ] Execute SQL scripts `00`–`08` against the intended Supabase `codesk` project and capture hosted results.
- [ ] Confirm/migrate the Supabase project to an asymmetric JWT signing key, configure real Auth credentials, create/reconcile the initial admin UUID, and verify issuer/audience/lifetime validation with a real token.
- [ ] Test live Supabase Admin user creation plus compensation behavior using a disposable test account.
- [ ] Capture the Chapter 4 screenshots/evidence using `docs/CHAPTER_4_EVIDENCE_GUIDE.md`.
- [ ] Plan and test the breaking React Router 7 migration, then rerun `npm audit --omit=dev`; do not use `npm audit fix --force` without migration testing.
- [ ] Optional coverage hardening: add isolated browser assertions for every loading/empty-state branch and a forced client-disconnect cancellation test.
