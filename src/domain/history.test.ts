import { describe, expect, it } from "vitest";
import type { AppState } from "./types";
import { buildHistoryList, emptyHistoryFilters } from "./history";

const state: AppState = {
  categories: [{ id: "cat-home", name: "Dom", color: "#40c057" }],
  assignees: [{ id: "person-ola", name: "Ola" }],
  taskTypes: [{ id: "type-task", name: "Zadanie", active: true, order: 0 }],
  priorities: [{ id: "priority-normal", name: "Normalny", active: true, order: 0, color: "#868e96" }],
  tasks: [
    {
      id: "task-1",
      title: "Podlac rosliny",
      categoryId: "cat-home",
      assigneeId: "person-ola",
      taskTypeId: "type-task",
      priorityId: "priority-normal",
      schedule: { mode: "oneTime", date: "2026-07-07" },
      active: true,
      createdAt: "2026-07-07T08:00:00.000Z",
      updatedAt: "2026-07-07T08:00:00.000Z"
    },
    {
      id: "task-2",
      title: "Bez slownikow",
      categoryId: "cat-missing",
      assigneeId: "person-missing",
      taskTypeId: "type-missing",
      priorityId: "priority-missing",
      schedule: { mode: "oneTime", date: "2026-07-08" },
      active: true,
      createdAt: "2026-07-07T08:00:00.000Z",
      updatedAt: "2026-07-07T08:00:00.000Z"
    }
  ],
  completions: [
    { id: "completion-old", taskId: "task-1", scheduledDate: "2026-07-07", completedDate: "2026-07-07" },
    { id: "completion-new", taskId: "task-2", scheduledDate: "2026-07-08", completedDate: "2026-07-09" }
  ],
  postponements: []
};

describe("history projection", () => {
  it("builds displayed completion rows newest first", () => {
    const rows = buildHistoryList(state, emptyHistoryFilters);

    expect(rows.map((row) => row.completionId)).toEqual(["completion-new", "completion-old"]);
    expect(rows[1]).toMatchObject({
      title: "Podlac rosliny",
      categoryName: "Dom",
      assigneeName: "Ola",
      taskTypeName: "Zadanie",
      priorityName: "Normalny"
    });
  });

  it("keeps history visible when referenced dictionary entries are missing", () => {
    const rows = buildHistoryList(state, emptyHistoryFilters);

    expect(rows[0]).toMatchObject({
      title: "Bez slownikow",
      categoryName: "Nieznana kategoria",
      assigneeName: "Nieznana osoba",
      taskTypeName: "Nieznany typ",
      priorityName: "Nieznany priorytet"
    });
  });

  it("filters by dates and task metadata", () => {
    const rows = buildHistoryList(state, {
      fromDate: "2026-07-07",
      toDate: "2026-07-07",
      categoryId: "cat-home",
      assigneeId: "person-ola",
      taskTypeId: "type-task",
      priorityId: "priority-normal"
    });

    expect(rows.map((row) => row.completionId)).toEqual(["completion-old"]);
  });
});
