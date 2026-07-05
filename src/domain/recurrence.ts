import { addDays, addMonths } from "./dates";
import type { RecurrenceRule } from "./types";

export function getNextScheduledDate(fromDate: string, recurrence: RecurrenceRule): string {
  switch (recurrence.type) {
    case "daily":
      return addDays(fromDate, 1);
    case "everyNDays":
      if (recurrence.intervalDays <= 0) {
        throw new Error("intervalDays must be greater than 0");
      }
      return addDays(fromDate, recurrence.intervalDays);
    case "weekly":
      return addDays(fromDate, 7);
    case "monthly":
      return addMonths(fromDate, 1);
    case "quarterly":
      return addMonths(fromDate, 3);
  }
}
