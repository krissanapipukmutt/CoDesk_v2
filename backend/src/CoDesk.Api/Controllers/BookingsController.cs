using CoDesk.Application;
using Microsoft.AspNetCore.Mvc;

namespace CoDesk.Api.Controllers;

[Route("api/bookings")]
public sealed class BookingsController(ICoDeskDataService dataService) : CoDeskControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PageResult<BookingDto>>> Get([FromQuery] BookingQuery query, CancellationToken cancellationToken)
    {
        var actor = await CurrentUserAsync(dataService, cancellationToken);
        return Ok(await dataService.GetBookingsAsync(query, actor, false, cancellationToken));
    }

    [HttpGet("{bookingId:guid}")]
    public async Task<ActionResult<BookingDto>> Get(Guid bookingId, CancellationToken cancellationToken)
    {
        var actor = await CurrentUserAsync(dataService, cancellationToken);
        var booking = await dataService.GetBookingAsync(bookingId, cancellationToken);
        if (booking is null) return NotFound();
        if (!AuthorizationRules.CanViewCalendarBooking(actor, booking)) return Forbid();
        return Ok(booking);
    }

    [HttpPost("validate")]
    public async Task<ActionResult<BookingValidationResult>> Validate([FromBody] BookingWriteRequest request, [FromQuery] Guid? excludeBookingId, CancellationToken cancellationToken)
    {
        ValidateBooking(request);
        var actor = await CurrentUserAsync(dataService, cancellationToken);
        var targetId = request.BookedForProfileId ?? actor.ProfileId;
        if (!AuthorizationRules.CanBookFor(actor, targetId)) return Forbid();
        return Ok(await dataService.ValidateBookingAsync(request, targetId, excludeBookingId, cancellationToken));
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] BookingWriteRequest request, CancellationToken cancellationToken)
    {
        ValidateBooking(request);
        var actor = await CurrentUserAsync(dataService, cancellationToken);
        var targetId = request.BookedForProfileId ?? actor.ProfileId;
        if (!AuthorizationRules.CanBookFor(actor, targetId)) return Forbid();
        var result = await dataService.CreateBookingAsync(request, targetId, actor, RequestMetadata(), cancellationToken);
        return OperationResponse(result, created: true);
    }

    [HttpPut("{bookingId:guid}")]
    public async Task<ActionResult> Update(Guid bookingId, [FromBody] BookingWriteRequest request, CancellationToken cancellationToken)
    {
        ValidateBooking(request);
        var actor = await CurrentUserAsync(dataService, cancellationToken);
        var existing = await dataService.GetBookingAsync(bookingId, cancellationToken);
        if (existing is null) return NotFound();
        if (!AuthorizationRules.CanModifyBooking(actor, existing)) return Forbid();
        var targetId = request.BookedForProfileId ?? existing.BookedForProfileId;
        if (!AuthorizationRules.CanBookFor(actor, targetId)) return Forbid();
        var result = await dataService.UpdateBookingAsync(bookingId, request, targetId, actor, RequestMetadata(), cancellationToken);
        return OperationResponse(result);
    }

    [HttpPost("{bookingId:guid}/cancel")]
    public async Task<ActionResult> Cancel(Guid bookingId, [FromBody] CancelBookingRequest request, CancellationToken cancellationToken)
    {
        var actor = await CurrentUserAsync(dataService, cancellationToken);
        var existing = await dataService.GetBookingAsync(bookingId, cancellationToken);
        if (existing is null) return NotFound();
        if (!AuthorizationRules.CanModifyBooking(actor, existing)) return Forbid();
        return OperationResponse(await dataService.CancelBookingAsync(bookingId, actor, request, RequestMetadata(), cancellationToken));
    }
}

