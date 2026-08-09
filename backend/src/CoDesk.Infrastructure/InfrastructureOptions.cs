namespace CoDesk.Infrastructure;

public sealed class SupabaseOptions
{
    public const string SectionName = "Supabase";
    public string Url { get; set; } = string.Empty;
    public string JwtIssuer { get; set; } = string.Empty;
    public string JwtAudience { get; set; } = "authenticated";
    public string SecretKey { get; set; } = string.Empty;
}

public sealed class DemoModeOptions
{
    public const string SectionName = "DemoMode";
    public bool Enabled { get; set; }
}
