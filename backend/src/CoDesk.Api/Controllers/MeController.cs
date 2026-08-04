using CoDesk.Application;
using Microsoft.AspNetCore.Mvc;

namespace CoDesk.Api.Controllers;

[Route("api/me")]
public sealed class MeController(ICoDeskDataService dataService) : CoDeskControllerBase
{
    [HttpGet]
    public async Task<ActionResult<CurrentUser>> Get(CancellationToken cancellationToken) =>
        Ok(await CurrentUserAsync(dataService, cancellationToken));
}

