using CoDesk.Application;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CoDesk.Api.Controllers;

[Route("api/bookings/{bookingId:guid}/audit")]
[Authorize(Policy = "AdminOnly")]
public sealed class BookingAuditController(ICoDeskDataService dataService) : CoDeskControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AuditLogDto>>> Get(Guid bookingId, CancellationToken cancellationToken) =>
        Ok(await dataService.GetBookingAuditAsync(bookingId, cancellationToken));
}

