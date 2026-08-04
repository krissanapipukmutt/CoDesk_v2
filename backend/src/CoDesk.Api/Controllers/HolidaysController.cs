using CoDesk.Application;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CoDesk.Api.Controllers;

[Route("api/holidays")]
public sealed class HolidaysController(ICoDeskDataService dataService) : CoDeskControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PageResult<HolidayDto>>> Get([FromQuery] ListQuery query, [FromQuery] bool includeInactive, CancellationToken cancellationToken)
    {
        var actor = await CurrentUserAsync(dataService, cancellationToken);
        return Ok(await dataService.GetHolidaysAsync(query, includeInactive && AuthorizationRules.CanManageHolidays(actor), cancellationToken));
    }

    [HttpPost]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<HolidayDto>> Create([FromBody] HolidayUpsertRequest request, CancellationToken cancellationToken)
    {
        ValidateHoliday(request);
        var actor = await CurrentUserAsync(dataService, cancellationToken);
        var holiday = await dataService.CreateHolidayAsync(request, actor.ProfileId, cancellationToken);
        return holiday is null ? Problem("Holiday could not be created.") : StatusCode(StatusCodes.Status201Created, holiday);
    }

    [HttpPut("{holidayId:guid}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<HolidayDto>> Update(Guid holidayId, [FromBody] HolidayUpsertRequest request, CancellationToken cancellationToken)
    {
        ValidateHoliday(request);
        var holiday = await dataService.UpdateHolidayAsync(holidayId, request, cancellationToken);
        return holiday is null ? NotFound() : Ok(holiday);
    }

    private static void ValidateHoliday(HolidayUpsertRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.HolidayName)) throw new ArgumentException("Holiday name is required.");
        if (request.HolidayDescription?.Length > 1000) throw new ArgumentException("Holiday description cannot exceed 1,000 characters.");
    }
}

