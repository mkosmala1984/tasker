import { describe, expect, it } from "vitest";
import { addTask, completeTask, deactivateTask, postponeTask, updateTask } from "./tasks";
import { buildTodayList } from "./todayList";
import type { AppState } from "./types";

const emptyState: AppState = {
  tasks: [],
  categories: [],
  assignees: [],
  completions: [],
  postponements: []
};

function ids(...values: string[]) {
  let index = 0;
  return () => values[index++];
}

describe("task mutations", () => {
  it("adds a task and creates reusable category and assignee records", () => {
    const state = addTask(
      emptyState,
      {
        title: "Podlać rośliny",
        categoryName: "Dom",
        assigneeName: "Ola",
        recurrence: { type: "daily" },
        startDate: "2026-07-05",
        active: true
      },
      "2026-07-05T08:00:00.000Z",
      ids("task-1", "cat-1", "assignee-1")
    );

    expect(state.tasks[0]).toMatchObject({
      id: "task-1",
      title: "Podlać rośliny",
      categoryId: "cat-1",
      assigneeId: "assignee-1",
      startDate: "2026-07-05",
      active: true
    });
    expect(state.categories).toEqual([{ id: "cat-1", name: "Dom" }]);
    expect(state.assignees).toEqual([{ id: "assignee-1", name: "Ola" }]);
  });

  it("reuses existing category and assignee names case-insensitively", () => {
    const initial = addTask(
      emptyState,
      {
        title: "Pierwsze",
        categoryName: "Dom",
        assigneeName: "Ola",
        recurrence: { type: "daily" },
        startDate: "2026-07-05",
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
        recurrence: { type: "weekly" },
        startDate: "2026-07-06",
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
        title: "Podlać rośliny",
        categoryName: "Dom",
        assigneeName: "Ola",
        recurrence: { type: "daily" },
        startDate: "2026-07-05",
        active: true
      },
      "2026-07-05T08:00:00.000Z",
      ids("task-1", "cat-1", "assignee-1")
    );

    const next = updateTask(
      initial,
      "task-1",
      {
        title: "Zapłacić fakturę",
        categoryName: "Finanse",
        assigneeName: "Jan",
        recurrence: { type: "monthly" },
        startDate: "2026-07-10",
        active: true
      },
      "2026-07-05T10:00:00.000Z",
      ids("cat-2", "assignee-2")
    );

    expect(next.tasks[0]).toMatchObject({
      title: "Zapłacić fakturę",
      categoryId: "cat-2",
      assigneeId: "assignee-2",
      recurrence: { type: "monthly" },
      startDate: "2026-07-10"
    });
    expect(next.categories.map((category) => category.name)).toEqual(["Dom", "Finanse"]);
    expect(next.assignees.map((assignee) => assignee.name)).toEqual(["Ola", "Jan"]);
  });

  it("deactivates a task", () => {
    const initial = addTask(
      emptyState,
      {
        title: "Podlać rośliny",
        categoryName: "Dom",
        assigneeName: "Ola",
        recurrence: { type: "daily" },
        startDate: "2026-07-05",
        active: true
      },
      "2026-07-05T08:00:00.000Z",
      ids("task-1", "cat-1", "assignee-1")
    );

    const next = deactivateTask(initial, "task-1", "2026-07-05T11:00:00.000Z");

    expect(next.tasks[0]).toMatchObject({ active: false, updatedAt: "2026-07-05T11:00:00.000Z" });
  });

  it("records completion and makes the next cycle depend on actual completion date", () => {
    const initial = addTask(
      emptyState,
      {
        title: "Raport",
        categoryName: "Praca",
        assigneeName: "Ola",
        recurrence: { type: "everyNDays", intervalDays: 7 },
        startDate: "2026-07-01",
        active: true
      },
      "2026-07-01T08:00:00.000Z",
      ids("task-1", "cat-1", "assignee-1")
    );

    const completed = completeTask(initial, "task-1", "2026-07-01", "2026-07-03", ids("completion-1"));
    const list = buildTodayList(completed, "2026-07-10", { categoryId: "", assigneeId: "" });

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
        title: "Podlać rośliny",
        categoryName: "Dom",
        assigneeName: "Ola",
        recurrence: { type: "daily" },
        startDate: "2026-07-05",
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
});
