import { describe, expect, it } from "vitest";
import { buildTodayList, buildTodayTaskGroup, getCurrentScheduledDate } from "./todayList";
import type { AppState, Task, TodayFilters } from "./types";

const emptyFilters: TodayFilters = { categoryId: "", assigneeId: "", taskTypeId: "", priorityId: "" };

const baseState: AppState = {
  tasks: [],
  categories: [
    { id: "cat-home", name: "Dom", color: "#40c057" },
    { id: "cat-work", name: "Praca", color: "#228be6" }
  ],
  assignees: [
    { id: "person-ola", name: "Ola" },
    { id: "person-jan", name: "Jan" }
  ],
  taskTypes: [
    { id: "type-task", name: "Zadanie", active: true, order: 0 },
    { id: "type-deadline", name: "Termin", active: true, order: 1 }
  ],
  priorities: [
    { id: "priority-normal", name: "Normalny", active: true, order: 0, color: "#868e96" },
    { id: "priority-high", name: "Wysoki", active: true, order: 1, color: "#fa5252" }
  ],
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
    schedule: { mode: "recurring", startDate: "2026-07-05", recurrence: { type: "daily" } },
    active: true,
    createdAt: "2026-07-05T08:00:00.000Z",
    updatedAt: "2026-07-05T08:00:00.000Z",
    ...overrides
  };
}

describe("buildTodayList", () => {
  it("separates tasks completed today from active items", () => {
    const state: AppState = {
      ...baseState,
      tasks: [
        task({ id: "task-active", title: "Aktywne", schedule: { mode: "oneTime", date: "2026-07-10" } }),
        task({ id: "task-done", title: "Wykonane", schedule: { mode: "oneTime", date: "2026-07-10" } })
      ],
      completions: [
        { id: "completion-1", taskId: "task-done", scheduledDate: "2026-07-10", completedDate: "2026-07-10" }
      ]
    };

    const group = buildTodayTaskGroup(state, "2026-07-10");

    expect(group.active.map((item) => item.task.title)).toEqual(["Aktywne"]);
    expect(group.completedToday.map((item) => item.task.title)).toEqual(["Wykonane"]);
  });

  it("does not include tasks completed on an earlier day in completed-today", () => {
    const state: AppState = {
      ...baseState,
      tasks: [task({ id: "task-1", schedule: { mode: "oneTime", date: "2026-07-09" } })],
      completions: [{ id: "completion-1", taskId: "task-1", scheduledDate: "2026-07-09", completedDate: "2026-07-09" }]
    };

    const group = buildTodayTaskGroup(state, "2026-07-10");

    expect(group.active).toHaveLength(0);
    expect(group.completedToday).toHaveLength(0);
  });

  it("shows active one-time tasks scheduled for today", () => {
    const state: AppState = {
      ...baseState,
      tasks: [task({ schedule: { mode: "oneTime", date: "2026-07-05" } })]
    };

    const list = buildTodayList(state, "2026-07-05", emptyFilters);

    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ scheduledDate: "2026-07-05", isOverdue: false });
  });

  it("shows overdue one-time tasks until they are completed or postponed", () => {
    const state: AppState = {
      ...baseState,
      tasks: [task({ schedule: { mode: "oneTime", date: "2026-07-03" } })]
    };

    const list = buildTodayList(state, "2026-07-05", emptyFilters);

    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ scheduledDate: "2026-07-03", isOverdue: true });
  });

  it("does not show one-time tasks completed for their scheduled date", () => {
    const state: AppState = {
      ...baseState,
      tasks: [task({ schedule: { mode: "oneTime", date: "2026-07-05" } })],
      completions: [{ id: "completion-1", taskId: "task-1", scheduledDate: "2026-07-05", completedDate: "2026-07-05" }]
    };

    expect(buildTodayList(state, "2026-07-05", emptyFilters)).toHaveLength(0);
    expect(getCurrentScheduledDate(state.tasks[0], state.completions)).toBeUndefined();
  });

  it("keeps recurring tasks completed for the current occurrence hidden until the next cycle", () => {
    const state: AppState = {
      ...baseState,
      tasks: [task({ schedule: { mode: "recurring", startDate: "2026-07-01", recurrence: { type: "weekly" } } })],
      completions: [{ id: "completion-1", taskId: "task-1", scheduledDate: "2026-07-01", completedDate: "2026-07-03" }]
    };

    expect(buildTodayList(state, "2026-07-09", emptyFilters)).toHaveLength(0);
    const nextCycle = buildTodayList(state, "2026-07-10", emptyFilters);
    expect(nextCycle).toHaveLength(1);
    expect(nextCycle[0].scheduledDate).toBe("2026-07-10");
  });

  it("provides the latest completion date and total completion count for an active task", () => {
    const state: AppState = {
      ...baseState,
      tasks: [task({ schedule: { mode: "recurring", startDate: "2026-07-01", recurrence: { type: "weekly" } } })],
      completions: [
        { id: "completion-1", taskId: "task-1", scheduledDate: "2026-07-01", completedDate: "2026-07-01" },
        { id: "completion-2", taskId: "task-1", scheduledDate: "2026-07-08", completedDate: "2026-07-04" },
        { id: "completion-3", taskId: "other-task", scheduledDate: "2026-07-01", completedDate: "2026-07-02" }
      ]
    };

    const group = buildTodayTaskGroup(state, "2026-07-11");

    expect(group.active[0]).toMatchObject({
      lastCompletedDate: "2026-07-04",
      completionCount: 2
    });
  });

  it("hides a task postponed to a future arbitrary date", () => {
    const state: AppState = {
      ...baseState,
      tasks: [task({ schedule: { mode: "oneTime", date: "2026-07-03" } })],
      postponements: [
        {
          id: "postponement-1",
          taskId: "task-1",
          fromDate: "2026-07-03",
          toDate: "2026-07-12",
          createdAt: "2026-07-05T08:00:00.000Z"
        }
      ]
    };

    expect(buildTodayList(state, "2026-07-05", emptyFilters)).toHaveLength(0);
    expect(buildTodayList(state, "2026-07-11", emptyFilters)).toHaveLength(0);
  });

  it("shows a postponed task again on the selected date", () => {
    const state: AppState = {
      ...baseState,
      tasks: [task({ schedule: { mode: "oneTime", date: "2026-07-03" } })],
      postponements: [
        {
          id: "postponement-1",
          taskId: "task-1",
          fromDate: "2026-07-03",
          toDate: "2026-07-12",
          createdAt: "2026-07-05T08:00:00.000Z"
        }
      ]
    };

    const list = buildTodayList(state, "2026-07-12", emptyFilters);

    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ scheduledDate: "2026-07-03", isOverdue: true });
  });

  it("uses the latest postponement when a task was postponed more than once", () => {
    const state: AppState = {
      ...baseState,
      tasks: [task({ schedule: { mode: "oneTime", date: "2026-07-03" } })],
      postponements: [
        {
          id: "postponement-1",
          taskId: "task-1",
          fromDate: "2026-07-03",
          toDate: "2026-07-08",
          createdAt: "2026-07-05T08:00:00.000Z"
        },
        {
          id: "postponement-2",
          taskId: "task-1",
          fromDate: "2026-07-03",
          toDate: "2026-07-12",
          createdAt: "2026-07-06T08:00:00.000Z"
        }
      ]
    };

    expect(buildTodayList(state, "2026-07-08", emptyFilters)).toHaveLength(0);
    expect(buildTodayList(state, "2026-07-12", emptyFilters)).toHaveLength(1);
  });

  it("filters by category, assignee, task type, and priority", () => {
    const state: AppState = {
      ...baseState,
      tasks: [
        task({ id: "task-1", title: "Dom Oli", categoryId: "cat-home", assigneeId: "person-ola", taskTypeId: "type-task", priorityId: "priority-normal" }),
        task({ id: "task-2", title: "Praca Jana", categoryId: "cat-work", assigneeId: "person-jan", taskTypeId: "type-deadline", priorityId: "priority-high" })
      ]
    };

    const list = buildTodayList(state, "2026-07-05", {
      categoryId: "cat-work",
      assigneeId: "person-jan",
      taskTypeId: "type-deadline",
      priorityId: "priority-high"
    });

    expect(list.map((item) => item.task.title)).toEqual(["Praca Jana"]);
  });

  it("keeps working when dictionary references are missing", () => {
    const state: AppState = {
      ...baseState,
      categories: [],
      assignees: [],
      taskTypes: [],
      priorities: [],
      tasks: [
        task({
          categoryId: "missing-category",
          assigneeId: "missing-assignee",
          taskTypeId: "missing-type",
          priorityId: "missing-priority"
        })
      ]
    };

    const list = buildTodayList(state, "2026-07-05", emptyFilters);

    expect(list[0].category.name).toBe("Nieznana kategoria");
    expect(list[0].assignee.name).toBe("Nieznana osoba");
    expect(list[0].taskType.name).toBe("Nieznany typ");
    expect(list[0].priority.name).toBe("Nieznany priorytet");
  });

  it("sorts overdue tasks by scheduled date before today's tasks, then by Polish title", () => {
    const state: AppState = {
      ...baseState,
      tasks: [
        task({ id: "task-3", title: "Zadanie dzisiaj", schedule: { mode: "oneTime", date: "2026-07-05" } }),
        task({ id: "task-2", title: "Alfa zalegla", schedule: { mode: "oneTime", date: "2026-07-04" } }),
        task({ id: "task-1", title: "Beta zalegla", schedule: { mode: "oneTime", date: "2026-07-04" } })
      ]
    };

    const list = buildTodayList(state, "2026-07-05", emptyFilters);

    expect(list.map((item) => item.task.title)).toEqual(["Alfa zalegla", "Beta zalegla", "Zadanie dzisiaj"]);
  });
});
