SET search_path = co_desk, public;

CREATE TABLE IF NOT EXISTS co_desk.roles (
    role_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    role_code text NOT NULL,
    role_name text NOT NULL,
    role_description text,
    can_manage_users boolean NOT NULL DEFAULT false,
    can_manage_departments boolean NOT NULL DEFAULT false,
    can_view_reports boolean NOT NULL DEFAULT false,
    is_system_role boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS co_desk.departments (
    department_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    department_code text NOT NULL,
    department_name text NOT NULL,
    capacity_mode text NOT NULL,
    default_capacity_per_day integer,
    is_active boolean NOT NULL DEFAULT true,
    effective_timezone text NOT NULL DEFAULT 'Asia/Bangkok',
    created_by_profile_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS co_desk.profiles (
    profile_id uuid PRIMARY KEY,
    employee_code text NOT NULL,
    full_name text NOT NULL,
    email text NOT NULL,
    department_id uuid NOT NULL,
    role_id uuid NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    timezone_name text NOT NULL DEFAULT 'Asia/Bangkok',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS co_desk.holidays (
    holiday_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    holiday_date date NOT NULL,
    holiday_name text NOT NULL,
    holiday_description text,
    is_active boolean NOT NULL DEFAULT true,
    created_by_profile_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS co_desk.bookings (
    booking_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    booked_for_profile_id uuid NOT NULL,
    booked_by_profile_id uuid NOT NULL,
    department_id uuid NOT NULL,
    booking_mode text NOT NULL,
    booking_date_start date NOT NULL,
    booking_date_end date NOT NULL,
    start_at timestamptz NOT NULL,
    end_at timestamptz NOT NULL,
    holiday_warning_acknowledged boolean NOT NULL DEFAULT false,
    status_code text NOT NULL DEFAULT 'booked',
    note_text text,
    cancelled_at timestamptz,
    cancelled_by_profile_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS co_desk.booking_audit_logs (
    audit_log_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id uuid NOT NULL,
    action_code text NOT NULL,
    actor_profile_id uuid NOT NULL,
    actor_role_code text NOT NULL,
    action_reason text,
    old_values_json jsonb,
    new_values_json jsonb,
    action_at timestamptz NOT NULL DEFAULT now(),
    request_id text,
    ip_address inet,
    user_agent text
);

CREATE TABLE IF NOT EXISTS co_desk.user_department_history (
    history_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id uuid NOT NULL,
    department_id uuid NOT NULL,
    assigned_start_date date NOT NULL,
    assigned_end_date date,
    assigned_by_profile_id uuid NOT NULL,
    note_text text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

