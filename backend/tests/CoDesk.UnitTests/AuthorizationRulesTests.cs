using CoDesk.Application;
using CoDesk.Domain;

namespace CoDesk.UnitTests;

public sealed class AuthorizationRulesTests
{
    private static readonly Guid OperationsId = Guid.Parse("20000000-0000-0000-0000-000000000001");
    private static readonly Guid DigitalId = Guid.Parse("20000000-0000-0000-0000-000000000002");
    private static readonly Guid EmployeeId = Guid.Parse("30000000-0000-0000-0000-000000000003");
    private static readonly Guid OtherId = Guid.Parse("30000000-0000-0000-0000-000000000004");

    [Fact]
    public void EmployeeCanBookOnlyForSelf()
    {
        var employee = User(EmployeeId, RoleCodes.Employee, OperationsId);
        Assert.True(AuthorizationRules.CanBookFor(employee, EmployeeId));
        Assert.False(AuthorizationRules.CanBookFor(employee, OtherId));
    }

    [Fact]
    public void HrCanBookOnlyForSelfAndCannotCreateUsersOrChangeRoles()
    {
        var hr = User(EmployeeId, RoleCodes.Hr, OperationsId);
        Assert.True(AuthorizationRules.CanBookFor(hr, EmployeeId));
        Assert.False(AuthorizationRules.CanBookFor(hr, OtherId));
        Assert.False(AuthorizationRules.CanCreateUsers(hr));
        Assert.False(AuthorizationRules.CanChangeRole(hr));
        Assert.True(AuthorizationRules.CanManageProfiles(hr));
        Assert.True(AuthorizationRules.CanManageDepartments(hr));
    }

    [Fact]
    public void AdminHasGlobalManagementPermissions()
    {
        var admin = User(EmployeeId, RoleCodes.Admin, DigitalId);
        Assert.True(AuthorizationRules.CanBookFor(admin, OtherId));
        Assert.True(AuthorizationRules.CanCreateUsers(admin));
        Assert.True(AuthorizationRules.CanChangeRole(admin));
        Assert.True(AuthorizationRules.CanManageHolidays(admin));
        Assert.True(AuthorizationRules.CanViewReports(admin));
    }

    [Fact]
    public void EmployeeCannotViewReportsOrManageSoftDeletedResources()
    {
        var employee = User(EmployeeId, RoleCodes.Employee, OperationsId);
        Assert.False(AuthorizationRules.CanViewReports(employee));
        Assert.False(AuthorizationRules.CanManageDepartments(employee));
        Assert.False(AuthorizationRules.CanManageProfiles(employee));
        Assert.False(AuthorizationRules.CanManageHolidays(employee));
    }

    [Fact]
    public void SameDepartmentCalendarIsVisibleButCrossDepartmentIsRejected()
    {
        var employee = User(EmployeeId, RoleCodes.Employee, OperationsId);
        Assert.True(AuthorizationRules.CanViewCalendarBooking(employee, Booking(OperationsId, OtherId)));
        Assert.False(AuthorizationRules.CanViewCalendarBooking(employee, Booking(DigitalId, OtherId)));
    }

    [Fact]
    public void OnlyOwnerOrAdminCanEditAndCancelBooking()
    {
        var employee = User(EmployeeId, RoleCodes.Employee, OperationsId);
        var hr = User(OtherId, RoleCodes.Hr, OperationsId);
        var admin = User(Guid.NewGuid(), RoleCodes.Admin, DigitalId);
        var booking = Booking(OperationsId, EmployeeId);
        Assert.True(AuthorizationRules.CanModifyBooking(employee, booking));
        Assert.False(AuthorizationRules.CanModifyBooking(hr, booking));
        Assert.True(AuthorizationRules.CanModifyBooking(admin, booking));
    }

    [Fact]
    public void InactiveUsersHaveNoPermissions()
    {
        var inactiveAdmin = User(EmployeeId, RoleCodes.Admin, OperationsId) with { IsActive = false };
        Assert.False(AuthorizationRules.CanCreateUsers(inactiveAdmin));
        Assert.False(AuthorizationRules.CanBookFor(inactiveAdmin, EmployeeId));
    }

    [Fact]
    public async Task AdminUserCreationUsesServerSideServiceAbstraction()
    {
        ISupabaseAdminService service = new FakeAdminService();
        var id = await service.CreateUserAsync("new@example.test", "temporary-password", "New User", CancellationToken.None);
        Assert.NotEqual(Guid.Empty, id);
        Assert.True(service.IsConfigured);
    }

    private static CurrentUser User(Guid id, string role, Guid departmentId) => new(
        id, "CODE", "Test User", "test@example.test", departmentId, "DEP", "Department",
        role, role, true, "Asia/Bangkok", "Asia/Bangkok",
        role == RoleCodes.Admin, role is RoleCodes.Hr or RoleCodes.Admin,
        role is RoleCodes.Hr or RoleCodes.Admin);

    private static BookingDto Booking(Guid departmentId, Guid ownerId) => new(
        Guid.NewGuid(), ownerId, "EMP", "Owner", ownerId, "Owner", departmentId, "DEP", "Department", "Asia/Bangkok",
        BookingModes.SingleDay, new DateOnly(2026, 8, 3), new DateOnly(2026, 8, 3),
        DateTimeOffset.UtcNow, DateTimeOffset.UtcNow.AddDays(1), false, BookingStatuses.Booked,
        null, null, null, DateTimeOffset.UtcNow, DateTimeOffset.UtcNow);

    private sealed class FakeAdminService : ISupabaseAdminService
    {
        public bool IsConfigured => true;
        public Task<Guid> CreateUserAsync(string email, string password, string fullName, CancellationToken cancellationToken) => Task.FromResult(Guid.NewGuid());
        public Task DeleteUserAsync(Guid userId, CancellationToken cancellationToken) => Task.CompletedTask;
    }
}
