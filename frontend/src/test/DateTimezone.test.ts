import { describe, expect, it } from "vitest";
import {
  DEFAULT_TIMEZONE,
  formatDate,
  localDateTimeToIso,
  toCalendarWallTime,
} from "../utils/date";

describe("timezone date utilities", () => {
  it("keeps Bangkok as the default and preserves date-only values", () => {
    expect(DEFAULT_TIMEZONE).toBe("Asia/Bangkok");
    expect(formatDate("2026-08-04")).toBe("2026-08-04");
    expect(localDateTimeToIso("2026-08-04", "09:00")).toBe(
      "2026-08-04T02:00:00.000Z",
    );
  });

  it("interprets Tokyo local input using the department timezone", () => {
    expect(localDateTimeToIso("2030-01-02", "00:30", "Asia/Tokyo")).toBe(
      "2030-01-01T15:30:00.000Z",
    );
  });

  it("uses New York daylight-saving offsets instead of a fixed offset", () => {
    expect(
      localDateTimeToIso("2026-01-15", "09:00", "America/New_York"),
    ).toBe("2026-01-15T14:00:00.000Z");
    expect(
      localDateTimeToIso("2026-07-15", "09:00", "America/New_York"),
    ).toBe("2026-07-15T13:00:00.000Z");
  });

  it("rejects a nonexistent New York spring-forward wall time", () => {
    expect(() =>
      localDateTimeToIso("2026-03-08", "02:30", "America/New_York"),
    ).toThrow("invalid_local_time");
  });

  it("builds browser-independent calendar wall times", () => {
    expect(
      toCalendarWallTime("2030-01-01T15:30:00Z", "Asia/Tokyo"),
    ).toBe("2030-01-02T00:30:00Z");
  });
});
