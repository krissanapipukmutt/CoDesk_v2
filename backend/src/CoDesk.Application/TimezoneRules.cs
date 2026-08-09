namespace CoDesk.Application;

public static class TimezoneRules
{
    public const string DefaultTimezone = "Asia/Bangkok";

    public static TimeZoneInfo GetRequiredTimeZone(string timezoneName)
    {
        if (string.IsNullOrWhiteSpace(timezoneName))
            throw new ArgumentException("A valid IANA timezone is required.");

        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(timezoneName);
        }
        catch (TimeZoneNotFoundException exception)
        {
            throw new ArgumentException("The selected IANA timezone is not supported.", exception);
        }
        catch (InvalidTimeZoneException exception)
        {
            throw new ArgumentException("The selected IANA timezone is invalid.", exception);
        }
    }

    public static DateTimeOffset LocalDateTimeToUtc(DateOnly date, TimeOnly time, string timezoneName)
    {
        var timezone = GetRequiredTimeZone(timezoneName);
        var local = DateTime.SpecifyKind(date.ToDateTime(time), DateTimeKind.Unspecified);
        if (timezone.IsInvalidTime(local))
            throw new ArgumentException("The selected local time does not exist in the department timezone.");
        return new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(local, timezone));
    }
}
