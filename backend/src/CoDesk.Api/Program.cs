using System.Security.Claims;
using CoDesk.Api.Auth;
using CoDesk.Api.Middleware;
using CoDesk.Infrastructure;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCoDeskInfrastructure(builder.Configuration);
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ApiExceptionHandler>();
builder.Services.AddControllers().AddJsonOptions(options =>
{
    options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
});
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo { Title = "CoDesk API", Version = "v1" });
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        Description = "Supabase access token. Demo Mode uses X-Demo-Profile-Id instead."
    });
});

var demoModeEnabled = builder.Configuration.GetValue<bool>("DemoMode:Enabled");
var authentication = builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = demoModeEnabled ? DemoAuthenticationHandler.SchemeName : JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = demoModeEnabled ? DemoAuthenticationHandler.SchemeName : JwtBearerDefaults.AuthenticationScheme;
});

authentication.AddScheme<AuthenticationSchemeOptions, DemoAuthenticationHandler>(DemoAuthenticationHandler.SchemeName, _ => { });
authentication.AddJwtBearer(options =>
{
    var issuer = builder.Configuration["Supabase:JwtIssuer"]?.TrimEnd('/');
    var audience = builder.Configuration["Supabase:JwtAudience"] ?? "authenticated";
    if (!string.IsNullOrWhiteSpace(issuer))
    {
        options.Authority = issuer;
        options.MetadataAddress = issuer + "/.well-known/openid-configuration";
    }
    options.RequireHttpsMetadata = !builder.Environment.IsDevelopment();
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidIssuer = issuer ?? string.Empty,
        ValidateAudience = true,
        ValidAudience = audience,
        ValidateLifetime = true,
        NameClaimType = ClaimTypes.NameIdentifier,
        RoleClaimType = ClaimTypes.Role,
        ClockSkew = TimeSpan.FromMinutes(1)
    };
});

builder.Services.AddTransient<IClaimsTransformation, ProfileClaimsTransformation>();
builder.Services.AddAuthorizationBuilder()
    .SetDefaultPolicy(new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .RequireClaim(CoDeskClaimTypes.ProfileActive, "true")
        .Build())
    .AddPolicy("DepartmentManagement", policy => policy.RequireRole("hr", "admin"))
    .AddPolicy("ProfileManagement", policy => policy.RequireRole("hr", "admin"))
    .AddPolicy("HolidayManagement", policy => policy.RequireRole("hr", "admin"))
    .AddPolicy("Reports", policy => policy.RequireRole("hr", "admin"))
    .AddPolicy("AdminOnly", policy => policy.RequireRole("admin"));

var origins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? ["http://localhost:5173"];
builder.Services.AddCors(options => options.AddPolicy("Frontend", policy =>
    policy.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();
app.UseExceptionHandler();
app.UseMiddleware<CorrelationIdMiddleware>();
app.UseCors("Frontend");
app.UseAuthentication();
app.UseAuthorization();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.MapControllers();
app.MapGet("/health", () => Results.Ok(new { status = "healthy", service = "CoDesk.Api" })).AllowAnonymous();
app.Run();

public partial class Program;
