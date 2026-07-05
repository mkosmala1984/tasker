import { describe, expect, it } from "vitest";
import { getNextScheduledDate } from "./recurrence";

describe("getNextScheduledDate", () => {
  it("calculates daily recurrence", () => {
    expect(getNextScheduledDate("2026-07-05", { type: "daily" })).toBe("2026-07-06");
  });

  it("calculates every N days recurrence", () => {
    expect(getNextScheduledDate("2026-07-05", { type: "everyNDays", intervalDays: 3 })).toBe("2026-07-08");
  });

  it("rejects non-positive every N days intervals", () => {
    expect(() => getNextScheduledDate("2026-07-05", { type: "everyNDays", intervalDays: 0 })).toThrow(
      "intervalDays must be greater than 0"
    );
  });

  it("calculates weekly recurrence", () => {
    expect(getNextScheduledDate("2026-07-05", { type: "weekly" })).toBe("2026-07-12");
  });

  it("calculates monthly recurrence", () => {
    expect(getNextScheduledDate("2026-01-31", { type: "monthly" })).toBe("2026-02-28");
  });

  it("calculates quarterly recurrence", () => {
    expect(getNextScheduledDate("2026-11-30", { type: "quarterly" })).toBe("2027-02-28");
  });
});
