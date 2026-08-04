# Chapter 4 Evidence Guide

## Preparation

1. Execute database scripts `00` through `08` in order.
2. Start the backend at `http://localhost:5080` with Demo Mode enabled.
3. Start the frontend at `http://localhost:5173` with `VITE_DEMO_MODE=true`.
4. Set the browser viewport to 1440×900 for desktop screenshots and 390×844 for a mobile example.
5. Keep database credentials, browser tokens, and service-role keys outside every screenshot.

The seed is centered on August 2026. In the calendar, navigate to August 2026 if it is not already visible.

## UI screenshot checklist

- [ ] Demo Role Selection showing Employee, HR, and Admin cards.
- [ ] Employee menu: overview, booking, calendar; no reports or management menus.
- [ ] HR menu: departments, employees, reports; no holidays or user creation.
- [ ] Admin menu: every menu including holidays and users/roles.
- [ ] Single-day form with one local date and department display.
- [ ] Date/time-range form with 24-hour start/end fields and a cross-day range.
- [ ] Successful single-day booking confirmation.
- [ ] Overlapping booking rejection. Use EMP001 on `2026-08-04`, which overlaps seeded booking `400…001`.
- [ ] Capacity rejection. Temporarily set OPS capacity to 1 in Department Management, then attempt another booking on a date already occupied; restore capacity to 3 afterward.
- [ ] Unlimited capacity success using a DIGI employee/admin target.
- [ ] Holiday warning on `2026-10-23`, followed by explicit confirmation and success.
- [ ] Monthly calendar in August 2026 showing all-day, range, and cross-day events.
- [ ] Employee same-department names visible; DIGI records absent from employee view.
- [ ] Admin calendar showing all departments.
- [ ] Department management table and limited/unlimited edit dialog.
- [ ] Employee management edit dialog and department-history section.
- [ ] Holiday management including the inactive record.
- [ ] Admin user creation form; do not submit unless production Supabase credentials are configured.
- [ ] Each of the five report tabs with actual rows.
- [ ] A per-column report filter, such as `OPS` in the department-code filter.
- [ ] Capacity chart plus the unchanged full source table.
- [ ] Responsive mobile navigation and one booking screen.

## Supabase/database evidence checklist

Capture the Supabase Table Editor or SQL results without connection strings:

- [ ] Exactly seven `co_desk` base tables.
- [ ] No `co_desk.department_capacity_policies` table.
- [ ] Five `co_desk.vw_*` reporting views.
- [ ] Three role rows: employee, HR, admin.
- [ ] Active and cancelled bookings.
- [ ] An acknowledged holiday booking.
- [ ] `booking_audit_logs` create and cancel rows with JSON snapshots.
- [ ] `user_department_history` closed and open rows for EMP003.
- [ ] RLS enabled on all seven tables.
- [ ] `ex_bookings_no_active_overlap` exclusion constraint.

Suggested read-only SQL:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'co_desk' AND table_type = 'BASE TABLE'
ORDER BY table_name;

SELECT viewname FROM pg_views WHERE schemaname = 'co_desk' ORDER BY viewname;

SELECT booking_id, action_code, actor_role_code, action_at, old_values_json, new_values_json
FROM co_desk.booking_audit_logs ORDER BY action_at DESC LIMIT 10;

SELECT p.employee_code, h.department_id, h.assigned_start_date, h.assigned_end_date
FROM co_desk.user_department_history h
JOIN co_desk.profiles p ON p.profile_id = h.profile_id
ORDER BY p.employee_code, h.assigned_start_date;
```

## Build and test evidence

Capture the final summaries from:

```bash
cd "/Users/krissanap/Document/KMUTT/Short Paper/Codesk_v2/backend"
dotnet build "CoDesk.sln"
dotnet test "CoDesk.sln"

cd "/Users/krissanap/Document/KMUTT/Short Paper/Codesk_v2/frontend"
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:e2e
```

Expected local verified totals from the implementation session:

- xUnit: 16 passed (8 unit + 8 API integration).
- Vitest/RTL: 8 passed.
- Playwright: 4 passed against the real temporary database/API/UI stack.
- SQL smoke script: completed and rolled back without errors.

