using CoDesk.Application;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace CoDesk.Infrastructure;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddCoDeskInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("CoDesk");
        if (string.IsNullOrWhiteSpace(connectionString))
            throw new InvalidOperationException("ConnectionStrings:CoDesk must be configured on the server.");

        services.Configure<SupabaseOptions>(configuration.GetSection(SupabaseOptions.SectionName));
        services.Configure<DemoModeOptions>(configuration.GetSection(DemoModeOptions.SectionName));
        services.AddSingleton(_ => NpgsqlDataSource.Create(connectionString));
        services.AddDbContext<CoDeskDbContext>(options => options.UseNpgsql(connectionString));
        services.AddScoped<ICoDeskDataService, CoDeskDataService>();
        services.AddHttpClient<ISupabaseAdminService, SupabaseAdminService>();
        return services;
    }
}
