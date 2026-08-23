SET search_path = co_desk, public;

CREATE OR REPLACE FUNCTION co_desk.current_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = co_desk, pg_temp
AS $$
    SELECT COALESCE(
        NULLIF(current_setting('app.current_profile_id', true), ''),
        NULLIF(current_setting('request.jwt.claim.sub', true), '')
    )::uuid;
$$;

CREATE OR REPLACE FUNCTION co_desk.current_role_code()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = co_desk, pg_temp
AS $$
    SELECT r.role_code
    FROM co_desk.profiles p
    JOIN co_desk.roles r ON r.role_id = p.role_id
    WHERE p.profile_id = co_desk.current_profile_id() AND p.is_active;
$$;

CREATE OR REPLACE FUNCTION co_desk.current_department_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = co_desk, pg_temp
AS $$
    SELECT p.department_id
    FROM co_desk.profiles p
    WHERE p.profile_id = co_desk.current_profile_id() AND p.is_active;
$$;

CREATE OR REPLACE FUNCTION co_desk.is_admin()
RETURNS boolean LANGUAGE sql STABLE
SET search_path = co_desk, pg_temp
AS $$ SELECT COALESCE(co_desk.current_role_code() = 'admin', false); $$;

CREATE OR REPLACE FUNCTION co_desk.is_hr_or_admin()
RETURNS boolean LANGUAGE sql STABLE
SET search_path = co_desk, pg_temp
AS $$ SELECT COALESCE(co_desk.current_role_code() IN ('hr', 'admin'), false); $$;

REVOKE ALL ON FUNCTION co_desk.current_profile_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION co_desk.current_role_code() FROM PUBLIC;
REVOKE ALL ON FUNCTION co_desk.current_department_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION co_desk.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION co_desk.is_hr_or_admin() FROM PUBLIC;

ALTER TABLE co_desk.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE co_desk.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE co_desk.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE co_desk.holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE co_desk.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE co_desk.booking_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE co_desk.user_department_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS roles_read ON co_desk.roles;
CREATE POLICY roles_read ON co_desk.roles FOR SELECT USING (co_desk.current_profile_id() IS NOT NULL);
DROP POLICY IF EXISTS roles_admin_manage ON co_desk.roles;
CREATE POLICY roles_admin_manage ON co_desk.roles FOR ALL USING (co_desk.is_admin()) WITH CHECK (co_desk.is_admin());

DROP POLICY IF EXISTS departments_read ON co_desk.departments;
CREATE POLICY departments_read ON co_desk.departments FOR SELECT USING (is_active OR co_desk.is_hr_or_admin());
DROP POLICY IF EXISTS departments_manage ON co_desk.departments;
DROP POLICY IF EXISTS departments_insert ON co_desk.departments;
CREATE POLICY departments_insert ON co_desk.departments FOR INSERT WITH CHECK (co_desk.is_hr_or_admin());
DROP POLICY IF EXISTS departments_update ON co_desk.departments;
CREATE POLICY departments_update ON co_desk.departments FOR UPDATE USING (co_desk.is_hr_or_admin()) WITH CHECK (co_desk.is_hr_or_admin());

DROP POLICY IF EXISTS profiles_read ON co_desk.profiles;
CREATE POLICY profiles_read ON co_desk.profiles FOR SELECT USING (
    co_desk.is_hr_or_admin()
    OR profile_id = co_desk.current_profile_id()
    OR department_id = co_desk.current_department_id()
);
DROP POLICY IF EXISTS profiles_manage ON co_desk.profiles;
CREATE POLICY profiles_manage ON co_desk.profiles FOR UPDATE USING (co_desk.is_hr_or_admin()) WITH CHECK (co_desk.is_hr_or_admin());
DROP POLICY IF EXISTS profiles_admin_insert ON co_desk.profiles;
CREATE POLICY profiles_admin_insert ON co_desk.profiles FOR INSERT WITH CHECK (co_desk.is_admin());

DROP POLICY IF EXISTS holidays_read ON co_desk.holidays;
CREATE POLICY holidays_read ON co_desk.holidays FOR SELECT USING (is_active OR co_desk.is_hr_or_admin());
DROP POLICY IF EXISTS holidays_admin_manage ON co_desk.holidays;
DROP POLICY IF EXISTS holidays_admin_insert ON co_desk.holidays;
DROP POLICY IF EXISTS holidays_admin_update ON co_desk.holidays;
DROP POLICY IF EXISTS holidays_manage_insert ON co_desk.holidays;
CREATE POLICY holidays_manage_insert ON co_desk.holidays FOR INSERT WITH CHECK (co_desk.is_hr_or_admin());
DROP POLICY IF EXISTS holidays_manage_update ON co_desk.holidays;
CREATE POLICY holidays_manage_update ON co_desk.holidays FOR UPDATE USING (co_desk.is_hr_or_admin()) WITH CHECK (co_desk.is_hr_or_admin());

DROP POLICY IF EXISTS bookings_read ON co_desk.bookings;
CREATE POLICY bookings_read ON co_desk.bookings FOR SELECT USING (
    co_desk.is_admin()
    OR booked_for_profile_id = co_desk.current_profile_id()
    OR department_id = co_desk.current_department_id()
);
DROP POLICY IF EXISTS bookings_insert ON co_desk.bookings;
CREATE POLICY bookings_insert ON co_desk.bookings FOR INSERT WITH CHECK (
    co_desk.is_admin() OR booked_for_profile_id = co_desk.current_profile_id()
);
DROP POLICY IF EXISTS bookings_update ON co_desk.bookings;
CREATE POLICY bookings_update ON co_desk.bookings FOR UPDATE USING (
    co_desk.is_admin() OR booked_for_profile_id = co_desk.current_profile_id()
) WITH CHECK (
    co_desk.is_admin() OR booked_for_profile_id = co_desk.current_profile_id()
);

DROP POLICY IF EXISTS audit_admin_read ON co_desk.booking_audit_logs;
CREATE POLICY audit_admin_read ON co_desk.booking_audit_logs FOR SELECT USING (co_desk.is_admin());

DROP POLICY IF EXISTS history_read ON co_desk.user_department_history;
CREATE POLICY history_read ON co_desk.user_department_history FOR SELECT USING (
    co_desk.is_hr_or_admin() OR profile_id = co_desk.current_profile_id()
);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        GRANT USAGE ON SCHEMA co_desk TO authenticated;
        GRANT SELECT ON co_desk.roles, co_desk.departments, co_desk.profiles, co_desk.holidays,
            co_desk.bookings, co_desk.booking_audit_logs, co_desk.user_department_history TO authenticated;
        GRANT EXECUTE ON FUNCTION co_desk.current_profile_id(), co_desk.current_role_code(),
            co_desk.current_department_id(), co_desk.is_admin(), co_desk.is_hr_or_admin() TO authenticated;
        REVOKE ALL ON FUNCTION co_desk.create_booking(uuid, uuid, text, date, timestamptz, timestamptz, boolean, text, text, inet, text),
            co_desk.update_booking(uuid, uuid, uuid, text, date, timestamptz, timestamptz, boolean, text, text, text, inet, text),
            co_desk.cancel_booking(uuid, uuid, text, text, inet, text),
            co_desk.check_booking_conflict(uuid, timestamptz, timestamptz, uuid),
            co_desk.check_department_capacity(uuid, timestamptz, timestamptz, uuid),
            co_desk.check_booking_holidays(uuid, timestamptz, timestamptz) FROM authenticated;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON FUNCTION co_desk.create_booking(uuid, uuid, text, date, timestamptz, timestamptz, boolean, text, text, inet, text),
            co_desk.update_booking(uuid, uuid, uuid, text, date, timestamptz, timestamptz, boolean, text, text, text, inet, text),
            co_desk.cancel_booking(uuid, uuid, text, text, inet, text) FROM anon;
    END IF;
END $$;
