import { addDays, compareDates, isDateString } from "./dates";
import { getNextScheduledDate } from "./recurrence";
import { getCurrentScheduledDate } from "./todayList";
import type { AppState, Postponement, Task } from "./types";

export type CalendarTaskKind = "oneTime" | "recurring";

export type CalendarTaskItem = {
  task: Task;
  scheduledDate: string;
  displayDate: string;
  kind: CalendarTaskKind;
  isPostponed: boolean;
};

export type CalendarDay = {
  date: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  items: CalendarTaskItem[];
};

export type CalendarDayDetails = {
  date: string;
  items: CalendarTaskItem[];
};

function monthStart(value: string): string {
  if (!isDateString(value)) {
    throw new Error(`Invalid month date: ${value}`);
  }
  return `${value.slice(0, 7)}-01`;
}

function monthNumber(value: string): string {
  return value.slice(0, 7);
}

function dayOfWeekMondayFirst(value: string): number {
  const date = new Date(`${value}T00:00:00.000Z`);
  return (date.getUTCDay() + 6) % 7;
}

function visibleRange(monthDate: string): { start: string; end: string; month: string } {
  const startOfMonth = monthStart(monthDate);
  const firstOffset = dayOfWeekMondayFirst(startOfMonth);
  const start = addDays(startOfMonth, -firstOffset);
  let end = addDays(start, 34);

  while (monthNumber(end) === monthNumber(startOfMonth)) {
    end = addDays(end, 7);
  }

  return { start, end, month: monthNumber(startOfMonth) };
}

function latestPostponementFor(taskId: string, scheduledDate: string, postponements: Postponement[]): Postponement | undefined {
  return postponements
    .filter((postponement) => postponement.taskId === taskId && postponement.fromDate === scheduledDate)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
}

function pushOccurrence(items: CalendarTaskItem[], state: AppState, task: Task, scheduledDate: string, kind: CalendarTaskKind) {
  const postponement = latestPostponementFor(task.id, scheduledDate, state.postponements);
  items.push({
    task,
    scheduledDate,
    displayDate: postponement?.toDate ?? scheduledDate,
    kind,
    isPostponed: postponement !== undefined
  });
}

function collectTaskItems(state: AppState, rangeStart: string, rangeEnd: string): CalendarTaskItem[] {
  const items: CalendarTaskItem[] = [];

  for (const task of state.tasks.filter((candidate) => candidate.active)) {
    if (task.schedule.mode === "oneTime") {
      pushOccurrence(items, state, task, task.schedule.date, "oneTime");
      continue;
    }

    const firstScheduledDate = getCurrentScheduledDate(task, state.completions);
    if (firstScheduledDate === undefined) {
      continue;
    }

    let scheduledDate = firstScheduledDate;
    while (compareDates(scheduledDate, rangeEnd) <= 0) {
      if (compareDates(scheduledDate, rangeStart) >= 0) {
        pushOccurrence(items, state, task, scheduledDate, "recurring");
      }
      scheduledDate = getNextScheduledDate(scheduledDate, task.schedule.recurrence);
    }
  }

  return items
    .filter((item) => compareDates(item.displayDate, rangeStart) >= 0 && compareDates(item.displayDate, rangeEnd) <= 0)
    .sort((left, right) => {
      const byDisplayDate = compareDates(left.displayDate, right.displayDate);
      if (byDisplayDate !== 0) {
        return byDisplayDate;
      }
      return left.task.title.localeCompare(right.task.title, "pl");
    });
}

export function getCalendarMonthDays(state: AppState, monthDate: string, today: string): CalendarDay[] {
  const range = visibleRange(monthDate);
  const items = collectTaskItems(state, range.start, range.end);
  const days: CalendarDay[] = [];

  for (let date = range.start; compareDates(date, range.end) <= 0; date = addDays(date, 1)) {
    days.push({
      date,
      isCurrentMonth: monthNumber(date) === range.month,
      isToday: date === today,
      items: items.filter((item) => item.displayDate === date)
    });
  }

  return days;
}

export function getCalendarDayDetails(state: AppState, date: string): CalendarDayDetails {
  const items = collectTaskItems(state, date, date);
  return { date, items };
}
