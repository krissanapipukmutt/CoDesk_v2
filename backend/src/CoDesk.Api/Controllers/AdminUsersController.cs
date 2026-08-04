using CoDesk.Application;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CoDesk.Api.Controllers;

[Route("api/admin/users")]
[Authorize(Policy = "AdminOnly")]
public sealed class AdminUsersController(
    ICoDeskDataService dataService,
    ISupabaseAdminService supabaseAdmin,
    ILogger<AdminUsersController> logger) : CoDeskControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PageResult<ProfileDto>>> Get([FromQuery] ListQuery query, [FromQuery] bool includeInactive, CancellationToken cancellationToken)
    {
        var actor = await CurrentUserAsync(dataService, cancellationToken);
        return Ok(await dataService.GetProfilesAsync(query, actor, includeInactive, cancellationToken));
    }

    [HttpGet("roles")]
    public async Task<ActionResult<IReadOnlyList<RoleDto>>> Roles(CancellationToken cancellationToken) =>
        Ok(await dataService.GetRolesAsync(cancellationToken));

    [HttpPost]
    public async Task<ActionResult<ProfileDto>> Create([FromBody] AdminCreateUserRequest request, CancellationToken cancellationToken)
    {
        Validate(request);
        var actor = await CurrentUserAsync(dataService, cancellationToken);
        await dataService.ValidateNewProfileAsync(request, cancellationToken);
        if (!supabaseAdmin.IsConfigured)
            return Problem(statusCode: StatusCodes.Status503ServiceUnavailable, title: "Supabase Admin API is not configured");

        var userId = await supabaseAdmin.CreateUserAsync(request.Email.Trim().ToLowerInvariant(), request.TemporaryPassword, request.FullName.Trim(), cancellationToken);
        try
        {
            var profile = await dataService.CreateProfileAsync(userId, request, actor.ProfileId, cancellationToken);
            logger.LogInformation("Admin created CoDesk user {UserId} with employee code {EmployeeCode}", userId, request.EmployeeCode);
            return StatusCode(StatusCodes.Status201Created, profile);
        }
        catch (Exception profileError)
        {
            try
            {
                await supabaseAdmin.DeleteUserAsync(userId, cancellationToken);
                logger.LogWarning("Compensated Supabase Auth user {UserId} after profile creation failure", userId);
            }
            catch (Exception compensationError)
            {
                logger.LogCritical(compensationError, "Manual reconciliation required for Supabase Auth user {UserId}", userId);
                throw new InvalidOperationException($"Profile creation failed and Auth compensation also failed. Reconcile user {userId} using server logs.", profileError);
            }
            throw;
        }
    }

    private static void Validate(AdminCreateUserRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.EmployeeCode) || string.IsNullOrWhiteSpace(request.FullName) || string.IsNullOrWhiteSpace(request.Email))
            throw new ArgumentException("Employee code, name, and email are required.");
        if (!request.Email.Contains('@', StringComparison.Ordinal)) throw new ArgumentException("Email is invalid.");
        if (request.TemporaryPassword.Length < 8) throw new ArgumentException("Temporary password must be at least 8 characters.");
    }
}
