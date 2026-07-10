import { describe, expect, it } from "vitest";
import type { AppState } from "./types";
import {
  addCategory,
  addPriority,
  addTaskType,
  deactivateCategory,
  movePriority,
  moveTaskType,
  setPriorityActive,
  setTaskTypeActive,
  updateCategory,
  updatePriority,
  updateTaskType
} from "./configuration";

const baseState: AppState = {
  tasks: [],
  categories: [],
  assignees: [],
  taskTypes: [{ id: "type-default", name: "Zadanie", active: true, order: 0 }],
  priorities: [{ id: "priority-normal", name: "Normalny", active: true, order: 0, color: "#868e96" }],
  completions: [],
  postponements: []
};

function ids(...values: string[]) {
  let index = 0;
  return () => values[index++];
}

describe("configuration category mutations", () => {
  it("adds a category with trimmed name and hex color", () => {
    const next = addCategory(baseState, { name: " Dom ", color: "#40c057" }, ids("cat-home"));

    expect(next.categories).toEqual([{ id: "cat-home", name: "Dom", color: "#40c057" }]);
  });

  it("rejects duplicate category names case-insensitively", () => {
    const initial = { ...baseState, categories: [{ id: "cat-home", name: "Dom", color: "#40c057" }] };

    expect(() => addCategory(initial, { name: " dom ", color: "#228be6" }, ids("cat-work"))).toThrow(
      "Kategoria o tej nazwie juz istnieje."
    );
  });

  it("updates category color without changing task references", () => {
    const initial: AppState = {
      ...baseState,
      categories: [{ id: "cat-home", name: "Dom", color: "#40c057" }],
      tasks: [
        {
          id: "task-1",
          title: "Podlac rosliny",
          categoryId: "cat-home",
          assigneeId: "person-1",
          taskTypeId: "type-default",
          priorityId: "priority-normal",
          schedule: { mode: "oneTime", date: "2026-07-07" },
          active: true,
          createdAt: "2026-07-07T08:00:00.000Z",
          updatedAt: "2026-07-07T08:00:00.000Z"
        }
      ]
    };

    const next = updateCategory(initial, "cat-home", { name: "Dom i sprawy", color: "#fab005" });

    expect(next.categories[0]).toEqual({ id: "cat-home", name: "Dom i sprawy", color: "#fab005" });
    expect(next.tasks[0].categoryId).toBe("cat-home");
  });

  it("does not remove a referenced category when deactivated", () => {
    const initial: AppState = {
      ...baseState,
      categories: [{ id: "cat-home", name: "Dom", color: "#40c057" }],
      tasks: [
        {
          id: "task-1",
          title: "Podlac rosliny",
          categoryId: "cat-home",
          assigneeId: "person-1",
          taskTypeId: "type-default",
          priorityId: "priority-normal",
          schedule: { mode: "oneTime", date: "2026-07-07" },
          active: true,
          createdAt: "2026-07-07T08:00:00.000Z",
          updatedAt: "2026-07-07T08:00:00.000Z"
        }
      ]
    };

    const next = deactivateCategory(initial, "cat-home");

    expect(next.categories).toEqual([{ id: "cat-home", name: "Dom", color: "#40c057" }]);
    expect(next.tasks[0].categoryId).toBe("cat-home");
  });
});

describe("configuration task type mutations", () => {
  it("adds task types at the next order value", () => {
    const next = addTaskType(baseState, { name: "Termin" }, ids("type-deadline"));

    expect(next.taskTypes).toEqual([
      { id: "type-default", name: "Zadanie", active: true, order: 0 },
      { id: "type-deadline", name: "Termin", active: true, order: 1 }
    ]);
  });

  it("updates and deactivates a task type without changing existing tasks", () => {
    const initial: AppState = {
      ...baseState,
      taskTypes: [{ id: "type-default", name: "Zadanie", active: true, order: 0 }],
      tasks: [
        {
          id: "task-1",
          title: "Zadanie testowe",
          categoryId: "cat-home",
          assigneeId: "person-1",
          taskTypeId: "type-default",
          priorityId: "priority-normal",
          schedule: { mode: "oneTime", date: "2026-07-07" },
          active: true,
          createdAt: "2026-07-07T08:00:00.000Z",
          updatedAt: "2026-07-07T08:00:00.000Z"
        }
      ]
    };

    const renamed = updateTaskType(initial, "type-default", { name: "Obowiazek" });
    const inactive = setTaskTypeActive(renamed, "type-default", false);

    expect(inactive.taskTypes[0]).toEqual({ id: "type-default", name: "Obowiazek", active: false, order: 0 });
    expect(inactive.tasks[0].taskTypeId).toBe("type-default");
  });

  it("moves task types by swapping order values", () => {
    const initial: AppState = {
      ...baseState,
      taskTypes: [
        { id: "type-a", name: "A", active: true, order: 0 },
        { id: "type-b", name: "B", active: true, order: 1 },
        { id: "type-c", name: "C", active: true, order: 2 }
      ]
    };

    const next = moveTaskType(initial, "type-c", "up");

    expect(next.taskTypes.map((item) => `${item.id}:${item.order}`)).toEqual(["type-a:0", "type-c:1", "type-b:2"]);
  });
});

describe("configuration priority mutations", () => {
  it("adds and updates priorities with optional colors", () => {
    const added = addPriority(baseState, { name: "Wysoki", color: "#fa5252" }, ids("priority-high"));
    const updated = updatePriority(added, "priority-high", { name: "Pilny", color: "#e03131" });

    expect(updated.priorities[1]).toEqual({
      id: "priority-high",
      name: "Pilny",
      active: true,
      order: 1,
      color: "#e03131"
    });
  });

  it("deactivates and reorders priorities without changing existing tasks", () => {
    const initial: AppState = {
      ...baseState,
      priorities: [
        { id: "priority-normal", name: "Normalny", active: true, order: 0, color: "#868e96" },
        { id: "priority-high", name: "Wysoki", active: true, order: 1, color: "#fa5252" }
      ],
      tasks: [
        {
          id: "task-1",
          title: "Zadanie testowe",
          categoryId: "cat-home",
          assigneeId: "person-1",
          taskTypeId: "type-default",
          priorityId: "priority-high",
          schedule: { mode: "oneTime", date: "2026-07-07" },
          active: true,
          createdAt: "2026-07-07T08:00:00.000Z",
          updatedAt: "2026-07-07T08:00:00.000Z"
        }
      ]
    };

    const inactive = setPriorityActive(initial, "priority-high", false);
    const moved = movePriority(inactive, "priority-high", "up");

    expect(moved.priorities.map((item) => `${item.id}:${item.active}:${item.order}`)).toEqual([
      "priority-high:false:0",
      "priority-normal:true:1"
    ]);
    expect(moved.tasks[0].priorityId).toBe("priority-high");
  });
});
