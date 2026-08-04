using CoDesk.Application;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CoDesk.Api.Controllers;

[Route("api/reports")]
[Authorize(Policy = "Reports")]
public sealed class ReportsController(ICoDeskDataService dataService) : CoDeskControllerBase
{
    [HttpGet("daily-department-bookings")]
    public Task<ReportPage> Daily([FromQuery] ReportQuery query, CancellationToken cancellationToken) => Report("daily-department-bookings", query, cancellationToken);

    [HttpGet("department-capacity-utilization")]
    public Task<ReportPage> Capacity([FromQuery] ReportQuery query, CancellationToken cancellationToken) => Report("department-capacity-utilization", query, cancellationToken);

    [HttpGet("employee-booking-frequency")]
    public Task<ReportPage> Frequency([FromQuery] ReportQuery query, CancellationToken cancellationToken) => Report("employee-booking-frequency", query, cancellationToken);

    [HttpGet("holiday-bookings")]
    public Task<ReportPage> Holidays([FromQuery] ReportQuery query, CancellationToken cancellationToken) => Report("holiday-bookings", query, cancellationToken);

    [HttpGet("booking-cancellations")]
    public Task<ReportPage> Cancellations([FromQuery] ReportQuery query, CancellationToken cancellationToken) => Report("booking-cancellations", query, cancellationToken);

    private Task<ReportPage> Report(string code, ReportQuery query, CancellationToken cancellationToken) =>
        dataService.GetReportAsync(code, query, cancellationToken);
}

