# Role Permission Matrix

| Area | Employee | HR | Admin | Enforcement |
|---|---|---|---|---|
| Current profile | Own | Own | Own | authenticated `/api/me` |
| Create booking | Self | Self | Any active profile | controller rule + DB actor assertion |
| Edit/cancel | Own | Own | Any | controller rule + DB actor assertion |
| Booking list | Own | Own | All / filters | API query scope |
| Calendar | Same department | Same department | All | API query scope + RLS intent |
| Departments | Read active | CRUD/soft status/timezone | CRUD/soft status/timezone | unchanged policy + controller |
| Existing profiles | Same-dept read | Edit employee profiles; no roles | Edit all and roles | unchanged controller rules + timezone/history triggers |
| Department history | Own | All managed | All | controller + RLS |
| Holidays | Read active warnings/list | Read active only | CRUD/soft status | admin policy for writes |
| Reports | No | Yes | Yes | `Reports` policy + hidden menu |
| Auth user creation | No | No | Yes | `AdminOnly` + service abstraction |
| Booking audit UI/API | No | No | Yes | `AdminOnly` |

Inactive profiles fail the default active-profile claim requirement.

Multi-timezone support adds no permission. HR/admin department-edit rights already cover `effective_timezone`; profile timezone inheritance and transfer synchronization are database invariants, not a new independently editable user preference.
