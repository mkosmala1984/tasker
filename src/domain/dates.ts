const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

type DateParts = {
  year: number;
  month: number;
  day: number;
};

function parseDateParts(value: string): DateParts {
  const match = DATE_PATTERN.exec(value);
  if (!match) {
    throw new Error(`Invalid date string: ${value}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error(`Invalid date string: ${value}`);
  }

  return { year, month, day };
}

function toDateString(parts: DateParts): string {
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${parts.year}-${month}-${day}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isDateString(value: string): boolean {
  try {
    parseDateParts(value);
    return true;
  } catch {
    return false;
  }
}

export function addDays(value: string, days: number): string {
  const parts = parseDateParts(value);
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return toDateString({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate()
  });
}

export function addMonths(value: string, months: number): string {
  const parts = parseDateParts(value);
  const targetMonthIndex = parts.month - 1 + months;
  const targetYear = parts.year + Math.floor(targetMonthIndex / 12);
  const normalizedMonthIndex = ((targetMonthIndex % 12) + 12) % 12;
  const targetMonth = normalizedMonthIndex + 1;
  const targetDay = Math.min(parts.day, daysInMonth(targetYear, targetMonth));

  return toDateString({
    year: targetYear,
    month: targetMonth,
    day: targetDay
  });
}

export function compareDates(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

export function getTodayString(now = new Date()): string {
  return toDateString({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate()
  });
}

export function formatPolishDateLabel(value: string): string {
  const parts = parseDateParts(value);
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const label = new Intl.DateTimeFormat("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}
