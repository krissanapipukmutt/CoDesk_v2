using CoDesk.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;

namespace CoDesk.Infrastructure;

public sealed class CoDeskDbContext(DbContextOptions<CoDeskDbContext> options) : DbContext(options)
{
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<Department> Departments => Set<Department>();
    public DbSet<Profile> Profiles => Set<Profile>();
    public DbSet<Holiday> Holidays => Set<Holiday>();
    public DbSet<Booking> Bookings => Set<Booking>();
    public DbSet<BookingAuditLog> BookingAuditLogs => Set<BookingAuditLog>();
    public DbSet<UserDepartmentHistory> UserDepartmentHistory => Set<UserDepartmentHistory>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Role>(entity => { entity.ToTable("roles", "co_desk"); entity.HasKey(x => x.RoleId); });
        modelBuilder.Entity<Department>(entity => { entity.ToTable("departments", "co_desk"); entity.HasKey(x => x.DepartmentId); });
        modelBuilder.Entity<Profile>(entity => { entity.ToTable("profiles", "co_desk"); entity.HasKey(x => x.ProfileId); });
        modelBuilder.Entity<Holiday>(entity => { entity.ToTable("holidays", "co_desk"); entity.HasKey(x => x.HolidayId); });
        modelBuilder.Entity<Booking>(entity => { entity.ToTable("bookings", "co_desk"); entity.HasKey(x => x.BookingId); });
        modelBuilder.Entity<BookingAuditLog>(entity =>
        {
            entity.ToTable("booking_audit_logs", "co_desk");
            entity.HasKey(x => x.AuditLogId);
            entity.Property(x => x.OldValuesJson).HasColumnType("jsonb");
            entity.Property(x => x.NewValuesJson).HasColumnType("jsonb");
        });
        modelBuilder.Entity<UserDepartmentHistory>(entity => { entity.ToTable("user_department_history", "co_desk"); entity.HasKey(x => x.HistoryId); });

        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            foreach (var property in entityType.GetProperties())
            {
                property.SetColumnName(ToSnakeCase(property.Name));
            }
        }
    }

    private static string ToSnakeCase(string value)
    {
        var result = new System.Text.StringBuilder(value.Length + 8);
        for (var index = 0; index < value.Length; index++)
        {
            var character = value[index];
            if (char.IsUpper(character) && index > 0)
            {
                result.Append('_');
            }
            result.Append(char.ToLowerInvariant(character));
        }
        return result.ToString();
    }
}

