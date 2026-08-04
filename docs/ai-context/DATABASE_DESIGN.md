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
- Partial unique index allowing one open department assignment per profile.
- Partial GiST exclusion constraint preventing active overlap per target profile.
- Foreign-key indexes and active/report query indexes.
- Reusable `updated_at`, history, system-role deletion, and audit immutability triggers.

## Booking transaction

`create_booking`, `update_booking`, and `cancel_booking` are security-definer PL/pgSQL functions with a safe search path. Create/update:

1. Validate active actor/target and self-vs-admin rule.
2. Normalize the Bangkok interval/business dates.
3. Lock the target department row.
4. Check every touched holiday.
5. Check employee overlap using strict half-open conditions.
6. Check projected daily department totals, excluding the updated row.
7. Write the booking and audit log atomically.

The exclusion constraint is a final concurrency backstop for employee overlap.

## Reports and RLS

The five views expand touched days or aggregate the approved tables only. RLS policies cover all seven tables for self/department/admin visibility and HR/admin management. Report views are backend-only to avoid owner-view bypass on PostgreSQL 14-compatible view definitions.

