SET search_path = co_desk, public;

CREATE OR REPLACE FUNCTION co_desk.is_supported_timezone(p_timezone text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, pg_temp
AS $$
    SELECT COALESCE(
        EXISTS (
            SELECT 1
            FROM pg_catalog.pg_timezone_names
            WHERE name = p_timezone
              AND name NOT LIKE 'posix/%'
              AND name NOT LIKE 'right/%'
        ),
        false
    );
$$;

CREATE OR REPLACE FUNCTION co_desk.validate_department_timezone()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = co_desk, pg_temp
AS $$
BEGIN
    IF NOT co_desk.is_supported_timezone(NEW.effective_timezone) THEN
        RAISE EXCEPTION 'Unsupported IANA timezone: %', NEW.effective_timezone USING ERRCODE = '22023';
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION co_desk.sync_profile_timezone()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = co_desk, pg_temp
AS $$
DECLARE
    v_department_timezone text;
BEGIN
    IF TG_OP = 'INSERT' OR NEW.department_id IS DISTINCT FROM OLD.department_id THEN
        SELECT effective_timezone INTO v_department_timezone
        FROM co_desk.departments
        WHERE department_id = NEW.department_id;

        IF v_department_timezone IS NULL THEN
            RAISE EXCEPTION 'Profile department was not found' USING ERRCODE = '23503';
        END IF;
        NEW.timezone_name := v_department_timezone;
    END IF;

    IF NOT co_desk.is_supported_timezone(NEW.timezone_name) THEN
        RAISE EXCEPTION 'Unsupported IANA timezone: %', NEW.timezone_name USING ERRCODE = '22023';
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION co_desk.validate_booking_business_dates()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = co_desk, pg_temp
AS $$
DECLARE
    v_timezone text;
    v_expected_start_date date;
    v_expected_end_date date;
BEGIN
    SELECT effective_timezone INTO v_timezone
    FROM co_desk.departments
    WHERE department_id = NEW.department_id;

    IF v_timezone IS NULL THEN
        RAISE EXCEPTION 'Booking department was not found' USING ERRCODE = '23503';
    END IF;

    v_expected_start_date := (NEW.start_at AT TIME ZONE v_timezone)::date;
    v_expected_end_date := ((NEW.end_at - interval '1 microsecond') AT TIME ZONE v_timezone)::date;

    IF NEW.booking_date_start <> v_expected_start_date OR NEW.booking_date_end <> v_expected_end_date THEN
        RAISE EXCEPTION 'Booking business dates do not match department timezone %', v_timezone USING ERRCODE = '23514';
    END IF;

    IF NEW.booking_mode = 'single_day' AND (
        NEW.booking_date_start <> NEW.booking_date_end
        OR NEW.start_at <> NEW.booking_date_start::timestamp AT TIME ZONE v_timezone
        OR NEW.end_at <> (NEW.booking_date_start + 1)::timestamp AT TIME ZONE v_timezone
    ) THEN
        RAISE EXCEPTION 'Single-day booking is not an exact local calendar day in timezone %', v_timezone USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION co_desk.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = co_desk, pg_temp
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION co_desk.prevent_system_role_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = co_desk, pg_temp
AS $$
BEGIN
    IF OLD.is_system_role THEN
        RAISE EXCEPTION 'System role % cannot be deleted', OLD.role_code USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION co_desk.prevent_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = co_desk, pg_temp
AS $$
BEGIN
    RAISE EXCEPTION 'Booking audit logs are immutable' USING ERRCODE = '55000';
END;
$$;

CREATE OR REPLACE FUNCTION co_desk.sync_profile_department_history()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = co_desk, pg_temp
AS $$
DECLARE
    v_actor uuid;
    v_business_date date;
BEGIN
    v_actor := NULLIF(current_setting('app.current_profile_id', true), '')::uuid;
    v_actor := COALESCE(v_actor, NEW.profile_id);
    v_business_date := (now() AT TIME ZONE NEW.timezone_name)::date;

    IF TG_OP = 'INSERT' THEN
        INSERT INTO co_desk.user_department_history (
            profile_id, department_id, assigned_start_date, assigned_by_profile_id, note_text
        ) VALUES (
            NEW.profile_id, NEW.department_id, v_business_date, v_actor, 'Initial department assignment'
        );
    ELSIF NEW.department_id IS DISTINCT FROM OLD.department_id THEN
        UPDATE co_desk.user_department_history
        SET assigned_end_date = GREATEST(v_business_date, assigned_start_date),
            note_text = COALESCE(note_text, 'Department assignment closed')
        WHERE profile_id = NEW.profile_id
          AND assigned_end_date IS NULL;

        INSERT INTO co_desk.user_department_history (
            profile_id, department_id, assigned_start_date, assigned_by_profile_id, note_text
        ) VALUES (
            NEW.profile_id, NEW.department_id, v_business_date, v_actor, 'Department changed'
        );
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION co_desk.set_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION co_desk.prevent_system_role_delete() FROM PUBLIC;
REVOKE ALL ON FUNCTION co_desk.prevent_audit_mutation() FROM PUBLIC;
REVOKE ALL ON FUNCTION co_desk.sync_profile_department_history() FROM PUBLIC;
REVOKE ALL ON FUNCTION co_desk.is_supported_timezone(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION co_desk.validate_department_timezone() FROM PUBLIC;
REVOKE ALL ON FUNCTION co_desk.sync_profile_timezone() FROM PUBLIC;
REVOKE ALL ON FUNCTION co_desk.validate_booking_business_dates() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_departments_validate_timezone ON co_desk.departments;
CREATE TRIGGER trg_departments_validate_timezone
BEFORE INSERT OR UPDATE OF effective_timezone ON co_desk.departments
FOR EACH ROW EXECUTE FUNCTION co_desk.validate_department_timezone();

DROP TRIGGER IF EXISTS trg_profiles_sync_timezone ON co_desk.profiles;
CREATE TRIGGER trg_profiles_sync_timezone
BEFORE INSERT OR UPDATE OF department_id, timezone_name ON co_desk.profiles
FOR EACH ROW EXECUTE FUNCTION co_desk.sync_profile_timezone();

DROP TRIGGER IF EXISTS trg_bookings_validate_business_dates ON co_desk.bookings;
CREATE TRIGGER trg_bookings_validate_business_dates
BEFORE INSERT OR UPDATE OF department_id, booking_mode, booking_date_start, booking_date_end, start_at, end_at ON co_desk.bookings
FOR EACH ROW EXECUTE FUNCTION co_desk.validate_booking_business_dates();

DROP TRIGGER IF EXISTS trg_roles_updated_at ON co_desk.roles;
CREATE TRIGGER trg_roles_updated_at BEFORE UPDATE ON co_desk.roles FOR EACH ROW EXECUTE FUNCTION co_desk.set_updated_at();
DROP TRIGGER IF EXISTS trg_departments_updated_at ON co_desk.departments;
CREATE TRIGGER trg_departments_updated_at BEFORE UPDATE ON co_desk.departments FOR EACH ROW EXECUTE FUNCTION co_desk.set_updated_at();
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON co_desk.profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON co_desk.profiles FOR EACH ROW EXECUTE FUNCTION co_desk.set_updated_at();
DROP TRIGGER IF EXISTS trg_holidays_updated_at ON co_desk.holidays;
CREATE TRIGGER trg_holidays_updated_at BEFORE UPDATE ON co_desk.holidays FOR EACH ROW EXECUTE FUNCTION co_desk.set_updated_at();
DROP TRIGGER IF EXISTS trg_bookings_updated_at ON co_desk.bookings;
CREATE TRIGGER trg_bookings_updated_at BEFORE UPDATE ON co_desk.bookings FOR EACH ROW EXECUTE FUNCTION co_desk.set_updated_at();
DROP TRIGGER IF EXISTS trg_history_updated_at ON co_desk.user_department_history;
CREATE TRIGGER trg_history_updated_at BEFORE UPDATE ON co_desk.user_department_history FOR EACH ROW EXECUTE FUNCTION co_desk.set_updated_at();

DROP TRIGGER IF EXISTS trg_roles_no_system_delete ON co_desk.roles;
CREATE TRIGGER trg_roles_no_system_delete BEFORE DELETE ON co_desk.roles FOR EACH ROW EXECUTE FUNCTION co_desk.prevent_system_role_delete();
DROP TRIGGER IF EXISTS trg_audit_immutable ON co_desk.booking_audit_logs;
CREATE TRIGGER trg_audit_immutable BEFORE UPDATE OR DELETE ON co_desk.booking_audit_logs FOR EACH ROW EXECUTE FUNCTION co_desk.prevent_audit_mutation();
DROP TRIGGER IF EXISTS trg_profiles_department_history ON co_desk.profiles;
CREATE TRIGGER trg_profiles_department_history AFTER INSERT OR UPDATE OF department_id ON co_desk.profiles FOR EACH ROW EXECUTE FUNCTION co_desk.sync_profile_department_history();
