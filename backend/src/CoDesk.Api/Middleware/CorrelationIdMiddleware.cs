namespace CoDesk.Api.Middleware;

public sealed class CorrelationIdMiddleware(RequestDelegate next)
{
    public const string HeaderName = "X-Request-ID";

    public async Task InvokeAsync(HttpContext context)
    {
        var requestId = context.Request.Headers.TryGetValue(HeaderName, out var existing) && !string.IsNullOrWhiteSpace(existing)
            ? existing.ToString()[..Math.Min(existing.ToString().Length, 128)]
            : Guid.NewGuid().ToString("N");
        context.TraceIdentifier = requestId;
        context.Response.Headers[HeaderName] = requestId;
        await next(context);
    }
}

