using CoDesk.Application;
using CoDesk.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace CoDesk.Api.Controllers;

[ApiController]
[AllowAnonymous]
[Route("api/demo")]
public sealed class DemoController(ICoDeskDataService dataService, IOptions<DemoModeOptions> options) : ControllerBase
{
    [HttpGet("profiles")]
    public async Task<ActionResult<IReadOnlyList<ProfileDto>>> GetProfiles(CancellationToken cancellationToken)
    {
        if (!options.Value.Enabled) return NotFound();
        return Ok(await dataService.GetDemoProfilesAsync(cancellationToken));
    }

    [HttpGet("profiles/{profileId:guid}")]
    public async Task<ActionResult<ProfileDto>> Validate(Guid profileId, CancellationToken cancellationToken)
    {
        if (!options.Value.Enabled) return NotFound();
        var profiles = await dataService.GetDemoProfilesAsync(cancellationToken);
        var profile = profiles.FirstOrDefault(item => item.ProfileId == profileId);
        return profile is null ? NotFound() : Ok(profile);
    }
}

