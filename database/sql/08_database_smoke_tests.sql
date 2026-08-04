-- Rollback-only smoke tests. Run after 00 through 07 in a development/test database.
BEGIN;
SET search_path = co_desk, public;

DO $$
DECLARE
    v_result jsonb;
    v_count integer;
    v_booking_id uuid;
    v_audit_id uuid;
BEGIN
    IF (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'co_desk' AND table_type = 'BASE TABLE') <> 7 THEN
        RAISE EXCEPTION 'Expected exactly seven co_desk base tables';
    END IF;
    IF to_regclass('co_desk.department_capacity_policies') IS NOT NULL THEN
        RAISE EXCEPTION 'Forbidden table department_capacity_policies exists';
    END IF;

    BEGIN
        INSERT INTO co_desk.profiles (profile_id, employee_code, full_name, email, department_id, role_id)
        VALUES (gen_random_uuid(), 'EMP001', 'Duplicate', 'unique-smoke@example.test',
                '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001');
        RAISE EXCEPTION 'Duplicate employee code was accepted';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;

    BEGIN
        INSERT INTO co_desk.profiles (profile_id, employee_code, full_name, email, department_id, role_id)
        VALUES (gen_random_uuid(), 'SMOKE001', 'Duplicate', 'non.employee@example.test',
                '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001');
        RAISE EXCEPTION 'Duplicate email was accepted';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;

    BEGIN
        INSERT INTO co_desk.departments (department_code, department_name, capacity_mode, default_capacity_per_day)
        VALUES ('BADCAP', 'Invalid capacity', 'limited', 0);
        RAISE EXCEPTION 'Invalid limited capacity was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    BEGIN
        INSERT INTO co_desk.departments (department_code, department_name, capacity_mode, default_capacity_per_day)
        VALUES ('BADUNL', 'Invalid unlimited', 'unlimited', 1);
        RAISE EXCEPTION 'Invalid unlimited capacity was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    INSERT INTO co_desk.departments (department_code, department_name, capacity_mode, default_capacity_per_day)
    VALUES ('GOODUNL', 'Valid unlimited', 'unlimited', NULL);

    BEGIN
        INSERT INTO co_desk.bookings (
            booked_for_profile_id, booked_by_profile_id, department_id, booking_mode,
            booking_date_start, booking_date_end, start_at, end_at, status_code
        ) VALUES (
            '30000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003',
            '20000000-0000-0000-0000-000000000001', 'date_time_range', DATE '2030-01-05', DATE '2030-01-05',
            TIMESTAMPTZ '2030-01-06 09:00:00+07', TIMESTAMPTZ '2030-01-06 10:00:00+07', 'booked'
        );
        RAISE EXCEPTION 'Inconsistent Bangkok business dates were accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    BEGIN
        INSERT INTO co_desk.bookings (
            booked_for_profile_id, booked_by_profile_id, department_id, booking_mode,
            booking_date_start, booking_date_end, start_at, end_at, status_code
        ) VALUES (
            '30000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003',
            '20000000-0000-0000-0000-000000000001', 'date_time_range', DATE '2030-01-02', DATE '2030-01-01',
            TIMESTAMPTZ '2030-01-02 10:00:00+07', TIMESTAMPTZ '2030-01-02 09:00:00+07', 'booked'
        );
        RAISE EXCEPTION 'Invalid booking dates were accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    INSERT INTO co_desk.bookings (
        booked_for_profile_id, booked_by_profile_id, department_id, booking_mode,
        booking_date_start, booking_date_end, start_at, end_at, status_code
    ) VALUES (
        '30000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003',
        '20000000-0000-0000-0000-000000000001', 'date_time_range', DATE '2030-01-10', DATE '2030-01-10',
        TIMESTAMPTZ '2030-01-10 09:00:00+07', TIMESTAMPTZ '2030-01-10 12:00:00+07', 'booked'
    );
    BEGIN
        INSERT INTO co_desk.bookings (
            booked_for_profile_id, booked_by_profile_id, department_id, booking_mode,
            booking_date_start, booking_date_end, start_at, end_at, status_code
        ) VALUES (
            '30000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003',
            '20000000-0000-0000-0000-000000000001', 'date_time_range', DATE '2030-01-10', DATE '2030-01-10',
            TIMESTAMPTZ '2030-01-10 11:00:00+07', TIMESTAMPTZ '2030-01-10 13:00:00+07', 'booked'
        );
        RAISE EXCEPTION 'Active overlap was accepted';
    EXCEPTION WHEN exclusion_violation THEN NULL;
    END;
    INSERT INTO co_desk.bookings (
        booked_for_profile_id, booked_by_profile_id, department_id, booking_mode,
        booking_date_start, booking_date_end, start_at, end_at, status_code, cancelled_at, cancelled_by_profile_id
    ) VALUES (
        '30000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003',
        '20000000-0000-0000-0000-000000000001', 'date_time_range', DATE '2030-01-10', DATE '2030-01-10',
        TIMESTAMPTZ '2030-01-10 10:00:00+07', TIMESTAMPTZ '2030-01-10 11:00:00+07', 'cancelled', now(),
        '30000000-0000-0000-0000-000000000003'
    );

    UPDATE co_desk.departments SET default_capacity_per_day = 1
    WHERE department_id = '20000000-0000-0000-0000-000000000001';
    v_result := co_desk.create_booking(
        '30000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001',
        'single_day', DATE '2030-02-01', NULL, NULL, false, 'capacity smoke one', 'smoke-cap-1', '127.0.0.1', 'smoke');
    IF NOT (v_result ->> 'success')::boolean THEN RAISE EXCEPTION 'First capacity booking failed: %', v_result; END IF;
    v_result := co_desk.create_booking(
        '30000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001',
        'single_day', DATE '2030-02-01', NULL, NULL, false, 'capacity smoke two', 'smoke-cap-2', '127.0.0.1', 'smoke');
    IF v_result ->> 'code' <> 'capacity_exceeded' THEN RAISE EXCEPTION 'Capacity rejection failed: %', v_result; END IF;

    v_result := co_desk.create_booking(
        '30000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000001',
        'single_day', DATE '2030-02-01', NULL, NULL, false, 'unlimited smoke', 'smoke-unlimited', '127.0.0.1', 'smoke');
    IF NOT (v_result ->> 'success')::boolean THEN RAISE EXCEPTION 'Unlimited capacity booking failed: %', v_result; END IF;

    v_result := co_desk.create_booking(
        '30000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001',
        'single_day', DATE '2030-03-02', NULL, NULL, false, 'cross-day capacity fixture',
        'smoke-cross-cap-fixture', '127.0.0.1', 'smoke');
    IF NOT (v_result ->> 'success')::boolean THEN RAISE EXCEPTION 'Cross-day capacity fixture failed: %', v_result; END IF;
    v_result := co_desk.create_booking(
        '30000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000001',
        'date_time_range', NULL, TIMESTAMPTZ '2030-03-01 12:00:00+07', TIMESTAMPTZ '2030-03-02 12:00:00+07',
        false, 'cross-day capacity request', 'smoke-cross-cap-request', '127.0.0.1', 'smoke');
    IF v_result ->> 'code' <> 'capacity_exceeded'
       OR NOT jsonb_path_exists(v_result, '$.details.dates[*] ? (@.date == "2030-03-02" && @.exceeded == true)') THEN
        RAISE EXCEPTION 'Cross-day capacity was not checked on every touched date: %', v_result;
    END IF;

    v_result := co_desk.create_booking(
        '30000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000001',
        'date_time_range', NULL, TIMESTAMPTZ '2030-04-01 22:00:00+07', TIMESTAMPTZ '2030-04-03 06:00:00+07',
        false, 'unlimited cross-day', 'smoke-unlimited-cross-day', '127.0.0.1', 'smoke');
    IF NOT (v_result ->> 'success')::boolean THEN RAISE EXCEPTION 'Unlimited cross-day booking failed: %', v_result; END IF;
    v_booking_id := (v_result #>> '{booking,booking_id}')::uuid;

    v_result := co_desk.update_booking(
        v_booking_id, '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000005',
        'date_time_range', NULL, TIMESTAMPTZ '2030-04-02 21:00:00+07', TIMESTAMPTZ '2030-04-04 05:00:00+07',
        false, 'updated unlimited cross-day', 'smoke update', 'smoke-update', '127.0.0.1', 'smoke');
    IF v_result ->> 'code' <> 'updated' THEN RAISE EXCEPTION 'Booking update failed: %', v_result; END IF;
    v_result := co_desk.cancel_booking(
        v_booking_id, '30000000-0000-0000-0000-000000000001', 'smoke cancel',
        'smoke-cancel', '127.0.0.1', 'smoke');
    IF v_result ->> 'code' <> 'cancelled' THEN RAISE EXCEPTION 'Booking cancellation failed: %', v_result; END IF;
    SELECT count(*) INTO v_count FROM co_desk.booking_audit_logs
    WHERE booking_id = v_booking_id AND action_code IN ('create', 'update', 'cancel');
    IF v_count <> 3 THEN RAISE EXCEPTION 'Create/update/cancel audit sequence failed'; END IF;

    v_result := co_desk.create_booking(
        '30000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001',
        'single_day', DATE '2026-10-23', NULL, NULL, false, 'holiday without acknowledgement',
        'smoke-holiday-rejected', '127.0.0.1', 'smoke');
    IF v_result ->> 'code' <> 'holiday_confirmation_required' THEN
        RAISE EXCEPTION 'Holiday acknowledgement was not required: %', v_result;
    END IF;
    v_result := co_desk.create_booking(
        '30000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001',
        'single_day', DATE '2026-10-23', NULL, NULL, true, 'holiday acknowledged',
        'smoke-holiday-accepted', '127.0.0.1', 'smoke');
    IF NOT (v_result ->> 'success')::boolean THEN RAISE EXCEPTION 'Acknowledged holiday booking failed: %', v_result; END IF;

    v_result := co_desk.check_booking_holidays(
        TIMESTAMPTZ '2026-08-12 00:00:00+07', TIMESTAMPTZ '2026-08-13 00:00:00+07');
    IF NOT (v_result ->> 'hasHolidays')::boolean THEN RAISE EXCEPTION 'Holiday detection failed'; END IF;

    SELECT count(*) INTO v_count FROM co_desk.booking_audit_logs WHERE request_id IN ('smoke-cap-1', 'smoke-unlimited');
    IF v_count <> 2 THEN RAISE EXCEPTION 'Booking audit creation failed'; END IF;

    SELECT audit_log_id INTO v_audit_id FROM co_desk.booking_audit_logs WHERE booking_id = v_booking_id LIMIT 1;
    BEGIN
        UPDATE co_desk.booking_audit_logs SET action_reason = 'tampered' WHERE audit_log_id = v_audit_id;
        RAISE EXCEPTION 'Audit update was accepted';
    EXCEPTION WHEN SQLSTATE '55000' THEN NULL;
    END;
    BEGIN
        DELETE FROM co_desk.booking_audit_logs WHERE audit_log_id = v_audit_id;
        RAISE EXCEPTION 'Audit delete was accepted';
    EXCEPTION WHEN SQLSTATE '55000' THEN NULL;
    END;

    PERFORM set_config('app.current_profile_id', '30000000-0000-0000-0000-000000000001', true);
    UPDATE co_desk.profiles SET department_id = '20000000-0000-0000-0000-000000000002'
    WHERE profile_id = '30000000-0000-0000-0000-000000000006';
    SELECT count(*) INTO v_count FROM co_desk.user_department_history
    WHERE profile_id = '30000000-0000-0000-0000-000000000006' AND assigned_end_date IS NULL;
    IF v_count <> 1 THEN RAISE EXCEPTION 'Department history open-assignment invariant failed'; END IF;
    SELECT count(*) INTO v_count FROM co_desk.user_department_history
    WHERE profile_id = '30000000-0000-0000-0000-000000000006' AND assigned_end_date IS NOT NULL;
    IF v_count < 1 THEN RAISE EXCEPTION 'Previous department assignment was not closed'; END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'co_desk'
          AND p.proname IN ('create_booking', 'update_booking', 'cancel_booking')
          AND has_function_privilege('public', p.oid, 'EXECUTE')
    ) THEN
        RAISE EXCEPTION 'Critical booking write function is executable by PUBLIC';
    END IF;

    SELECT count(*) INTO v_count FROM co_desk.vw_daily_department_bookings WHERE active_booking_total > 0;
    IF v_count = 0 THEN RAISE EXCEPTION 'Daily department report returned no active data'; END IF;
    SELECT count(*) INTO v_count FROM co_desk.vw_department_capacity_utilization
    WHERE capacity_mode = 'limited' AND utilization_percentage IS NOT NULL;
    IF v_count = 0 THEN RAISE EXCEPTION 'Capacity utilization report values are incorrect'; END IF;
    SELECT count(*) INTO v_count FROM co_desk.vw_employee_booking_frequency
    WHERE total_bookings = active_bookings + cancelled_bookings;
    IF v_count = 0 THEN RAISE EXCEPTION 'Employee frequency report values are incorrect'; END IF;
    SELECT count(*) INTO v_count FROM co_desk.vw_holiday_bookings
    WHERE holiday_date = DATE '2026-10-23' AND holiday_warning_acknowledged;
    IF v_count = 0 THEN RAISE EXCEPTION 'Holiday booking report omitted acknowledged booking'; END IF;
    SELECT count(*) INTO v_count FROM co_desk.vw_booking_cancellation_summary WHERE booking_id = v_booking_id;
    IF v_count <> 1 THEN RAISE EXCEPTION 'Cancelled booking was not retained in cancellation report'; END IF;
END $$;

ROLLBACK;
