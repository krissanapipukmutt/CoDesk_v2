import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
dayjs.extend(utc);
dayjs.extend(timezone);
export const BUSINESS_TIMEZONE = "Asia/Bangkok";
export const formatDate = (value: string | Date) => {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value))
    return value;
  return dayjs(value).tz(BUSINESS_TIMEZONE).format("YYYY-MM-DD");
};
export const formatDateTime = (value: string | Date) =>
  dayjs(value).tz(BUSINESS_TIMEZONE).format("YYYY-MM-DD HH:mm");
export const localDateTimeToIso = (date: string, time: string) =>
  dayjs.tz(`${date} ${time}`, BUSINESS_TIMEZONE).toISOString();
export const todayBusinessDate = () =>
  dayjs().tz(BUSINESS_TIMEZONE).format("YYYY-MM-DD");
