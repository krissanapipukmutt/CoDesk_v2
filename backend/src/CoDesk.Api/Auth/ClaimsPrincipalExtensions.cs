using System.Security.Claims;
using CoDesk.Application;

namespace CoDesk.Api.Auth;

public static class ClaimsPrincipalExtensions
{
    public static async Task<CurrentUser> GetCurrentUserAsync(
        this ClaimsPrincipal principal,
        ICoDeskDataService dataService,
        CancellationToken cancellationToken)
    {
        var subject = principal.FindFirstValue(ClaimTypes.NameIdentifier) ?? principal.FindFirstValue("sub");
        if (!Guid.TryParse(subject, out var profileId)) throw new UnauthorizedAccessException("Authenticated profile identifier is missing.");
        var profile = await dataService.GetProfileAsync(profileId, cancellationToken)
            ?? throw new UnauthorizedAccessException("Application profile was not found.");
        return new CurrentUser(
            profile.ProfileId, profile.EmployeeCode, profile.FullName, profile.Email,
            profile.DepartmentId, profile.DepartmentCode, profile.DepartmentName,
            profile.RoleCode, profile.RoleName, profile.IsActive,
            profile.TimezoneName, profile.DepartmentTimezone,
            profile.CanManageUsers, profile.CanManageDepartments, profile.CanViewReports);
    }
}
