using System.Data;
using System.Net;
using System.Text.Json;
using CoDesk.Application;
using CoDesk.Domain;
using Npgsql;
using NpgsqlTypes;

namespace CoDesk.Infrastructure;

public sealed class CoDeskDataService(NpgsqlDataSource dataSource) : ICoDeskDataService
{
    private readonly NpgsqlDataSource _dataSource = dataSource;

    private const string ProfileSelect = """
        SELECT p.profile_id, p.employee_code, p.full_name, p.email,
               p.department_id, d.department_code, d.department_name,
               p.role_id, r.role_code, r.role_name, p.is_active, p.timezone_name, d.effective_timezone,
               r.can_manage_users, r.can_manage_departments, r.can_view_reports
        FROM co_desk.profiles p
        JOIN co_desk.departments d ON d.department_id = p.department_id
        JOIN co_desk.roles r ON r.role_id = p.role_id
        """;

    private const string BookingSelect = """
        SELECT b.booking_id, b.booked_for_profile_id, target.employee_code, target.full_name,
               b.booked_by_profile_id, actor.full_name, b.department_id, d.department_code, d.department_name,
               COALESCE(booking_context.business_timezone, 'Asia/Bangkok') AS business_timezone,
               b.booking_mode, b.booking_date_start, b.booking_date_end, b.start_at, b.end_at,
               b.holiday_warning_acknowledged, b.status_code, b.note_text, b.cancelled_at,
               b.cancelled_by_profile_id, b.created_at, b.updated_at
        FROM co_desk.bookings b
        JOIN co_desk.profiles target ON target.profile_id = b.booked_for_profile_id
        JOIN co_desk.profiles actor ON actor.profile_id = b.booked_by_profile_id
        JOIN co_desk.departments d ON d.department_id = b.department_id
        LEFT JOIN LATERAL (
            SELECT l.new_values_json ->> 'business_timezone' AS business_timezone
            FROM co_desk.booking_audit_logs l
            WHERE l.booking_id = b.booking_id
              AND l.action_code IN ('create', 'update')
              AND l.new_values_json ? 'business_timezone'
            ORDER BY l.action_at DESC
            LIMIT 1
        ) booking_context ON true
        """;

    public async Task<ProfileDto?> GetProfileAsync(Guid profileId, CancellationToken cancellationToken)
    {
        await using var command = _dataSource.CreateCommand(ProfileSelect + " WHERE p.profile_id = @profile_id");
        command.Parameters.AddWithValue("profile_id", profileId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken) ? MapProfile(reader) : null;
    }

    public async Task<IReadOnlyList<ProfileDto>> GetDemoProfilesAsync(CancellationToken cancellationToken)
    {
        await using var command = _dataSource.CreateCommand(ProfileSelect + "\n" + """
             WHERE p.profile_id IN (
                 '30000000-0000-0000-0000-000000000001',
                 '30000000-0000-0000-0000-000000000002',
                 '30000000-0000-0000-0000-000000000003'
             ) AND p.is_active
             ORDER BY CASE r.role_code WHEN 'employee' THEN 1 WHEN 'hr' THEN 2 ELSE 3 END
             """);
        return await ReadListAsync(command, MapProfile, cancellationToken);
    }

    public async Task<IReadOnlyList<RoleDto>> GetRolesAsync(CancellationToken cancellationToken)
    {
        await using var command = _dataSource.CreateCommand("""
            SELECT role_id, role_code, role_name, can_manage_users, can_manage_departments, can_view_reports
            FROM co_desk.roles ORDER BY CASE role_code WHEN 'employee' THEN 1 WHEN 'hr' THEN 2 ELSE 3 END
            """);
        return await ReadListAsync(command, reader => new RoleDto(
            reader.GetGuid(0), reader.GetString(1), reader.GetString(2),
            reader.GetBoolean(3), reader.GetBoolean(4), reader.GetBoolean(5)), cancellationToken);
    }

    public async Task<IReadOnlyList<string>> GetSupportedTimezonesAsync(CancellationToken cancellationToken)
    {
        await using var command = _dataSource.CreateCommand("""
            SELECT name
            FROM pg_catalog.pg_timezone_names
            WHERE name NOT LIKE 'posix/%' AND name NOT LIKE 'right/%'
            ORDER BY name
            """);
        return await ReadListAsync(command, reader => reader.GetString(0), cancellationToken);
    }

    public async Task<DepartmentDto?> GetDepartmentAsync(Guid departmentId, CancellationToken cancellationToken)
    {
        await using var command = _dataSource.CreateCommand("""
            SELECT department_id, department_code, department_name, capacity_mode,
                   default_capacity_per_day, is_active, effective_timezone, created_at, updated_at
            FROM co_desk.departments
            WHERE department_id = @department_id
            """);
        command.Parameters.AddWithValue("department_id", departmentId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken) ? MapDepartment(reader) : null;
    }

    public async Task<PageResult<DepartmentDto>> GetDepartmentsAsync(ListQuery query, bool includeInactive, CancellationToken cancellationToken)
    {
        var (page, pageSize) = NormalizePage(query.Page, query.PageSize);
        var sort = query.SortBy?.ToLowerInvariant() switch
        {
            "departmentname" => "department_name",
            "capacitymode" => "capacity_mode",
            "isactive" => "is_active",
            _ => "department_code"
        };
        var direction = IsDescending(query.SortDirection) ? "DESC" : "ASC";
        await using var command = _dataSource.CreateCommand($$"""
            SELECT department_id, department_code, department_name, capacity_mode,
                   default_capacity_per_day, is_active, effective_timezone, created_at, updated_at,
                   count(*) OVER()::integer AS total_count
            FROM co_desk.departments
            WHERE (@include_inactive OR is_active)
              AND (@search = '' OR department_code ILIKE @search_pattern OR department_name ILIKE @search_pattern)
            ORDER BY {{sort}} {{direction}}, department_id
            LIMIT @page_size OFFSET @offset
            """);
        AddListParameters(command, query.Search, includeInactive, page, pageSize);
        var items = new List<DepartmentDto>();
        var total = 0;
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            items.Add(MapDepartment(reader));
            total = reader.GetInt32(9);
        }
        return new PageResult<DepartmentDto>(items, total, page, pageSize);
    }

    public async Task<DepartmentDto?> CreateDepartmentAsync(DepartmentUpsertRequest request, Guid actorId, CancellationToken cancellationToken)
    {
        await EnsureSupportedTimezoneAsync(request.EffectiveTimezone, cancellationToken);
        await using var command = _dataSource.CreateCommand("""
            INSERT INTO co_desk.departments (
                department_code, department_name, capacity_mode, default_capacity_per_day,
                is_active, effective_timezone, created_by_profile_id
            ) VALUES (upper(@code), @name, @capacity_mode, @capacity, @is_active, @timezone, @actor_id)
            RETURNING department_id, department_code, department_name, capacity_mode,
                      default_capacity_per_day, is_active, effective_timezone, created_at, updated_at
            """);
        AddDepartmentParameters(command, request);
        command.Parameters.AddWithValue("actor_id", actorId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken) ? MapDepartment(reader) : null;
    }

    public async Task<DepartmentDto?> UpdateDepartmentAsync(Guid departmentId, DepartmentUpsertRequest request, CancellationToken cancellationToken)
    {
        await EnsureSupportedTimezoneAsync(request.EffectiveTimezone, cancellationToken);
        await using var command = _dataSource.CreateCommand("""
            UPDATE co_desk.departments SET
                department_code = upper(@code), department_name = @name,
                capacity_mode = @capacity_mode, default_capacity_per_day = @capacity,
                is_active = @is_active, effective_timezone = @timezone
            WHERE department_id = @department_id
            RETURNING department_id, department_code, department_name, capacity_mode,
                      default_capacity_per_day, is_active, effective_timezone, created_at, updated_at
            """);
        AddDepartmentParameters(command, request);
        command.Parameters.AddWithValue("department_id", departmentId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken) ? MapDepartment(reader) : null;
    }

    public async Task<PageResult<ProfileDto>> GetProfilesAsync(ListQuery query, CurrentUser actor, bool includeInactive, CancellationToken cancellationToken)
    {
        var (page, pageSize) = NormalizePage(query.Page, query.PageSize);
        var sort = query.SortBy?.ToLowerInvariant() switch
        {
            "fullname" => "p.full_name",
            "email" => "p.email",
            "departmentname" => "d.department_name",
            "rolecode" => "r.role_code",
            "isactive" => "p.is_active",
            _ => "p.employee_code"
        };
        var direction = IsDescending(query.SortDirection) ? "DESC" : "ASC";
        var sql = ProfileSelect + "\n" + $$"""
            WHERE (@include_inactive OR p.is_active)
              AND (@can_manage OR p.department_id = @actor_department_id)
              AND (@search = '' OR p.employee_code ILIKE @search_pattern OR p.full_name ILIKE @search_pattern OR p.email ILIKE @search_pattern)
            ORDER BY {{sort}} {{direction}}, p.profile_id
            LIMIT @page_size OFFSET @offset
            """;
        var countSql = """
            SELECT count(*)::integer
            FROM co_desk.profiles p
            WHERE (@include_inactive OR p.is_active)
              AND (@can_manage OR p.department_id = @actor_department_id)
              AND (@search = '' OR p.employee_code ILIKE @search_pattern OR p.full_name ILIKE @search_pattern OR p.email ILIKE @search_pattern)
            """;

        await using var countCommand = _dataSource.CreateCommand(countSql);
        AddProfileListParameters(countCommand, query.Search, includeInactive, actor);
        var total = Convert.ToInt32(await countCommand.ExecuteScalarAsync(cancellationToken));

        await using var command = _dataSource.CreateCommand(sql);
        AddProfileListParameters(command, query.Search, includeInactive, actor);
        command.Parameters.AddWithValue("page_size", pageSize);
        command.Parameters.AddWithValue("offset", (page - 1) * pageSize);
        var items = await ReadListAsync(command, MapProfile, cancellationToken);
        return new PageResult<ProfileDto>(items, total, page, pageSize);
    }

    public async Task<ProfileDto?> UpdateProfileAsync(Guid profileId, ProfileUpdateRequest request, CurrentUser actor, CancellationToken cancellationToken)
    {
        var existing = await GetProfileAsync(profileId, cancellationToken);
        if (existing is null) return null;
        var roleId = actor.RoleCode == RoleCodes.Admin && request.RoleId.HasValue ? request.RoleId.Value : existing.RoleId;

        await using (var validationCommand = _dataSource.CreateCommand("""
            SELECT
                EXISTS (SELECT 1 FROM co_desk.departments WHERE department_id = @department_id) AS department_exists,
                EXISTS (SELECT 1 FROM co_desk.departments WHERE department_id = @department_id AND is_active) AS department_active,
                EXISTS (SELECT 1 FROM co_desk.roles WHERE role_id = @role_id) AS role_exists
            """))
        {
            validationCommand.Parameters.AddWithValue("department_id", request.DepartmentId);
            validationCommand.Parameters.AddWithValue("role_id", roleId);
            await using var reader = await validationCommand.ExecuteReaderAsync(cancellationToken);
            await reader.ReadAsync(cancellationToken);
            if (!reader.GetBoolean(0)) throw new ArgumentException("Department was not found.");
            if (request.IsActive && !reader.GetBoolean(1)) throw new ArgumentException("An active profile must belong to an active department.");
            if (!reader.GetBoolean(2)) throw new ArgumentException("Application role was not found.");
        }

        await using var connection = await _dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        await using (var contextCommand = new NpgsqlCommand("SELECT set_config('app.current_profile_id', @actor_id, true)", connection, transaction))
        {
            contextCommand.Parameters.AddWithValue("actor_id", actor.ProfileId.ToString());
            await contextCommand.ExecuteNonQueryAsync(cancellationToken);
        }
        await using (var command = new NpgsqlCommand("""
            UPDATE co_desk.profiles SET
                employee_code = upper(@employee_code), full_name = @full_name, email = lower(@email),
                department_id = @department_id, role_id = @role_id, is_active = @is_active
            WHERE profile_id = @profile_id
            """, connection, transaction))
        {
            AddProfileWriteParameters(command, request.EmployeeCode, request.FullName, request.Email, request.DepartmentId, roleId, request.IsActive);
            command.Parameters.AddWithValue("profile_id", profileId);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }
        await transaction.CommitAsync(cancellationToken);
        return await GetProfileAsync(profileId, cancellationToken);
    }

    public async Task ValidateNewProfileAsync(AdminCreateUserRequest request, CancellationToken cancellationToken)
    {
        await using var command = _dataSource.CreateCommand("""
            SELECT
                EXISTS (
                    SELECT 1 FROM co_desk.profiles
                    WHERE employee_code = upper(@employee_code) OR email = lower(@email)
                ) AS duplicate_identity,
                EXISTS (
                    SELECT 1 FROM co_desk.departments
                    WHERE department_id = @department_id AND is_active
                ) AS active_department,
                EXISTS (
                    SELECT 1 FROM co_desk.roles WHERE role_id = @role_id
                ) AS valid_role
            """);
        command.Parameters.AddWithValue("employee_code", request.EmployeeCode.Trim());
        command.Parameters.AddWithValue("email", request.Email.Trim());
        command.Parameters.AddWithValue("department_id", request.DepartmentId);
        command.Parameters.AddWithValue("role_id", request.RoleId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        await reader.ReadAsync(cancellationToken);
        if (reader.GetBoolean(0)) throw new ConflictException("Employee code or email already exists.");
        if (!reader.GetBoolean(1)) throw new ArgumentException("An active department is required.");
        if (!reader.GetBoolean(2)) throw new ArgumentException("A valid application role is required.");
    }

    public async Task<ProfileDto> CreateProfileAsync(
        Guid authUserId,
        AdminCreateUserRequest request,
        Guid actorId,
        CancellationToken cancellationToken)
    {
        await using var connection = await _dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        await using (var contextCommand = new NpgsqlCommand("SELECT set_config('app.current_profile_id', @actor_id, true)", connection, transaction))
        {
            contextCommand.Parameters.AddWithValue("actor_id", actorId.ToString());
            await contextCommand.ExecuteNonQueryAsync(cancellationToken);
        }
        await using (var command = new NpgsqlCommand("""
            INSERT INTO co_desk.profiles (
                profile_id, employee_code, full_name, email, department_id, role_id, is_active
            ) VALUES (@profile_id, upper(@employee_code), @full_name, lower(@email), @department_id, @role_id, @is_active)
            """, connection, transaction))
        {
            command.Parameters.AddWithValue("profile_id", authUserId);
            AddProfileWriteParameters(command, request.EmployeeCode, request.FullName, request.Email, request.DepartmentId, request.RoleId, request.IsActive);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }
        await transaction.CommitAsync(cancellationToken);
        return await GetProfileAsync(authUserId, cancellationToken)
            ?? throw new DataException("The profile was inserted but could not be read.");
    }

    public async Task<PageResult<HolidayDto>> GetHolidaysAsync(ListQuery query, bool includeInactive, CancellationToken cancellationToken)
    {
        var (page, pageSize) = NormalizePage(query.Page, query.PageSize);
        var sort = query.SortBy?.ToLowerInvariant() switch
        {
            "holidayname" => "holiday_name",
            "isactive" => "is_active",
            _ => "holiday_date"
        };
        var direction = IsDescending(query.SortDirection) ? "DESC" : "ASC";
        await using var command = _dataSource.CreateCommand($$"""
            SELECT holiday_id, holiday_date, holiday_name, holiday_description, is_active,
                   created_by_profile_id, created_at, updated_at, count(*) OVER()::integer AS total_count
            FROM co_desk.holidays
            WHERE (@include_inactive OR is_active)
              AND (@search = '' OR holiday_name ILIKE @search_pattern OR COALESCE(holiday_description, '') ILIKE @search_pattern)
            ORDER BY {{sort}} {{direction}}, holiday_id
            LIMIT @page_size OFFSET @offset
            """);
        AddListParameters(command, query.Search, includeInactive, page, pageSize);
        var items = new List<HolidayDto>();
        var total = 0;
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            items.Add(MapHoliday(reader));
            total = reader.GetInt32(8);
        }
        return new PageResult<HolidayDto>(items, total, page, pageSize);
    }

    public async Task<HolidayDto?> CreateHolidayAsync(HolidayUpsertRequest request, Guid actorId, CancellationToken cancellationToken)
    {
        await using var command = _dataSource.CreateCommand("""
            INSERT INTO co_desk.holidays (holiday_date, holiday_name, holiday_description, is_active, created_by_profile_id)
            VALUES (@date, @name, @description, @is_active, @actor_id)
            RETURNING holiday_id, holiday_date, holiday_name, holiday_description, is_active,
                      created_by_profile_id, created_at, updated_at
            """);
        AddHolidayParameters(command, request);
        command.Parameters.AddWithValue("actor_id", actorId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken) ? MapHoliday(reader) : null;
    }

    public async Task<HolidayDto?> UpdateHolidayAsync(Guid holidayId, HolidayUpsertRequest request, CancellationToken cancellationToken)
    {
        await using var command = _dataSource.CreateCommand("""
            UPDATE co_desk.holidays SET holiday_date = @date, holiday_name = @name,
                holiday_description = @description, is_active = @is_active
            WHERE holiday_id = @holiday_id
            RETURNING holiday_id, holiday_date, holiday_name, holiday_description, is_active,
                      created_by_profile_id, created_at, updated_at
            """);
        AddHolidayParameters(command, request);
        command.Parameters.AddWithValue("holiday_id", holidayId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken) ? MapHoliday(reader) : null;
    }

    public async Task<PageResult<BookingDto>> GetBookingsAsync(BookingQuery query, CurrentUser actor, bool calendarScope, CancellationToken cancellationToken)
    {
        var (page, pageSize) = NormalizePage(query.Page, query.PageSize, 500);
        var where = new List<string> { "1 = 1" };
        if (calendarScope)
        {
            if (actor.RoleCode != RoleCodes.Admin) where.Add("b.department_id = @actor_department_id");
        }
        else if (actor.RoleCode != RoleCodes.Admin)
        {
            where.Add("b.booked_for_profile_id = @actor_profile_id");
        }
        if (query.ProfileId.HasValue) where.Add("b.booked_for_profile_id = @profile_id");
        if (query.DepartmentId.HasValue) where.Add("b.department_id = @department_id");
        if (query.DateFrom.HasValue) where.Add("b.booking_date_end >= @date_from");
        if (query.DateTo.HasValue) where.Add("b.booking_date_start <= @date_to");
        if (!string.IsNullOrWhiteSpace(query.Status)) where.Add("b.status_code = @status");

        var filter = string.Join(" AND ", where);
        await using var countCommand = _dataSource.CreateCommand("SELECT count(*)::integer FROM co_desk.bookings b WHERE " + filter);
        AddBookingQueryParameters(countCommand, query, actor);
        var total = Convert.ToInt32(await countCommand.ExecuteScalarAsync(cancellationToken));

        await using var command = _dataSource.CreateCommand(BookingSelect + $" WHERE {filter} ORDER BY b.start_at, b.booking_id LIMIT @page_size OFFSET @offset");
        AddBookingQueryParameters(command, query, actor);
        command.Parameters.AddWithValue("page_size", pageSize);
        command.Parameters.AddWithValue("offset", (page - 1) * pageSize);
        var items = await ReadListAsync(command, MapBooking, cancellationToken);
        return new PageResult<BookingDto>(items, total, page, pageSize);
    }

    public async Task<BookingDto?> GetBookingAsync(Guid bookingId, CancellationToken cancellationToken)
    {
        await using var command = _dataSource.CreateCommand(BookingSelect + " WHERE b.booking_id = @booking_id");
        command.Parameters.AddWithValue("booking_id", bookingId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken) ? MapBooking(reader) : null;
    }

    public async Task<BookingValidationResult> ValidateBookingAsync(BookingWriteRequest request, Guid targetProfileId, Guid? excludeBookingId, CancellationToken cancellationToken)
    {
        var target = await GetProfileAsync(targetProfileId, cancellationToken)
            ?? throw new KeyNotFoundException("Target profile was not found.");
        var (startAt, endAt) = NormalizeBookingRange(request, target.DepartmentTimezone);
        await using var command = _dataSource.CreateCommand("""
            SELECT co_desk.check_booking_conflict(@target, @start_at, @end_at, @exclude)::text,
                   co_desk.check_department_capacity(@department, @start_at, @end_at, @exclude)::text,
                   co_desk.check_booking_holidays(@department, @start_at, @end_at)::text
            """);
        command.Parameters.AddWithValue("target", targetProfileId);
        command.Parameters.AddWithValue("department", target.DepartmentId);
        command.Parameters.AddWithValue("start_at", startAt);
        command.Parameters.AddWithValue("end_at", endAt);
        AddNullable(command, "exclude", NpgsqlDbType.Uuid, excludeBookingId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        await reader.ReadAsync(cancellationToken);
        return new BookingValidationResult(ParseElement(reader.GetString(0)), ParseElement(reader.GetString(1)), ParseElement(reader.GetString(2)));
    }

    public Task<BookingOperationResult> CreateBookingAsync(BookingWriteRequest request, Guid targetProfileId, CurrentUser actor, RequestMetadata metadata, CancellationToken cancellationToken) =>
        ExecuteBookingFunctionAsync("""
            SELECT co_desk.create_booking(
                @target, @actor, @mode, @booking_date, @start_at, @end_at,
                @holiday_ack, @note, @request_id, @ip_address, @user_agent
            )::text
            """, command =>
        {
            AddBookingWriteParameters(command, request, targetProfileId, actor.ProfileId, metadata);
        }, cancellationToken);

    public Task<BookingOperationResult> UpdateBookingAsync(Guid bookingId, BookingWriteRequest request, Guid targetProfileId, CurrentUser actor, RequestMetadata metadata, CancellationToken cancellationToken) =>
        ExecuteBookingFunctionAsync("""
            SELECT co_desk.update_booking(
                @booking_id, @actor, @target, @mode, @booking_date, @start_at, @end_at,
                @holiday_ack, @note, @reason, @request_id, @ip_address, @user_agent
            )::text
            """, command =>
        {
            command.Parameters.AddWithValue("booking_id", bookingId);
            AddBookingWriteParameters(command, request, targetProfileId, actor.ProfileId, metadata);
            command.Parameters.AddWithValue("reason", request.ActionReason ?? string.Empty);
        }, cancellationToken);

    public Task<BookingOperationResult> CancelBookingAsync(Guid bookingId, CurrentUser actor, CancelBookingRequest request, RequestMetadata metadata, CancellationToken cancellationToken) =>
        ExecuteBookingFunctionAsync("""
            SELECT co_desk.cancel_booking(
                @booking_id, @actor, @reason, @request_id, @ip_address, @user_agent
            )::text
            """, command =>
        {
            command.Parameters.AddWithValue("booking_id", bookingId);
            command.Parameters.AddWithValue("actor", actor.ProfileId);
            command.Parameters.AddWithValue("reason", request.Reason ?? string.Empty);
            command.Parameters.AddWithValue("request_id", metadata.RequestId);
            AddNullable(command, "ip_address", NpgsqlDbType.Inet, ParseIpAddress(metadata.IpAddress));
            AddNullable(command, "user_agent", NpgsqlDbType.Text, metadata.UserAgent);
        }, cancellationToken);

    public async Task<IReadOnlyList<HistoryDto>> GetDepartmentHistoryAsync(Guid profileId, CancellationToken cancellationToken)
    {
        await using var command = _dataSource.CreateCommand("""
            SELECT h.history_id, h.profile_id, h.department_id, d.department_code, d.department_name,
                   h.assigned_start_date, h.assigned_end_date, h.assigned_by_profile_id,
                   actor.full_name, h.note_text, h.created_at, h.updated_at
            FROM co_desk.user_department_history h
            JOIN co_desk.departments d ON d.department_id = h.department_id
            JOIN co_desk.profiles actor ON actor.profile_id = h.assigned_by_profile_id
            WHERE h.profile_id = @profile_id
            ORDER BY h.assigned_start_date DESC, h.created_at DESC
            """);
        command.Parameters.AddWithValue("profile_id", profileId);
        return await ReadListAsync(command, reader => new HistoryDto(
            reader.GetGuid(0), reader.GetGuid(1), reader.GetGuid(2), reader.GetString(3), reader.GetString(4),
            reader.GetFieldValue<DateOnly>(5), reader.IsDBNull(6) ? null : reader.GetFieldValue<DateOnly>(6),
            reader.GetGuid(7), reader.GetString(8), reader.IsDBNull(9) ? null : reader.GetString(9),
            reader.GetFieldValue<DateTimeOffset>(10), reader.GetFieldValue<DateTimeOffset>(11)), cancellationToken);
    }

    public async Task<IReadOnlyList<AuditLogDto>> GetBookingAuditAsync(Guid bookingId, CancellationToken cancellationToken)
    {
        await using var command = _dataSource.CreateCommand("""
            SELECT l.audit_log_id, l.booking_id, l.action_code, l.actor_profile_id, p.full_name,
                   l.actor_role_code, l.action_reason, l.old_values_json::text, l.new_values_json::text,
                   l.action_at, l.request_id, l.ip_address::text, l.user_agent
            FROM co_desk.booking_audit_logs l
            JOIN co_desk.profiles p ON p.profile_id = l.actor_profile_id
            WHERE l.booking_id = @booking_id ORDER BY l.action_at
            """);
        command.Parameters.AddWithValue("booking_id", bookingId);
        return await ReadListAsync(command, reader => new AuditLogDto(
            reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2), reader.GetGuid(3), reader.GetString(4), reader.GetString(5),
            reader.IsDBNull(6) ? null : reader.GetString(6), ParseNullableElement(reader, 7), ParseNullableElement(reader, 8),
            reader.GetFieldValue<DateTimeOffset>(9), reader.IsDBNull(10) ? null : reader.GetString(10),
            reader.IsDBNull(11) ? null : reader.GetString(11), reader.IsDBNull(12) ? null : reader.GetString(12)), cancellationToken);
    }

    public async Task<ReportPage> GetReportAsync(string reportCode, ReportQuery query, CancellationToken cancellationToken)
    {
        if (!ReportDefinitions.TryGetValue(reportCode, out var definition))
            throw new KeyNotFoundException("Unknown report.");

        var (page, pageSize) = NormalizePage(query.Page, query.PageSize, 500);
        var conditions = new List<string>();
        await using var command = _dataSource.CreateCommand();
        if (query.DateFrom.HasValue && definition.DateColumn is not null)
        {
            conditions.Add($"v.{definition.DateColumn} >= @date_from");
            command.Parameters.AddWithValue("date_from", query.DateFrom.Value);
        }
        if (query.DateTo.HasValue && definition.DateColumn is not null)
        {
            conditions.Add($"v.{definition.DateColumn} <= @date_to");
            command.Parameters.AddWithValue("date_to", query.DateTo.Value);
        }
        if (query.DepartmentId.HasValue && definition.Columns.Contains("department_id"))
        {
            conditions.Add("v.department_id = @department_id");
            command.Parameters.AddWithValue("department_id", query.DepartmentId.Value);
        }
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            conditions.Add("to_jsonb(v)::text ILIKE @search");
            command.Parameters.AddWithValue("search", $"%{query.Search.Trim()}%");
        }
        if (!string.IsNullOrWhiteSpace(query.Filters))
        {
            var filters = JsonSerializer.Deserialize<Dictionary<string, string>>(query.Filters) ?? [];
            var index = 0;
            foreach (var (column, value) in filters.Where(item => !string.IsNullOrWhiteSpace(item.Value)))
            {
                if (!definition.Columns.Contains(column)) continue;
                var parameter = $"filter_{index++}";
                conditions.Add($"v.{column}::text ILIKE @{parameter}");
                command.Parameters.AddWithValue(parameter, $"%{value.Trim()}%");
            }
        }
        var sort = definition.Columns.Contains(query.SortBy ?? string.Empty) ? query.SortBy! : definition.DefaultSort;
        var direction = IsDescending(query.SortDirection) ? "DESC" : "ASC";
        var where = conditions.Count == 0 ? string.Empty : " WHERE " + string.Join(" AND ", conditions);
        command.CommandText = $"""
            SELECT to_jsonb(v)::text AS row_json, count(*) OVER()::integer AS total_count
            FROM co_desk.{definition.ViewName} v
            {where}
            ORDER BY v.{sort} {direction} NULLS LAST
            LIMIT @page_size OFFSET @offset
            """;
        command.Parameters.AddWithValue("page_size", pageSize);
        command.Parameters.AddWithValue("offset", (page - 1) * pageSize);
        var items = new List<JsonElement>();
        var total = 0;
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            items.Add(ParseElement(reader.GetString(0)));
            total = reader.GetInt32(1);
        }
        return new ReportPage(items, total, page, pageSize);
    }

    private async Task<BookingOperationResult> ExecuteBookingFunctionAsync(string sql, Action<NpgsqlCommand> configure, CancellationToken cancellationToken)
    {
        await using var command = _dataSource.CreateCommand(sql);
        configure(command);
        var payload = (string?)await command.ExecuteScalarAsync(cancellationToken)
            ?? throw new DataException("Booking function returned no result.");
        var root = ParseElement(payload);
        var success = root.TryGetProperty("success", out var successValue) && successValue.GetBoolean();
        var code = root.TryGetProperty("code", out var codeValue) ? codeValue.GetString() ?? "unknown" : "unknown";
        var message = root.TryGetProperty("message", out var messageValue) ? messageValue.GetString() : null;
        JsonElement? booking = root.TryGetProperty("booking", out var bookingValue) ? bookingValue.Clone() : null;
        JsonElement? details = root.TryGetProperty("details", out var detailsValue) ? detailsValue.Clone() : null;
        return new BookingOperationResult(success, code, message, booking, details);
    }

    private static void AddBookingWriteParameters(NpgsqlCommand command, BookingWriteRequest request, Guid targetId, Guid actorId, RequestMetadata metadata)
    {
        command.Parameters.AddWithValue("target", targetId);
        command.Parameters.AddWithValue("actor", actorId);
        command.Parameters.AddWithValue("mode", request.BookingMode);
        AddNullable(command, "booking_date", NpgsqlDbType.Date, request.BookingDateStart);
        AddNullable(command, "start_at", NpgsqlDbType.TimestampTz, request.StartAt);
        AddNullable(command, "end_at", NpgsqlDbType.TimestampTz, request.EndAt);
        command.Parameters.AddWithValue("holiday_ack", request.HolidayWarningAcknowledged);
        command.Parameters.AddWithValue("note", request.NoteText ?? string.Empty);
        command.Parameters.AddWithValue("request_id", metadata.RequestId);
        AddNullable(command, "ip_address", NpgsqlDbType.Inet, ParseIpAddress(metadata.IpAddress));
        AddNullable(command, "user_agent", NpgsqlDbType.Text, metadata.UserAgent);
    }

    private static (DateTimeOffset StartAt, DateTimeOffset EndAt) NormalizeBookingRange(
        BookingWriteRequest request,
        string departmentTimezone)
    {
        if (request.BookingMode == BookingModes.SingleDay && request.BookingDateStart.HasValue)
        {
            var date = request.BookingDateStart.Value;
            return (
                TimezoneRules.LocalDateTimeToUtc(date, TimeOnly.MinValue, departmentTimezone),
                TimezoneRules.LocalDateTimeToUtc(date.AddDays(1), TimeOnly.MinValue, departmentTimezone)
            );
        }
        if (request.BookingMode == BookingModes.DateTimeRange && request.StartAt.HasValue && request.EndAt > request.StartAt)
            return (request.StartAt.Value, request.EndAt!.Value);
        throw new ArgumentException("Invalid booking date or time range.");
    }

    private static void AddBookingQueryParameters(NpgsqlCommand command, BookingQuery query, CurrentUser actor)
    {
        command.Parameters.AddWithValue("actor_profile_id", actor.ProfileId);
        command.Parameters.AddWithValue("actor_department_id", actor.DepartmentId);
        if (query.ProfileId.HasValue) command.Parameters.AddWithValue("profile_id", query.ProfileId.Value);
        if (query.DepartmentId.HasValue) command.Parameters.AddWithValue("department_id", query.DepartmentId.Value);
        if (query.DateFrom.HasValue) command.Parameters.AddWithValue("date_from", query.DateFrom.Value);
        if (query.DateTo.HasValue) command.Parameters.AddWithValue("date_to", query.DateTo.Value);
        if (!string.IsNullOrWhiteSpace(query.Status)) command.Parameters.AddWithValue("status", query.Status);
    }

    private static ProfileDto MapProfile(NpgsqlDataReader reader) => new(
        reader.GetGuid(0), reader.GetString(1), reader.GetString(2), reader.GetString(3),
        reader.GetGuid(4), reader.GetString(5), reader.GetString(6), reader.GetGuid(7),
        reader.GetString(8), reader.GetString(9), reader.GetBoolean(10), reader.GetString(11),
        reader.GetString(12), reader.GetBoolean(13), reader.GetBoolean(14), reader.GetBoolean(15));

    private static DepartmentDto MapDepartment(NpgsqlDataReader reader) => new(
        reader.GetGuid(0), reader.GetString(1), reader.GetString(2), reader.GetString(3),
        reader.IsDBNull(4) ? null : reader.GetInt32(4), reader.GetBoolean(5), reader.GetString(6),
        reader.GetFieldValue<DateTimeOffset>(7), reader.GetFieldValue<DateTimeOffset>(8));

    private static HolidayDto MapHoliday(NpgsqlDataReader reader) => new(
        reader.GetGuid(0), reader.GetFieldValue<DateOnly>(1), reader.GetString(2),
        reader.IsDBNull(3) ? null : reader.GetString(3), reader.GetBoolean(4), reader.GetGuid(5),
        reader.GetFieldValue<DateTimeOffset>(6), reader.GetFieldValue<DateTimeOffset>(7));

    private static BookingDto MapBooking(NpgsqlDataReader reader) => new(
        reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2), reader.GetString(3),
        reader.GetGuid(4), reader.GetString(5), reader.GetGuid(6), reader.GetString(7), reader.GetString(8),
        reader.GetString(9), reader.GetString(10), reader.GetFieldValue<DateOnly>(11), reader.GetFieldValue<DateOnly>(12),
        reader.GetFieldValue<DateTimeOffset>(13), reader.GetFieldValue<DateTimeOffset>(14), reader.GetBoolean(15),
        reader.GetString(16), reader.IsDBNull(17) ? null : reader.GetString(17),
        reader.IsDBNull(18) ? null : reader.GetFieldValue<DateTimeOffset>(18),
        reader.IsDBNull(19) ? null : reader.GetGuid(19), reader.GetFieldValue<DateTimeOffset>(20), reader.GetFieldValue<DateTimeOffset>(21));

    private static async Task<IReadOnlyList<T>> ReadListAsync<T>(NpgsqlCommand command, Func<NpgsqlDataReader, T> map, CancellationToken cancellationToken)
    {
        var items = new List<T>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken)) items.Add(map(reader));
        return items;
    }

    private static void AddDepartmentParameters(NpgsqlCommand command, DepartmentUpsertRequest request)
    {
        command.Parameters.AddWithValue("code", request.DepartmentCode.Trim());
        command.Parameters.AddWithValue("name", request.DepartmentName.Trim());
        command.Parameters.AddWithValue("capacity_mode", request.CapacityMode);
        AddNullable(command, "capacity", NpgsqlDbType.Integer, request.DefaultCapacityPerDay);
        command.Parameters.AddWithValue("is_active", request.IsActive);
        command.Parameters.AddWithValue("timezone", request.EffectiveTimezone.Trim());
    }

    private async Task EnsureSupportedTimezoneAsync(string timezoneName, CancellationToken cancellationToken)
    {
        TimezoneRules.GetRequiredTimeZone(timezoneName);
        await using var command = _dataSource.CreateCommand("SELECT co_desk.is_supported_timezone(@timezone)");
        command.Parameters.AddWithValue("timezone", timezoneName.Trim());
        if (await command.ExecuteScalarAsync(cancellationToken) is not true)
            throw new ArgumentException("The selected IANA timezone is not supported.");
    }

    private static void AddHolidayParameters(NpgsqlCommand command, HolidayUpsertRequest request)
    {
        command.Parameters.AddWithValue("date", request.HolidayDate);
        command.Parameters.AddWithValue("name", request.HolidayName.Trim());
        AddNullable(command, "description", NpgsqlDbType.Text, request.HolidayDescription);
        command.Parameters.AddWithValue("is_active", request.IsActive);
    }

    private static void AddProfileWriteParameters(NpgsqlCommand command, string code, string name, string email, Guid departmentId, Guid roleId, bool isActive)
    {
        command.Parameters.AddWithValue("employee_code", code.Trim());
        command.Parameters.AddWithValue("full_name", name.Trim());
        command.Parameters.AddWithValue("email", email.Trim());
        command.Parameters.AddWithValue("department_id", departmentId);
        command.Parameters.AddWithValue("role_id", roleId);
        command.Parameters.AddWithValue("is_active", isActive);
    }

    private static void AddListParameters(NpgsqlCommand command, string? search, bool includeInactive, int page, int pageSize)
    {
        var normalized = search?.Trim() ?? string.Empty;
        command.Parameters.AddWithValue("include_inactive", includeInactive);
        command.Parameters.AddWithValue("search", normalized);
        command.Parameters.AddWithValue("search_pattern", $"%{normalized}%");
        command.Parameters.AddWithValue("page_size", pageSize);
        command.Parameters.AddWithValue("offset", (page - 1) * pageSize);
    }

    private static void AddProfileListParameters(NpgsqlCommand command, string? search, bool includeInactive, CurrentUser actor)
    {
        var normalized = search?.Trim() ?? string.Empty;
        command.Parameters.AddWithValue("include_inactive", includeInactive);
        command.Parameters.AddWithValue("can_manage", actor.RoleCode is RoleCodes.Hr or RoleCodes.Admin);
        command.Parameters.AddWithValue("actor_department_id", actor.DepartmentId);
        command.Parameters.AddWithValue("search", normalized);
        command.Parameters.AddWithValue("search_pattern", $"%{normalized}%");
    }

    private static void AddNullable(NpgsqlCommand command, string name, NpgsqlDbType type, object? value) =>
        command.Parameters.Add(new NpgsqlParameter(name, type) { Value = value ?? DBNull.Value });

    private static IPAddress? ParseIpAddress(string? value) =>
        IPAddress.TryParse(value, out var address) ? address : null;

    private static JsonElement ParseElement(string json)
    {
        using var document = JsonDocument.Parse(json);
        return document.RootElement.Clone();
    }

    private static JsonElement? ParseNullableElement(NpgsqlDataReader reader, int ordinal) =>
        reader.IsDBNull(ordinal) ? null : ParseElement(reader.GetString(ordinal));

    private static (int Page, int PageSize) NormalizePage(int page, int pageSize, int maximum = 100) =>
        (Math.Max(page, 1), Math.Clamp(pageSize, 1, maximum));

    private static bool IsDescending(string? direction) => string.Equals(direction, "desc", StringComparison.OrdinalIgnoreCase);

    private sealed record ReportDefinition(string ViewName, HashSet<string> Columns, string DefaultSort, string? DateColumn);

    private static readonly Dictionary<string, ReportDefinition> ReportDefinitions = new(StringComparer.OrdinalIgnoreCase)
    {
        ["daily-department-bookings"] = new("vw_daily_department_bookings",
            ["business_date", "department_id", "department_code", "department_name", "active_booking_total"], "business_date", "business_date"),
        ["department-capacity-utilization"] = new("vw_department_capacity_utilization",
            ["business_date", "department_id", "department_code", "department_name", "capacity_mode", "capacity_per_day", "booked_count", "remaining_capacity", "utilization_percentage"], "business_date", "business_date"),
        ["employee-booking-frequency"] = new("vw_employee_booking_frequency",
            ["profile_id", "employee_code", "full_name", "email", "department_id", "department_code", "department_name", "total_bookings", "active_bookings", "cancelled_bookings", "first_booking_date", "last_booking_date"], "employee_code", "first_booking_date"),
        ["holiday-bookings"] = new("vw_holiday_bookings",
            ["holiday_id", "holiday_date", "holiday_name", "booking_id", "status_code", "booking_mode", "start_at", "end_at", "holiday_warning_acknowledged", "profile_id", "employee_code", "full_name", "department_id", "department_code", "department_name"], "holiday_date", "holiday_date"),
        ["booking-cancellations"] = new("vw_booking_cancellation_summary",
            ["booking_id", "cancellation_date", "cancelled_at", "profile_id", "employee_code", "full_name", "department_id", "department_code", "department_name", "cancelled_by_profile_id", "cancelled_by_name", "action_reason", "department_daily_cancellation_total"], "cancellation_date", "cancellation_date")
    };
}
