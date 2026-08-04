using CoDesk.Application;
using CoDesk.Domain;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CoDesk.Api.Controllers;

[Route("api/profiles")]
public sealed class ProfilesController(ICoDeskDataService dataService) : CoDeskControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PageResult<ProfileDto>>> Get([FromQuery] ListQuery query, [FromQuery] bool includeInactive, CancellationToken cancellationToken)
    {
        var actor = await CurrentUserAsync(dataService, cancellationToken);
        return Ok(await dataService.GetProfilesAsync(query, actor, includeInactive && AuthorizationRules.CanManageProfiles(actor), cancellationToken));
    }

    [HttpGet("{profileId:guid}")]
    public async Task<ActionResult<ProfileDto>> Get(Guid profileId, CancellationToken cancellationToken)
    {
        var actor = await CurrentUserAsync(dataService, cancellationToken);
        var profile = await dataService.GetProfileAsync(profileId, cancellationToken);
        if (profile is null) return NotFound();
        if (actor.RoleCode != RoleCodes.Admin && actor.RoleCode != RoleCodes.Hr &&
            actor.ProfileId != profileId && actor.DepartmentId != profile.DepartmentId) return Forbid();
        return Ok(profile);
    }

    [HttpPut("{profileId:guid}")]
    [Authorize(Policy = "ProfileManagement")]
    public async Task<ActionResult<ProfileDto>> Update(Guid profileId, [FromBody] ProfileUpdateRequest request, CancellationToken cancellationToken)
    {
        ValidateProfile(request);
        var actor = await CurrentUserAsync(dataService, cancellationToken);
        var existing = await dataService.GetProfileAsync(profileId, cancellationToken);
        if (existing is null) return NotFound();
        if (actor.RoleCode == RoleCodes.Hr && existing.RoleCode != RoleCodes.Employee) return Forbid();
        if (actor.RoleCode == RoleCodes.Hr && request.RoleId.HasValue && request.RoleId != existing.RoleId) return Forbid();
        return Ok(await dataService.UpdateProfileAsync(profileId, request, actor, cancellationToken));
    }

    [HttpGet("{profileId:guid}/department-history")]
    public async Task<ActionResult<IReadOnlyList<HistoryDto>>> History(Guid profileId, CancellationToken cancellationToken)
    {
        var actor = await CurrentUserAsync(dataService, cancellationToken);
        if (!AuthorizationRules.CanManageProfiles(actor) && actor.ProfileId != profileId) return Forbid();
        return Ok(await dataService.GetDepartmentHistoryAsync(profileId, cancellationToken));
    }

    private static void ValidateProfile(ProfileUpdateRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.EmployeeCode) || string.IsNullOrWhiteSpace(request.FullName) || string.IsNullOrWhiteSpace(request.Email))
            throw new ArgumentException("Employee code, name, and email are required.");
        if (!request.Email.Contains('@', StringComparison.Ordinal)) throw new ArgumentException("Email is invalid.");
    }
}

