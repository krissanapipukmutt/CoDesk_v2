using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using CoDesk.Application;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace CoDesk.IntegrationTests;

public sealed class ApiAuthorizationTests : IClassFixture<CoDeskApiFactory>
{
    private readonly CoDeskApiFactory _factory;
    public ApiAuthorizationTests(CoDeskApiFactory factory) => _factory = factory;

    [Fact]
    public async Task MissingDemoIdentityReturnsUnauthorized()
    {
        using var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/me");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task DemoHeaderAndDiscoveryAreDisabledOutsideDemoMode()
    {
        await using var factory = _factory.WithWebHostBuilder(builder =>
            builder.UseSetting("DemoMode:Enabled", "false").ConfigureAppConfiguration((_, configuration) =>
                configuration.AddInMemoryCollection(new Dictionary<string, string?> { ["DemoMode:Enabled"] = "false" })));
        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Demo-Profile-Id", CoDeskApiFactory.AdminId.ToString());
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/me")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/demo/profiles")).StatusCode);
    }

    [Fact]
    public async Task DemoEmployeeCannotAccessReportsOrAdminUserCreation()
    {
        using var client = ClientFor(CoDeskApiFactory.EmployeeId);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/reports/daily-department-bookings")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync("/api/admin/users", new { })).StatusCode);
    }

    [Fact]
    public async Task HrCanAccessReportsButCannotCreateUsers()
    {
        using var client = ClientFor(CoDeskApiFactory.HrId);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/reports/daily-department-bookings")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync("/api/admin/users", new { })).StatusCode);
    }

    [Fact]
    public async Task AdminCanAccessReportsAndUserManagement()
    {
        using var client = ClientFor(CoDeskApiFactory.AdminId);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/reports/employee-booking-frequency")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/admin/users?includeInactive=true")).StatusCode);
    }

    [Fact]
    public async Task AdminUserCreationUsesTheAuthUuidForTheProfile()
    {
        using var client = ClientFor(CoDeskApiFactory.AdminId);
        var request = new AdminCreateUserRequest(
            "NEW001", "New User", "new.user@example.test", "temporary-password",
            CoDeskApiFactory.OperationsId, Guid.Parse("10000000-0000-0000-0000-000000000001"), true);
        var response = await client.PostAsJsonAsync("/api/admin/users", request);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var profile = await response.Content.ReadFromJsonAsync<ProfileDto>();
        var auth = _factory.Services.GetRequiredService<RecordingAdminService>();
        Assert.NotNull(profile);
        Assert.Equal(auth.LastCreatedUserId, profile.ProfileId);
    }

    [Fact]
    public async Task ProfileFailureDeletesThePartiallyCreatedAuthUser()
    {
        using var client = ClientFor(CoDeskApiFactory.AdminId);
        var request = new AdminCreateUserRequest(
            "FAILPROFILE", "Failure User", "failure.user@example.test", "temporary-password",
            CoDeskApiFactory.OperationsId, Guid.Parse("10000000-0000-0000-0000-000000000001"), true);
        var response = await client.PostAsJsonAsync("/api/admin/users", request);
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var auth = _factory.Services.GetRequiredService<RecordingAdminService>();
        Assert.Equal(auth.LastCreatedUserId, auth.LastDeletedUserId);
    }

    [Fact]
    public async Task EmployeeCannotBookForAnotherProfile()
    {
        using var client = ClientFor(CoDeskApiFactory.EmployeeId);
        var response = await client.PostAsJsonAsync("/api/bookings", BookingRequest(CoDeskApiFactory.OtherEmployeeId, "normal"));
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task BookingConflictAndCapacityUseConflictStatus()
    {
        using var client = ClientFor(CoDeskApiFactory.EmployeeId);
        Assert.Equal(HttpStatusCode.Conflict,
            (await client.PostAsJsonAsync("/api/bookings", BookingRequest(CoDeskApiFactory.EmployeeId, "conflict"))).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict,
            (await client.PostAsJsonAsync("/api/bookings", BookingRequest(CoDeskApiFactory.EmployeeId, "capacity"))).StatusCode);
    }

    [Fact]
    public async Task HolidayRequiresConfirmation()
    {
        using var client = ClientFor(CoDeskApiFactory.EmployeeId);
        var response = await client.PostAsJsonAsync("/api/bookings", BookingRequest(CoDeskApiFactory.EmployeeId, "holiday"));
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("holiday_confirmation_required", body);
    }

    [Fact]
    public async Task SameDepartmentCalendarReturnsVisibleRowsOnly()
    {
        using var client = ClientFor(CoDeskApiFactory.EmployeeId);
        var response = await client.GetFromJsonAsync<PageResult<BookingDto>>("/api/calendar?dateFrom=2026-08-01&dateTo=2026-08-31");
        Assert.NotNull(response);
        Assert.All(response.Items, item => Assert.Equal(CoDeskApiFactory.OperationsId, item.DepartmentId));
    }

    private HttpClient ClientFor(Guid profileId)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Demo-Profile-Id", profileId.ToString());
        return client;
    }

    private static object BookingRequest(Guid targetId, string note) => new
    {
        bookedForProfileId = targetId,
        bookingMode = "single_day",
        bookingDateStart = "2026-08-20",
        holidayWarningAcknowledged = false,
        noteText = note
    };
}

public sealed class CoDeskApiFactory : WebApplicationFactory<Program>
{
    public static readonly Guid AdminId = Guid.Parse("30000000-0000-0000-0000-000000000001");
    public static readonly Guid HrId = Guid.Parse("30000000-0000-0000-0000-000000000002");
    public static readonly Guid EmployeeId = Guid.Parse("30000000-0000-0000-0000-000000000003");
    public static readonly Guid OtherEmployeeId = Guid.Parse("30000000-0000-0000-0000-000000000004");
    public static readonly Guid OperationsId = Guid.Parse("20000000-0000-0000-0000-000000000001");
    public static readonly Guid DigitalId = Guid.Parse("20000000-0000-0000-0000-000000000002");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.UseSetting("DemoMode:Enabled", "true");
        builder.UseSetting("ConnectionStrings:CoDesk", "Host=localhost;Database=codesk_test;Username=postgres");
        builder.ConfigureAppConfiguration((_, configuration) =>
            configuration.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["DemoMode:Enabled"] = "true",
                ["ConnectionStrings:CoDesk"] = "Host=localhost;Database=codesk_test;Username=postgres"
            }));
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<ICoDeskDataService>();
            services.AddSingleton<ICoDeskDataService, FakeDataService>();
            services.RemoveAll<ISupabaseAdminService>();
            services.AddSingleton<RecordingAdminService>();
            services.AddSingleton<ISupabaseAdminService>(provider => provider.GetRequiredService<RecordingAdminService>());
        });
    }
}

internal sealed class FakeDataService : ICoDeskDataService
{
    private static readonly IReadOnlyList<ProfileDto> Profiles =
    [
        Profile(CoDeskApiFactory.AdminId, "ADM001", "Admin", "admin", CoDeskApiFactory.DigitalId, "DIGI"),
        Profile(CoDeskApiFactory.HrId, "HR001", "HR", "hr", CoDeskApiFactory.OperationsId, "OPS"),
        Profile(CoDeskApiFactory.EmployeeId, "EMP001", "Employee", "employee", CoDeskApiFactory.OperationsId, "OPS"),
        Profile(CoDeskApiFactory.OtherEmployeeId, "EMP002", "Other", "employee", CoDeskApiFactory.OperationsId, "OPS")
    ];

    public Task<ProfileDto?> GetProfileAsync(Guid profileId, CancellationToken cancellationToken) =>
        Task.FromResult(Profiles.FirstOrDefault(profile => profile.ProfileId == profileId));
    public Task<IReadOnlyList<ProfileDto>> GetDemoProfilesAsync(CancellationToken cancellationToken) => Task.FromResult<IReadOnlyList<ProfileDto>>(Profiles.Take(3).ToList());
    public Task<IReadOnlyList<RoleDto>> GetRolesAsync(CancellationToken cancellationToken) => Task.FromResult<IReadOnlyList<RoleDto>>([]);
    public Task<PageResult<ProfileDto>> GetProfilesAsync(ListQuery query, CurrentUser actor, bool includeInactive, CancellationToken cancellationToken) => Task.FromResult(new PageResult<ProfileDto>(Profiles, Profiles.Count, 1, 20));
    public Task<ReportPage> GetReportAsync(string reportCode, ReportQuery query, CancellationToken cancellationToken) => Task.FromResult(new ReportPage([], 0, 1, 50));
    public Task<PageResult<BookingDto>> GetBookingsAsync(BookingQuery query, CurrentUser actor, bool calendarScope, CancellationToken cancellationToken)
    {
        var booking = new BookingDto(Guid.NewGuid(), CoDeskApiFactory.OtherEmployeeId, "EMP002", "Other", CoDeskApiFactory.OtherEmployeeId,
            "Other", CoDeskApiFactory.OperationsId, "OPS", "Operations", "single_day", new DateOnly(2026, 8, 20), new DateOnly(2026, 8, 20),
            DateTimeOffset.Parse("2026-08-19T17:00:00Z"), DateTimeOffset.Parse("2026-08-20T17:00:00Z"), false, "booked", null, null, null, DateTimeOffset.UtcNow, DateTimeOffset.UtcNow);
        IReadOnlyList<BookingDto> result = actor.RoleCode == "admin" || actor.DepartmentId == booking.DepartmentId ? [booking] : [];
        return Task.FromResult(new PageResult<BookingDto>(result, result.Count, 1, 50));
    }
    public Task<BookingOperationResult> CreateBookingAsync(BookingWriteRequest request, Guid targetProfileId, CurrentUser actor, RequestMetadata metadata, CancellationToken cancellationToken)
    {
        var code = request.NoteText switch
        {
            "conflict" => "booking_conflict",
            "capacity" => "capacity_exceeded",
            "holiday" => "holiday_confirmation_required",
            _ => "created"
        };
        return Task.FromResult(new BookingOperationResult(code == "created", code, code, null, Json("{}")));
    }

    public Task<DepartmentDto?> CreateDepartmentAsync(DepartmentUpsertRequest request, Guid actorId, CancellationToken cancellationToken) => throw new NotSupportedException();
    public Task<DepartmentDto?> UpdateDepartmentAsync(Guid departmentId, DepartmentUpsertRequest request, CancellationToken cancellationToken) => throw new NotSupportedException();
    public Task<PageResult<DepartmentDto>> GetDepartmentsAsync(ListQuery query, bool includeInactive, CancellationToken cancellationToken) => Task.FromResult(new PageResult<DepartmentDto>([], 0, 1, 20));
    public Task<ProfileDto?> UpdateProfileAsync(Guid profileId, ProfileUpdateRequest request, CurrentUser actor, CancellationToken cancellationToken) => throw new NotSupportedException();
    public Task ValidateNewProfileAsync(AdminCreateUserRequest request, CancellationToken cancellationToken) => Task.CompletedTask;
    public Task<ProfileDto> CreateProfileAsync(Guid authUserId, AdminCreateUserRequest request, Guid actorId, CancellationToken cancellationToken)
    {
        if (request.EmployeeCode == "FAILPROFILE") throw new ConflictException("Profile creation failed for compensation test.");
        return Task.FromResult(new ProfileDto(
            authUserId, request.EmployeeCode, request.FullName, request.Email,
            request.DepartmentId, "OPS", "Operations", request.RoleId, "employee", "Employee",
            request.IsActive, "Asia/Bangkok", false, false, false));
    }
    public Task<PageResult<HolidayDto>> GetHolidaysAsync(ListQuery query, bool includeInactive, CancellationToken cancellationToken) => Task.FromResult(new PageResult<HolidayDto>([], 0, 1, 20));
    public Task<HolidayDto?> CreateHolidayAsync(HolidayUpsertRequest request, Guid actorId, CancellationToken cancellationToken) => throw new NotSupportedException();
    public Task<HolidayDto?> UpdateHolidayAsync(Guid holidayId, HolidayUpsertRequest request, CancellationToken cancellationToken) => throw new NotSupportedException();
    public Task<BookingDto?> GetBookingAsync(Guid bookingId, CancellationToken cancellationToken) => Task.FromResult<BookingDto?>(null);
    public Task<BookingValidationResult> ValidateBookingAsync(BookingWriteRequest request, Guid targetProfileId, Guid? excludeBookingId, CancellationToken cancellationToken) => throw new NotSupportedException();
    public Task<BookingOperationResult> UpdateBookingAsync(Guid bookingId, BookingWriteRequest request, Guid targetProfileId, CurrentUser actor, RequestMetadata metadata, CancellationToken cancellationToken) => throw new NotSupportedException();
    public Task<BookingOperationResult> CancelBookingAsync(Guid bookingId, CurrentUser actor, CancelBookingRequest request, RequestMetadata metadata, CancellationToken cancellationToken) => throw new NotSupportedException();
    public Task<IReadOnlyList<HistoryDto>> GetDepartmentHistoryAsync(Guid profileId, CancellationToken cancellationToken) => Task.FromResult<IReadOnlyList<HistoryDto>>([]);
    public Task<IReadOnlyList<AuditLogDto>> GetBookingAuditAsync(Guid bookingId, CancellationToken cancellationToken) => Task.FromResult<IReadOnlyList<AuditLogDto>>([]);

    private static ProfileDto Profile(Guid id, string code, string name, string role, Guid departmentId, string departmentCode) =>
        new(id, code, name, $"{code.ToLowerInvariant()}@example.test", departmentId, departmentCode, departmentCode,
            Guid.NewGuid(), role, role, true, "Asia/Bangkok", role == "admin", role is "hr" or "admin", role is "hr" or "admin");
    private static JsonElement Json(string value) { using var document = JsonDocument.Parse(value); return document.RootElement.Clone(); }
}

public sealed class RecordingAdminService : ISupabaseAdminService
{
    public bool IsConfigured => true;
    public Guid LastCreatedUserId { get; private set; }
    public Guid? LastDeletedUserId { get; private set; }

    public Task<Guid> CreateUserAsync(string email, string password, string fullName, CancellationToken cancellationToken)
    {
        LastCreatedUserId = Guid.NewGuid();
        LastDeletedUserId = null;
        return Task.FromResult(LastCreatedUserId);
    }

    public Task DeleteUserAsync(Guid userId, CancellationToken cancellationToken)
    {
        LastDeletedUserId = userId;
        return Task.CompletedTask;
    }
}
