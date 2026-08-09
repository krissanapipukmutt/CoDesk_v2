using CoDesk.Application;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CoDesk.Api.Controllers;

[Route("api/departments")]
public sealed class DepartmentsController(ICoDeskDataService dataService) : CoDeskControllerBase
{
    [HttpGet("timezones")]
    public async Task<ActionResult<IReadOnlyList<string>>> Timezones(CancellationToken cancellationToken) =>
        Ok(await dataService.GetSupportedTimezonesAsync(cancellationToken));

    [HttpGet]
    public async Task<ActionResult<PageResult<DepartmentDto>>> Get([FromQuery] ListQuery query, [FromQuery] bool includeInactive, CancellationToken cancellationToken)
    {
        var actor = await CurrentUserAsync(dataService, cancellationToken);
        var allowedInactive = includeInactive && AuthorizationRules.CanManageDepartments(actor);
        return Ok(await dataService.GetDepartmentsAsync(query, allowedInactive, cancellationToken));
    }

    [HttpPost]
    [Authorize(Policy = "DepartmentManagement")]
    public async Task<ActionResult<DepartmentDto>> Create([FromBody] DepartmentUpsertRequest request, CancellationToken cancellationToken)
    {
        ValidateDepartment(request);
        var actor = await CurrentUserAsync(dataService, cancellationToken);
        var department = await dataService.CreateDepartmentAsync(request, actor.ProfileId, cancellationToken);
        return department is null ? Problem("Department could not be created.") : CreatedAtAction(nameof(Get), department);
    }

    [HttpPut("{departmentId:guid}")]
    [Authorize(Policy = "DepartmentManagement")]
    public async Task<ActionResult<DepartmentDto>> Update(Guid departmentId, [FromBody] DepartmentUpsertRequest request, CancellationToken cancellationToken)
    {
        ValidateDepartment(request);
        var department = await dataService.UpdateDepartmentAsync(departmentId, request, cancellationToken);
        return department is null ? NotFound() : Ok(department);
    }

    [HttpPatch("{departmentId:guid}/status")]
    [Authorize(Policy = "DepartmentManagement")]
    public async Task<ActionResult<DepartmentDto>> SetStatus(Guid departmentId, [FromBody] DepartmentStatusRequest request, CancellationToken cancellationToken)
    {
        var existing = await dataService.GetDepartmentAsync(departmentId, cancellationToken);
        if (existing is null) return NotFound();
        var update = new DepartmentUpsertRequest(existing.DepartmentCode, existing.DepartmentName, existing.CapacityMode,
            existing.DefaultCapacityPerDay, request.IsActive, existing.EffectiveTimezone);
        return Ok(await dataService.UpdateDepartmentAsync(departmentId, update, cancellationToken));
    }
}

public sealed record DepartmentStatusRequest(bool IsActive);
