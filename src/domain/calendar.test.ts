import { describe, expect, it } from "vitest";
import { getCalendarDayDetails, getCalendarMonthDays } from "./calendar";
import type { AppState, Task } from "./types";

const baseState: AppState = {
  tasks: [],
  categories: [{ id: "cat-home", name: "Dom", color: "#40c057" }],
  assignees: [{ id: "person-ola", name: "Ola" }],
  taskTypes: [{ id: "type-task", name: "Zadanie", active: true, order: 0 }],
  priorities: [{ id: "priority-normal", name: "Normalny", active: true, order: 0, color: "#868e96" }],
  completions: [],
  postponements: []
};

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "Podlac rosliny",
    categoryId: "cat-home",
    assigneeId: "person-ola",
    taskTypeId: "type-task",
    priorityId: "priority-normal",
    schedule: { mode: "oneTime", date: "2026-07-08" },
    active: true,
    createdAt: "2026-07-01T08:00:00.000Z",
    updatedAt: "2026-07-01T08:00:00.000Z",
    ...overrides
  };
}

describe("calendar domain", () => {
  it("builds a complete Monday-first month grid and marks today", () => {
    const days = getCalendarMonthDays(baseState, "2026-07-15", "2026-07-07");

    expect(days).toHaveLength(35);
    expect(days[0]).toMatchObject({ date: "2026-06-29", isCurrentMonth: false });
    expect(days[2]).toMatchObject({ date: "2026-07-01", isCurrentMonth: true });
    expect(days[8]).toMatchObject({ date: "2026-07-07", isToday: true });
    expect(days[34]).toMatchObject({ date: "2026-08-02", isCurrentMonth: false });
  });

  it("places one-time tasks on their calendar date", () => {
    const state = { ...baseState, tasks: [task()] };

    const details = getCalendarDayDetails(state, "2026-07-08");

    expect(details.items.map((item) => item.task.title)).toEqual(["Podlac rosliny"]);
    expect(details.items[0]).toMatchObject({
      scheduledDate: "2026-07-08",
      displayDate: "2026-07-08",
      kind: "oneTime",
      isPostponed: false
    });
  });

  it("generates future recurring occurrences within the visible month", () => {
    const state: AppState = {
      ...baseState,
      tasks: [
        task({
          id: "task-recurring",
          title: "Trening",
          schedule: { mode: "recurring", startDate: "2026-07-02", recurrence: { type: "weekly" } }
        })
      ]
    };

    const days = getCalendarMonthDays(state, "2026-07-01", "2026-07-07");
    const datesWithItems = days.filter((day) => day.items.length > 0).map((day) => day.date);

    expect(datesWithItems).toEqual(["2026-07-02", "2026-07-09", "2026-07-16", "2026-07-23", "2026-07-30"]);
  });

  it("starts recurring projections from the next occurrence after the latest completion", () => {
    const state: AppState = {
      ...baseState,
      tasks: [
        task({
          id: "task-recurring",
          title: "Trening",
          schedule: { mode: "recurring", startDate: "2026-07-01", recurrence: { type: "weekly" } }
        })
      ],
      completions: [
        {
          id: "completion-1",
          taskId: "task-recurring",
          scheduledDate: "2026-07-01",
          completedDate: "2026-07-03"
        }
      ]
    };

    const days = getCalendarMonthDays(state, "2026-07-01", "2026-07-07");
    const datesWithItems = days.filter((day) => day.items.length > 0).map((day) => day.date);

    expect(datesWithItems).toEqual(["2026-07-10", "2026-07-17", "2026-07-24", "2026-07-31"]);
  });

  it("does not show inactive tasks", () => {
    const state = { ...baseState, tasks: [task({ active: false })] };

    expect(getCalendarDayDetails(state, "2026-07-08").items).toEqual([]);
  });

  it("places a postponed task on the postponed target date", () => {
    const state: AppState = {
      ...baseState,
      tasks: [task()],
      postponements: [
        {
          id: "postponement-1",
          taskId: "task-1",
          fromDate: "2026-07-08",
          toDate: "2026-07-12",
          createdAt: "2026-07-08T08:00:00.000Z"
        }
      ]
    };

    expect(getCalendarDayDetails(state, "2026-07-08").items).toEqual([]);
    expect(getCalendarDayDetails(state, "2026-07-12").items[0]).toMatchObject({
      scheduledDate: "2026-07-08",
      displayDate: "2026-07-12",
      isPostponed: true
    });
  });
});
