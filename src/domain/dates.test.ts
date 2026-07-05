import { describe, expect, it } from "vitest";
import { addDays, addMonths, compareDates, formatPolishDateLabel, getTodayString, isDateString } from "./dates";

describe("date helpers", () => {
  it("adds days using local calendar date strings", () => {
    expect(addDays("2026-07-05", 1)).toBe("2026-07-06");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("clamps month additions to the last valid day", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-11-30", 3)).toBe("2027-02-28");
  });

  it("compares date strings", () => {
    expect(compareDates("2026-07-04", "2026-07-05")).toBeLessThan(0);
    expect(compareDates("2026-07-05", "2026-07-05")).toBe(0);
    expect(compareDates("2026-07-06", "2026-07-05")).toBeGreaterThan(0);
  });

  it("validates YYYY-MM-DD dates", () => {
    expect(isDateString("2026-07-05")).toBe(true);
    expect(isDateString("2026-02-30")).toBe(false);
    expect(isDateString("05-07-2026")).toBe(false);
  });

  it("formats today's date from an injected Date", () => {
    expect(getTodayString(new Date(2026, 6, 5, 23, 30))).toBe("2026-07-05");
  });

  it("formats a Polish display label for the header date", () => {
    expect(formatPolishDateLabel("2026-07-05")).toBe("Niedziela, 5 lipca 2026");
  });
});
