SET search_path = co_desk, public;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_roles_role_code' AND conrelid = 'co_desk.roles'::regclass) THEN
        ALTER TABLE co_desk.roles ADD CONSTRAINT uq_roles_role_code UNIQUE (role_code);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_roles_role_code' AND conrelid = 'co_desk.roles'::regclass) THEN
        ALTER TABLE co_desk.roles ADD CONSTRAINT ck_roles_role_code CHECK (role_code IN ('employee', 'hr', 'admin'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_departments_department_code' AND conrelid = 'co_desk.departments'::regclass) THEN
        ALTER TABLE co_desk.departments ADD CONSTRAINT uq_departments_department_code UNIQUE (department_code);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_departments_capacity' AND conrelid = 'co_desk.departments'::regclass) THEN
        ALTER TABLE co_desk.departments ADD CONSTRAINT ck_departments_capacity CHECK (
            (capacity_mode = 'limited' AND default_capacity_per_day > 0)
            OR (capacity_mode = 'unlimited' AND default_capacity_per_day IS NULL)
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_profiles_employee_code' AND conrelid = 'co_desk.profiles'::regclass) THEN
        ALTER TABLE co_desk.profiles ADD CONSTRAINT uq_profiles_employee_code UNIQUE (employee_code);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_profiles_email' AND conrelid = 'co_desk.profiles'::regclass) THEN
        ALTER TABLE co_desk.profiles ADD CONSTRAINT uq_profiles_email UNIQUE (email);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_profiles_department' AND conrelid = 'co_desk.profiles'::regclass) THEN
        ALTER TABLE co_desk.profiles ADD CONSTRAINT fk_profiles_department FOREIGN KEY (department_id) REFERENCES co_desk.departments(department_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_profiles_role' AND conrelid = 'co_desk.profiles'::regclass) THEN
        ALTER TABLE co_desk.profiles ADD CONSTRAINT fk_profiles_role FOREIGN KEY (role_id) REFERENCES co_desk.roles(role_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_departments_created_by' AND conrelid = 'co_desk.departments'::regclass) THEN
        ALTER TABLE co_desk.departments ADD CONSTRAINT fk_departments_created_by FOREIGN KEY (created_by_profile_id) REFERENCES co_desk.profiles(profile_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_holidays_date' AND conrelid = 'co_desk.holidays'::regclass) THEN
        ALTER TABLE co_desk.holidays ADD CONSTRAINT uq_holidays_date UNIQUE (holiday_date);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_holidays_created_by' AND conrelid = 'co_desk.holidays'::regclass) THEN
        ALTER TABLE co_desk.holidays ADD CONSTRAINT fk_holidays_created_by FOREIGN KEY (created_by_profile_id) REFERENCES co_desk.profiles(profile_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_bookings_booked_for' AND conrelid = 'co_desk.bookings'::regclass) THEN
        ALTER TABLE co_desk.bookings ADD CONSTRAINT fk_bookings_booked_for FOREIGN KEY (booked_for_profile_id) REFERENCES co_desk.profiles(profile_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_bookings_booked_by' AND conrelid = 'co_desk.bookings'::regclass) THEN
        ALTER TABLE co_desk.bookings ADD CONSTRAINT fk_bookings_booked_by FOREIGN KEY (booked_by_profile_id) REFERENCES co_desk.profiles(profile_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_bookings_department' AND conrelid = 'co_desk.bookings'::regclass) THEN
        ALTER TABLE co_desk.bookings ADD CONSTRAINT fk_bookings_department FOREIGN KEY (department_id) REFERENCES co_desk.departments(department_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_bookings_cancelled_by' AND conrelid = 'co_desk.bookings'::regclass) THEN
        ALTER TABLE co_desk.bookings ADD CONSTRAINT fk_bookings_cancelled_by FOREIGN KEY (cancelled_by_profile_id) REFERENCES co_desk.profiles(profile_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_bookings_mode' AND conrelid = 'co_desk.bookings'::regclass) THEN
        ALTER TABLE co_desk.bookings ADD CONSTRAINT ck_bookings_mode CHECK (booking_mode IN ('single_day', 'date_time_range'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_bookings_status' AND conrelid = 'co_desk.bookings'::regclass) THEN
        ALTER TABLE co_desk.bookings ADD CONSTRAINT ck_bookings_status CHECK (status_code IN ('booked', 'cancelled'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_bookings_dates' AND conrelid = 'co_desk.bookings'::regclass) THEN
        ALTER TABLE co_desk.bookings ADD CONSTRAINT ck_bookings_dates CHECK (booking_date_end >= booking_date_start AND end_at > start_at);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_bookings_business_dates' AND conrelid = 'co_desk.bookings'::regclass) THEN
        ALTER TABLE co_desk.bookings ADD CONSTRAINT ck_bookings_business_dates CHECK (
            booking_date_start = (start_at AT TIME ZONE 'Asia/Bangkok')::date
            AND booking_date_end = ((end_at - interval '1 microsecond') AT TIME ZONE 'Asia/Bangkok')::date
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_bookings_single_day_storage' AND conrelid = 'co_desk.bookings'::regclass) THEN
        ALTER TABLE co_desk.bookings ADD CONSTRAINT ck_bookings_single_day_storage CHECK (
            booking_mode <> 'single_day'
            OR (
                booking_date_start = booking_date_end
                AND start_at = booking_date_start::timestamp AT TIME ZONE 'Asia/Bangkok'
                AND end_at = (booking_date_start + 1)::timestamp AT TIME ZONE 'Asia/Bangkok'
            )
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_bookings_cancellation' AND conrelid = 'co_desk.bookings'::regclass) THEN
        ALTER TABLE co_desk.bookings ADD CONSTRAINT ck_bookings_cancellation CHECK (
            (status_code = 'booked' AND cancelled_at IS NULL AND cancelled_by_profile_id IS NULL)
            OR (status_code = 'cancelled' AND cancelled_at IS NOT NULL AND cancelled_by_profile_id IS NOT NULL)
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_audit_booking' AND conrelid = 'co_desk.booking_audit_logs'::regclass) THEN
        ALTER TABLE co_desk.booking_audit_logs ADD CONSTRAINT fk_audit_booking FOREIGN KEY (booking_id) REFERENCES co_desk.bookings(booking_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_audit_actor' AND conrelid = 'co_desk.booking_audit_logs'::regclass) THEN
        ALTER TABLE co_desk.booking_audit_logs ADD CONSTRAINT fk_audit_actor FOREIGN KEY (actor_profile_id) REFERENCES co_desk.profiles(profile_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_audit_action' AND conrelid = 'co_desk.booking_audit_logs'::regclass) THEN
        ALTER TABLE co_desk.booking_audit_logs ADD CONSTRAINT ck_audit_action CHECK (action_code IN ('create', 'update', 'cancel'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_history_profile' AND conrelid = 'co_desk.user_department_history'::regclass) THEN
        ALTER TABLE co_desk.user_department_history ADD CONSTRAINT fk_history_profile FOREIGN KEY (profile_id) REFERENCES co_desk.profiles(profile_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_history_department' AND conrelid = 'co_desk.user_department_history'::regclass) THEN
        ALTER TABLE co_desk.user_department_history ADD CONSTRAINT fk_history_department FOREIGN KEY (department_id) REFERENCES co_desk.departments(department_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_history_assigned_by' AND conrelid = 'co_desk.user_department_history'::regclass) THEN
        ALTER TABLE co_desk.user_department_history ADD CONSTRAINT fk_history_assigned_by FOREIGN KEY (assigned_by_profile_id) REFERENCES co_desk.profiles(profile_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_history_dates' AND conrelid = 'co_desk.user_department_history'::regclass) THEN
        ALTER TABLE co_desk.user_department_history ADD CONSTRAINT ck_history_dates CHECK (assigned_end_date IS NULL OR assigned_end_date >= assigned_start_date);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ex_bookings_no_active_overlap' AND conrelid = 'co_desk.bookings'::regclass) THEN
        ALTER TABLE co_desk.bookings ADD CONSTRAINT ex_bookings_no_active_overlap
        EXCLUDE USING gist (
            booked_for_profile_id WITH =,
            tstzrange(start_at, end_at, '[)') WITH &&
        ) WHERE (status_code = 'booked');
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_history_one_open_assignment ON co_desk.user_department_history(profile_id) WHERE assigned_end_date IS NULL;
CREATE INDEX IF NOT EXISTS ix_profiles_department ON co_desk.profiles(department_id, is_active);
CREATE INDEX IF NOT EXISTS ix_profiles_role ON co_desk.profiles(role_id);
CREATE INDEX IF NOT EXISTS ix_profiles_name ON co_desk.profiles(lower(full_name));
CREATE INDEX IF NOT EXISTS ix_departments_active ON co_desk.departments(is_active, department_code);
CREATE INDEX IF NOT EXISTS ix_departments_created_by ON co_desk.departments(created_by_profile_id);
CREATE INDEX IF NOT EXISTS ix_holidays_active_date ON co_desk.holidays(holiday_date) WHERE is_active;
CREATE INDEX IF NOT EXISTS ix_holidays_created_by ON co_desk.holidays(created_by_profile_id);
CREATE INDEX IF NOT EXISTS ix_bookings_booked_for ON co_desk.bookings(booked_for_profile_id, start_at);
CREATE INDEX IF NOT EXISTS ix_bookings_booked_by ON co_desk.bookings(booked_by_profile_id);
CREATE INDEX IF NOT EXISTS ix_bookings_cancelled_by ON co_desk.bookings(cancelled_by_profile_id) WHERE cancelled_by_profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_bookings_department_dates ON co_desk.bookings(department_id, booking_date_start, booking_date_end);
CREATE INDEX IF NOT EXISTS ix_bookings_active_department_dates ON co_desk.bookings(department_id, booking_date_start, booking_date_end) WHERE status_code = 'booked';
CREATE INDEX IF NOT EXISTS ix_bookings_status_created ON co_desk.bookings(status_code, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_audit_booking_action ON co_desk.booking_audit_logs(booking_id, action_at DESC);
CREATE INDEX IF NOT EXISTS ix_audit_actor ON co_desk.booking_audit_logs(actor_profile_id, action_at DESC);
CREATE INDEX IF NOT EXISTS ix_history_profile_dates ON co_desk.user_department_history(profile_id, assigned_start_date DESC);
CREATE INDEX IF NOT EXISTS ix_history_department ON co_desk.user_department_history(department_id, assigned_start_date DESC);
CREATE INDEX IF NOT EXISTS ix_history_assigned_by ON co_desk.user_department_history(assigned_by_profile_id);
