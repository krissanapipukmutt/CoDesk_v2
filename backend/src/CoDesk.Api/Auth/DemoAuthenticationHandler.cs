using System.Security.Claims;
using System.Text.Encodings.Web;
using CoDesk.Application;
using CoDesk.Infrastructure;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace CoDesk.Api.Auth;

public sealed class DemoAuthenticationHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    IOptions<DemoModeOptions> demoOptions,
    ICoDeskDataService dataService)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "CoDeskDemo";
    public const string HeaderName = "X-Demo-Profile-Id";
    private static readonly HashSet<Guid> AllowedDemoProfiles =
    [
        Guid.Parse("30000000-0000-0000-0000-000000000001"),
        Guid.Parse("30000000-0000-0000-0000-000000000002"),
        Guid.Parse("30000000-0000-0000-0000-000000000003")
    ];

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!demoOptions.Value.Enabled) return AuthenticateResult.NoResult();
        if (!Request.Headers.TryGetValue(HeaderName, out var value) || !Guid.TryParse(value.ToString(), out var profileId))
            return AuthenticateResult.NoResult();
        if (!AllowedDemoProfiles.Contains(profileId))
            return AuthenticateResult.Fail("Unknown demo identity.");

        var profile = await dataService.GetProfileAsync(profileId, Context.RequestAborted);
        if (profile is null || !profile.IsActive) return AuthenticateResult.Fail("Demo profile is missing or inactive.");

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, profile.ProfileId.ToString()),
            new Claim(ClaimTypes.Name, profile.FullName),
            new Claim(ClaimTypes.Email, profile.Email),
            new Claim(ClaimTypes.Role, profile.RoleCode),
            new Claim(CoDeskClaimTypes.ProfileActive, "true"),
            new Claim(CoDeskClaimTypes.DepartmentId, profile.DepartmentId.ToString()),
            new Claim(CoDeskClaimTypes.EmployeeCode, profile.EmployeeCode)
        };
        var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, SchemeName, ClaimTypes.Name, ClaimTypes.Role));
        return AuthenticateResult.Success(new AuthenticationTicket(principal, SchemeName));
    }
}

