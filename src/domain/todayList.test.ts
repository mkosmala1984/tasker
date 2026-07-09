import { describe, expect, it } from "vitest";
import { DEFAULT_PRIORITY_ID, DEFAULT_TASK_TYPE_ID } from "../storage/taskerStorage";
import { buildTodayList } from "./todayList";
import type { AppState, Task } from "./types";

const baseState: AppState = {
  tasks: [],
  categories: [{ id: "cat-home", name: "Dom", color: "#40c057" }],
  assignees: [{ id: "person-ola", name: "Ola" }],
  taskTypes: [{ id: DEFAULT_TASK_TYPE_ID, name: "Zadanie", active: true, order: 0 }],
  priorities: [{ id: DEFAULT_PRIORITY_ID, name: "Normalny", active: true, order: 0, color: "#868e96" }],
  completions: [],
  postponements: []
};

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "Podlac rosliny",
    categoryId: "cat-home",
    assigneeId: "person-ola",
    taskTypeId: DEFAULT_TASK_TYPE_ID,
    priorityId: DEFAULT_PRIORITY_ID,
    schedule: { mode: "recurring", startDate: "2026-07-05", recurrence: { type: "daily" } },
    active: true,
    createdAt: "2026-07-05T08:00:00.000Z",
    updatedAt: "2026-07-05T08:00:00.000Z",
    ...overrides
  };
}

const emptyFilters = { categoryId: "", assigneeId: "", taskTypeId: "", priorityId: "" };

describe("buildTodayList", () => {
  it("shows active recurring tasks scheduled for today", () => {
    const state: AppState = { ...baseState, tasks: [task()] };

    const list = buildTodayList(state, "2026-07-05", emptyFilters);

    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ scheduledDate: "2026-07-05", isOverdue: false });
  });

  it("shows one-time tasks scheduled for today", () => {
    const state: AppState = { ...baseState, tasks: [task({ schedule: { mode: "oneTime", date: "2026-07-05" } })] };

    const list = buildTodayList(state, "2026-07-05", emptyFilters);

    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ scheduledDate: "2026-07-05", isOverdue: false });
  });

  it("hides completed one-time tasks", () => {
    const state: AppState = {
      ...baseState,
      tasks: [task({ schedule: { mode: "oneTime", date: "2026-07-05" } })],
      completions: [{ id: "completion-1", taskId: "task-1", scheduledDate: "2026-07-05", completedDate: "2026-07-05" }]
    };

    expect(buildTodayList(state, "2026-07-06", emptyFilters)).toHaveLength(0);
  });

  it("shows overdue recurring tasks with the original scheduled date", () => {
    const state: AppState = {
      ...baseState,
      tasks: [task({ schedule: { mode: "recurring", startDate: "2026-07-03", recurrence: { type: "daily" } } })]
    };

    const list = buildTodayList(state, "2026-07-05", emptyFilters);

    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ scheduledDate: "2026-07-03", isOverdue: true });
  });

  it("hides recurring tasks completed for the current occurrence until the next cycle", () => {
    const state: AppState = {
      ...baseState,
      tasks: [task({ schedule: { mode: "recurring", startDate: "2026-07-01", recurrence: { type: "weekly" } } })],
      completions: [{ id: "completion-1", taskId: "task-1", scheduledDate: "2026-07-01", completedDate: "2026-07-03" }]
    };

    const listBeforeNextCycle = buildTodayList(state, "2026-07-09", emptyFilters);
    const listOnNextCycle = buildTodayList(state, "2026-07-10", emptyFilters);

    expect(listBeforeNextCycle).toHaveLength(0);
    expect(listOnNextCycle).toHaveLength(1);
    expect(listOnNextCycle[0].scheduledDate).toBe("2026-07-10");
  });

  it("hides a task postponed from today and shows it again tomorrow as overdue", () => {
    const state: AppState = {
      ...baseState,
      tasks: [task({ schedule: { mode: "recurring", startDate: "2026-07-03", recurrence: { type: "daily" } } })],
      postponements: [
        {
          id: "postponement-1",
          taskId: "task-1",
          fromDate: "2026-07-05",
          toDate: "2026-07-06",
          createdAt: "2026-07-05T08:00:00.000Z"
        }
      ]
    };

    expect(buildTodayList(state, "2026-07-05", emptyFilters)).toHaveLength(0);
    const tomorrow = buildTodayList(state, "2026-07-06", emptyFilters);
    expect(tomorrow).toHaveLength(1);
    expect(tomorrow[0]).toMatchObject({ scheduledDate: "2026-07-03", isOverdue: true });
  });

  it("filters by category, assignee, task type, and priority", () => {
    const state: AppState = {
      ...baseState,
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
        { id: "priority-normal", name: "Normalny", active: true, order: 0 },
        { id: "priority-high", name: "Wysoki", active: true, order: 1 }
      ],
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
});
