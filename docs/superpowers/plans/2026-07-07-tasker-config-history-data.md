# Tasker Config History Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the post-foundation v2 slice for category/color management, task-type and priority dictionaries, completion history as a filtered list, and safe full local data import/export.

**Architecture:** Keep all data rules outside React: dictionary/category mutations live in `src/domain/configuration.ts`, history projection lives in `src/domain/history.ts`, and import/export validation lives in `src/storage/taskerBackup.ts`. Zustand exposes narrow actions that persist complete `AppState` snapshots, while React views compose Mantine forms, tables, filters, and confirmation flows. The plan assumes `docs/superpowers/plans/2026-07-07-tasker-foundation.md` has already landed, including `AppState` version `2`, `TaskSchedule`, category colors, task types, priorities, `AppView`, and navigation placeholders.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, React Testing Library, Mantine, Zustand, browser `localStorage`, browser `Blob`, `URL.createObjectURL`, and `<input type="file">`.

## Global Constraints

- Local-only application: no accounts, backend, synchronization, or network dependency.
- Dates are calendar dates in `YYYY-MM-DD`, without time or timezone.
- Interface copy remains Polish.
- This plan starts after the v2 foundation plan and must preserve the Today workflow introduced there.
- Scope includes categories with colors, task-type dictionary, priority dictionary, completion history list with filters, full local export, and validated import with confirmation.
- Scope excludes full task module, Today list expansion, calendar behavior, statistics, reports, charts, backend, and notifications.
- Import must not overwrite current data when parsing, validation, version support, or user confirmation fails.
- Dictionary changes must not destroy existing tasks or history.
- Use ASCII in source and docs unless the touched file already intentionally uses non-ASCII.
- Do not commit during this plan execution unless the user explicitly asks for commits later.

---

## File Structure

- Create `src/domain/configuration.ts`: pure mutations for categories, task types, and priorities. Responsible for validation, name normalization, color validation, order handling, active/deactivated dictionary entries, and safe deletes.
- Create `src/domain/configuration.test.ts`: focused unit coverage for add/update/deactivate/reorder behavior and reference safety.
- Create `src/domain/history.ts`: pure history projection from `AppState.completions` plus task/category/assignee/type/priority lookups. Responsible for filters and newest-first sorting; no statistics.
- Create `src/domain/history.test.ts`: unit coverage for displayed completion rows, missing referenced entities, filters, and sort order.
- Create `src/storage/taskerBackup.ts`: full-state export/import helpers. Responsible for serializing complete v2 backups, parsing files, validating supported schema version, returning summaries, and never writing storage directly.
- Create `src/storage/taskerBackup.test.ts`: unit coverage for full export shape, valid import preview, invalid JSON, unsupported version, incomplete payloads, and non-overwrite contract.
- Modify `src/state/taskerStore.ts`: add `historyFilters`, configuration actions, import preview/apply actions, and a state replacement path that persists only after confirmation.
- Create `src/state/taskerStore.test.ts`: store-level persistence and import-safety coverage for new actions.
- Create `src/components/CategoryManager.tsx`: category list and add/edit/deactivate controls with color input.
- Create `src/components/DictionaryManager.tsx`: reusable dictionary UI for task types and priorities, including active toggles and move up/down.
- Create `src/components/HistoryView.tsx`: completion history list with filters for date range, category, assignee, task type, and priority.
- Create `src/components/DataTransferView.tsx`: export button, import file picker, validation result, summary, and explicit confirmation button.
- Modify `src/App.tsx`: replace foundation placeholders for `categories`, `settings`, `history`, and `data` with real views; keep `today`, `tasks`, and `calendar` navigation integration only.
- Modify `src/App.test.tsx`: cover navigation to the new views and one high-level import/export safety path.

---

### Task 1: Configuration Domain Mutations

**Files:**
- Create: `src/domain/configuration.ts`
- Create: `src/domain/configuration.test.ts`

**Interfaces:**
- Consumes: `AppState`, `Category`, `TaskType`, `Priority` from `src/domain/types.ts`.
- Produces:
  - `type IdFactory = () => string`
  - `addCategory(state: AppState, input: CategoryInput, nextId: IdFactory): AppState`
  - `updateCategory(state: AppState, categoryId: string, input: CategoryInput): AppState`
  - `deactivateCategory(state: AppState, categoryId: string): AppState`
  - `addTaskType(state: AppState, input: DictionaryInput, nextId: IdFactory): AppState`
  - `updateTaskType(state: AppState, taskTypeId: string, input: DictionaryInput): AppState`
  - `setTaskTypeActive(state: AppState, taskTypeId: string, active: boolean): AppState`
  - `moveTaskType(state: AppState, taskTypeId: string, direction: "up" | "down"): AppState`
  - `addPriority(state: AppState, input: PriorityInput, nextId: IdFactory): AppState`
  - `updatePriority(state: AppState, priorityId: string, input: PriorityInput): AppState`
  - `setPriorityActive(state: AppState, priorityId: string, active: boolean): AppState`
  - `movePriority(state: AppState, priorityId: string, direction: "up" | "down"): AppState`

- [ ] **Step 1: Write failing tests for categories**

Create `src/domain/configuration.test.ts` with these category tests:

```ts
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
```

- [ ] **Step 2: Run category tests and verify failure**

Run: `npm run test:run -- src/domain/configuration.test.ts`

Expected: FAIL because `src/domain/configuration.ts` does not exist.

- [ ] **Step 3: Implement category functions**

Create `src/domain/configuration.ts` with the category input types and helpers:

```ts
import type { AppState, Category, Priority, TaskType } from "./types";

export type IdFactory = () => string;

export type CategoryInput = {
  name: string;
  color: string;
};

export type DictionaryInput = {
  name: string;
};

export type PriorityInput = {
  name: string;
  color?: string;
};

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function normalizeKey(name: string): string {
  return normalizeName(name).toLocaleLowerCase("pl");
}

function assertName(name: string): string {
  const normalized = normalizeName(name);
  if (normalized.length === 0) {
    throw new Error("Nazwa jest wymagana.");
  }
  return normalized;
}

function assertHexColor(color: string): string {
  const normalized = color.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(normalized)) {
    throw new Error("Kolor musi byc w formacie #RRGGBB.");
  }
  return normalized.toLowerCase();
}

function assertUniqueName<T extends { id: string; name: string }>(
  items: T[],
  name: string,
  currentId: string | undefined,
  message: string
): void {
  const key = normalizeKey(name);
  const duplicate = items.some((item) => item.id !== currentId && normalizeKey(item.name) === key);
  if (duplicate) {
    throw new Error(message);
  }
}

export function addCategory(state: AppState, input: CategoryInput, nextId: IdFactory): AppState {
  const name = assertName(input.name);
  const color = assertHexColor(input.color);
  assertUniqueName(state.categories, name, undefined, "Kategoria o tej nazwie juz istnieje.");
  return { ...state, categories: [...state.categories, { id: nextId(), name, color }] };
}

export function updateCategory(state: AppState, categoryId: string, input: CategoryInput): AppState {
  const name = assertName(input.name);
  const color = assertHexColor(input.color);
  assertUniqueName(state.categories, name, categoryId, "Kategoria o tej nazwie juz istnieje.");
  return {
    ...state,
    categories: state.categories.map((category) =>
      category.id === categoryId ? { ...category, name, color } : category
    )
  };
}

export function deactivateCategory(state: AppState, categoryId: string): AppState {
  const isReferenced = state.tasks.some((task) => task.categoryId === categoryId);
  if (isReferenced) {
    return state;
  }
  return { ...state, categories: state.categories.filter((category) => category.id !== categoryId) };
}
```

- [ ] **Step 4: Add failing tests for task types and priorities**

Append these tests to `src/domain/configuration.test.ts`:

```ts
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

    expect(updated.priorities[1]).toEqual({ id: "priority-high", name: "Pilny", active: true, order: 1, color: "#e03131" });
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
```

- [ ] **Step 5: Run dictionary tests and verify failure**

Run: `npm run test:run -- src/domain/configuration.test.ts`

Expected: FAIL because dictionary functions are imported but not implemented.

- [ ] **Step 6: Implement dictionary functions**

Extend `src/domain/configuration.ts` with:

```ts
function nextOrder(items: Array<{ order: number }>): number {
  return items.length === 0 ? 0 : Math.max(...items.map((item) => item.order)) + 1;
}

function sortByOrder<T extends { order: number }>(items: T[]): T[] {
  return [...items].sort((left, right) => left.order - right.order);
}

function moveOrderedItem<T extends { id: string; order: number }>(items: T[], id: string, direction: "up" | "down"): T[] {
  const sorted = sortByOrder(items);
  const index = sorted.findIndex((item) => item.id === id);
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || targetIndex < 0 || targetIndex >= sorted.length) {
    return sorted;
  }

  const current = sorted[index];
  const target = sorted[targetIndex];
  return sorted
    .map((item) => {
      if (item.id === current.id) {
        return { ...item, order: target.order };
      }
      if (item.id === target.id) {
        return { ...item, order: current.order };
      }
      return item;
    })
    .sort((left, right) => left.order - right.order);
}

export function addTaskType(state: AppState, input: DictionaryInput, nextId: IdFactory): AppState {
  const name = assertName(input.name);
  assertUniqueName(state.taskTypes, name, undefined, "Typ zadania o tej nazwie juz istnieje.");
  const taskType: TaskType = { id: nextId(), name, active: true, order: nextOrder(state.taskTypes) };
  return { ...state, taskTypes: sortByOrder([...state.taskTypes, taskType]) };
}

export function updateTaskType(state: AppState, taskTypeId: string, input: DictionaryInput): AppState {
  const name = assertName(input.name);
  assertUniqueName(state.taskTypes, name, taskTypeId, "Typ zadania o tej nazwie juz istnieje.");
  return {
    ...state,
    taskTypes: sortByOrder(state.taskTypes.map((item) => (item.id === taskTypeId ? { ...item, name } : item)))
  };
}

export function setTaskTypeActive(state: AppState, taskTypeId: string, active: boolean): AppState {
  return {
    ...state,
    taskTypes: sortByOrder(state.taskTypes.map((item) => (item.id === taskTypeId ? { ...item, active } : item)))
  };
}

export function moveTaskType(state: AppState, taskTypeId: string, direction: "up" | "down"): AppState {
  return { ...state, taskTypes: moveOrderedItem(state.taskTypes, taskTypeId, direction) };
}

export function addPriority(state: AppState, input: PriorityInput, nextId: IdFactory): AppState {
  const name = assertName(input.name);
  const color = input.color ? assertHexColor(input.color) : undefined;
  assertUniqueName(state.priorities, name, undefined, "Priorytet o tej nazwie juz istnieje.");
  const priority: Priority = { id: nextId(), name, active: true, order: nextOrder(state.priorities), color };
  return { ...state, priorities: sortByOrder([...state.priorities, priority]) };
}

export function updatePriority(state: AppState, priorityId: string, input: PriorityInput): AppState {
  const name = assertName(input.name);
  const color = input.color ? assertHexColor(input.color) : undefined;
  assertUniqueName(state.priorities, name, priorityId, "Priorytet o tej nazwie juz istnieje.");
  return {
    ...state,
    priorities: sortByOrder(state.priorities.map((item) => (item.id === priorityId ? { ...item, name, color } : item)))
  };
}

export function setPriorityActive(state: AppState, priorityId: string, active: boolean): AppState {
  return {
    ...state,
    priorities: sortByOrder(state.priorities.map((item) => (item.id === priorityId ? { ...item, active } : item)))
  };
}

export function movePriority(state: AppState, priorityId: string, direction: "up" | "down"): AppState {
  return { ...state, priorities: moveOrderedItem(state.priorities, priorityId, direction) };
}
```

- [ ] **Step 7: Run configuration tests**

Run: `npm run test:run -- src/domain/configuration.test.ts`

Expected: PASS.

---

### Task 2: History Projection And Filters

**Files:**
- Create: `src/domain/history.ts`
- Create: `src/domain/history.test.ts`

**Interfaces:**
- Consumes: `AppState`, `Completion`, `Task`, `Category`, `Assignee`, `TaskType`, `Priority`.
- Produces:
  - `type HistoryFilters = { fromDate: string; toDate: string; categoryId: string; assigneeId: string; taskTypeId: string; priorityId: string }`
  - `const emptyHistoryFilters: HistoryFilters`
  - `type HistoryItem = { completionId: string; taskId: string; title: string; scheduledDate: string; completedDate: string; categoryName: string; categoryColor: string; assigneeName: string; taskTypeName: string; priorityName: string; priorityColor?: string }`
  - `buildHistoryList(state: AppState, filters: HistoryFilters): HistoryItem[]`

- [ ] **Step 1: Write failing history tests**

Create `src/domain/history.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildHistoryList, emptyHistoryFilters } from "./history";
import type { AppState } from "./types";

const state: AppState = {
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
  tasks: [
    {
      id: "task-home",
      title: "Podlac rosliny",
      categoryId: "cat-home",
      assigneeId: "person-ola",
      taskTypeId: "type-task",
      priorityId: "priority-normal",
      schedule: { mode: "oneTime", date: "2026-07-05" },
      active: true,
      createdAt: "2026-07-01T08:00:00.000Z",
      updatedAt: "2026-07-01T08:00:00.000Z"
    },
    {
      id: "task-work",
      title: "Wyslac raport",
      categoryId: "cat-work",
      assigneeId: "person-jan",
      taskTypeId: "type-deadline",
      priorityId: "priority-high",
      schedule: { mode: "oneTime", date: "2026-07-06" },
      active: true,
      createdAt: "2026-07-01T08:00:00.000Z",
      updatedAt: "2026-07-01T08:00:00.000Z"
    }
  ],
  completions: [
    { id: "completion-1", taskId: "task-home", scheduledDate: "2026-07-05", completedDate: "2026-07-05" },
    { id: "completion-2", taskId: "task-work", scheduledDate: "2026-07-06", completedDate: "2026-07-07" }
  ],
  postponements: []
};

describe("buildHistoryList", () => {
  it("returns completion rows with task and dictionary labels newest first", () => {
    const items = buildHistoryList(state, emptyHistoryFilters);

    expect(items.map((item) => item.title)).toEqual(["Wyslac raport", "Podlac rosliny"]);
    expect(items[0]).toMatchObject({
      completionId: "completion-2",
      scheduledDate: "2026-07-06",
      completedDate: "2026-07-07",
      categoryName: "Praca",
      categoryColor: "#228be6",
      assigneeName: "Jan",
      taskTypeName: "Termin",
      priorityName: "Wysoki",
      priorityColor: "#fa5252"
    });
  });

  it("filters by completed date range and dictionaries", () => {
    const items = buildHistoryList(state, {
      fromDate: "2026-07-07",
      toDate: "2026-07-07",
      categoryId: "cat-work",
      assigneeId: "person-jan",
      taskTypeId: "type-deadline",
      priorityId: "priority-high"
    });

    expect(items.map((item) => item.completionId)).toEqual(["completion-2"]);
  });

  it("keeps rows when referenced task is missing", () => {
    const next: AppState = {
      ...state,
      tasks: [],
      completions: [{ id: "completion-missing", taskId: "missing-task", scheduledDate: "2026-07-01", completedDate: "2026-07-02" }]
    };

    expect(buildHistoryList(next, emptyHistoryFilters)[0]).toMatchObject({
      title: "Usuniete zadanie",
      categoryName: "Nieznana kategoria",
      assigneeName: "Nieznana osoba",
      taskTypeName: "Nieznany typ",
      priorityName: "Nieznany priorytet"
    });
  });
});
```

- [ ] **Step 2: Run history tests and verify failure**

Run: `npm run test:run -- src/domain/history.test.ts`

Expected: FAIL because `src/domain/history.ts` does not exist.

- [ ] **Step 3: Implement history projection**

Create `src/domain/history.ts`:

```ts
import { compareDates } from "./dates";
import type { AppState, Assignee, Category, Priority, Task, TaskType } from "./types";

export type HistoryFilters = {
  fromDate: string;
  toDate: string;
  categoryId: string;
  assigneeId: string;
  taskTypeId: string;
  priorityId: string;
};

export const emptyHistoryFilters: HistoryFilters = {
  fromDate: "",
  toDate: "",
  categoryId: "",
  assigneeId: "",
  taskTypeId: "",
  priorityId: ""
};

export type HistoryItem = {
  completionId: string;
  taskId: string;
  title: string;
  scheduledDate: string;
  completedDate: string;
  categoryName: string;
  categoryColor: string;
  assigneeName: string;
  taskTypeName: string;
  priorityName: string;
  priorityColor?: string;
};

function findTask(state: AppState, taskId: string): Task | undefined {
  return state.tasks.find((task) => task.id === taskId);
}

function findCategory(categories: Category[], id: string | undefined): Category {
  return categories.find((category) => category.id === id) ?? { id: id ?? "", name: "Nieznana kategoria", color: "#868e96" };
}

function findAssignee(assignees: Assignee[], id: string | undefined): Assignee {
  return assignees.find((assignee) => assignee.id === id) ?? { id: id ?? "", name: "Nieznana osoba" };
}

function findTaskType(taskTypes: TaskType[], id: string | undefined): TaskType {
  return taskTypes.find((taskType) => taskType.id === id) ?? { id: id ?? "", name: "Nieznany typ", active: false, order: 0 };
}

function findPriority(priorities: Priority[], id: string | undefined): Priority {
  return priorities.find((priority) => priority.id === id) ?? { id: id ?? "", name: "Nieznany priorytet", active: false, order: 0 };
}

function matchesDateRange(completedDate: string, filters: HistoryFilters): boolean {
  const afterStart = filters.fromDate === "" || compareDates(completedDate, filters.fromDate) >= 0;
  const beforeEnd = filters.toDate === "" || compareDates(completedDate, filters.toDate) <= 0;
  return afterStart && beforeEnd;
}

function matchesDictionaryFilters(task: Task | undefined, filters: HistoryFilters): boolean {
  if (!task) {
    return filters.categoryId === "" && filters.assigneeId === "" && filters.taskTypeId === "" && filters.priorityId === "";
  }

  return (
    (filters.categoryId === "" || task.categoryId === filters.categoryId) &&
    (filters.assigneeId === "" || task.assigneeId === filters.assigneeId) &&
    (filters.taskTypeId === "" || task.taskTypeId === filters.taskTypeId) &&
    (filters.priorityId === "" || task.priorityId === filters.priorityId)
  );
}

export function buildHistoryList(state: AppState, filters: HistoryFilters): HistoryItem[] {
  return state.completions
    .filter((completion) => matchesDateRange(completion.completedDate, filters))
    .map((completion) => ({ completion, task: findTask(state, completion.taskId) }))
    .filter(({ task }) => matchesDictionaryFilters(task, filters))
    .map(({ completion, task }) => {
      const category = findCategory(state.categories, task?.categoryId);
      const assignee = findAssignee(state.assignees, task?.assigneeId);
      const taskType = findTaskType(state.taskTypes, task?.taskTypeId);
      const priority = findPriority(state.priorities, task?.priorityId);

      return {
        completionId: completion.id,
        taskId: completion.taskId,
        title: task?.title ?? "Usuniete zadanie",
        scheduledDate: completion.scheduledDate,
        completedDate: completion.completedDate,
        categoryName: category.name,
        categoryColor: category.color,
        assigneeName: assignee.name,
        taskTypeName: taskType.name,
        priorityName: priority.name,
        priorityColor: priority.color
      };
    })
    .sort((left, right) => {
      const byCompletedDate = compareDates(right.completedDate, left.completedDate);
      if (byCompletedDate !== 0) {
        return byCompletedDate;
      }
      return left.title.localeCompare(right.title, "pl");
    });
}
```

- [ ] **Step 4: Run history tests**

Run: `npm run test:run -- src/domain/history.test.ts`

Expected: PASS.

---

### Task 3: Full Backup Export And Import Validation

**Files:**
- Create: `src/storage/taskerBackup.ts`
- Create: `src/storage/taskerBackup.test.ts`

**Interfaces:**
- Consumes: `AppState` and `createEmptyState()` from `src/storage/taskerStorage.ts`.
- Produces:
  - `type BackupPayload = { app: "tasker"; exportedAt: string; state: AppState }`
  - `type ImportPreview = { state: AppState; summary: ImportSummary }`
  - `type ImportSummary = { taskCount: number; categoryCount: number; assigneeCount: number; taskTypeCount: number; priorityCount: number; completionCount: number; postponementCount: number }`
  - `createExportPayload(state: AppState, exportedAt: string): BackupPayload`
  - `serializeExportPayload(payload: BackupPayload): string`
  - `parseImportPayload(raw: string): ImportPreview`

- [ ] **Step 1: Write failing backup tests**

Create `src/storage/taskerBackup.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createEmptyState } from "./taskerStorage";
import { createExportPayload, parseImportPayload, serializeExportPayload } from "./taskerBackup";

describe("taskerBackup", () => {
  it("exports a complete state inside a Tasker payload", () => {
    const state = createEmptyState();
    const payload = createExportPayload(state, "2026-07-07T10:00:00.000Z");

    expect(payload).toEqual({
      app: "tasker",
      exportedAt: "2026-07-07T10:00:00.000Z",
      state
    });
    expect(JSON.parse(serializeExportPayload(payload))).toEqual(payload);
  });

  it("previews a valid import and returns summary counts", () => {
    const state = {
      ...createEmptyState(),
      categories: [{ id: "cat-home", name: "Dom", color: "#40c057" }],
      assignees: [{ id: "person-ola", name: "Ola" }],
      taskTypes: [{ id: "type-task", name: "Zadanie", active: true, order: 0 }],
      priorities: [{ id: "priority-normal", name: "Normalny", active: true, order: 0 }],
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
        }
      ],
      completions: [{ id: "completion-1", taskId: "task-1", scheduledDate: "2026-07-07", completedDate: "2026-07-07" }],
      postponements: []
    };

    const raw = serializeExportPayload(createExportPayload(state, "2026-07-07T10:00:00.000Z"));
    const preview = parseImportPayload(raw);

    expect(preview.state).toEqual(state);
    expect(preview.summary).toEqual({
      taskCount: 1,
      categoryCount: 1,
      assigneeCount: 1,
      taskTypeCount: 1,
      priorityCount: 1,
      completionCount: 1,
      postponementCount: 0
    });
  });

  it("rejects invalid JSON", () => {
    expect(() => parseImportPayload("{bad-json")).toThrow("Plik importu nie jest poprawnym JSON.");
  });

  it("rejects incomplete state payloads", () => {
    const raw = JSON.stringify({ app: "tasker", exportedAt: "2026-07-07T10:00:00.000Z", state: { tasks: [] } });

    expect(() => parseImportPayload(raw)).toThrow("Plik importu nie zawiera kompletnych danych Tasker.");
  });
});
```

- [ ] **Step 2: Run backup tests and verify failure**

Run: `npm run test:run -- src/storage/taskerBackup.test.ts`

Expected: FAIL because `src/storage/taskerBackup.ts` does not exist.

- [ ] **Step 3: Implement backup helpers without storage writes**

Create `src/storage/taskerBackup.ts`:

```ts
import type { AppState } from "../domain/types";

export type BackupPayload = {
  app: "tasker";
  exportedAt: string;
  state: AppState;
};

export type ImportSummary = {
  taskCount: number;
  categoryCount: number;
  assigneeCount: number;
  taskTypeCount: number;
  priorityCount: number;
  completionCount: number;
  postponementCount: number;
};

export type ImportPreview = {
  state: AppState;
  summary: ImportSummary;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasArray(value: Record<string, unknown>, key: string): boolean {
  return Array.isArray(value[key]);
}

function isAppState(value: unknown): value is AppState {
  if (!isRecord(value)) {
    return false;
  }

  return (
    hasArray(value, "tasks") &&
    hasArray(value, "categories") &&
    hasArray(value, "assignees") &&
    hasArray(value, "taskTypes") &&
    hasArray(value, "priorities") &&
    hasArray(value, "completions") &&
    hasArray(value, "postponements")
  );
}

function summarize(state: AppState): ImportSummary {
  return {
    taskCount: state.tasks.length,
    categoryCount: state.categories.length,
    assigneeCount: state.assignees.length,
    taskTypeCount: state.taskTypes.length,
    priorityCount: state.priorities.length,
    completionCount: state.completions.length,
    postponementCount: state.postponements.length
  };
}

export function createExportPayload(state: AppState, exportedAt: string): BackupPayload {
  return { app: "tasker", exportedAt, state };
}

export function serializeExportPayload(payload: BackupPayload): string {
  return JSON.stringify(payload, null, 2);
}

export function parseImportPayload(raw: string): ImportPreview {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Plik importu nie jest poprawnym JSON.");
  }

  if (!isRecord(parsed) || parsed.app !== "tasker") {
    throw new Error("Plik importu nie jest plikiem danych Tasker.");
  }

  if (!isAppState(parsed.state)) {
    throw new Error("Plik importu nie zawiera kompletnych danych Tasker.");
  }

  return { state: parsed.state, summary: summarize(parsed.state) };
}
```

- [ ] **Step 4: Run backup tests**

Run: `npm run test:run -- src/storage/taskerBackup.test.ts`

Expected: PASS.

---

### Task 4: Store Actions For Configuration, History, And Import

**Files:**
- Modify: `src/state/taskerStore.ts`
- Create: `src/state/taskerStore.test.ts`

**Interfaces:**
- Consumes: Task 1 configuration functions, Task 2 `HistoryFilters`, Task 3 `ImportPreview`.
- Produces store actions:
  - `setHistoryFilters(filters: HistoryFilters): void`
  - `addCategory(input: CategoryInput): void`
  - `updateCategory(categoryId: string, input: CategoryInput): void`
  - `deactivateCategory(categoryId: string): void`
  - `addTaskType(input: DictionaryInput): void`
  - `updateTaskType(taskTypeId: string, input: DictionaryInput): void`
  - `setTaskTypeActive(taskTypeId: string, active: boolean): void`
  - `moveTaskType(taskTypeId: string, direction: "up" | "down"): void`
  - `addPriority(input: PriorityInput): void`
  - `updatePriority(priorityId: string, input: PriorityInput): void`
  - `setPriorityActive(priorityId: string, active: boolean): void`
  - `movePriority(priorityId: string, direction: "up" | "down"): void`
  - `previewImport(raw: string): ImportPreview`
  - `applyImport(preview: ImportPreview): void`

- [ ] **Step 1: Add store-level tests**

Create `src/state/taskerStore.test.ts` with:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createExportPayload, serializeExportPayload } from "../storage/taskerBackup";
import { STORAGE_KEY, createEmptyState } from "../storage/taskerStorage";
import { resetTaskerStore, useTaskerStore } from "./taskerStore";

describe("taskerStore configuration and import actions", () => {
  beforeEach(() => {
    localStorage.clear();
    resetTaskerStore();
  });

  it("persists category changes", () => {
    useTaskerStore.getState().addCategory({ name: "Dom", color: "#40c057" });

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    expect(stored.categories).toHaveLength(1);
    expect(stored.categories[0]).toMatchObject({ name: "Dom", color: "#40c057" });
  });

  it("previews invalid import without overwriting current storage", () => {
    useTaskerStore.getState().addCategory({ name: "Dom", color: "#40c057" });
    const before = localStorage.getItem(STORAGE_KEY);

    expect(() => useTaskerStore.getState().previewImport("{bad-json")).toThrow("Plik importu nie jest poprawnym JSON.");
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before);
  });

  it("applies import only when explicitly confirmed", () => {
    useTaskerStore.getState().addCategory({ name: "Dom", color: "#40c057" });
    const importedState = { ...createEmptyState(), categories: [{ id: "cat-work", name: "Praca", color: "#228be6" }] };
    const raw = serializeExportPayload(createExportPayload(importedState, "2026-07-07T10:00:00.000Z"));

    const preview = useTaskerStore.getState().previewImport(raw);
    expect(useTaskerStore.getState().state.categories[0].name).toBe("Dom");

    useTaskerStore.getState().applyImport(preview);

    expect(useTaskerStore.getState().state.categories).toEqual([{ id: "cat-work", name: "Praca", color: "#228be6" }]);
  });
});
```

- [ ] **Step 2: Run store tests and verify failure**

Run: `npm run test:run -- src/state/taskerStore.test.ts`

Expected: FAIL because store actions do not exist.

- [ ] **Step 3: Extend store implementation**

Modify `src/state/taskerStore.ts`:

```ts
import {
  addCategory as addCategoryDomain,
  addPriority as addPriorityDomain,
  addTaskType as addTaskTypeDomain,
  deactivateCategory as deactivateCategoryDomain,
  movePriority as movePriorityDomain,
  moveTaskType as moveTaskTypeDomain,
  setPriorityActive as setPriorityActiveDomain,
  setTaskTypeActive as setTaskTypeActiveDomain,
  updateCategory as updateCategoryDomain,
  updatePriority as updatePriorityDomain,
  updateTaskType as updateTaskTypeDomain,
  type CategoryInput,
  type DictionaryInput,
  type PriorityInput
} from "../domain/configuration";
import { emptyHistoryFilters, type HistoryFilters } from "../domain/history";
import { parseImportPayload, type ImportPreview } from "../storage/taskerBackup";
```

Add fields to `TaskerStore`:

```ts
historyFilters: HistoryFilters;
setHistoryFilters: (filters: HistoryFilters) => void;
addCategory: (input: CategoryInput) => void;
updateCategory: (categoryId: string, input: CategoryInput) => void;
deactivateCategory: (categoryId: string) => void;
addTaskType: (input: DictionaryInput) => void;
updateTaskType: (taskTypeId: string, input: DictionaryInput) => void;
setTaskTypeActive: (taskTypeId: string, active: boolean) => void;
moveTaskType: (taskTypeId: string, direction: "up" | "down") => void;
addPriority: (input: PriorityInput) => void;
updatePriority: (priorityId: string, input: PriorityInput) => void;
setPriorityActive: (priorityId: string, active: boolean) => void;
movePriority: (priorityId: string, direction: "up" | "down") => void;
previewImport: (raw: string) => ImportPreview;
applyImport: (preview: ImportPreview) => void;
```

Extend `loadInitialStoreState()`:

```ts
return {
  state: initial.state,
  storageError: initial.error,
  filters: emptyFilters,
  historyFilters: emptyHistoryFilters,
  view: "today" as AppView
};
```

Add actions in the Zustand initializer:

```ts
setHistoryFilters: (historyFilters) => set({ historyFilters }),
addCategory: (input) => set(persist(addCategoryDomain(get().state, input, crypto.randomUUID))),
updateCategory: (categoryId, input) => set(persist(updateCategoryDomain(get().state, categoryId, input))),
deactivateCategory: (categoryId) => set(persist(deactivateCategoryDomain(get().state, categoryId))),
addTaskType: (input) => set(persist(addTaskTypeDomain(get().state, input, crypto.randomUUID))),
updateTaskType: (taskTypeId, input) => set(persist(updateTaskTypeDomain(get().state, taskTypeId, input))),
setTaskTypeActive: (taskTypeId, active) => set(persist(setTaskTypeActiveDomain(get().state, taskTypeId, active))),
moveTaskType: (taskTypeId, direction) => set(persist(moveTaskTypeDomain(get().state, taskTypeId, direction))),
addPriority: (input) => set(persist(addPriorityDomain(get().state, input, crypto.randomUUID))),
updatePriority: (priorityId, input) => set(persist(updatePriorityDomain(get().state, priorityId, input))),
setPriorityActive: (priorityId, active) => set(persist(setPriorityActiveDomain(get().state, priorityId, active))),
movePriority: (priorityId, direction) => set(persist(movePriorityDomain(get().state, priorityId, direction))),
previewImport: (raw) => parseImportPayload(raw),
applyImport: (preview) => set(persist(preview.state)),
```

- [ ] **Step 4: Run store tests**

Run: `npm run test:run -- src/state/taskerStore.test.ts`

Expected: PASS.

---

### Task 5: Category And Dictionary UI

**Files:**
- Create: `src/components/CategoryManager.tsx`
- Create: `src/components/DictionaryManager.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Consumes store actions from Task 4.
- Produces real views for `AppView` values `categories` and `settings`.

- [ ] **Step 1: Add failing UI tests for category and configuration views**

Import `STORAGE_KEY` from `./storage/taskerStorage`, then append to `src/App.test.tsx`:

```tsx
it("manages categories from the Kategorie view", async () => {
  renderApp();
  const user = userEvent.setup();

  await user.click(screen.getByRole("button", { name: "Kategorie" }));
  await user.type(screen.getByLabelText("Nazwa kategorii"), "Dom");
  await user.clear(screen.getByLabelText("Kolor kategorii"));
  await user.type(screen.getByLabelText("Kolor kategorii"), "#40c057");
  await user.click(screen.getByRole("button", { name: "Dodaj kategorie" }));

  expect(screen.getByText("Dom")).toBeInTheDocument();
  expect(screen.getByText("#40c057")).toBeInTheDocument();
});

it("manages task types and priorities from the Konfiguracja view", async () => {
  renderApp();
  const user = userEvent.setup();

  await user.click(screen.getByRole("button", { name: "Konfiguracja" }));
  await user.type(screen.getByLabelText("Nowy typ zadania"), "Termin");
  await user.click(screen.getByRole("button", { name: "Dodaj typ" }));
  await user.type(screen.getByLabelText("Nowy priorytet"), "Wysoki");
  await user.clear(screen.getByLabelText("Kolor priorytetu"));
  await user.type(screen.getByLabelText("Kolor priorytetu"), "#fa5252");
  await user.click(screen.getByRole("button", { name: "Dodaj priorytet" }));

  expect(screen.getByText("Termin")).toBeInTheDocument();
  expect(screen.getByText("Wysoki")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run UI tests and verify failure**

Run: `npm run test:run -- src/App.test.tsx`

Expected: FAIL because the new inputs and real views do not exist.

- [ ] **Step 3: Create category manager component**

Create `src/components/CategoryManager.tsx`:

```tsx
import { Button, Group, Stack, Table, Text, TextInput, Title } from "@mantine/core";
import { useState } from "react";
import type { Category } from "../domain/types";

type Props = {
  categories: Category[];
  onAdd: (input: { name: string; color: string }) => void;
  onUpdate: (categoryId: string, input: { name: string; color: string }) => void;
  onDeactivate: (categoryId: string) => void;
};

export function CategoryManager({ categories, onAdd, onUpdate, onDeactivate }: Props) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#228be6");
  const [error, setError] = useState<string | undefined>();

  function submitAdd() {
    try {
      onAdd({ name, color });
      setName("");
      setColor("#228be6");
      setError(undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nie mozna zapisac kategorii.");
    }
  }

  function rename(category: Category) {
    const nextName = window.prompt("Nowa nazwa kategorii", category.name);
    if (nextName === null) {
      return;
    }
    const nextColor = window.prompt("Nowy kolor kategorii", category.color);
    if (nextColor === null) {
      return;
    }
    try {
      onUpdate(category.id, { name: nextName, color: nextColor });
      setError(undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nie mozna zapisac kategorii.");
    }
  }

  return (
    <Stack gap="md">
      <Title order={2}>Kategorie</Title>
      <Group align="end">
        <TextInput label="Nazwa kategorii" value={name} onChange={(event) => setName(event.currentTarget.value)} />
        <TextInput label="Kolor kategorii" value={color} onChange={(event) => setColor(event.currentTarget.value)} />
        <Button type="button" onClick={submitAdd}>Dodaj kategorie</Button>
      </Group>
      {error ? <Text c="red">{error}</Text> : null}
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Nazwa</Table.Th>
            <Table.Th>Kolor</Table.Th>
            <Table.Th>Akcje</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {categories.map((category) => (
            <Table.Tr key={category.id}>
              <Table.Td>{category.name}</Table.Td>
              <Table.Td>{category.color}</Table.Td>
              <Table.Td>
                <Group gap="xs">
                  <Button type="button" variant="default" onClick={() => rename(category)}>Edytuj</Button>
                  <Button type="button" color="red" variant="light" onClick={() => onDeactivate(category.id)}>Usun</Button>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}
```

- [ ] **Step 4: Create dictionary manager component**

Create `src/components/DictionaryManager.tsx`:

```tsx
import { Button, Checkbox, Group, Stack, Table, Text, TextInput, Title } from "@mantine/core";
import { useState } from "react";

type DictionaryItem = {
  id: string;
  name: string;
  active: boolean;
  order: number;
  color?: string;
};

type Props = {
  title: string;
  nameLabel: string;
  colorLabel?: string;
  addLabel: string;
  items: DictionaryItem[];
  onAdd: (input: { name: string; color?: string }) => void;
  onUpdate: (id: string, input: { name: string; color?: string }) => void;
  onSetActive: (id: string, active: boolean) => void;
  onMove: (id: string, direction: "up" | "down") => void;
};

export function DictionaryManager({ title, nameLabel, colorLabel, addLabel, items, onAdd, onUpdate, onSetActive, onMove }: Props) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#868e96");
  const [error, setError] = useState<string | undefined>();

  function submitAdd() {
    try {
      onAdd({ name, color: colorLabel ? color : undefined });
      setName("");
      setColor("#868e96");
      setError(undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nie mozna zapisac slownika.");
    }
  }

  function edit(item: DictionaryItem) {
    const nextName = window.prompt("Nowa nazwa", item.name);
    if (nextName === null) {
      return;
    }
    const nextColor = colorLabel ? window.prompt("Nowy kolor", item.color ?? "#868e96") : undefined;
    if (colorLabel && nextColor === null) {
      return;
    }
    try {
      onUpdate(item.id, { name: nextName, color: nextColor ?? undefined });
      setError(undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nie mozna zapisac slownika.");
    }
  }

  return (
    <Stack gap="md">
      <Title order={3}>{title}</Title>
      <Group align="end">
        <TextInput label={nameLabel} value={name} onChange={(event) => setName(event.currentTarget.value)} />
        {colorLabel ? <TextInput label={colorLabel} value={color} onChange={(event) => setColor(event.currentTarget.value)} /> : null}
        <Button type="button" onClick={submitAdd}>{addLabel}</Button>
      </Group>
      {error ? <Text c="red">{error}</Text> : null}
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Nazwa</Table.Th>
            <Table.Th>Aktywny</Table.Th>
            <Table.Th>Kolejnosc</Table.Th>
            <Table.Th>Akcje</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {[...items].sort((left, right) => left.order - right.order).map((item) => (
            <Table.Tr key={item.id}>
              <Table.Td>{item.name}</Table.Td>
              <Table.Td>
                <Checkbox checked={item.active} onChange={(event) => onSetActive(item.id, event.currentTarget.checked)} aria-label={`Aktywny ${item.name}`} />
              </Table.Td>
              <Table.Td>{item.order + 1}</Table.Td>
              <Table.Td>
                <Group gap="xs">
                  <Button type="button" variant="default" onClick={() => onMove(item.id, "up")}>W gore</Button>
                  <Button type="button" variant="default" onClick={() => onMove(item.id, "down")}>W dol</Button>
                  <Button type="button" variant="default" onClick={() => edit(item)}>Edytuj</Button>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}
```

- [ ] **Step 5: Wire category and settings views in App**

Modify `src/App.tsx` imports:

```ts
import { CategoryManager } from "./components/CategoryManager";
import { DictionaryManager } from "./components/DictionaryManager";
```

Read new store actions inside `App`:

```ts
const addCategory = useTaskerStore((store) => store.addCategory);
const updateCategory = useTaskerStore((store) => store.updateCategory);
const deactivateCategory = useTaskerStore((store) => store.deactivateCategory);
const addTaskType = useTaskerStore((store) => store.addTaskType);
const updateTaskType = useTaskerStore((store) => store.updateTaskType);
const setTaskTypeActive = useTaskerStore((store) => store.setTaskTypeActive);
const moveTaskType = useTaskerStore((store) => store.moveTaskType);
const addPriority = useTaskerStore((store) => store.addPriority);
const updatePriority = useTaskerStore((store) => store.updatePriority);
const setPriorityActive = useTaskerStore((store) => store.setPriorityActive);
const movePriority = useTaskerStore((store) => store.movePriority);
```

Replace the `categories` placeholder with:

```tsx
{view === "categories" ? (
  <Paper withBorder p="lg" radius="md" shadow="xs">
    <CategoryManager
      categories={state.categories}
      onAdd={addCategory}
      onUpdate={updateCategory}
      onDeactivate={deactivateCategory}
    />
  </Paper>
) : null}
```

Replace the `settings` placeholder with:

```tsx
{view === "settings" ? (
  <Paper withBorder p="lg" radius="md" shadow="xs">
    <Stack gap="xl">
      <Title order={2}>Konfiguracja zadan</Title>
      <DictionaryManager
        title="Typy zadan"
        nameLabel="Nowy typ zadania"
        addLabel="Dodaj typ"
        items={state.taskTypes}
        onAdd={addTaskType}
        onUpdate={updateTaskType}
        onSetActive={setTaskTypeActive}
        onMove={moveTaskType}
      />
      <DictionaryManager
        title="Priorytety"
        nameLabel="Nowy priorytet"
        colorLabel="Kolor priorytetu"
        addLabel="Dodaj priorytet"
        items={state.priorities}
        onAdd={addPriority}
        onUpdate={updatePriority}
        onSetActive={setPriorityActive}
        onMove={movePriority}
      />
    </Stack>
  </Paper>
) : null}
```

- [ ] **Step 6: Run UI tests**

Run: `npm run test:run -- src/App.test.tsx`

Expected: PASS for the new category and configuration tests.

---

### Task 6: History UI With Filters, No Statistics

**Files:**
- Create: `src/components/HistoryView.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Consumes: `buildHistoryList(state, historyFilters)`, `historyFilters`, `setHistoryFilters`.
- Produces a real `history` view that displays only a list and filters; no summaries, charts, or statistics.

- [ ] **Step 1: Add failing history UI test**

Append to `src/App.test.tsx`:

```tsx
it("shows completion history as a filterable list without statistics", async () => {
  const storedState = {
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
      }
    ],
    completions: [{ id: "completion-1", taskId: "task-1", scheduledDate: "2026-07-07", completedDate: "2026-07-07" }],
    postponements: []
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(storedState));
  resetTaskerStore();
  renderApp();
  const user = userEvent.setup();

  await user.click(screen.getByRole("button", { name: "Historia" }));

  expect(screen.getByRole("heading", { name: "Historia" })).toBeInTheDocument();
  expect(screen.getByText("Podlac rosliny")).toBeInTheDocument();
  expect(screen.getByText("2026-07-07")).toBeInTheDocument();
  expect(screen.queryByText(/statysty/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run App tests and verify failure**

Run: `npm run test:run -- src/App.test.tsx`

Expected: FAIL because `HistoryView` is not wired.

- [ ] **Step 3: Create history view**

Create `src/components/HistoryView.tsx`:

```tsx
import { Select, Stack, Table, Text, TextInput, Title } from "@mantine/core";
import { buildHistoryList, type HistoryFilters } from "../domain/history";
import type { AppState } from "../domain/types";

type Props = {
  state: AppState;
  filters: HistoryFilters;
  onFiltersChange: (filters: HistoryFilters) => void;
};

export function HistoryView({ state, filters, onFiltersChange }: Props) {
  const items = buildHistoryList(state, filters);

  return (
    <Stack gap="md">
      <Title order={2}>Historia</Title>
      <Stack gap="sm">
        <TextInput label="Od daty wykonania" value={filters.fromDate} onChange={(event) => onFiltersChange({ ...filters, fromDate: event.currentTarget.value })} />
        <TextInput label="Do daty wykonania" value={filters.toDate} onChange={(event) => onFiltersChange({ ...filters, toDate: event.currentTarget.value })} />
        <Select label="Kategoria" clearable value={filters.categoryId || null} data={state.categories.map((item) => ({ value: item.id, label: item.name }))} onChange={(value) => onFiltersChange({ ...filters, categoryId: value ?? "" })} />
        <Select label="Osoba" clearable value={filters.assigneeId || null} data={state.assignees.map((item) => ({ value: item.id, label: item.name }))} onChange={(value) => onFiltersChange({ ...filters, assigneeId: value ?? "" })} />
        <Select label="Typ zadania" clearable value={filters.taskTypeId || null} data={state.taskTypes.map((item) => ({ value: item.id, label: item.name }))} onChange={(value) => onFiltersChange({ ...filters, taskTypeId: value ?? "" })} />
        <Select label="Priorytet" clearable value={filters.priorityId || null} data={state.priorities.map((item) => ({ value: item.id, label: item.name }))} onChange={(value) => onFiltersChange({ ...filters, priorityId: value ?? "" })} />
      </Stack>
      {items.length === 0 ? <Text c="dimmed">Brak wpisow historii dla wybranych filtrow.</Text> : null}
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Zadanie</Table.Th>
            <Table.Th>Planowana data</Table.Th>
            <Table.Th>Data wykonania</Table.Th>
            <Table.Th>Kategoria</Table.Th>
            <Table.Th>Osoba</Table.Th>
            <Table.Th>Typ</Table.Th>
            <Table.Th>Priorytet</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.map((item) => (
            <Table.Tr key={item.completionId}>
              <Table.Td>{item.title}</Table.Td>
              <Table.Td>{item.scheduledDate}</Table.Td>
              <Table.Td>{item.completedDate}</Table.Td>
              <Table.Td>{item.categoryName}</Table.Td>
              <Table.Td>{item.assigneeName}</Table.Td>
              <Table.Td>{item.taskTypeName}</Table.Td>
              <Table.Td>{item.priorityName}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}
```

- [ ] **Step 4: Wire history view in App**

Modify `src/App.tsx` imports:

```ts
import { HistoryView } from "./components/HistoryView";
```

Read store fields:

```ts
const historyFilters = useTaskerStore((store) => store.historyFilters);
const setHistoryFilters = useTaskerStore((store) => store.setHistoryFilters);
```

Replace the `history` placeholder with:

```tsx
{view === "history" ? (
  <Paper withBorder p="lg" radius="md" shadow="xs">
    <HistoryView state={state} filters={historyFilters} onFiltersChange={setHistoryFilters} />
  </Paper>
) : null}
```

- [ ] **Step 5: Run history tests**

Run:

```bash
npm run test:run -- src/domain/history.test.ts src/App.test.tsx
```

Expected: PASS.

---

### Task 7: Data Export And Confirmed Import UI

**Files:**
- Create: `src/components/DataTransferView.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Consumes: `createExportPayload`, `serializeExportPayload`, `previewImport`, and `applyImport`.
- Produces a real `data` view that exports the complete local v2 state and imports only after valid preview plus explicit confirmation.

- [ ] **Step 1: Add failing data-transfer UI tests**

Modify the Vitest import in `src/App.test.tsx` so `vi` is available:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
```

Append to `src/App.test.tsx`:

```tsx
it("exports complete local data from the Dane view", async () => {
  const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:tasker-export");
  const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  renderApp();
  const user = userEvent.setup();

  await user.click(screen.getByRole("button", { name: "Dane" }));
  await user.click(screen.getByRole("button", { name: "Eksportuj dane" }));

  expect(createObjectURL).toHaveBeenCalledTimes(1);
  expect(revokeObjectURL).toHaveBeenCalledWith("blob:tasker-export");
});

it("validates import before confirmation and does not overwrite data on error", async () => {
  renderApp();
  const user = userEvent.setup();

  await user.click(screen.getByRole("button", { name: "Kategorie" }));
  await user.type(screen.getByLabelText("Nazwa kategorii"), "Dom");
  await user.click(screen.getByRole("button", { name: "Dodaj kategorie" }));

  await user.click(screen.getByRole("button", { name: "Dane" }));
  const badFile = new File(["{bad-json"], "bad.json", { type: "application/json" });
  await user.upload(screen.getByLabelText("Plik importu"), badFile);

  expect(screen.getByText("Plik importu nie jest poprawnym JSON.")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Kategorie" }));
  expect(screen.getByText("Dom")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run App tests and verify failure**

Run: `npm run test:run -- src/App.test.tsx`

Expected: FAIL because `DataTransferView` is not wired.

- [ ] **Step 3: Create data transfer component**

Create `src/components/DataTransferView.tsx`:

```tsx
import { Alert, Button, FileInput, Group, Stack, Text, Title } from "@mantine/core";
import { useState } from "react";
import type { ImportPreview } from "../storage/taskerBackup";
import { createExportPayload, serializeExportPayload } from "../storage/taskerBackup";
import type { AppState } from "../domain/types";

type Props = {
  state: AppState;
  onPreviewImport: (raw: string) => ImportPreview;
  onApplyImport: (preview: ImportPreview) => void;
};

export function DataTransferView({ state, onPreviewImport, onApplyImport }: Props) {
  const [preview, setPreview] = useState<ImportPreview | undefined>();
  const [error, setError] = useState<string | undefined>();

  function exportData() {
    const payload = createExportPayload(state, new Date().toISOString());
    const blob = new Blob([serializeExportPayload(payload)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tasker-backup-${payload.exportedAt.slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importFile(file: File | null) {
    setPreview(undefined);
    setError(undefined);
    if (!file) {
      return;
    }

    try {
      const raw = await file.text();
      setPreview(onPreviewImport(raw));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nie mozna odczytac pliku importu.");
    }
  }

  function confirmImport() {
    if (!preview) {
      return;
    }
    onApplyImport(preview);
    setPreview(undefined);
    setError(undefined);
  }

  return (
    <Stack gap="md">
      <Title order={2}>Dane</Title>
      <Group>
        <Button type="button" onClick={exportData}>Eksportuj dane</Button>
      </Group>
      <FileInput label="Plik importu" accept="application/json,.json" onChange={importFile} />
      {error ? <Alert color="red" title="Import przerwany">{error}</Alert> : null}
      {preview ? (
        <Alert color="blue" title="Podsumowanie importu">
          <Stack gap="xs">
            <Text>Zadania: {preview.summary.taskCount}</Text>
            <Text>Kategorie: {preview.summary.categoryCount}</Text>
            <Text>Osoby: {preview.summary.assigneeCount}</Text>
            <Text>Typy zadan: {preview.summary.taskTypeCount}</Text>
            <Text>Priorytety: {preview.summary.priorityCount}</Text>
            <Text>Historia: {preview.summary.completionCount}</Text>
            <Text>Odlozenia: {preview.summary.postponementCount}</Text>
            <Button type="button" color="red" onClick={confirmImport}>Potwierdz import i zastap dane</Button>
          </Stack>
        </Alert>
      ) : null}
    </Stack>
  );
}
```

- [ ] **Step 4: Wire data view in App**

Modify `src/App.tsx` imports:

```ts
import { DataTransferView } from "./components/DataTransferView";
```

Read store actions:

```ts
const previewImport = useTaskerStore((store) => store.previewImport);
const applyImport = useTaskerStore((store) => store.applyImport);
```

Replace the `data` placeholder with:

```tsx
{view === "data" ? (
  <Paper withBorder p="lg" radius="md" shadow="xs">
    <DataTransferView state={state} onPreviewImport={previewImport} onApplyImport={applyImport} />
  </Paper>
) : null}
```

- [ ] **Step 5: Run data-transfer tests**

Run:

```bash
npm run test:run -- src/storage/taskerBackup.test.ts src/App.test.tsx
```

Expected: PASS.

---

### Task 8: Navigation Integration And Final Verification

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- No changes: `src/domain/todayList.ts`, `src/domain/tasks.ts`, full task module, Today behavior, and calendar behavior unless TypeScript requires import cleanup.

**Interfaces:**
- Consumes all views from Tasks 5-7.
- Produces complete navigation integration for this slice.

- [ ] **Step 1: Add navigation regression test**

Append to `src/App.test.tsx`:

```tsx
it("keeps non-scope modules as navigation-only placeholders", async () => {
  renderApp();
  const user = userEvent.setup();

  await user.click(screen.getByRole("button", { name: "Zadania" }));
  expect(screen.getByRole("heading", { name: "Zadania" })).toBeInTheDocument();
  expect(screen.getByText("Tutaj powstanie osobny widok dodawania i edycji zadan.")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Kalendarz" }));
  expect(screen.getByRole("heading", { name: "Kalendarz" })).toBeInTheDocument();
  expect(screen.getByText("Tutaj powstanie widok planowania zadan wedlug dat.")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run all focused tests**

Run:

```bash
npm run test:run -- src/domain/configuration.test.ts src/domain/history.test.ts src/storage/taskerBackup.test.ts src/state/taskerStore.test.ts src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run full test suite**

Run:

```bash
npm run test:run
```

Expected: PASS for all Vitest suites, including existing recurrence, dates, tasks, today-list, storage, and App tests.

- [ ] **Step 4: Run production build**

Run:

```bash
npm run build
```

Expected: PASS with TypeScript emitting no errors and Vite completing the production build.

- [ ] **Step 5: Inspect changed files**

Run:

```bash
git diff -- src/domain/configuration.ts src/domain/configuration.test.ts src/domain/history.ts src/domain/history.test.ts src/storage/taskerBackup.ts src/storage/taskerBackup.test.ts src/state/taskerStore.ts src/state/taskerStore.test.ts src/components/CategoryManager.tsx src/components/DictionaryManager.tsx src/components/HistoryView.tsx src/components/DataTransferView.tsx src/App.tsx src/App.test.tsx
```

Expected: Diff contains only configuration, history, import/export, store wiring, and navigation integration. It does not implement full task module, Today feature expansion, or calendar behavior.

- [ ] **Step 6: Stop without committing**

Run:

```bash
git status --short
```

Expected: The implementation files from this plan are modified or created and remain uncommitted, unless the user has explicitly requested commits after receiving this plan.

---

## Self-Review

**Spec coverage:** This plan covers UC-09 categories with colors, UC-10 task type and priority dictionaries, UC-12 completion history as a list with filters, UC-13 complete local export, and UC-14 import validation with summary and explicit confirmation. It also preserves navigation integration for categories, configuration, history, and data after the foundation plan.

**Out-of-scope check:** The plan does not implement full task CRUD, Today list changes, arbitrary-date postponement UI, calendar behavior, statistics, reports, charts, accounts, backend, synchronization, or notifications. `tasks` and `calendar` remain navigation placeholders.

**Import safety:** `parseImportPayload()` only returns a preview and never writes storage. The store writes imported state only through `applyImport(preview)`, which the UI calls only from the confirmation button. Invalid JSON and incomplete payloads surface errors while current storage remains untouched.

**Type consistency:** Store actions use the same `CategoryInput`, `DictionaryInput`, `PriorityInput`, `HistoryFilters`, and `ImportPreview` types produced by earlier tasks. The backup payload wraps the complete `AppState` shape expected by the foundation storage.

**Placeholder scan:** There are no unresolved implementation markers. Product placeholder text appears only for out-of-scope `Zadania` and `Kalendarz` navigation views and is covered by regression tests.
