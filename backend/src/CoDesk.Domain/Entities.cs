namespace CoDesk.Domain;

public static class RoleCodes
{
    public const string Employee = "employee";
    public const string Hr = "hr";
    public const string Admin = "admin";

    public static readonly IReadOnlySet<string> All = new HashSet<string>(
        [Employee, Hr, Admin], StringComparer.OrdinalIgnoreCase);
}

public static class BookingModes
{
    public const string SingleDay = "single_day";
    public const string DateTimeRange = "date_time_range";
}

public static class BookingStatuses
{
    public const string Booked = "booked";
    public const string Cancelled = "cancelled";
}

public sealed class Role
{
    public Guid RoleId { get; set; }
    public required string RoleCode { get; set; }
    public required string RoleName { get; set; }
    public string? RoleDescription { get; set; }
    public bool CanManageUsers { get; set; }
    public bool CanManageDepartments { get; set; }
    public bool CanViewReports { get; set; }
    public bool IsSystemRole { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class Department
{
    public Guid DepartmentId { get; set; }
    public required string DepartmentCode { get; set; }
    public required string DepartmentName { get; set; }
    public required string CapacityMode { get; set; }
    public int? DefaultCapacityPerDay { get; set; }
    public bool IsActive { get; set; }
    public required string EffectiveTimezone { get; set; }
    public Guid? CreatedByProfileId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class Profile
{
    public Guid ProfileId { get; set; }
    public required string EmployeeCode { get; set; }
    public required string FullName { get; set; }
    public required string Email { get; set; }
    public Guid DepartmentId { get; set; }
    public Guid RoleId { get; set; }
    public bool IsActive { get; set; }
    public required string TimezoneName { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class Holiday
{
    public Guid HolidayId { get; set; }
    public DateOnly HolidayDate { get; set; }
    public required string HolidayName { get; set; }
    public string? HolidayDescription { get; set; }
    public bool IsActive { get; set; }
    public Guid CreatedByProfileId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class Booking
{
    public Guid BookingId { get; set; }
    public Guid BookedForProfileId { get; set; }
    public Guid BookedByProfileId { get; set; }
    public Guid DepartmentId { get; set; }
    public required string BookingMode { get; set; }
    public DateOnly BookingDateStart { get; set; }
    public DateOnly BookingDateEnd { get; set; }
    public DateTimeOffset StartAt { get; set; }
    public DateTimeOffset EndAt { get; set; }
    public bool HolidayWarningAcknowledged { get; set; }
    public required string StatusCode { get; set; }
    public string? NoteText { get; set; }
    public DateTimeOffset? CancelledAt { get; set; }
    public Guid? CancelledByProfileId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class BookingAuditLog
{
    public Guid AuditLogId { get; set; }
    public Guid BookingId { get; set; }
    public required string ActionCode { get; set; }
    public Guid ActorProfileId { get; set; }
    public required string ActorRoleCode { get; set; }
    public string? ActionReason { get; set; }
    public string? OldValuesJson { get; set; }
    public string? NewValuesJson { get; set; }
    public DateTimeOffset ActionAt { get; set; }
    public string? RequestId { get; set; }
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
}

public sealed class UserDepartmentHistory
{
    public Guid HistoryId { get; set; }
    public Guid ProfileId { get; set; }
    public Guid DepartmentId { get; set; }
    public DateOnly AssignedStartDate { get; set; }
    public DateOnly? AssignedEndDate { get; set; }
    public Guid AssignedByProfileId { get; set; }
    public string? NoteText { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

