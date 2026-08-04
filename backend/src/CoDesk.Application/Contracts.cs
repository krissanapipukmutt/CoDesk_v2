using System.Text.Json;

namespace CoDesk.Application;

public sealed record RoleDto(
    Guid RoleId,
    string RoleCode,
    string RoleName,
    bool CanManageUsers,
    bool CanManageDepartments,
    bool CanViewReports);

public sealed record ProfileDto(
    Guid ProfileId,
    string EmployeeCode,
    string FullName,
    string Email,
    Guid DepartmentId,
    string DepartmentCode,
    string DepartmentName,
    Guid RoleId,
    string RoleCode,
    string RoleName,
    bool IsActive,
    string TimezoneName,
    bool CanManageUsers,
    bool CanManageDepartments,
    bool CanViewReports);

public sealed record CurrentUser(
    Guid ProfileId,
    string EmployeeCode,
    string FullName,
    string Email,
    Guid DepartmentId,
    string DepartmentCode,
    string DepartmentName,
    string RoleCode,
    string RoleName,
    bool IsActive,
    bool CanManageUsers,
    bool CanManageDepartments,
    bool CanViewReports);

public sealed record DepartmentDto(
    Guid DepartmentId,
    string DepartmentCode,
    string DepartmentName,
    string CapacityMode,
    int? DefaultCapacityPerDay,
    bool IsActive,
    string EffectiveTimezone,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record DepartmentUpsertRequest(
    string DepartmentCode,
    string DepartmentName,
    string CapacityMode,
    int? DefaultCapacityPerDay,
    bool IsActive = true,
    string EffectiveTimezone = "Asia/Bangkok");

public sealed record ProfileUpdateRequest(
    string EmployeeCode,
    string FullName,
    string Email,
    Guid DepartmentId,
    Guid? RoleId,
    bool IsActive);

public sealed record AdminCreateUserRequest(
    string EmployeeCode,
    string FullName,
    string Email,
    string TemporaryPassword,
    Guid DepartmentId,
    Guid RoleId,
    bool IsActive = true);

public sealed record HolidayDto(
    Guid HolidayId,
    DateOnly HolidayDate,
    string HolidayName,
    string? HolidayDescription,
    bool IsActive,
    Guid CreatedByProfileId,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record HolidayUpsertRequest(
    DateOnly HolidayDate,
    string HolidayName,
    string? HolidayDescription,
    bool IsActive = true);

public sealed record BookingDto(
    Guid BookingId,
    Guid BookedForProfileId,
    string BookedForEmployeeCode,
    string BookedForName,
    Guid BookedByProfileId,
    string BookedByName,
    Guid DepartmentId,
    string DepartmentCode,
    string DepartmentName,
    string BookingMode,
    DateOnly BookingDateStart,
    DateOnly BookingDateEnd,
    DateTimeOffset StartAt,
    DateTimeOffset EndAt,
    bool HolidayWarningAcknowledged,
    string StatusCode,
    string? NoteText,
    DateTimeOffset? CancelledAt,
    Guid? CancelledByProfileId,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record BookingWriteRequest(
    Guid? BookedForProfileId,
    string BookingMode,
    DateOnly? BookingDateStart,
    DateTimeOffset? StartAt,
    DateTimeOffset? EndAt,
    bool HolidayWarningAcknowledged,
    string? NoteText,
    string? ActionReason = null);

public sealed record CancelBookingRequest(string? Reason);

public sealed record BookingOperationResult(
    bool Success,
    string Code,
    string? Message,
    JsonElement? Booking,
    JsonElement? Details);

public sealed record BookingValidationResult(
    JsonElement Conflict,
    JsonElement Capacity,
    JsonElement Holidays);

public sealed record HistoryDto(
    Guid HistoryId,
    Guid ProfileId,
    Guid DepartmentId,
    string DepartmentCode,
    string DepartmentName,
    DateOnly AssignedStartDate,
    DateOnly? AssignedEndDate,
    Guid AssignedByProfileId,
    string AssignedByName,
    string? NoteText,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record AuditLogDto(
    Guid AuditLogId,
    Guid BookingId,
    string ActionCode,
    Guid ActorProfileId,
    string ActorName,
    string ActorRoleCode,
    string? ActionReason,
    JsonElement? OldValues,
    JsonElement? NewValues,
    DateTimeOffset ActionAt,
    string? RequestId,
    string? IpAddress,
    string? UserAgent);

public sealed record PageResult<T>(IReadOnlyList<T> Items, int Total, int Page, int PageSize);

public sealed record ListQuery(
    string? Search = null,
    int Page = 1,
    int PageSize = 20,
    string? SortBy = null,
    string? SortDirection = null);

public sealed record BookingQuery(
    DateOnly? DateFrom = null,
    DateOnly? DateTo = null,
    Guid? ProfileId = null,
    Guid? DepartmentId = null,
    string? Status = null,
    int Page = 1,
    int PageSize = 50);

public sealed record ReportQuery(
    DateOnly? DateFrom = null,
    DateOnly? DateTo = null,
    Guid? DepartmentId = null,
    string? Search = null,
    string? Filters = null,
    string? SortBy = null,
    string? SortDirection = null,
    int Page = 1,
    int PageSize = 50);

public sealed record ReportPage(IReadOnlyList<JsonElement> Items, int Total, int Page, int PageSize);

public sealed record RequestMetadata(string RequestId, string? IpAddress, string? UserAgent);

