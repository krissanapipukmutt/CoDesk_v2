# Verification and Requirement Matrix

Independent audit date: 2026-08-04 (Asia/Bangkok).

## Status rules and evidence

- **Verified** means the behavior was exercised against the implementation, not merely located in source.
- **Partially verified** means a meaningful portion was exercised but an external dependency or a remaining interaction was reviewed only statically.
- **Blocked** means the required hosted Supabase tenant or final evidence capture was unavailable.
- **Not implemented** and **Incorrect** are retained as allowed statuses; no requirement remains in either state after the corrective work recorded below.

Evidence labels used in the matrix:

- `DB-1`: PostgreSQL 14.21, fresh `codesk_final` database, scripts `00`-`08` executed with `ON_ERROR_STOP`; the same sequence passed again on the populated database. Script `08` rolled back its fixtures.
- `DB-2`: catalog inspection plus expanded `08_database_smoke_tests.sql`: seven tables, ERD columns/types/keys, constraints, triggers, functions, RLS flags/policies, five views, seed behavior, reports, audit, and history.
- `DB-3`: two concurrent PostgreSQL sessions with OPS capacity 1: the first transaction committed one booking; the waiting second call returned `capacity_exceeded`; active count was exactly 1 and the fixture was cancelled.
- `DB-4`: after defining local `anon`/`authenticated` roles, a forged direct call to the write RPC as `authenticated` was denied. Before the fix the same test created a booking, proving the defect and the correction.
- `BE-1`: `dotnet restore`, build (0 warnings/errors), 8 unit tests and 11 in-process API tests; 19/19 passed.
- `API-1`: direct calls to the live API/database verified 400, 401, 403, 404, 409 and 503 bodies; ownership, department, HR and admin boundaries; duplicate preflight; and invalid references.
- `FE-1`: strict typecheck, lint, 12 Vitest/RTL tests and production build all passed.
- `E2E-1`: 15/15 Playwright tests passed against Vite + live ASP.NET + PostgreSQL. No application-data mock was used.
- `SEC-1`: secret/config scan, `dotnet list package --vulnerable --include-transitive`, and `npm audit --omit=dev`.

## 1. Approved scope and technology

| ID | Requirement | Source | Frontend implementation | Backend implementation | Database object | Automated test | Manual verification | Status | Notes / corrective action |
|---|---|---|---|---|---|---|---|---|---|
| R-001 | Web application for reserving office attendance | Short Paper Ch.1, Ch.3.1 | `frontend/src/App.tsx`, `pages/BookingsPage.tsx` | `BookingsController.cs` | `co_desk.bookings` | `demo-mode.spec.ts` booking flows | E2E-1 created, read, edited and cancelled records | Verified | Actual API/database path used. |
| R-002 | React component-based frontend | Short Paper 2.3 | `frontend/src/**` | — | — | FE-1 | Production bundle inspected and run | Verified | React 19 + TypeScript strict. |
| R-003 | ASP.NET backend for business rules and database access | Short Paper 2.3 | `api/client.ts` | `backend/src/CoDesk.Api`, Application, Infrastructure | booking RPCs/views | BE-1, E2E-1 | Live API served all UI data | Verified | Four-project layering retained. |
| R-004 | Supabase PostgreSQL is the target database | Short Paper 2.1, 2.3 | — | Npgsql/EF Core configuration | PostgreSQL SQL `00`-`08` | DB-1, DB-2 | Compatible PostgreSQL 14 behavior passed locally | Partially verified | Hosted Supabase extensions, roles, grants and pooler remain blocked by missing tenant credentials. |
| R-005 | Supabase Auth provides production authentication | Short Paper 2.3 | `auth/supabase.ts`, `AuthContext.tsx` | JWT bearer and Supabase Admin service | UUID linkage to profiles | BE-1 | Production flow statically traced | Partially verified | No hosted token/Admin API was available. |
| R-006 | Application schema is `co_desk` | Short Paper 3.3, ERD | — | schema-qualified Npgsql/EF mappings | `co_desk` schema | DB-1, DB-2 | Catalog returned the schema | Verified | No application object was placed in `public`. |
| R-007 | Exactly seven approved application tables | Short Paper 3.3, ERD | — | seven EF entities/mappings | roles, departments, profiles, holidays, bookings, booking_audit_logs, user_department_history | `08_database_smoke_tests.sql` | DB-2 returned exactly seven base tables | Verified | Exact boundary asserted. |
| R-008 | No capacity-policy, employee, seat or other contradictory table | Approved ERD; audit baseline | — | — | catalog assertion | `08_database_smoke_tests.sql` | DB-2 found none | Verified | Capacity remains on departments. |
| R-009 | Relational integrity uses PK, FK, NOT NULL, UNIQUE and CHECK constraints | Short Paper 2.1 | — | exception mapping | `01`, `02` SQL | `08_database_smoke_tests.sql` | DB-2 exercised valid and invalid rows | Verified | Constraint checks are relation-scoped for reruns. |
| R-010 | `YYYY-MM-DD`, 24-hour time and `Asia/Bangkok` are system standards | Short Paper Ch.1, 3.1 | `utils/date.ts`, booking/calendar pages | contracts and Npgsql time handling | Bangkok normalization in RPCs/views | `BookingForm.test.tsx`, `demo-mode.spec.ts`, SQL smoke | FE-1/E2E-1/DB-2 showed local dates and cross-midnight handling | Verified | Date-only parsing was corrected to avoid browser timezone shifts. |

## 2. ERD entities, columns and relationships

| ID | Requirement | Source | Frontend implementation | Backend implementation | Database object | Automated test | Manual verification | Status | Notes / corrective action |
|---|---|---|---|---|---|---|---|---|---|
| R-011 | `roles` contains the ERD role identity, description, permission flags, system flag and timestamps | ERD `roles` | role types/admin page | `Role` mapping, roles endpoint | `co_desk.roles` | DB-2; BE-1 | Catalog and three seeded roles checked | Verified | PK UUID, unique code and timestamps match. |
| R-012 | `departments` contains code/name, capacity fields, activity, timezone, creator and timestamps | ERD `departments` | `DepartmentsPage.tsx` | department contracts/service/controller | `co_desk.departments` | DB-2, E2E-1 | Limited OPS and unlimited DIGI exercised | Verified | `capacity_mode` and `default_capacity_per_day` are here. |
| R-013 | `profiles` contains employee identity, email, one department, one role, activity, timezone and timestamps | ERD `profiles` | employees/admin/auth pages | profile contracts/mapping/service | `co_desk.profiles` | DB-2, API-1 | Duplicate and invalid-reference calls exercised | Verified | Auth UUID is the profile PK by design. |
| R-014 | `holidays` contains date/name/description/activity/creator/timestamps | ERD `holidays` | `HolidaysPage.tsx`, booking warning | holiday service/controller | `co_desk.holidays` | DB-2, E2E-1 | 2026-10-23 warning and acknowledgement exercised | Verified | Unique holiday date enforced. |
| R-015 | `bookings` contains all approved target/actor/department/mode/date/time/warning/status/note/cancellation/timestamp fields | ERD `bookings` | booking form/list/calendar | booking contracts/service/controller | `co_desk.bookings` | DB-2, FE-1, E2E-1 | Single-day and cross-day rows inspected through API/UI | Verified | Added checks tying stored Bangkok business dates to timestamps. |
| R-016 | `booking_audit_logs` contains approved booking, actor, action, snapshot and request metadata | ERD `booking_audit_logs` | admin audit access | audit DTO/service/controller | `co_desk.booking_audit_logs` | DB-2 | Create/update/cancel produced three immutable records | Verified | Update/delete tampering is rejected. |
| R-017 | `user_department_history` contains approved assignment dates, actor, note and timestamps | ERD `user_department_history` | employee history UI | history DTO/service/controller | `co_desk.user_department_history` | DB-2 | Department change closed old row and opened one row | Verified | Trigger uses Bangkok business date. |
| R-018 | One role has zero/many profiles; every profile has exactly one role | Short Paper 3.3.1 | profile role selector | FK mapping/validation | `profiles.role_id -> roles.role_id` | DB-2, API-1 | NULL/invalid role rejected | Verified | Admin-only role changes. |
| R-019 | One department has zero/many profiles; every profile has exactly one department | Short Paper 3.3.2 | employee department selector | mapping/validation | `profiles.department_id -> departments.department_id` | DB-2, API-1 | Missing department returned 400 | Verified | Inactive departments are also rejected for assignment. |
| R-020 | One profile can be target of many bookings; every booking has one target | Short Paper 3.3.3 | target selector | booking contracts/RPC call | `booked_for_profile_id` FK NOT NULL | DB-2, E2E-1 | Target-specific rows created | Verified | — |
| R-021 | One profile can create many bookings; every booking has one creator | Short Paper 3.3.4 | current/admin actor behavior | authenticated actor resolution | `booked_by_profile_id` FK NOT NULL | DB-2, E2E-1 | Actor persisted and authorization exercised | Verified | — |
| R-022 | A booking has zero/one canceller; a profile can cancel many bookings | Short Paper 3.3.5 | cancellation action | cancel endpoint/RPC | nullable `cancelled_by_profile_id` FK | DB-2, E2E-1 | Active then cancelled state inspected | Verified | Cancellation consistency check enforced. |
| R-023 | One department has zero/many bookings; every booking snapshots one department | Short Paper 3.3.6 | selected target department display | booking service | `bookings.department_id` FK NOT NULL | DB-2, E2E-1 | Admin DIGI target stored DIGI department | Verified | Prevents later profile moves rewriting old booking scope. |
| R-024 | One booking has zero/many audit rows; every audit row has one booking | Short Paper 3.3.7 | admin audit area | audit service/controller | `booking_audit_logs.booking_id` FK | DB-2 | Exact action count/assertions passed | Verified | Audit rows retained with booking. |
| R-025 | One profile can be actor for many audit rows; every audit row has one actor | Short Paper 3.3.8 | — | actor claims/RPC parameters | `actor_profile_id` FK NOT NULL | DB-2 | Actor and role snapshot checked | Verified | RPC actor is now bound to request context. |
| R-026 | One profile has zero/many department-history rows; every history row has one profile | Short Paper 3.3.9 | history panel | history service/controller | `history.profile_id` FK NOT NULL | DB-2 | Closed/open history assertion passed | Verified | — |
| R-027 | All foreign keys and nullability match the approved optional/required relationships | ERD; Short Paper 3.3.1-3.3.9 | — | EF mappings | `01_create_tables.sql`, `02_create_constraints_and_indexes.sql` | DB-2 | Catalog compared with ERD | Verified | Nullable creator bootstrap and canceller match ERD semantics. |
| R-028 | Duplicate employee code is rejected | Short Paper 2.1; ERD | admin/employee error state | duplicate preflight + 409 mapping | `ux_profiles_employee_code` | SQL smoke, BE-1 | Live duplicate admin request returned 409 before Auth call | Verified | Preflight was added during audit. |
| R-029 | Duplicate profile email is rejected | Short Paper 2.1; ERD | admin/employee error state | duplicate preflight + 409 mapping | `ux_profiles_email_lower` | SQL smoke, BE-1 | Case-insensitive duplicate exercised | Verified | — |
| R-030 | Limited department requires positive daily capacity | Ch.1, Ch.3.1; ERD | department validation | service validation | `ck_departments_capacity` | SQL smoke | Invalid limited rows rejected | Verified | — |
| R-031 | Unlimited department permits NULL capacity and is unrestricted | Ch.3.1; ERD | department form, booking UI | booking service | capacity check/RPC | SQL smoke, E2E-1 | Admin booking for DIGI succeeded | Verified | — |
| R-032 | Booking start precedes end and stored business dates are internally consistent | Ch.3.1; ERD | Zod/form validation | request validation/RPC mapping | booking checks | SQL smoke, FE-1 | Invalid range and inconsistent direct insert rejected | Verified | Bangkok consistency constraints added. |
| R-033 | Only one open history assignment may exist per profile | Historical traceability requirement; ERD | history display | profile update service | partial unique history index | SQL smoke | Second open assignment rejected | Verified | — |
| R-034 | `updated_at` is maintained on mutable tables | ERD timestamp columns | refreshed query state | EF/Npgsql updates | touch triggers | DB-2 | Trigger set inspected and update smoke passed | Verified | Trigger helpers are not public. |
| R-035 | Audit logs cannot be altered or deleted | Ch.2.1 retrospective inspection | — | no mutation endpoint | immutable audit trigger | SQL smoke | Direct update/delete both rejected | Verified | — |
| R-036 | RLS is enabled on all seven application tables | Short Paper 2.2 | — | request-context settings | `05_create_rls_policies.sql` | SQL smoke/catalog | Local flags/policies checked; forged write RPC denied | Partially verified | Policy behavior with real Supabase JWT claims remains a hosted check. |

## 3. Booking, capacity, holiday and reporting rules

| ID | Requirement | Source | Frontend implementation | Backend implementation | Database object | Automated test | Manual verification | Status | Notes / corrective action |
|---|---|---|---|---|---|---|---|---|---|
| R-037 | Single-day booking is supported | Ch.1, Ch.3.1 | `BookingForm.tsx` | booking endpoint/service | `create_booking` | FE-1, E2E-1, SQL smoke | Correct local date stored/displayed | Verified | Stored as Bangkok half-open midnight interval. |
| R-038 | Date/time-range and cross-day booking are supported | Ch.3.1 | range form | booking contracts/service | touched-date function/RPC | FE-1, E2E-1, SQL smoke | 2020-02-01 22:00–02-02 07:00 flow passed | Verified | — |
| R-039 | Past bookings are allowed | Ch.3.1 | no past-date minimum | no date prohibition | RPC | FE-1, E2E-1 | Past cross-day create/edit/cancel passed | Verified | — |
| R-040 | Future bookings have no arbitrary horizon | Ch.3.1 | native date/time inputs | no maximum-date rule | RPC | FE-1, E2E-1 | 2041/2042 fixtures succeeded | Verified | — |
| R-041 | Active overlap for one target is rejected | Ch.1, 2.1, 3.1 | clear conflict feedback | 409 mapping | GiST exclusion + conflict function | SQL smoke, E2E-1 | Seeded overlap returned visible rejection | Verified | Database constraint is final backstop. |
| R-042 | Cancelled booking does not block a new overlap | Ch.3.1 cancellation behavior | booking list/status | cancel endpoint | exclusion predicate excludes cancelled | SQL smoke | Cancel then overlapping create succeeded | Verified | Cancelled row remained. |
| R-043 | Department capacity is enforced per Bangkok calendar date | Ch.1, 2.1, 3.1 | visible capacity error | 409 mapping | `check_department_capacity` | SQL smoke, E2E-1 | Capacity fixture filled OPS and next booking failed | Verified | — |
| R-044 | Cross-day capacity is checked for every affected date | Ch.3.1 | cross-day form | RPC call | touched-date expansion | SQL smoke | Capacity on the second touched date rejected the range | Verified | Expanded smoke assertion added. |
| R-045 | Capacity is safe under concurrent requests | Ch.1/2.1 integrity objective | — | transactional RPC | department `FOR UPDATE` lock | DB-3 | Two sessions produced one active booking and one capacity rejection | Verified | Not based on frontend preflight. |
| R-046 | Holiday dates are detected across the touched interval | Ch.1, Ch.3.1 | holiday dialog | validation/RPC mapping | `check_booking_holidays` | SQL smoke, E2E-1 | 2026-10-23 detected | Verified | — |
| R-047 | Holiday booking requires explicit acknowledgement but remains possible | Ch.3.1 | confirmation dialog | acknowledgement contract | create/update RPC | SQL smoke, E2E-1 | First save warned; confirmed save succeeded | Verified | — |
| R-048 | Booking editing follows ownership/admin rules | Ch.3.1 | edit dialog/form | PUT authorization | `update_booking` | SQL smoke, E2E-1, BE-1 | Employee edited own range; cross-user calls forbidden | Verified | — |
| R-049 | Booking cancellation follows ownership/admin rules | Ch.3.1 | confirmation/cancel action | cancel authorization | `cancel_booking` | SQL smoke, E2E-1, BE-1 | Employee own and admin cleanup passed | Verified | — |
| R-050 | Create, update and cancel each produce an audit record | Ch.2.1 auditability; ERD | admin audit read | audit service | write RPCs + audit table | SQL smoke | Exact three-action sequence asserted | Verified | Assigned role/request metadata retained. |
| R-051 | Profile department change closes old history and opens new history | Ch.2.1 auditability; ERD | employee/history page | update profile service | history trigger | SQL smoke | Bangkok dates and one open row asserted | Verified | Creator is the actual admin actor after fix. |
| R-052 | Soft deletion preserves department/profile/holiday history | Ch.3.1 management and reporting | active toggles | update endpoints | `is_active` flags | SQL smoke, API-1 | No hard-delete endpoints; inactive filters reviewed | Verified | RLS hard-delete policies were removed. |
| R-053 | Five required reporting views return correct live values | Ch.3.1 reports | `ReportsPage.tsx` | report service/controller | five `vw_*` views | SQL smoke, E2E-1 | All tabs rendered database rows; view totals asserted | Verified | Cancelled rows included where applicable. |
| R-054 | Cancelled records remain reportable | Ch.1 transparency; Ch.3.1 reports | cancellation report | report endpoint | cancellation view/base booking | SQL smoke, E2E-1 | Cancelled seed/fixtures remained and appeared in source data | Verified | — |

## 4. Roles, Demo Mode and production authentication

| ID | Requirement | Source | Frontend implementation | Backend implementation | Database object | Automated test | Manual verification | Status | Notes / corrective action |
|---|---|---|---|---|---|---|---|---|---|
| R-055 | Employee, HR and admin are the three primary roles | Ch.1, 2.2 | role-aware navigation/copy | role constants/policies | seeded `roles` | BE-1, E2E-1 | Three role identities selected through UI | Verified | — |
| R-056 | Employee books only for self | Ch.3.1 RBAC scope | target fixed to current user | ownership rule/controller | actor assertion | BE-1, E2E-1 | Direct cross-target API returned 403 | Verified | UI hiding was not used as proof. |
| R-057 | Employee edits/cancels only own bookings | Ch.3.1 | buttons scoped to returned records | ownership authorization | actor assertion | BE-1, E2E-1 | Own flow passed; protected cross-resource calls forbidden | Verified | — |
| R-058 | Employee sees own/same-department calendar, not another department | Ch.3.1 | calendar | calendar query scope | booking RLS intent | BE-1, E2E-1 | Same-department booking 200; cross-department protected booking 403 | Verified | — |
| R-059 | Employee cannot access reports or management areas | Ch.1, 2.2; approved role decision | navigation/routes | policies/controllers | RLS defense | BE-1, E2E-1 | Direct report and department mutation calls returned 403 | Verified | — |
| R-060 | HR books/edits/cancels only for self | Ch.3.1; approved role matrix | target fixed | ownership rules | actor assertion | BE-1, E2E-1 | HR cross-role/user action probes forbidden | Verified | — |
| R-061 | HR sees same-department calendar | Ch.3.1 | calendar | calendar query scope | RLS intent | BE-1, E2E-1 | Role/API scope exercised | Verified | — |
| R-062 | HR manages departments | Ch.3.1; approved role matrix | departments page | `DepartmentManagement` policy | department policies | BE-1, E2E-1 | HR menu and authorized API path verified | Verified | Full CRUD interaction coverage is recorded separately at R-086. |
| R-063 | HR manages existing employee data and department assignments | Ch.3.1; approved role matrix | employees page | profile policy/rules | profile/history trigger | BE-1, API-1 | Employee-profile path permitted; protected identities restricted | Verified | — |
| R-064 | HR cannot create login users or assign/change roles | Ch.2.2; approved role decision | no user/role UI | AdminOnly + HR role guard | role/profile policies | BE-1, E2E-1 | Direct admin-user POST and role-changing PUT returned 403 | Verified | — |
| R-065 | HR can access reports, but not holiday management | Ch.3.1; approved role decision | reports visible, holidays hidden | Reports/AdminOnly policies | report views/holiday policies | BE-1, E2E-1 | Report 200; holiday mutation 403 | Verified | — |
| R-066 | Admin has all-department booking/calendar and may manage any booking | Ch.3.1, 2.2 | target selector/all calendar | admin authorization | admin RLS intent/RPC actor | BE-1, E2E-1 | Admin DIGI booking and global flows passed | Verified | — |
| R-067 | Admin manages departments, holidays, profiles, users and roles | Ch.1, Ch.3.1 | all management routes | AdminOnly/policies | management tables/RLS | BE-1, E2E-1 | Direct/API/menu boundaries verified | Verified | Hosted Auth creation is split out below. |
| R-068 | Admin user creation uses only the secure backend flow | Ch.3.1; production security decision | `AdminUsersPage.tsx` calls API | `AdminUsersController`, `SupabaseAdminService` | profile insert | BE-1, API-1 | Browser contains no Admin API call/service key; unique local request reached expected 503 | Partially verified | Hosted Admin API call is blocked. |
| R-069 | Demo Mode uses actual backend and database seeded identities | Audit execution requirement supporting Chapter 4 | demo selection/auth context | demo auth handler/controller | deterministic seed profiles | E2E-1 | All 12 tests used live data path | Verified | No frontend mock database exists. |
| R-070 | Demo role indicator and role switching work | Chapter 4 evidence requirement | layout/demo page | demo profiles endpoint | seed identities | E2E-1 | Indicator and employee-to-admin switch passed | Verified | — |
| R-071 | Demo header authenticates only when enabled and is allowlisted | Security requirement derived from RBAC | API client | `DemoAuthenticationHandler` | active seeded profiles | BE-1 | Enabled live stack worked; disabled-mode test returned 401/404 | Verified | No production header bypass. |
| R-072 | React uses Supabase only for login/session and sends Bearer tokens to ASP.NET | Short Paper 2.3 | `auth/supabase.ts`, `api/client.ts` | JWT bearer handler | — | FE-1 | Static call graph reviewed; Demo live path exercised | Partially verified | A real hosted session token was unavailable. |
| R-073 | ASP.NET validates issuer, audience, lifetime and resolves the active profile | Short Paper 2.2, 2.3 | — | `Program.cs`, `ProfileClaimsTransformation.cs` | profile query | BE-1 | Static options/claims flow reviewed | Partially verified | Requires hosted asymmetric signing-key/JWKS token test. |
| R-074 | Service-role credential stays server-side | Production security requirement | only public anon-key env | backend options/Admin service | — | SEC-1 | Source/env/secret scan found no frontend service-role credential | Verified | Placeholder appears only in server example/docs. |
| R-075 | Auth UUID and profile UUID match; duplicate checks and partial-failure compensation are safe | Approved user-management design | admin form | preflight, same UUID insert, Auth delete compensation | profile PK | BE-1 | In-process tests assert UUID equality and compensation; live duplicate returned 409 | Partially verified | Hosted Auth create/delete remains blocked. |
| R-076 | Hosted Supabase JWT login and Admin create/delete work end to end | Short Paper 2.3 | production login/admin UI | JWT/Admin service | hosted Auth + database | — | No tenant credentials supplied | Blocked | Follow exact hosted steps in README/Open Tasks. |
| R-077 | SQL/RLS/functions operate with hosted Supabase roles and pooler | Short Paper 2.1, 2.2 | — | connection settings | hosted Supabase PostgreSQL | — | Generic PostgreSQL is insufficient proof | Blocked | Run `00`-`08`, inspect grants/policies, and exercise real JWT claims. |

## 5. Frontend behavior, calendar, management and reports

| ID | Requirement | Source | Frontend implementation | Backend implementation | Database object | Automated test | Manual verification | Status | Notes / corrective action |
|---|---|---|---|---|---|---|---|---|---|
| R-078 | Thai is the default user-facing language | Ch.1 organizational UX | pages, `i18n/copy.ts` | localized business errors mapped by UI | — | FE-1, E2E-1 | All exercised routes displayed Thai labels/messages | Verified | Technical identifiers remain English. |
| R-079 | Desktop and 390×844 mobile layouts are usable | Web-app scope; Chapter 4 evidence | responsive layout/pages | — | — | E2E-1 | Desktop suite and mobile drawer flow passed | Verified | Backdrop interaction test was corrected to target its visible area. |
| R-080 | Forms expose labels, validation, loading, empty, warning, success and API-error states | Ch.3.1 usable booking/management | forms/pages/feedback components | ProblemDetails | — | FE-1, E2E-1 | Validation, warning, success and API errors exercised; code review covered loading/empty | Partially verified | Not every empty/loading branch has an isolated browser assertion. |
| R-081 | Employee/HR target themselves; admin defaults to self and can choose active target | Approved role behavior | `BookingForm.tsx` | target authorization | active profiles | FE-1, E2E-1 | Payload tests and admin real booking passed | Verified | — |
| R-082 | Selected target controls the booking department | ERD/department capacity semantics | department display | target lookup | profile/department snapshot | FE-1, E2E-1 | Admin DIGI target stored DIGI department | Verified | — |
| R-083 | Booking Save and Reset work | Ch.3.1 | booking form | POST endpoint | create RPC | FE-1, E2E-1 | Reset assertions and successful saves passed | Verified | Reset test coverage was added. |
| R-084 | Editing, cancellation and confirmations work in UI | Ch.3.1 | booking list/dialog | PUT/cancel endpoints | update/cancel RPC | E2E-1 | Full past cross-day UI flow passed | Verified | Booking cards gained stable accessible labels. |
| R-085 | Conflict, capacity and holiday failures are clear and actionable | Ch.1, Ch.3.1 | alerts/dialog | 409 code mapping | booking RPC details | E2E-1 | Three distinct live messages observed | Verified | Query failures no longer masquerade as empty lists. |
| R-086 | Department management supports create/edit/soft status and sorting | Ch.1, Ch.3.1 | `DepartmentsPage.tsx` | departments controller/service | departments | BE-1, FE-1, E2E-1 | Admin created an unlimited department, sorted, and soft-deactivated it in the UI | Verified | Interactive sorting and success feedback were added. |
| R-087 | Employee management supports edits, department moves and assignment history | Ch.1, Ch.3.1 | `EmployeesPage.tsx` | profiles/history endpoints | profiles/history | BE-1, DB-2, FE-1, E2E-1 | Admin moved EMP004, observed history, and restored the profile in the UI | Verified | Inactive departments are disabled in the selector. |
| R-088 | Holiday management supports create/edit/soft status and sorting | Ch.1, Ch.3.1 | `HolidaysPage.tsx` | holidays controller/service | holidays | BE-1, FE-1, E2E-1 | Admin created, sorted, and soft-deactivated a holiday in the UI | Verified | Booking-warning behavior is separately exercised. |
| R-089 | User/role page creates users and lists roles through backend only | Ch.1, Ch.3.1 | `AdminUsersPage.tsx` | admin users/roles endpoints | roles/profiles | BE-1, API-1 | Roles/list path and local error behavior verified | Partially verified | Creation success needs hosted Supabase. |
| R-090 | Monthly calendar supports previous, next and today | Ch.3.1 | `CalendarPage.tsx`/FullCalendar | calendar endpoint | bookings | E2E-1 | All three controls exercised | Verified | Production calendar now opens current month; Demo evidence stays August 2026. |
| R-091 | Calendar renders cross-day entries and permission-safe details/names | Ch.3.1 | calendar event/dialog | scoped calendar/detail endpoints | bookings | E2E-1, BE-1 | Seeded cross-day and detail dialog exercised; cross-department protected | Verified | — |
| R-092 | All five reports use backend/database views and preserve source tables | Ch.3.1 | five report tabs/table/chart | report service/controller | five views | SQL smoke, E2E-1 | All five tabs rendered actual rows | Verified | Values are not hardcoded. |
| R-093 | Report sorting and per-column filtering work | Ch.3.1 report utility | TanStack table/filter controls | allowlisted server filters/sorts | reporting views | E2E-1 | OPS column filter and date sort exercised | Verified | — |
| R-094 | Report pagination works | Ch.3.1 report utility | `Pagination.tsx`, report query state | paged report service | reporting views | BE-1, FE-1, API-1 | Live report request returned page 2, page size 1, total 7, and exactly one row | Verified | UI uses the same page contract. |
| R-095 | Date and department report filters work where applicable | Ch.3.1 reporting | report filter controls | allowlisted query filters | reporting views | BE-1, E2E-1, API-1 | Combined 2026-08-04 + OPS filter returned only the expected OPS row | Verified | Per-column UI filtering is also exercised. |
| R-096 | Capacity visualization does not replace the underlying table | Ch.3.1 reporting usefulness | Recharts + table | report endpoint | capacity view | E2E-1 | Capacity tab contained the table; chart source inspected | Verified | — |

## 6. Backend quality, security and verification controls

| ID | Requirement | Source | Frontend implementation | Backend implementation | Database object | Automated test | Manual verification | Status | Notes / corrective action |
|---|---|---|---|---|---|---|---|---|---|
| R-097 | .NET 10, Npgsql, EF Core, DI and Swagger/OpenAPI are configured | Short Paper 2.3; audit technical criteria | Swagger consumed manually | projects/`Program.cs`/Infrastructure DI | explicit mappings | BE-1 | Build and Development Swagger startup succeeded | Verified | No EF migrations create schema. |
| R-098 | Validation and ProblemDetails-compatible 400/404/409 errors are meaningful | Business-rule correctness | API error rendering | exception middleware/controllers | SQL error codes | BE-1, E2E-1 | Live 400, 404 and 409 bodies inspected | Verified | FK violations map to validation; duplicates to conflict. |
| R-099 | Unauthenticated and forbidden calls return 401/403 | Short Paper 2.2 | route/menu guards | authentication/policies/rules | RLS defense | BE-1, E2E-1 | Direct unauthorized calls returned expected codes | Verified | — |
| R-100 | Request correlation and structured logging are present | Auditability/security | API client receives request ID | correlation middleware/`ILogger` | audit request_id | BE-1, API-1 | `X-Request-ID`/ProblemDetails requestId observed | Verified | Sensitive credentials are not logged. |
| R-101 | Cancellation tokens flow through controllers/services | ASP.NET reliability criterion | query cancellation by library | controller/service signatures and calls | Npgsql async calls | BE-1 | Static call-chain review plus tests | Partially verified | No forced client-disconnect integration test. |
| R-102 | SQL input handling avoids injection and unsafe identifiers | Short Paper data integrity/security | encoded JSON/query params | parameterized Npgsql; report allowlists | fixed SQL/RPCs | BE-1, SEC-1 | Dynamic report identifiers traced to allowlists | Verified | No untrusted SQL concatenation found. |
| R-103 | SECURITY DEFINER functions have controlled search paths and safe privileges | Short Paper 2.2 defense in depth | — | server DB owner calls | booking/identity helpers | SQL smoke, DB-4 | Forged authenticated direct RPC changed from exploit to permission denied | Verified | Critical write/check helpers revoked from PUBLIC/anon/authenticated. |
| R-104 | CORS is explicit and configurable | Production web security | configured origin | named CORS policy | — | E2E-1 | Local frontend origin successfully called API | Verified | No wildcard credentials/origin. |
| R-105 | No committed secrets or insecure default database credentials | Security requirement | public anon placeholder only | empty required connection setting | — | SEC-1 | Ignored `.env.test` contained only Demo URL/flag; scan found no secret | Verified | Removed `postgres/postgres` fallback. |
| R-106 | Dependency audits have no unrecorded high-risk finding | Security requirement | npm dependencies | NuGet dependencies | — | SEC-1 | NuGet: none vulnerable; npm: two moderate router findings | Partially verified | Do not force the breaking v7 upgrade; advisory impact documented. |
| R-107 | Automated tests assert behavior against a real database/API/UI where supported | Audit QA requirement | Vitest + Playwright | xUnit/in-process tests | SQL smoke/live DB | DB-1, BE-1, FE-1, E2E-1 | Existing weak coverage was expanded from 4 to 15 real-stack journeys | Verified | In-process API tests still fake data, and are described honestly as such. |
| R-108 | Chapter 4 screenshots are captured from the intended project | Academic evidence requirement | all evidence screens exist | live Demo stack | seeded evidence data | E2E-1 | Exact steps are documented, but final captures were not requested/supplied | Blocked | Use `docs/CHAPTER_4_EVIDENCE_GUIDE.md`; never expose credentials. |

## Coverage calculation

The denominator is all 108 rows above, including external deployment/evidence requirements:

- Verified: 94 / 108 = **87.0% fully behavior-verified**.
- Partially verified: 11 / 108 = 10.2%.
- Blocked: 3 / 108 = 2.8%.
- Not implemented: 0. Incorrect: 0.
- Counting partial evidence at one-half gives **92.1% weighted verification coverage**: `(94 + 11/2) / 108`.

The three blocked rows are hosted Supabase Auth, hosted database/RLS compatibility, and final Chapter 4 screenshot capture. They are not represented as completed.

## Corrective actions completed during this audit

1. Revoked public/browser-role execution of critical security-definer booking RPCs and bound RPC actors to request context when provided.
2. Added Bangkok business-date/storage constraints, relation-scoped idempotency checks, safer trigger dates, write-helper privilege revocations, and insert/update-only RLS management policies.
3. Expanded rollback-only SQL smoke coverage to all required booking, audit, history, immutability and reporting behaviors.
4. Removed insecure connection defaults and required explicit server database configuration.
5. Added admin-profile duplicate/reference preflight, 409/400 mapping, actual-admin history attribution, same-UUID assertions, and Auth compensation tests.
6. Corrected frontend Bangkok/date-only behavior, production calendar month selection, production login/API error handling, inactive-department selection, management sorting/success states, and accessible booking identifiers.
7. Expanded Vitest from 8 to 12 and real-stack Playwright from 4 to 15 journeys, including management CRUD/soft-delete and assignment-history interactions.

Remaining work is limited to the Partially verified and Blocked notes above; it requires a real Supabase tenant or additional non-critical UI coverage.
