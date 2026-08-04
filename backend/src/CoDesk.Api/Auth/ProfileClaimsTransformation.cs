using System.Security.Claims;
using CoDesk.Application;
using Microsoft.AspNetCore.Authentication;

namespace CoDesk.Api.Auth;

public sealed class ProfileClaimsTransformation(ICoDeskDataService dataService) : IClaimsTransformation
{
    public async Task<ClaimsPrincipal> TransformAsync(ClaimsPrincipal principal)
    {
        if (principal.Identity?.IsAuthenticated != true || principal.HasClaim(claim => claim.Type == CoDeskClaimTypes.ProfileActive))
            return principal;

        var subject = principal.FindFirstValue(ClaimTypes.NameIdentifier) ?? principal.FindFirstValue("sub");
        if (!Guid.TryParse(subject, out var profileId)) return principal;
        var profile = await dataService.GetProfileAsync(profileId, CancellationToken.None);
        if (profile is null || !profile.IsActive) return principal;

        var identity = new ClaimsIdentity();
        identity.AddClaim(new Claim(ClaimTypes.NameIdentifier, profile.ProfileId.ToString()));
        identity.AddClaim(new Claim(ClaimTypes.Name, profile.FullName));
        identity.AddClaim(new Claim(ClaimTypes.Email, profile.Email));
        identity.AddClaim(new Claim(ClaimTypes.Role, profile.RoleCode));
        identity.AddClaim(new Claim(CoDeskClaimTypes.ProfileActive, "true"));
        identity.AddClaim(new Claim(CoDeskClaimTypes.DepartmentId, profile.DepartmentId.ToString()));
        identity.AddClaim(new Claim(CoDeskClaimTypes.EmployeeCode, profile.EmployeeCode));
        principal.AddIdentity(identity);
        return principal;
    }
}
