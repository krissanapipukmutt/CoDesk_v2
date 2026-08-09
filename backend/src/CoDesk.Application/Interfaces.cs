namespace CoDesk.Application;

public interface ICoDeskDataService
{
    Task<ProfileDto?> GetProfileAsync(Guid profileId, CancellationToken cancellationToken);
    Task<IReadOnlyList<ProfileDto>> GetDemoProfilesAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<RoleDto>> GetRolesAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<string>> GetSupportedTimezonesAsync(CancellationToken cancellationToken);
    Task<DepartmentDto?> GetDepartmentAsync(Guid departmentId, CancellationToken cancellationToken);
    Task<PageResult<DepartmentDto>> GetDepartmentsAsync(ListQuery query, bool includeInactive, CancellationToken cancellationToken);
    Task<DepartmentDto?> CreateDepartmentAsync(DepartmentUpsertRequest request, Guid actorId, CancellationToken cancellationToken);
    Task<DepartmentDto?> UpdateDepartmentAsync(Guid departmentId, DepartmentUpsertRequest request, CancellationToken cancellationToken);
    Task<PageResult<ProfileDto>> GetProfilesAsync(ListQuery query, CurrentUser actor, bool includeInactive, CancellationToken cancellationToken);
    Task<ProfileDto?> UpdateProfileAsync(Guid profileId, ProfileUpdateRequest request, CurrentUser actor, CancellationToken cancellationToken);
    Task ValidateNewProfileAsync(AdminCreateUserRequest request, CancellationToken cancellationToken);
    Task<ProfileDto> CreateProfileAsync(Guid authUserId, AdminCreateUserRequest request, Guid actorId, CancellationToken cancellationToken);
    Task<PageResult<HolidayDto>> GetHolidaysAsync(ListQuery query, bool includeInactive, CancellationToken cancellationToken);
    Task<HolidayDto?> CreateHolidayAsync(HolidayUpsertRequest request, Guid actorId, CancellationToken cancellationToken);
    Task<HolidayDto?> UpdateHolidayAsync(Guid holidayId, HolidayUpsertRequest request, CancellationToken cancellationToken);
    Task<PageResult<BookingDto>> GetBookingsAsync(BookingQuery query, CurrentUser actor, bool calendarScope, CancellationToken cancellationToken);
    Task<BookingDto?> GetBookingAsync(Guid bookingId, CancellationToken cancellationToken);
    Task<BookingValidationResult> ValidateBookingAsync(BookingWriteRequest request, Guid targetProfileId, Guid? excludeBookingId, CancellationToken cancellationToken);
    Task<BookingOperationResult> CreateBookingAsync(BookingWriteRequest request, Guid targetProfileId, CurrentUser actor, RequestMetadata metadata, CancellationToken cancellationToken);
    Task<BookingOperationResult> UpdateBookingAsync(Guid bookingId, BookingWriteRequest request, Guid targetProfileId, CurrentUser actor, RequestMetadata metadata, CancellationToken cancellationToken);
    Task<BookingOperationResult> CancelBookingAsync(Guid bookingId, CurrentUser actor, CancelBookingRequest request, RequestMetadata metadata, CancellationToken cancellationToken);
    Task<IReadOnlyList<HistoryDto>> GetDepartmentHistoryAsync(Guid profileId, CancellationToken cancellationToken);
    Task<IReadOnlyList<AuditLogDto>> GetBookingAuditAsync(Guid bookingId, CancellationToken cancellationToken);
    Task<ReportPage> GetReportAsync(string reportCode, ReportQuery query, CancellationToken cancellationToken);
}

public interface ISupabaseAdminService
{
    bool IsConfigured { get; }
    Task<Guid> CreateUserAsync(string email, string password, string fullName, CancellationToken cancellationToken);
    Task DeleteUserAsync(Guid userId, CancellationToken cancellationToken);
}
