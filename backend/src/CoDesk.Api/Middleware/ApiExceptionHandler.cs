using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using CoDesk.Application;

namespace CoDesk.Api.Middleware;

public sealed class ApiExceptionHandler(ILogger<ApiExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken cancellationToken)
    {
        var (status, title) = exception switch
        {
            UnauthorizedAccessException => (StatusCodes.Status403Forbidden, "Permission denied"),
            KeyNotFoundException => (StatusCodes.Status404NotFound, "Resource not found"),
            ArgumentException => (StatusCodes.Status400BadRequest, "Validation failed"),
            ConflictException => (StatusCodes.Status409Conflict, "Conflict"),
            PostgresException { SqlState: "23505" } => (StatusCodes.Status409Conflict, "Duplicate value"),
            PostgresException { SqlState: "23503" } => (StatusCodes.Status400BadRequest, "Invalid reference"),
            PostgresException { SqlState: "23514" } => (StatusCodes.Status400BadRequest, "Database validation failed"),
            PostgresException { SqlState: "23P01" } => (StatusCodes.Status409Conflict, "Booking conflict"),
            PostgresException { SqlState: "42501" } => (StatusCodes.Status403Forbidden, "Permission denied"),
            InvalidOperationException => (StatusCodes.Status503ServiceUnavailable, "Service unavailable"),
            _ => (StatusCodes.Status500InternalServerError, "Unexpected server error")
        };
        if (status >= 500) logger.LogError(exception, "Request {RequestId} failed", context.TraceIdentifier);
        else logger.LogWarning("Request {RequestId} rejected: {ExceptionType}", context.TraceIdentifier, exception.GetType().Name);

        var problem = new ProblemDetails
        {
            Status = status,
            Title = title,
            Detail = status == 500 ? "An unexpected error occurred." : exception.Message,
            Instance = context.Request.Path
        };
        problem.Extensions["requestId"] = context.TraceIdentifier;
        context.Response.StatusCode = status;
        await context.Response.WriteAsJsonAsync(problem, cancellationToken);
        return true;
    }
}
