# Database Design

## Tables and relationships

- One role has many profiles; every profile has one role.
- One department has many profiles and bookings; every profile/booking has one department.
- A profile can be booking target, creator, canceller, audit actor, department-history subject, or assignment actor.
- One booking has many immutable audit records.
- Holidays have no booking foreign key; dates are joined logically over the booking's touched range.

Circular bootstrap is safe: departments are created with nullable creator, profiles are inserted, then department creator IDs are set.

## Integrity

- UUID primary keys and deterministic UUIDs for demo fixtures.
- Unique role/department/employee/email/holiday business keys.
- Checks for capacity mode, booking mode/status/dates/cancellation state, audit action, and history dates.
- Triggers validate department/profile IANA names, inherit the department timezone on profile creation/transfer, and ensure booking business dates and single-day boundaries match the booking department's effective timezone at write time.
- Partial unique index allowing one open department assignment per profile.
- Partial GiST exclusion constraint preventing active overlap per target profile.
- Foreign-key indexes and active/report query indexes.
- Reusable `updated_at`, history, system-role deletion, and audit immutability triggers.

## Booking transaction

`create_booking`, `update_booking`, and `cancel_booking` are security-definer PL/pgSQL functions with a safe search path. They are private to the backend database principal: execution is revoked from `PUBLIC`, `anon`, and `authenticated`. When a request-context profile/JWT subject is present, it must match the supplied actor. Create/update:

1. Validate active actor/target and self-vs-admin rule.
2. Load the target department's validated effective timezone and normalize the interval/business dates in that timezone.
3. Lock the target department row.
4. Check every department-local touched date against the global holiday calendar.
5. Check employee overlap using strict half-open conditions.
6. Check projected daily department totals, excluding the updated row.
7. Write the booking and audit log atomically.

The exclusion constraint is a final concurrency backstop for employee overlap. A department-row `FOR UPDATE` lock serializes capacity decisions; an independent two-session audit confirmed that concurrent requests cannot both consume the last place. Create/update audit JSON also records `business_timezone`, and cancel audit JSON records its department-local cancellation date. These snapshots preserve historical interpretation without adding an unapproved table or column. A later department timezone edit therefore does not rewrite existing profile timezones or persisted booking dates.

## Reports and RLS

The five views expand persisted booking business dates or aggregate the approved tables only, so later department timezone edits cannot shift historical report dates. Cancellation reports use the immutable cancellation-local-date audit value, with an explicit Asia/Bangkok fallback only for legacy rows created before timezone snapshots existed. RLS policies cover all seven tables for self/department/admin visibility and HR/admin insert/update management; business records are soft-deleted, so no management delete policies are granted. Report views are backend-only to avoid owner-view bypass on PostgreSQL 14-compatible view definitions. The 2026-08-04 hosted role/JWT baseline passed; the 2026-08-09 multi-timezone release still requires an explicitly authorized hosted deployment/regression pass.
