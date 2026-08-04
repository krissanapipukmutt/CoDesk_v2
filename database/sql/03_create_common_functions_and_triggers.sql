SET search_path = co_desk, public;

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
    v_business_date date := (now() AT TIME ZONE 'Asia/Bangkok')::date;
BEGIN
    v_actor := NULLIF(current_setting('app.current_profile_id', true), '')::uuid;
    v_actor := COALESCE(v_actor, NEW.profile_id);

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
