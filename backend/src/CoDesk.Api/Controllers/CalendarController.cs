using CoDesk.Application;
using Microsoft.AspNetCore.Mvc;

namespace CoDesk.Api.Controllers;

[Route("api/calendar")]
public sealed class CalendarController(ICoDeskDataService dataService) : CoDeskControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PageResult<BookingDto>>> Get([FromQuery] BookingQuery query, CancellationToken cancellationToken)
    {
        var actor = await CurrentUserAsync(dataService, cancellationToken);
        return Ok(await dataService.GetBookingsAsync(query with { PageSize = Math.Clamp(query.PageSize, 1, 500) }, actor, true, cancellationToken));
    }
}

