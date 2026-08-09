using CoDesk.Application;

namespace CoDesk.UnitTests;

public sealed class TimezoneRulesTests
{
    [Fact]
    public void BangkokRemainsTheDefaultTimezone() =>
        Assert.Equal("Asia/Bangkok", TimezoneRules.DefaultTimezone);

    [Fact]
    public void NewYorkConversionUsesDifferentWinterAndSummerOffsets()
    {
        var winter = TimezoneRules.LocalDateTimeToUtc(
            new DateOnly(2026, 1, 15), new TimeOnly(9, 0), "America/New_York");
        var summer = TimezoneRules.LocalDateTimeToUtc(
            new DateOnly(2026, 7, 15), new TimeOnly(9, 0), "America/New_York");

        Assert.Equal(DateTimeOffset.Parse("2026-01-15T14:00:00Z"), winter);
        Assert.Equal(DateTimeOffset.Parse("2026-07-15T13:00:00Z"), summer);
    }

    [Fact]
    public void InvalidTimezoneIsRejected() =>
        Assert.Throws<ArgumentException>(() => TimezoneRules.GetRequiredTimeZone("Mars/Olympus"));
}
