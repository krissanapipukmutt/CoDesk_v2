using CoDesk.Api.Auth;
using CoDesk.Application;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CoDesk.Api.Controllers;

[ApiController]
[Authorize]
public abstract class CoDeskControllerBase : ControllerBase
{
    protected Task<CurrentUser> CurrentUserAsync(ICoDeskDataService dataService, CancellationToken cancellationToken) =>
        User.GetCurrentUserAsync(dataService, cancellationToken);

    protected RequestMetadata RequestMetadata() => new(
        HttpContext.TraceIdentifier,
        HttpContext.Connection.RemoteIpAddress?.ToString(),
        Request.Headers.UserAgent.ToString());

    protected ActionResult OperationResponse(BookingOperationResult result, bool created = false)
    {
        if (result.Success)
            return created ? StatusCode(StatusCodes.Status201Created, result) : Ok(result);

        var status = result.Code switch
        {
            "not_found" => StatusCodes.Status404NotFound,
            "booking_conflict" or "capacity_exceeded" or "holiday_confirmation_required" => StatusCodes.Status409Conflict,
            "invalid_status" => StatusCodes.Status409Conflict,
            _ => StatusCodes.Status400BadRequest
        };
        return StatusCode(status, new ProblemDetails
        {
            Status = status,
            Title = result.Code,
            Detail = result.Message,
            Extensions = { ["code"] = result.Code, ["details"] = result.Details }
        });
    }

    protected static void ValidateDepartment(DepartmentUpsertRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.DepartmentCode) || string.IsNullOrWhiteSpace(request.DepartmentName))
            throw new ArgumentException("Department code and name are required.");
        if (request.CapacityMode == "limited" && request.DefaultCapacityPerDay is not > 0)
            throw new ArgumentException("Limited departments require capacity greater than zero.");
        if (request.CapacityMode == "unlimited" && request.DefaultCapacityPerDay is not null)
            throw new ArgumentException("Unlimited departments must not specify daily capacity.");
        if (request.CapacityMode is not ("limited" or "unlimited"))
            throw new ArgumentException("Capacity mode must be limited or unlimited.");
        if (request.EffectiveTimezone != "Asia/Bangkok")
            throw new ArgumentException("CoDesk currently requires Asia/Bangkok as the effective timezone.");
    }

    protected static void ValidateBooking(BookingWriteRequest request)
    {
        if (request.BookingMode == "single_day" && request.BookingDateStart is null)
            throw new ArgumentException("A date is required for a single-day booking.");
        if (request.BookingMode == "date_time_range" &&
            (request.StartAt is null || request.EndAt is null || request.EndAt <= request.StartAt))
            throw new ArgumentException("A valid start and end are required for a date-time range.");
        if (request.BookingMode is not ("single_day" or "date_time_range"))
            throw new ArgumentException("Unsupported booking mode.");
        if (request.NoteText?.Length > 2000) throw new ArgumentException("Notes cannot exceed 2,000 characters.");
    }
}

