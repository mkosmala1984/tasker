import { describe, expect, it } from "vitest";
import { DEFAULT_PRIORITY_ID, DEFAULT_TASK_TYPE_ID } from "../storage/taskerStorage";
import { addTask, completeTask, deactivateTask, postponeTask, updateTask } from "./tasks";
import { buildTodayList } from "./todayList";
import type { AppState } from "./types";

const emptyState: AppState = {
  tasks: [],
  categories: [],
  assignees: [],
  taskTypes: [{ id: DEFAULT_TASK_TYPE_ID, name: "Zadanie", active: true, order: 0 }],
  priorities: [{ id: DEFAULT_PRIORITY_ID, name: "Normalny", active: true, order: 0, color: "#868e96" }],
  completions: [],
  postponements: []
};

function ids(...values: string[]) {
  let index = 0;
  return () => values[index++];
}

describe("task mutations", () => {
  it("adds a recurring task and creates reusable category and assignee records", () => {
    const state = addTask(
      emptyState,
      {
        title: "Podlac rosliny",
        categoryName: "Dom",
        categoryColor: "#40c057",
        assigneeName: "Ola",
        schedule: { mode: "recurring", startDate: "2026-07-05", recurrence: { type: "daily" } },
        active: true
      },
      "2026-07-05T08:00:00.000Z",
      ids("task-1", "cat-1", "assignee-1")
    );

    expect(state.tasks[0]).toMatchObject({
      id: "task-1",
      title: "Podlac rosliny",
      categoryId: "cat-1",
      assigneeId: "assignee-1",
      taskTypeId: DEFAULT_TASK_TYPE_ID,
      priorityId: DEFAULT_PRIORITY_ID,
      schedule: { mode: "recurring", startDate: "2026-07-05", recurrence: { type: "daily" } },
      active: true
    });
    expect(state.categories).toEqual([{ id: "cat-1", name: "Dom", color: "#40c057" }]);
    expect(state.assignees).toEqual([{ id: "assignee-1", name: "Ola" }]);
  });

  it("adds a one-time task with selected type and priority", () => {
    const state: AppState = {
      ...emptyState,
      taskTypes: [{ id: "type-deadline", name: "Termin", active: true, order: 0 }],
      priorities: [{ id: "priority-high", name: "Wysoki", active: true, order: 0, color: "#fa5252" }]
    };

    const next = addTask(
      state,
      {
        title: "Zaplacic rachunek",
        categoryName: "Finanse",
        assigneeName: "Jan",
        taskTypeId: "type-deadline",
        priorityId: "priority-high",
        schedule: { mode: "oneTime", date: "2026-07-08" },
        active: true
      },
      "2026-07-05T08:00:00.000Z",
      ids("task-1", "cat-1", "assignee-1")
    );

    expect(next.tasks[0]).toMatchObject({
      taskTypeId: "type-deadline",
      priorityId: "priority-high",
      schedule: { mode: "oneTime", date: "2026-07-08" }
    });
  });

  it("reuses existing category and assignee names case-insensitively", () => {
    const initial = addTask(
      emptyState,
      {
        title: "Pierwsze",
        categoryName: "Dom",
        assigneeName: "Ola",
        schedule: { mode: "recurring", startDate: "2026-07-05", recurrence: { type: "daily" } },
        active: true
      },
      "2026-07-05T08:00:00.000Z",
      ids("task-1", "cat-1", "assignee-1")
    );

    const next = addTask(
      initial,
      {
        title: "Drugie",
        categoryName: " dom ",
        assigneeName: " ola ",
        schedule: { mode: "recurring", startDate: "2026-07-06", recurrence: { type: "weekly" } },
        active: true
      },
      "2026-07-05T09:00:00.000Z",
      ids("task-2")
    );

    expect(next.categories).toHaveLength(1);
    expect(next.assignees).toHaveLength(1);
    expect(next.tasks[1]).toMatchObject({ categoryId: "cat-1", assigneeId: "assignee-1" });
  });

  it("updates task details and can create new category and assignee records", () => {
    const initial = addTask(
      emptyState,
      {
        title: "Podlac rosliny",
        categoryName: "Dom",
        assigneeName: "Ola",
        schedule: { mode: "recurring", startDate: "2026-07-05", recurrence: { type: "daily" } },
        active: true
      },
      "2026-07-05T08:00:00.000Z",
      ids("task-1", "cat-1", "assignee-1")
    );

    const next = updateTask(
      initial,
      "task-1",
      {
        title: "Zaplacic fakture",
        categoryName: "Finanse",
        categoryColor: "#fab005",
        assigneeName: "Jan",
        schedule: { mode: "recurring", startDate: "2026-07-10", recurrence: { type: "monthly" } },
        active: true
      },
      "2026-07-05T10:00:00.000Z",
      ids("cat-2", "assignee-2")
    );

    expect(next.tasks[0]).toMatchObject({
      title: "Zaplacic fakture",
      categoryId: "cat-2",
      assigneeId: "assignee-2",
      schedule: { mode: "recurring", startDate: "2026-07-10", recurrence: { type: "monthly" } }
    });
    expect(next.categories.map((category) => category.name)).toEqual(["Dom", "Finanse"]);
    expect(next.categories[1].color).toBe("#fab005");
  });

  it("deactivates a task", () => {
    const initial = addTask(
      emptyState,
      {
        title: "Podlac rosliny",
        categoryName: "Dom",
        assigneeName: "Ola",
        schedule: { mode: "recurring", startDate: "2026-07-05", recurrence: { type: "daily" } },
        active: true
      },
      "2026-07-05T08:00:00.000Z",
      ids("task-1", "cat-1", "assignee-1")
    );

    const next = deactivateTask(initial, "task-1", "2026-07-05T11:00:00.000Z");

    expect(next.tasks[0]).toMatchObject({ active: false, updatedAt: "2026-07-05T11:00:00.000Z" });
  });

  it("records completion and makes the next recurring cycle depend on actual completion date", () => {
    const initial = addTask(
      emptyState,
      {
        title: "Raport",
        categoryName: "Praca",
        assigneeName: "Ola",
        schedule: { mode: "recurring", startDate: "2026-07-01", recurrence: { type: "everyNDays", intervalDays: 7 } },
        active: true
      },
      "2026-07-01T08:00:00.000Z",
      ids("task-1", "cat-1", "assignee-1")
    );

    const completed = completeTask(initial, "task-1", "2026-07-01", "2026-07-03", ids("completion-1"));
    const list = buildTodayList(completed, "2026-07-10", { categoryId: "", assigneeId: "", taskTypeId: "", priorityId: "" });

    expect(completed.completions).toEqual([
      {
        id: "completion-1",
        taskId: "task-1",
        scheduledDate: "2026-07-01",
        completedDate: "2026-07-03"
      }
    ]);
    expect(list[0].scheduledDate).toBe("2026-07-10");
  });

  it("postpones a task without adding a completion", () => {
    const initial = addTask(
      emptyState,
      {
        title: "Podlac rosliny",
        categoryName: "Dom",
        assigneeName: "Ola",
        schedule: { mode: "oneTime", date: "2026-07-05" },
        active: true
      },
      "2026-07-05T08:00:00.000Z",
      ids("task-1", "cat-1", "assignee-1")
    );

    const postponed = postponeTask(
      initial,
      "task-1",
      "2026-07-05",
      "2026-07-06",
      "2026-07-05T12:00:00.000Z",
      ids("postponement-1")
    );

    expect(postponed.completions).toHaveLength(0);
    expect(postponed.postponements).toEqual([
      {
        id: "postponement-1",
        taskId: "task-1",
        fromDate: "2026-07-05",
        toDate: "2026-07-06",
        createdAt: "2026-07-05T12:00:00.000Z"
      }
    ]);
  });

  it("postpones a task to an arbitrary date without recording completion", () => {
    const state: AppState = {
      ...emptyState,
      tasks: [
        {
          id: "task-1",
          title: "Podlac rosliny",
          categoryId: "cat-1",
          assigneeId: "person-1",
          taskTypeId: DEFAULT_TASK_TYPE_ID,
          priorityId: DEFAULT_PRIORITY_ID,
          schedule: { mode: "oneTime", date: "2026-07-03" },
          active: true,
          createdAt: "2026-07-03T08:00:00.000Z",
          updatedAt: "2026-07-03T08:00:00.000Z"
        }
      ]
    };

    const next = postponeTask(state, "task-1", "2026-07-03", "2026-07-12", "2026-07-05T08:00:00.000Z", ids("postponement-1"));

    expect(next.postponements).toEqual([
      {
        id: "postponement-1",
        taskId: "task-1",
        fromDate: "2026-07-03",
        toDate: "2026-07-12",
        createdAt: "2026-07-05T08:00:00.000Z"
      }
    ]);
    expect(next.completions).toEqual([]);
  });

  it("rejects empty target postponement date", () => {
    expect(() => postponeTask(emptyState, "task-1", "2026-07-03", "", "2026-07-05T08:00:00.000Z")).toThrow("toDate is required");
  });

  it("keeps recurring completion based on the actual completion date", () => {
    const state: AppState = {
      ...emptyState,
      tasks: [
        {
          id: "task-1",
          title: "Przeglad",
          categoryId: "cat-1",
          assigneeId: "person-1",
          taskTypeId: DEFAULT_TASK_TYPE_ID,
          priorityId: DEFAULT_PRIORITY_ID,
          schedule: { mode: "recurring", startDate: "2026-07-01", recurrence: { type: "weekly" } },
          active: true,
          createdAt: "2026-07-01T08:00:00.000Z",
          updatedAt: "2026-07-01T08:00:00.000Z"
        }
      ]
    };

    const completed = completeTask(state, "task-1", "2026-07-01", "2026-07-03", ids("completion-1"));
    const todayList = buildTodayList(completed, "2026-07-10", { categoryId: "", assigneeId: "", taskTypeId: "", priorityId: "" });

    expect(completed.completions[0]).toMatchObject({ scheduledDate: "2026-07-01", completedDate: "2026-07-03" });
    expect(todayList[0].scheduledDate).toBe("2026-07-10");
  });
});
