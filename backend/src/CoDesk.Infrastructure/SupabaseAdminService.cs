using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using CoDesk.Application;
using Microsoft.Extensions.Options;

namespace CoDesk.Infrastructure;

public sealed class SupabaseAdminService(HttpClient httpClient, IOptions<SupabaseOptions> options) : ISupabaseAdminService
{
    private readonly SupabaseOptions _options = options.Value;

    public bool IsConfigured =>
        Uri.TryCreate(_options.Url, UriKind.Absolute, out _) &&
        !string.IsNullOrWhiteSpace(_options.ServiceRoleKey) &&
        !_options.ServiceRoleKey.Contains("server-only", StringComparison.OrdinalIgnoreCase);

    public async Task<Guid> CreateUserAsync(string email, string password, string fullName, CancellationToken cancellationToken)
    {
        EnsureConfigured();
        using var request = CreateRequest(HttpMethod.Post, "/auth/v1/admin/users");
        request.Content = JsonContent.Create(new
        {
            email,
            password,
            email_confirm = true,
            user_metadata = new { full_name = fullName }
        });
        using var response = await httpClient.SendAsync(request, cancellationToken);
        var payload = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            if (response.StatusCode is System.Net.HttpStatusCode.Conflict or System.Net.HttpStatusCode.UnprocessableEntity)
                throw new ConflictException("A Supabase Auth user with this identity already exists.");
            throw new InvalidOperationException($"Supabase Auth user creation failed ({(int)response.StatusCode}).");
        }
        using var document = JsonDocument.Parse(payload);
        if (!document.RootElement.TryGetProperty("id", out var id) || !Guid.TryParse(id.GetString(), out var userId))
        {
            throw new InvalidOperationException("Supabase Auth returned an invalid user identifier.");
        }
        return userId;
    }

    public async Task DeleteUserAsync(Guid userId, CancellationToken cancellationToken)
    {
        EnsureConfigured();
        using var request = CreateRequest(HttpMethod.Delete, $"/auth/v1/admin/users/{userId}");
        using var response = await httpClient.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException("Supabase Auth compensation failed; manual reconciliation is required.");
        }
    }

    private HttpRequestMessage CreateRequest(HttpMethod method, string path)
    {
        var request = new HttpRequestMessage(method, _options.Url.TrimEnd('/') + path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.ServiceRoleKey);
        request.Headers.Add("apikey", _options.ServiceRoleKey);
        return request;
    }

    private void EnsureConfigured()
    {
        if (!IsConfigured)
        {
            throw new InvalidOperationException("Supabase Admin API is not configured on the server.");
        }
    }
}
