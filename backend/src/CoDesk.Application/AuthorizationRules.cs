using CoDesk.Domain;

namespace CoDesk.Application;

public static class AuthorizationRules
{
    public static bool CanBookFor(CurrentUser actor, Guid targetProfileId) =>
        actor.IsActive && (actor.RoleCode == RoleCodes.Admin || actor.ProfileId == targetProfileId);

    public static bool CanModifyBooking(CurrentUser actor, BookingDto booking) =>
        actor.IsActive && (actor.RoleCode == RoleCodes.Admin || actor.ProfileId == booking.BookedForProfileId);

    public static bool CanViewCalendarBooking(CurrentUser actor, BookingDto booking) =>
        actor.IsActive && (actor.RoleCode == RoleCodes.Admin || actor.DepartmentId == booking.DepartmentId);

    public static bool CanManageDepartments(CurrentUser actor) =>
        actor.IsActive && actor.RoleCode is RoleCodes.Hr or RoleCodes.Admin;

    public static bool CanManageProfiles(CurrentUser actor) =>
        actor.IsActive && actor.RoleCode is RoleCodes.Hr or RoleCodes.Admin;

    public static bool CanChangeRole(CurrentUser actor) =>
        actor.IsActive && actor.RoleCode == RoleCodes.Admin;

    public static bool CanManageHolidays(CurrentUser actor) =>
        actor.IsActive && actor.RoleCode is RoleCodes.Hr or RoleCodes.Admin;

    public static bool CanCreateUsers(CurrentUser actor) =>
        actor.IsActive && actor.RoleCode == RoleCodes.Admin;

    public static bool CanViewReports(CurrentUser actor) =>
        actor.IsActive && actor.RoleCode is RoleCodes.Hr or RoleCodes.Admin;
}
