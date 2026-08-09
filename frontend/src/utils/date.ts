import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
dayjs.extend(utc);
dayjs.extend(timezone);
export const DEFAULT_TIMEZONE = "Asia/Bangkok";
export const formatDate = (
  value: string | Date,
  timezoneName = DEFAULT_TIMEZONE,
) => {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value))
    return value;
  return dayjs(value).tz(timezoneName).format("YYYY-MM-DD");
};
export const formatDateTime = (
  value: string | Date,
  timezoneName = DEFAULT_TIMEZONE,
) => dayjs(value).tz(timezoneName).format("YYYY-MM-DD HH:mm");
export const localDateTimeToIso = (
  date: string,
  time: string,
  timezoneName = DEFAULT_TIMEZONE,
) => {
  const localValue = `${date} ${time}`;
  const parsed = dayjs.tz(localValue, timezoneName);
  if (parsed.format("YYYY-MM-DD HH:mm") !== localValue)
    throw new RangeError("invalid_local_time");
  return parsed.toISOString();
};
export const todayBusinessDate = (timezoneName = DEFAULT_TIMEZONE) =>
  dayjs().tz(timezoneName).format("YYYY-MM-DD");

// FullCalendar needs a timezone plugin for arbitrary named zones. Feed it a
// UTC-shaped wall time instead so the calendar never falls back to the browser
// machine timezone while still rendering the signed-in profile's local clock.
export const toCalendarWallTime = (value: string, timezoneName: string) =>
  dayjs(value).tz(timezoneName).format("YYYY-MM-DDTHH:mm:ss[Z]");
