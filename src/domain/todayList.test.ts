import { describe, expect, it } from "vitest";
import { buildTodayList } from "./todayList";
import type { AppState } from "./types";

const baseState: AppState = {
  tasks: [],
  categories: [{ id: "cat-home", name: "Dom" }],
  assignees: [{ id: "person-ola", name: "Ola" }],
  completions: [],
  postponements: []
};

describe("buildTodayList", () => {
  it("shows active tasks scheduled for today", () => {
    const state: AppState = {
      ...baseState,
      tasks: [
        {
          id: "task-1",
          title: "Podlać rośliny",
          categoryId: "cat-home",
          assigneeId: "person-ola",
          recurrence: { type: "daily" },
          startDate: "2026-07-05",
          active: true,
          createdAt: "2026-07-05T08:00:00.000Z",
          updatedAt: "2026-07-05T08:00:00.000Z"
        }
      ]
    };

    const list = buildTodayList(state, "2026-07-05", { categoryId: "", assigneeId: "" });

    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ scheduledDate: "2026-07-05", isOverdue: false });
  });

  it("shows overdue tasks with the original scheduled date", () => {
    const state: AppState = {
      ...baseState,
      tasks: [
        {
          id: "task-1",
          title: "Podlać rośliny",
          categoryId: "cat-home",
          assigneeId: "person-ola",
          recurrence: { type: "daily" },
          startDate: "2026-07-03",
          active: true,
          createdAt: "2026-07-03T08:00:00.000Z",
          updatedAt: "2026-07-03T08:00:00.000Z"
        }
      ]
    };

    const list = buildTodayList(state, "2026-07-05", { categoryId: "", assigneeId: "" });

    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ scheduledDate: "2026-07-03", isOverdue: true });
  });

  it("hides tasks completed for the current occurrence", () => {
    const state: AppState = {
      ...baseState,
      tasks: [
        {
          id: "task-1",
          title: "Podlać rośliny",
          categoryId: "cat-home",
          assigneeId: "person-ola",
          recurrence: { type: "weekly" },
          startDate: "2026-07-01",
          active: true,
          createdAt: "2026-07-01T08:00:00.000Z",
          updatedAt: "2026-07-01T08:00:00.000Z"
        }
      ],
      completions: [
        {
          id: "completion-1",
          taskId: "task-1",
          scheduledDate: "2026-07-01",
          completedDate: "2026-07-03"
        }
      ]
    };

    const listBeforeNextCycle = buildTodayList(state, "2026-07-09", { categoryId: "", assigneeId: "" });
    const listOnNextCycle = buildTodayList(state, "2026-07-10", { categoryId: "", assigneeId: "" });

    expect(listBeforeNextCycle).toHaveLength(0);
    expect(listOnNextCycle).toHaveLength(1);
    expect(listOnNextCycle[0].scheduledDate).toBe("2026-07-10");
  });

  it("hides a task postponed from today and shows it again tomorrow as overdue", () => {
    const state: AppState = {
      ...baseState,
      tasks: [
        {
          id: "task-1",
          title: "Podlać rośliny",
          categoryId: "cat-home",
          assigneeId: "person-ola",
          recurrence: { type: "daily" },
          startDate: "2026-07-03",
          active: true,
          createdAt: "2026-07-03T08:00:00.000Z",
          updatedAt: "2026-07-03T08:00:00.000Z"
        }
      ],
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

    expect(buildTodayList(state, "2026-07-05", { categoryId: "", assigneeId: "" })).toHaveLength(0);
    const tomorrow = buildTodayList(state, "2026-07-06", { categoryId: "", assigneeId: "" });
    expect(tomorrow).toHaveLength(1);
    expect(tomorrow[0]).toMatchObject({ scheduledDate: "2026-07-03", isOverdue: true });
  });

  it("filters by category and assignee", () => {
    const state: AppState = {
      ...baseState,
      categories: [
        { id: "cat-home", name: "Dom" },
        { id: "cat-work", name: "Praca" }
      ],
      assignees: [
        { id: "person-ola", name: "Ola" },
        { id: "person-jan", name: "Jan" }
      ],
      tasks: [
        {
          id: "task-1",
          title: "Dom Oli",
          categoryId: "cat-home",
          assigneeId: "person-ola",
          recurrence: { type: "daily" },
          startDate: "2026-07-05",
          active: true,
          createdAt: "2026-07-05T08:00:00.000Z",
          updatedAt: "2026-07-05T08:00:00.000Z"
        },
        {
          id: "task-2",
          title: "Praca Jana",
          categoryId: "cat-work",
          assigneeId: "person-jan",
          recurrence: { type: "daily" },
          startDate: "2026-07-05",
          active: true,
          createdAt: "2026-07-05T08:00:00.000Z",
          updatedAt: "2026-07-05T08:00:00.000Z"
        }
      ]
    };

    const list = buildTodayList(state, "2026-07-05", {
      categoryId: "cat-work",
      assigneeId: "person-jan"
    });

    expect(list.map((item) => item.task.title)).toEqual(["Praca Jana"]);
  });

  it("keeps working when category or assignee references are missing", () => {
    const state: AppState = {
      ...baseState,
      categories: [],
      assignees: [],
      tasks: [
        {
          id: "task-1",
          title: "Zadanie",
          categoryId: "missing-category",
          assigneeId: "missing-assignee",
          recurrence: { type: "daily" },
          startDate: "2026-07-05",
          active: true,
          createdAt: "2026-07-05T08:00:00.000Z",
          updatedAt: "2026-07-05T08:00:00.000Z"
        }
      ]
    };

    const list = buildTodayList(state, "2026-07-05", { categoryId: "", assigneeId: "" });

    expect(list[0].category.name).toBe("Nieznana kategoria");
    expect(list[0].assignee.name).toBe("Nieznana osoba");
  });

  it("exposes the latest completion date for card metadata", () => {
    const state: AppState = {
      ...baseState,
      tasks: [
        {
          id: "task-1",
          title: "Podlać rośliny",
          categoryId: "cat-home",
          assigneeId: "person-ola",
          recurrence: { type: "daily" },
          startDate: "2026-07-05",
          active: true,
          createdAt: "2026-07-05T08:00:00.000Z",
          updatedAt: "2026-07-05T08:00:00.000Z"
        }
      ],
      completions: [
        {
          id: "completion-1",
          taskId: "task-1",
          scheduledDate: "2026-07-03",
          completedDate: "2026-07-04"
        }
      ]
    };

    const list = buildTodayList(state, "2026-07-05", { categoryId: "", assigneeId: "" });

    expect(list[0].lastCompletedDate).toBe("2026-07-04");
  });
});
