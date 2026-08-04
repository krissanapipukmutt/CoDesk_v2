-- Fictional, deterministic data for Demo Mode and Chapter 4 evidence.
SET search_path = co_desk, public;

INSERT INTO co_desk.roles (
    role_id, role_code, role_name, role_description,
    can_manage_users, can_manage_departments, can_view_reports, is_system_role
) VALUES
    ('10000000-0000-0000-0000-000000000001', 'employee', 'Employee', 'General employee', false, false, false, true),
    ('10000000-0000-0000-0000-000000000002', 'hr', 'Human Resources', 'Manages departments and existing profiles', false, true, true, true),
    ('10000000-0000-0000-0000-000000000003', 'admin', 'Administrator', 'Full application administration', true, true, true, true)
ON CONFLICT (role_code) DO UPDATE SET
    role_name = EXCLUDED.role_name,
    role_description = EXCLUDED.role_description,
    can_manage_users = EXCLUDED.can_manage_users,
    can_manage_departments = EXCLUDED.can_manage_departments,
    can_view_reports = EXCLUDED.can_view_reports,
    is_system_role = EXCLUDED.is_system_role;

INSERT INTO co_desk.departments (
    department_id, department_code, department_name, capacity_mode,
    default_capacity_per_day, is_active, effective_timezone, created_by_profile_id
) VALUES
    ('20000000-0000-0000-0000-000000000001', 'OPS', 'ฝ่ายปฏิบัติการ', 'limited', 3, true, 'Asia/Bangkok', NULL),
    ('20000000-0000-0000-0000-000000000002', 'DIGI', 'ฝ่ายนวัตกรรมดิจิทัล', 'unlimited', NULL, true, 'Asia/Bangkok', NULL),
    ('20000000-0000-0000-0000-000000000003', 'FIN', 'ฝ่ายการเงิน', 'limited', 2, false, 'Asia/Bangkok', NULL)
ON CONFLICT (department_code) DO UPDATE SET
    department_name = EXCLUDED.department_name,
    capacity_mode = EXCLUDED.capacity_mode,
    default_capacity_per_day = EXCLUDED.default_capacity_per_day,
    is_active = EXCLUDED.is_active,
    effective_timezone = EXCLUDED.effective_timezone;

INSERT INTO co_desk.profiles (
    profile_id, employee_code, full_name, email, department_id, role_id, is_active, timezone_name
) VALUES
    ('30000000-0000-0000-0000-000000000001', 'ADM001', 'อริสา ผู้ดูแลระบบ', 'arisa.admin@example.test', '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003', true, 'Asia/Bangkok'),
    ('30000000-0000-0000-0000-000000000002', 'HR001', 'ปวีณา ฝ่ายบุคคล', 'paweena.hr@example.test', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', true, 'Asia/Bangkok'),
    ('30000000-0000-0000-0000-000000000003', 'EMP001', 'นนท์ พนักงานหนึ่ง', 'non.employee@example.test', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', true, 'Asia/Bangkok'),
    ('30000000-0000-0000-0000-000000000004', 'EMP002', 'มินตรา พนักงานสอง', 'mintra.employee@example.test', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', true, 'Asia/Bangkok'),
    ('30000000-0000-0000-0000-000000000005', 'EMP003', 'วายุ พนักงานสาม', 'wayu.employee@example.test', '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', true, 'Asia/Bangkok'),
    ('30000000-0000-0000-0000-000000000006', 'EMP004', 'ลลิน พนักงานสี่', 'lalin.employee@example.test', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', true, 'Asia/Bangkok')
ON CONFLICT (profile_id) DO UPDATE SET
    employee_code = EXCLUDED.employee_code,
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    department_id = EXCLUDED.department_id,
    role_id = EXCLUDED.role_id,
    is_active = EXCLUDED.is_active,
    timezone_name = EXCLUDED.timezone_name;

UPDATE co_desk.departments
SET created_by_profile_id = '30000000-0000-0000-0000-000000000001'
WHERE created_by_profile_id IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM co_desk.user_department_history
        WHERE profile_id = '30000000-0000-0000-0000-000000000005'
          AND assigned_end_date IS NOT NULL
    ) THEN
        UPDATE co_desk.user_department_history
        SET department_id = '20000000-0000-0000-0000-000000000001',
            assigned_start_date = DATE '2025-01-01',
            assigned_end_date = DATE '2025-12-31',
            note_text = 'Transferred to Digital Innovation'
        WHERE profile_id = '30000000-0000-0000-0000-000000000005'
          AND assigned_end_date IS NULL;

        INSERT INTO co_desk.user_department_history (
            history_id, profile_id, department_id, assigned_start_date,
            assigned_by_profile_id, note_text
        ) VALUES (
            '60000000-0000-0000-0000-000000000005',
            '30000000-0000-0000-0000-000000000005',
            '20000000-0000-0000-0000-000000000002',
            DATE '2026-01-01',
            '30000000-0000-0000-0000-000000000001',
            'Current Digital Innovation assignment'
        );
    END IF;
END $$;

INSERT INTO co_desk.holidays (
    holiday_id, holiday_date, holiday_name, holiday_description, is_active, created_by_profile_id
) VALUES
    ('70000000-0000-0000-0000-000000000001', DATE '2026-08-12', 'วันแม่แห่งชาติ', 'Active demo holiday requiring acknowledgement', true, '30000000-0000-0000-0000-000000000001'),
    ('70000000-0000-0000-0000-000000000002', DATE '2026-10-23', 'วันปิยมหาราช', 'Active demo holiday', true, '30000000-0000-0000-0000-000000000001'),
    ('70000000-0000-0000-0000-000000000003', DATE '2026-05-01', 'วันแรงงาน (ปิดใช้งาน)', 'Inactive holiday for management demonstration', false, '30000000-0000-0000-0000-000000000001')
ON CONFLICT (holiday_date) DO UPDATE SET
    holiday_name = EXCLUDED.holiday_name,
    holiday_description = EXCLUDED.holiday_description,
    is_active = EXCLUDED.is_active,
    created_by_profile_id = EXCLUDED.created_by_profile_id;

INSERT INTO co_desk.bookings (
    booking_id, booked_for_profile_id, booked_by_profile_id, department_id,
    booking_mode, booking_date_start, booking_date_end, start_at, end_at,
    holiday_warning_acknowledged, status_code, note_text, cancelled_at, cancelled_by_profile_id,
    created_at, updated_at
) VALUES
    ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001',
     'single_day', DATE '2026-08-04', DATE '2026-08-04', TIMESTAMPTZ '2026-08-04 00:00:00+07', TIMESTAMPTZ '2026-08-05 00:00:00+07', false, 'booked', 'ประชุมทีมประจำสัปดาห์', NULL, NULL, TIMESTAMPTZ '2026-08-01 09:00:00+07', TIMESTAMPTZ '2026-08-01 09:00:00+07'),
    ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001',
     'date_time_range', DATE '2026-08-05', DATE '2026-08-05', TIMESTAMPTZ '2026-08-05 09:00:00+07', TIMESTAMPTZ '2026-08-05 17:00:00+07', false, 'booked', 'สัมภาษณ์ผู้สมัคร', NULL, NULL, TIMESTAMPTZ '2026-08-01 09:15:00+07', TIMESTAMPTZ '2026-08-01 09:15:00+07'),
    ('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001',
     'date_time_range', DATE '2026-08-06', DATE '2026-08-07', TIMESTAMPTZ '2026-08-06 22:00:00+07', TIMESTAMPTZ '2026-08-07 06:00:00+07', false, 'booked', 'ทดสอบระบบข้ามคืน', NULL, NULL, TIMESTAMPTZ '2026-08-01 09:30:00+07', TIMESTAMPTZ '2026-08-01 09:30:00+07'),
    ('40000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000002',
     'single_day', DATE '2026-08-04', DATE '2026-08-04', TIMESTAMPTZ '2026-08-04 00:00:00+07', TIMESTAMPTZ '2026-08-05 00:00:00+07', false, 'cancelled', 'ยกเลิกเพื่อทดสอบรายงาน', TIMESTAMPTZ '2026-08-02 10:00:00+07', '30000000-0000-0000-0000-000000000005', TIMESTAMPTZ '2026-08-01 10:00:00+07', TIMESTAMPTZ '2026-08-02 10:00:00+07'),
    ('40000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001',
     'single_day', DATE '2026-08-12', DATE '2026-08-12', TIMESTAMPTZ '2026-08-12 00:00:00+07', TIMESTAMPTZ '2026-08-13 00:00:00+07', true, 'booked', 'ยืนยันการเข้าทำงานในวันหยุด', NULL, NULL, TIMESTAMPTZ '2026-08-02 11:00:00+07', TIMESTAMPTZ '2026-08-02 11:00:00+07'),
    ('40000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
     'single_day', DATE '2026-08-08', DATE '2026-08-08', TIMESTAMPTZ '2026-08-08 00:00:00+07', TIMESTAMPTZ '2026-08-09 00:00:00+07', false, 'booked', 'ผู้ดูแลระบบจองให้พนักงาน', NULL, NULL, TIMESTAMPTZ '2026-08-02 11:30:00+07', TIMESTAMPTZ '2026-08-02 11:30:00+07')
ON CONFLICT (booking_id) DO NOTHING;

INSERT INTO co_desk.booking_audit_logs (
    audit_log_id, booking_id, action_code, actor_profile_id, actor_role_code,
    action_reason, old_values_json, new_values_json, action_at, request_id, ip_address, user_agent
)
SELECT
    ('50000000-0000-0000-0000-' || lpad(row_number() OVER (ORDER BY b.booking_id)::text, 12, '0'))::uuid,
    b.booking_id,
    'create',
    b.booked_by_profile_id,
    r.role_code,
    'Demo seed booking created',
    NULL,
    to_jsonb(b),
    b.created_at,
    'demo-seed-create-' || right(b.booking_id::text, 4),
    '127.0.0.1'::inet,
    'CoDesk demo seed'
FROM co_desk.bookings b
JOIN co_desk.profiles p ON p.profile_id = b.booked_by_profile_id
JOIN co_desk.roles r ON r.role_id = p.role_id
WHERE b.booking_id::text LIKE '40000000-%'
ON CONFLICT (audit_log_id) DO NOTHING;

INSERT INTO co_desk.booking_audit_logs (
    audit_log_id, booking_id, action_code, actor_profile_id, actor_role_code,
    action_reason, old_values_json, new_values_json, action_at, request_id, ip_address, user_agent
) VALUES (
    '51000000-0000-0000-0000-000000000004',
    '40000000-0000-0000-0000-000000000004',
    'cancel',
    '30000000-0000-0000-0000-000000000005',
    'employee',
    'Changed work plan',
    jsonb_build_object('status_code', 'booked'),
    jsonb_build_object('status_code', 'cancelled'),
    TIMESTAMPTZ '2026-08-02 10:00:00+07',
    'demo-seed-cancel-0004',
    '127.0.0.1'::inet,
    'CoDesk demo seed'
)
ON CONFLICT (audit_log_id) DO NOTHING;

