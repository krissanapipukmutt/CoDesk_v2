SET search_path = co_desk, public;

CREATE OR REPLACE FUNCTION co_desk.booking_touched_dates(
    p_start_at timestamptz,
    p_end_at timestamptz,
    p_timezone text DEFAULT NULL
)
RETURNS TABLE(business_date date)
LANGUAGE sql
STABLE
STRICT
SET search_path = co_desk, pg_temp
AS $$
    SELECT generated::date
    FROM generate_series(
        (p_start_at AT TIME ZONE p_timezone)::date,
        ((p_end_at - interval '1 microsecond') AT TIME ZONE p_timezone)::date,
        interval '1 day'
    ) AS generated
    WHERE p_end_at > p_start_at;
$$;

CREATE OR REPLACE FUNCTION co_desk.check_booking_conflict(
    p_booked_for_profile_id uuid,
    p_start_at timestamptz,
    p_end_at timestamptz,
    p_exclude_booking_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = co_desk, pg_temp
AS $$
    SELECT jsonb_build_object(
        'hasConflict', EXISTS (
            SELECT 1
            FROM co_desk.bookings b
            WHERE b.booked_for_profile_id = p_booked_for_profile_id
              AND b.status_code = 'booked'
              AND b.booking_id IS DISTINCT FROM p_exclude_booking_id
              AND p_start_at < b.end_at
              AND p_end_at > b.start_at
        ),
        'conflictingBookingId', (
            SELECT b.booking_id
            FROM co_desk.bookings b
            WHERE b.booked_for_profile_id = p_booked_for_profile_id
              AND b.status_code = 'booked'
              AND b.booking_id IS DISTINCT FROM p_exclude_booking_id
              AND p_start_at < b.end_at
              AND p_end_at > b.start_at
            ORDER BY b.start_at
            LIMIT 1
        )
    );
$$;

CREATE OR REPLACE FUNCTION co_desk.check_department_capacity(
    p_department_id uuid,
    p_start_at timestamptz,
    p_end_at timestamptz,
    p_exclude_booking_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = co_desk, pg_temp
AS $$
    WITH department AS (
        SELECT capacity_mode, default_capacity_per_day, effective_timezone
        FROM co_desk.departments
        WHERE department_id = p_department_id AND is_active
    ), daily AS (
        SELECT d.business_date,
               COUNT(b.booking_id)::integer AS current_count
        FROM department
        CROSS JOIN LATERAL co_desk.booking_touched_dates(
            p_start_at, p_end_at, department.effective_timezone
        ) d
        LEFT JOIN co_desk.bookings b
          ON b.department_id = p_department_id
         AND b.status_code = 'booked'
         AND b.booking_id IS DISTINCT FROM p_exclude_booking_id
         AND b.booking_date_start <= d.business_date
         AND b.booking_date_end >= d.business_date
        GROUP BY d.business_date
    ), result AS (
        SELECT daily.business_date,
               department.capacity_mode,
               department.default_capacity_per_day,
               daily.current_count,
               daily.current_count + 1 AS projected_count,
               department.capacity_mode = 'limited'
                   AND daily.current_count + 1 > department.default_capacity_per_day AS exceeded
        FROM daily CROSS JOIN department
    )
    SELECT jsonb_build_object(
        'isAvailable', COALESCE(NOT bool_or(exceeded), false),
        'dates', COALESCE(jsonb_agg(jsonb_build_object(
            'date', business_date,
            'capacityMode', capacity_mode,
            'capacity', default_capacity_per_day,
            'currentCount', current_count,
            'projectedCount', projected_count,
            'exceeded', exceeded
        ) ORDER BY business_date), '[]'::jsonb)
    )
    FROM result;
$$;

DROP FUNCTION IF EXISTS co_desk.check_booking_holidays(timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION co_desk.check_booking_holidays(
    p_department_id uuid,
    p_start_at timestamptz,
    p_end_at timestamptz
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = co_desk, pg_temp
AS $$
    WITH department AS (
        SELECT effective_timezone
        FROM co_desk.departments
        WHERE department_id = p_department_id AND is_active
    ), matches AS (
        SELECT h.holiday_id, h.holiday_date, h.holiday_name, h.holiday_description
        FROM co_desk.holidays h
        JOIN department ON true
        JOIN LATERAL co_desk.booking_touched_dates(
            p_start_at, p_end_at, department.effective_timezone
        ) d
          ON d.business_date = h.holiday_date
        WHERE h.is_active
        ORDER BY h.holiday_date
    )
    SELECT jsonb_build_object(
        'hasHolidays', EXISTS (SELECT 1 FROM matches),
        'holidays', COALESCE((SELECT jsonb_agg(to_jsonb(matches)) FROM matches), '[]'::jsonb)
    );
$$;

CREATE OR REPLACE FUNCTION co_desk.assert_booking_actor(
    p_actor_profile_id uuid,
    p_target_profile_id uuid
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = co_desk, pg_temp
AS $$
DECLARE
    v_role text;
    v_active boolean;
    v_request_profile_id uuid;
BEGIN
    v_request_profile_id := COALESCE(
        NULLIF(current_setting('app.current_profile_id', true), ''),
        NULLIF(current_setting('request.jwt.claim.sub', true), '')
    )::uuid;
    IF v_request_profile_id IS NOT NULL AND v_request_profile_id <> p_actor_profile_id THEN
        RAISE EXCEPTION 'The booking actor does not match the authenticated profile' USING ERRCODE = '42501';
    END IF;

    SELECT r.role_code, p.is_active
    INTO v_role, v_active
    FROM co_desk.profiles p
    JOIN co_desk.roles r ON r.role_id = p.role_id
    WHERE p.profile_id = p_actor_profile_id;

    IF v_role IS NULL OR NOT v_active THEN
        RAISE EXCEPTION 'Actor profile is missing or inactive' USING ERRCODE = '42501';
    END IF;
    IF v_role <> 'admin' AND p_actor_profile_id <> p_target_profile_id THEN
        RAISE EXCEPTION 'Only an admin can book for another profile' USING ERRCODE = '42501';
    END IF;
    RETURN v_role;
END;
$$;

CREATE OR REPLACE FUNCTION co_desk.create_booking(
    p_booked_for_profile_id uuid,
    p_booked_by_profile_id uuid,
    p_booking_mode text,
    p_booking_date_start date,
    p_start_at timestamptz,
    p_end_at timestamptz,
    p_holiday_warning_acknowledged boolean,
    p_note_text text,
    p_request_id text,
    p_ip_address inet,
    p_user_agent text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = co_desk, pg_temp
AS $$
DECLARE
    v_actor_role text;
    v_department_id uuid;
    v_timezone text;
    v_start_at timestamptz;
    v_end_at timestamptz;
    v_date_start date;
    v_date_end date;
    v_holidays jsonb;
    v_conflict jsonb;
    v_capacity jsonb;
    v_booking co_desk.bookings;
BEGIN
    v_actor_role := co_desk.assert_booking_actor(p_booked_by_profile_id, p_booked_for_profile_id);

    SELECT p.department_id, d.effective_timezone INTO v_department_id, v_timezone
    FROM co_desk.profiles p
    JOIN co_desk.departments d ON d.department_id = p.department_id AND d.is_active
    WHERE p.profile_id = p_booked_for_profile_id AND p.is_active
    FOR SHARE OF p;
    IF v_department_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'code', 'invalid_profile', 'message', 'Target profile or department is inactive');
    END IF;

    IF p_booking_mode = 'single_day' THEN
        IF p_booking_date_start IS NULL THEN
            RETURN jsonb_build_object('success', false, 'code', 'validation_error', 'message', 'bookingDateStart is required');
        END IF;
        v_date_start := p_booking_date_start;
        v_date_end := p_booking_date_start;
        v_start_at := p_booking_date_start::timestamp AT TIME ZONE v_timezone;
        v_end_at := (p_booking_date_start + 1)::timestamp AT TIME ZONE v_timezone;
    ELSIF p_booking_mode = 'date_time_range' THEN
        IF p_start_at IS NULL OR p_end_at IS NULL OR p_end_at <= p_start_at THEN
            RETURN jsonb_build_object('success', false, 'code', 'validation_error', 'message', 'A valid startAt/endAt range is required');
        END IF;
        v_start_at := p_start_at;
        v_end_at := p_end_at;
        v_date_start := (v_start_at AT TIME ZONE v_timezone)::date;
        v_date_end := ((v_end_at - interval '1 microsecond') AT TIME ZONE v_timezone)::date;
    ELSE
        RETURN jsonb_build_object('success', false, 'code', 'validation_error', 'message', 'Unsupported booking mode');
    END IF;

    PERFORM 1 FROM co_desk.departments WHERE department_id = v_department_id FOR UPDATE;

    v_holidays := co_desk.check_booking_holidays(v_department_id, v_start_at, v_end_at);
    IF COALESCE((v_holidays ->> 'hasHolidays')::boolean, false) AND NOT p_holiday_warning_acknowledged THEN
        RETURN jsonb_build_object('success', false, 'code', 'holiday_confirmation_required', 'message', 'Holiday confirmation is required', 'details', v_holidays);
    END IF;

    v_conflict := co_desk.check_booking_conflict(p_booked_for_profile_id, v_start_at, v_end_at);
    IF COALESCE((v_conflict ->> 'hasConflict')::boolean, false) THEN
        RETURN jsonb_build_object('success', false, 'code', 'booking_conflict', 'message', 'The employee already has an overlapping booking', 'details', v_conflict);
    END IF;

    v_capacity := co_desk.check_department_capacity(v_department_id, v_start_at, v_end_at);
    IF NOT COALESCE((v_capacity ->> 'isAvailable')::boolean, false) THEN
        RETURN jsonb_build_object('success', false, 'code', 'capacity_exceeded', 'message', 'Department capacity is exceeded', 'details', v_capacity);
    END IF;

    INSERT INTO co_desk.bookings (
        booked_for_profile_id, booked_by_profile_id, department_id, booking_mode,
        booking_date_start, booking_date_end, start_at, end_at,
        holiday_warning_acknowledged, status_code, note_text
    ) VALUES (
        p_booked_for_profile_id, p_booked_by_profile_id, v_department_id, p_booking_mode,
        v_date_start, v_date_end, v_start_at, v_end_at,
        p_holiday_warning_acknowledged, 'booked', NULLIF(btrim(p_note_text), '')
    ) RETURNING * INTO v_booking;

    INSERT INTO co_desk.booking_audit_logs (
        booking_id, action_code, actor_profile_id, actor_role_code, action_reason,
        old_values_json, new_values_json, request_id, ip_address, user_agent
    ) VALUES (
        v_booking.booking_id, 'create', p_booked_by_profile_id, v_actor_role, 'Booking created',
        NULL, to_jsonb(v_booking) || jsonb_build_object('business_timezone', v_timezone),
        p_request_id, p_ip_address, left(p_user_agent, 1000)
    );

    RETURN jsonb_build_object('success', true, 'code', 'created', 'booking', to_jsonb(v_booking), 'holidays', v_holidays);
EXCEPTION
    WHEN exclusion_violation THEN
        RETURN jsonb_build_object('success', false, 'code', 'booking_conflict', 'message', 'The employee already has an overlapping booking');
END;
$$;

CREATE OR REPLACE FUNCTION co_desk.update_booking(
    p_booking_id uuid,
    p_actor_profile_id uuid,
    p_booked_for_profile_id uuid,
    p_booking_mode text,
    p_booking_date_start date,
    p_start_at timestamptz,
    p_end_at timestamptz,
    p_holiday_warning_acknowledged boolean,
    p_note_text text,
    p_action_reason text,
    p_request_id text,
    p_ip_address inet,
    p_user_agent text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = co_desk, pg_temp
AS $$
DECLARE
    v_old co_desk.bookings;
    v_new co_desk.bookings;
    v_actor_role text;
    v_department_id uuid;
    v_timezone text;
    v_start_at timestamptz;
    v_end_at timestamptz;
    v_date_start date;
    v_date_end date;
    v_check jsonb;
BEGIN
    SELECT * INTO v_old FROM co_desk.bookings WHERE booking_id = p_booking_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'not_found', 'message', 'Booking was not found');
    END IF;
    IF v_old.status_code = 'cancelled' THEN
        RETURN jsonb_build_object('success', false, 'code', 'invalid_status', 'message', 'A cancelled booking cannot be edited');
    END IF;

    v_actor_role := co_desk.assert_booking_actor(p_actor_profile_id, p_booked_for_profile_id);
    IF v_actor_role <> 'admin' AND v_old.booked_for_profile_id <> p_actor_profile_id THEN
        RAISE EXCEPTION 'Only an admin can edit another profile booking' USING ERRCODE = '42501';
    END IF;

    SELECT p.department_id, d.effective_timezone INTO v_department_id, v_timezone
    FROM co_desk.profiles p
    JOIN co_desk.departments d ON d.department_id = p.department_id
    WHERE p.profile_id = p_booked_for_profile_id AND p.is_active;
    IF v_department_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'code', 'invalid_profile', 'message', 'Target profile is inactive');
    END IF;

    IF p_booking_mode = 'single_day' AND p_booking_date_start IS NOT NULL THEN
        v_date_start := p_booking_date_start;
        v_date_end := p_booking_date_start;
        v_start_at := p_booking_date_start::timestamp AT TIME ZONE v_timezone;
        v_end_at := (p_booking_date_start + 1)::timestamp AT TIME ZONE v_timezone;
    ELSIF p_booking_mode = 'date_time_range' AND p_start_at IS NOT NULL AND p_end_at > p_start_at THEN
        v_start_at := p_start_at;
        v_end_at := p_end_at;
        v_date_start := (v_start_at AT TIME ZONE v_timezone)::date;
        v_date_end := ((v_end_at - interval '1 microsecond') AT TIME ZONE v_timezone)::date;
    ELSE
        RETURN jsonb_build_object('success', false, 'code', 'validation_error', 'message', 'Invalid booking date or range');
    END IF;

    PERFORM 1 FROM co_desk.departments WHERE department_id = v_department_id AND is_active FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'invalid_department', 'message', 'Department is inactive');
    END IF;

    v_check := co_desk.check_booking_holidays(v_department_id, v_start_at, v_end_at);
    IF COALESCE((v_check ->> 'hasHolidays')::boolean, false) AND NOT p_holiday_warning_acknowledged THEN
        RETURN jsonb_build_object('success', false, 'code', 'holiday_confirmation_required', 'message', 'Holiday confirmation is required', 'details', v_check);
    END IF;
    v_check := co_desk.check_booking_conflict(p_booked_for_profile_id, v_start_at, v_end_at, p_booking_id);
    IF COALESCE((v_check ->> 'hasConflict')::boolean, false) THEN
        RETURN jsonb_build_object('success', false, 'code', 'booking_conflict', 'message', 'The employee already has an overlapping booking', 'details', v_check);
    END IF;
    v_check := co_desk.check_department_capacity(v_department_id, v_start_at, v_end_at, p_booking_id);
    IF NOT COALESCE((v_check ->> 'isAvailable')::boolean, false) THEN
        RETURN jsonb_build_object('success', false, 'code', 'capacity_exceeded', 'message', 'Department capacity is exceeded', 'details', v_check);
    END IF;

    UPDATE co_desk.bookings SET
        booked_for_profile_id = p_booked_for_profile_id,
        department_id = v_department_id,
        booking_mode = p_booking_mode,
        booking_date_start = v_date_start,
        booking_date_end = v_date_end,
        start_at = v_start_at,
        end_at = v_end_at,
        holiday_warning_acknowledged = p_holiday_warning_acknowledged,
        note_text = NULLIF(btrim(p_note_text), '')
    WHERE booking_id = p_booking_id
    RETURNING * INTO v_new;

    INSERT INTO co_desk.booking_audit_logs (
        booking_id, action_code, actor_profile_id, actor_role_code, action_reason,
        old_values_json, new_values_json, request_id, ip_address, user_agent
    ) VALUES (
        p_booking_id, 'update', p_actor_profile_id, v_actor_role, COALESCE(NULLIF(btrim(p_action_reason), ''), 'Booking updated'),
        to_jsonb(v_old), to_jsonb(v_new) || jsonb_build_object('business_timezone', v_timezone),
        p_request_id, p_ip_address, left(p_user_agent, 1000)
    );

    RETURN jsonb_build_object('success', true, 'code', 'updated', 'booking', to_jsonb(v_new));
EXCEPTION
    WHEN exclusion_violation THEN
        RETURN jsonb_build_object('success', false, 'code', 'booking_conflict', 'message', 'The employee already has an overlapping booking');
END;
$$;

CREATE OR REPLACE FUNCTION co_desk.cancel_booking(
    p_booking_id uuid,
    p_actor_profile_id uuid,
    p_action_reason text,
    p_request_id text,
    p_ip_address inet,
    p_user_agent text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = co_desk, pg_temp
AS $$
DECLARE
    v_old co_desk.bookings;
    v_new co_desk.bookings;
    v_actor_role text;
    v_timezone text;
BEGIN
    SELECT * INTO v_old FROM co_desk.bookings WHERE booking_id = p_booking_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'not_found', 'message', 'Booking was not found');
    END IF;

    v_actor_role := co_desk.assert_booking_actor(p_actor_profile_id, v_old.booked_for_profile_id);
    IF v_actor_role <> 'admin' AND v_old.booked_for_profile_id <> p_actor_profile_id THEN
        RAISE EXCEPTION 'Only an admin can cancel another profile booking' USING ERRCODE = '42501';
    END IF;
    IF v_old.status_code = 'cancelled' THEN
        RETURN jsonb_build_object('success', true, 'code', 'already_cancelled', 'booking', to_jsonb(v_old));
    END IF;

    SELECT effective_timezone INTO v_timezone
    FROM co_desk.departments
    WHERE department_id = v_old.department_id;

    UPDATE co_desk.bookings SET
        status_code = 'cancelled',
        cancelled_at = now(),
        cancelled_by_profile_id = p_actor_profile_id
    WHERE booking_id = p_booking_id
    RETURNING * INTO v_new;

    INSERT INTO co_desk.booking_audit_logs (
        booking_id, action_code, actor_profile_id, actor_role_code, action_reason,
        old_values_json, new_values_json, request_id, ip_address, user_agent
    ) VALUES (
        p_booking_id, 'cancel', p_actor_profile_id, v_actor_role, COALESCE(NULLIF(btrim(p_action_reason), ''), 'Booking cancelled'),
        to_jsonb(v_old), to_jsonb(v_new) || jsonb_build_object(
            'business_timezone', v_timezone,
            'cancellation_business_date', (v_new.cancelled_at AT TIME ZONE v_timezone)::date
        ), p_request_id, p_ip_address, left(p_user_agent, 1000)
    );

    RETURN jsonb_build_object('success', true, 'code', 'cancelled', 'booking', to_jsonb(v_new));
END;
$$;

REVOKE ALL ON FUNCTION co_desk.booking_touched_dates(timestamptz, timestamptz, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION co_desk.check_booking_conflict(uuid, timestamptz, timestamptz, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION co_desk.check_department_capacity(uuid, timestamptz, timestamptz, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION co_desk.check_booking_holidays(uuid, timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION co_desk.assert_booking_actor(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION co_desk.create_booking(uuid, uuid, text, date, timestamptz, timestamptz, boolean, text, text, inet, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION co_desk.update_booking(uuid, uuid, uuid, text, date, timestamptz, timestamptz, boolean, text, text, text, inet, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION co_desk.cancel_booking(uuid, uuid, text, text, inet, text) FROM PUBLIC;
