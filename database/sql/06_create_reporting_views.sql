SET search_path = co_desk, public;

CREATE OR REPLACE VIEW co_desk.vw_daily_department_bookings AS
SELECT
    d.business_date,
    dep.department_id,
    dep.department_code,
    dep.department_name,
    COUNT(*)::integer AS active_booking_total
FROM co_desk.bookings b
JOIN co_desk.departments dep ON dep.department_id = b.department_id
JOIN LATERAL co_desk.booking_touched_dates(b.start_at, b.end_at, 'Asia/Bangkok') d ON true
WHERE b.status_code = 'booked'
GROUP BY d.business_date, dep.department_id, dep.department_code, dep.department_name;

CREATE OR REPLACE VIEW co_desk.vw_department_capacity_utilization AS
SELECT
    daily.business_date,
    dep.department_id,
    dep.department_code,
    dep.department_name,
    dep.capacity_mode,
    dep.default_capacity_per_day AS capacity_per_day,
    daily.active_booking_total AS booked_count,
    CASE WHEN dep.capacity_mode = 'limited'
         THEN GREATEST(dep.default_capacity_per_day - daily.active_booking_total, 0)
         ELSE NULL END AS remaining_capacity,
    CASE WHEN dep.capacity_mode = 'limited'
         THEN ROUND((daily.active_booking_total::numeric / dep.default_capacity_per_day) * 100, 2)
         ELSE NULL END AS utilization_percentage
FROM co_desk.vw_daily_department_bookings daily
JOIN co_desk.departments dep ON dep.department_id = daily.department_id;

CREATE OR REPLACE VIEW co_desk.vw_employee_booking_frequency AS
SELECT
    p.profile_id,
    p.employee_code,
    p.full_name,
    p.email,
    dep.department_id,
    dep.department_code,
    dep.department_name,
    COUNT(b.booking_id)::integer AS total_bookings,
    COUNT(b.booking_id) FILTER (WHERE b.status_code = 'booked')::integer AS active_bookings,
    COUNT(b.booking_id) FILTER (WHERE b.status_code = 'cancelled')::integer AS cancelled_bookings,
    MIN(b.booking_date_start) AS first_booking_date,
    MAX(b.booking_date_end) AS last_booking_date
FROM co_desk.profiles p
JOIN co_desk.departments dep ON dep.department_id = p.department_id
LEFT JOIN co_desk.bookings b ON b.booked_for_profile_id = p.profile_id
GROUP BY p.profile_id, p.employee_code, p.full_name, p.email,
         dep.department_id, dep.department_code, dep.department_name;

CREATE OR REPLACE VIEW co_desk.vw_holiday_bookings AS
SELECT
    h.holiday_id,
    h.holiday_date,
    h.holiday_name,
    b.booking_id,
    b.status_code,
    b.booking_mode,
    b.start_at,
    b.end_at,
    b.holiday_warning_acknowledged,
    p.profile_id,
    p.employee_code,
    p.full_name,
    dep.department_id,
    dep.department_code,
    dep.department_name
FROM co_desk.holidays h
JOIN co_desk.bookings b
  ON b.booking_date_start <= h.holiday_date
 AND b.booking_date_end >= h.holiday_date
JOIN co_desk.profiles p ON p.profile_id = b.booked_for_profile_id
JOIN co_desk.departments dep ON dep.department_id = b.department_id
WHERE h.is_active;

CREATE OR REPLACE VIEW co_desk.vw_booking_cancellation_summary AS
SELECT
    b.booking_id,
    (b.cancelled_at AT TIME ZONE 'Asia/Bangkok')::date AS cancellation_date,
    b.cancelled_at,
    p.profile_id,
    p.employee_code,
    p.full_name,
    dep.department_id,
    dep.department_code,
    dep.department_name,
    actor.profile_id AS cancelled_by_profile_id,
    actor.full_name AS cancelled_by_name,
    audit.action_reason,
    COUNT(*) OVER (PARTITION BY dep.department_id, (b.cancelled_at AT TIME ZONE 'Asia/Bangkok')::date)::integer AS department_daily_cancellation_total
FROM co_desk.bookings b
JOIN co_desk.profiles p ON p.profile_id = b.booked_for_profile_id
JOIN co_desk.departments dep ON dep.department_id = b.department_id
LEFT JOIN co_desk.profiles actor ON actor.profile_id = b.cancelled_by_profile_id
LEFT JOIN LATERAL (
    SELECT l.action_reason
    FROM co_desk.booking_audit_logs l
    WHERE l.booking_id = b.booking_id AND l.action_code = 'cancel'
    ORDER BY l.action_at DESC
    LIMIT 1
) audit ON true
WHERE b.status_code = 'cancelled';

-- Reports are intentionally not granted to Supabase's authenticated role. The backend
-- enforces HR/admin policies and queries these views through its server-only connection.
REVOKE ALL ON co_desk.vw_daily_department_bookings,
    co_desk.vw_department_capacity_utilization,
    co_desk.vw_employee_booking_frequency,
    co_desk.vw_holiday_bookings,
    co_desk.vw_booking_cancellation_summary FROM PUBLIC;
