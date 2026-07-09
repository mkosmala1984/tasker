# Tasker Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the foundation for Tasker's target local product by introducing the v2 data model, storage migration, extended filters, and a navigation shell for future feature modules.

**Architecture:** Keep domain logic under `src/domain/`, persistence under `src/storage/`, global state under `src/state/`, and UI composition under `src/App.tsx` plus focused components. This plan keeps the current Today workflow operational while adding model fields and navigation placeholders that future plans will implement. Storage writes a new `tasker:v2` payload and migrates existing `tasker:v1` data on load.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, React Testing Library, Mantine, Zustand, browser `localStorage`.

## Global Constraints

- Local-only application: no accounts, backend, or synchronization.
- Dates are calendar dates in `YYYY-MM-DD`, without time or timezone.
- Interface copy remains Polish.
- Existing domain behavior for recurring tasks, overdue tasks, completion, postponement to tomorrow, filtering, and local persistence must keep working.
- Use ASCII in source and docs unless the touched file already intentionally uses non-ASCII.
- Do not implement full calendar, history, import/export, or configuration CRUD in this plan; add only foundation types, migration, navigation, and placeholders.

---

## File Structure

- Modify `src/domain/types.ts`: introduce v2 model types for one-time and recurring task schedules, category colors, task types, priorities, extended filters, and navigation view names.
- Modify `src/storage/taskerStorage.ts`: change active storage key to `tasker:v2`, load v2 state, migrate v1 state from `tasker:v1`, and keep safe fallbacks.
- Modify `src/storage/taskerStorage.test.ts`: verify empty v2 state, v2 load/save, invalid data fallback, unknown v2 version fallback, and v1 migration.
- Modify `src/domain/tasks.ts`: update add/update mutations to create v2 tasks while preserving category and assignee reuse.
- Modify `src/domain/tasks.test.ts`: update existing task fixtures and add coverage for one-time tasks, category colors, task types, and priorities.
- Modify `src/domain/todayList.ts`: derive scheduled date from v2 task schedule and support extended filters.
- Modify `src/domain/todayList.test.ts`: update fixtures and add filter coverage for task type and priority.
- Modify `src/state/taskerStore.ts`: add current app view, extended filter defaults, and navigation actions.
- Modify `src/App.tsx`: add top-level navigation with placeholders for future modules and keep Today as the initial view.
- Modify `src/App.test.tsx`: reset Zustand store consistently and test navigation placeholders.
- Modify `src/test/setup.ts`: add `window.matchMedia` test polyfill required by Mantine in jsdom.

---

### Task 1: V2 Domain Types

**Files:**
- Modify: `src/domain/types.ts`

**Interfaces:**
- Produces: `AppState` version `2`, `TaskSchedule`, `TaskMode`, `TaskType`, `Priority`, `AppView`, `TodayFilters`, `TaskDraft`.
- Consumes: Existing recurrence rules and existing task domain functions.

- [ ] **Step 1: Replace the shared domain types**

Replace `src/domain/types.ts` with:

```ts
export type RecurrenceRule =
  | { type: "daily" }
  | { type: "everyNDays"; intervalDays: number }
  | { type: "weekly" }
  | { type: "monthly" }
  | { type: "quarterly" };

export type TaskMode = "oneTime" | "recurring";

export type TaskSchedule =
  | { mode: "oneTime"; date: string }
  | { mode: "recurring"; startDate: string; recurrence: RecurrenceRule };

export type Task = {
  id: string;
  title: string;
  categoryId: string;
  assigneeId: string;
  taskTypeId: string;
  priorityId: string;
  schedule: TaskSchedule;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Category = {
  id: string;
  name: string;
  color: string;
};

export type Assignee = {
  id: string;
  name: string;
};

export type TaskType = {
  id: string;
  name: string;
  active: boolean;
  order: number;
};

export type Priority = {
  id: string;
  name: string;
  active: boolean;
  order: number;
  color?: string;
};

export type Completion = {
  id: string;
  taskId: string;
  scheduledDate: string;
  completedDate: string;
};

export type Postponement = {
  id: string;
  taskId: string;
  fromDate: string;
  toDate: string;
  createdAt: string;
};

export type AppState = {
  version: 2;
  tasks: Task[];
  categories: Category[];
  assignees: Assignee[];
  taskTypes: TaskType[];
  priorities: Priority[];
  completions: Completion[];
  postponements: Postponement[];
};

export type TodayFilters = {
  categoryId: string;
  assigneeId: string;
  taskTypeId: string;
  priorityId: string;
};

export type TodayTask = {
  task: Task;
  category: Category;
  assignee: Assignee;
  taskType: TaskType;
  priority: Priority;
  scheduledDate: string;
  isOverdue: boolean;
  lastCompletedDate?: string;
};

export type TaskDraft = {
  title: string;
  categoryName: string;
  categoryColor?: string;
  assigneeName: string;
  taskTypeId?: string;
  priorityId?: string;
  schedule: TaskSchedule;
  active: boolean;
};

export type AppView = "today" | "tasks" | "calendar" | "categories" | "settings" | "history" | "data";
```

- [ ] **Step 2: Run TypeScript to see dependent failures**

Run:

```bash
npm run build
```

Expected: FAIL with TypeScript errors in domain, storage, store, and components that still refer to `version: 1`, `task.recurrence`, `task.startDate`, and two-field `TodayFilters`.

- [ ] **Step 3: Commit after later tasks only**

Do not commit yet. Task 1 intentionally breaks the build and is completed by Tasks 2-5.

---

### Task 2: V2 Storage And V1 Migration

**Files:**
- Modify: `src/storage/taskerStorage.ts`
- Modify: `src/storage/taskerStorage.test.ts`

**Interfaces:**
- Consumes: `AppState`, `Category`, `Priority`, `TaskType` from Task 1.
- Produces: `STORAGE_KEY = "tasker:v2"`, `LEGACY_STORAGE_KEY = "tasker:v1"`, `createEmptyState(): AppState`, `loadState(storage?: Storage): LoadResult`, `saveState(state: AppState, storage?: Storage): void`.

- [ ] **Step 1: Replace storage tests with v2 and migration coverage**

Replace `src/storage/taskerStorage.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import { createEmptyState, LEGACY_STORAGE_KEY, loadState, saveState, STORAGE_KEY } from "./taskerStorage";

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => Array.from(data.keys())[index] ?? null,
    removeItem: (key: string) => {
      data.delete(key);
    },
    setItem: (key: string, value: string) => {
      data.set(key, value);
    }
  };
}

describe("taskerStorage", () => {
  it("returns empty v2 state when storage has no data", () => {
    const result = loadState(memoryStorage());

    expect(result.state).toEqual(createEmptyState());
    expect(result.error).toBeUndefined();
  });

  it("loads a valid v2 state", () => {
    const state = createEmptyState();
    const result = loadState(memoryStorage({ [STORAGE_KEY]: JSON.stringify(state) }));

    expect(result.state).toEqual(state);
  });

  it("saves state under the v2 key", () => {
    const storage = memoryStorage();
    const state = createEmptyState();

    saveState(state, storage);

    expect(storage.getItem(STORAGE_KEY)).toBe(JSON.stringify(state));
    expect(storage.getItem(LEGACY_STORAGE_KEY)).toBeNull();
  });

  it("falls back to empty state for invalid v2 JSON", () => {
    const result = loadState(memoryStorage({ [STORAGE_KEY]: "{bad-json" }));

    expect(result.state).toEqual(createEmptyState());
    expect(result.error).toBe("Nie mozna odczytac lokalnych danych.");
  });

  it("falls back to empty state for unknown v2 version", () => {
    const result = loadState(memoryStorage({ [STORAGE_KEY]: JSON.stringify({ version: 3 }) }));

    expect(result.state).toEqual(createEmptyState());
    expect(result.error).toBe("Nieobslugiwana wersja lokalnych danych.");
  });

  it("migrates a valid v1 state into v2 defaults", () => {
    const legacy = {
      version: 1,
      tasks: [
        {
          id: "task-1",
          title: "Podlac rosliny",
          categoryId: "cat-1",
          assigneeId: "person-1",
          recurrence: { type: "daily" },
          startDate: "2026-07-05",
          active: true,
          createdAt: "2026-07-05T08:00:00.000Z",
          updatedAt: "2026-07-05T08:00:00.000Z"
        }
      ],
      categories: [{ id: "cat-1", name: "Dom" }],
      assignees: [{ id: "person-1", name: "Ola" }],
      completions: [],
      postponements: []
    };

    const result = loadState(memoryStorage({ [LEGACY_STORAGE_KEY]: JSON.stringify(legacy) }));

    expect(result.error).toBeUndefined();
    expect(result.state.version).toBe(2);
    expect(result.state.categories).toEqual([{ id: "cat-1", name: "Dom", color: "#228be6" }]);
    expect(result.state.taskTypes).toEqual([{ id: "task-type-default", name: "Zadanie", active: true, order: 0 }]);
    expect(result.state.priorities).toEqual([{ id: "priority-normal", name: "Normalny", active: true, order: 0, color: "#868e96" }]);
    expect(result.state.tasks[0]).toMatchObject({
      id: "task-1",
      taskTypeId: "task-type-default",
      priorityId: "priority-normal",
      schedule: { mode: "recurring", startDate: "2026-07-05", recurrence: { type: "daily" } }
    });
  });
});
```

- [ ] **Step 2: Run storage tests and verify they fail**

Run:

```bash
npm run test:run -- src/storage/taskerStorage.test.ts
```

Expected: FAIL because `LEGACY_STORAGE_KEY`, v2 state, and migration do not exist yet.

- [ ] **Step 3: Replace storage implementation**

Replace `src/storage/taskerStorage.ts` with:

```ts
import type { AppState, Category, Priority, RecurrenceRule, Task, TaskType } from "../domain/types";

export const STORAGE_KEY = "tasker:v2";
export const LEGACY_STORAGE_KEY = "tasker:v1";

export type LoadResult = {
  state: AppState;
  error?: string;
};

const DEFAULT_CATEGORY_COLOR = "#228be6";
export const DEFAULT_TASK_TYPE_ID = "task-type-default";
export const DEFAULT_PRIORITY_ID = "priority-normal";

export function createDefaultTaskTypes(): TaskType[] {
  return [{ id: DEFAULT_TASK_TYPE_ID, name: "Zadanie", active: true, order: 0 }];
}

export function createDefaultPriorities(): Priority[] {
  return [{ id: DEFAULT_PRIORITY_ID, name: "Normalny", active: true, order: 0, color: "#868e96" }];
}

export function createEmptyState(): AppState {
  return {
    version: 2,
    tasks: [],
    categories: [],
    assignees: [],
    taskTypes: createDefaultTaskTypes(),
    priorities: createDefaultPriorities(),
    completions: [],
    postponements: []
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isArrayProperty(value: Record<string, unknown>, key: string): boolean {
  return Array.isArray(value[key]);
}

function isAppState(value: unknown): value is AppState {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.version === 2 &&
    isArrayProperty(value, "tasks") &&
    isArrayProperty(value, "categories") &&
    isArrayProperty(value, "assignees") &&
    isArrayProperty(value, "taskTypes") &&
    isArrayProperty(value, "priorities") &&
    isArrayProperty(value, "completions") &&
    isArrayProperty(value, "postponements")
  );
}

function isLegacyState(value: unknown): value is {
  version: 1;
  tasks: Array<{
    id: string;
    title: string;
    categoryId: string;
    assigneeId: string;
    recurrence: RecurrenceRule;
    startDate: string;
    active: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  categories: Array<{ id: string; name: string }>;
  assignees: AppState["assignees"];
  completions: AppState["completions"];
  postponements: AppState["postponements"];
} {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.version === 1 &&
    isArrayProperty(value, "tasks") &&
    isArrayProperty(value, "categories") &&
    isArrayProperty(value, "assignees") &&
    isArrayProperty(value, "completions") &&
    isArrayProperty(value, "postponements")
  );
}

function migrateCategory(category: { id: string; name: string }): Category {
  return { ...category, color: DEFAULT_CATEGORY_COLOR };
}

function migrateTask(task: ReturnType<typeof assertLegacyTasks>[number]): Task {
  return {
    id: task.id,
    title: task.title,
    categoryId: task.categoryId,
    assigneeId: task.assigneeId,
    taskTypeId: DEFAULT_TASK_TYPE_ID,
    priorityId: DEFAULT_PRIORITY_ID,
    schedule: { mode: "recurring", startDate: task.startDate, recurrence: task.recurrence },
    active: task.active,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  };
}

function assertLegacyTasks(value: {
  tasks: Array<{
    id: string;
    title: string;
    categoryId: string;
    assigneeId: string;
    recurrence: RecurrenceRule;
    startDate: string;
    active: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
}) {
  return value.tasks;
}

function migrateLegacyState(value: ReturnType<typeof narrowLegacyState>): AppState {
  return {
    version: 2,
    tasks: assertLegacyTasks(value).map(migrateTask),
    categories: value.categories.map(migrateCategory),
    assignees: value.assignees,
    taskTypes: createDefaultTaskTypes(),
    priorities: createDefaultPriorities(),
    completions: value.completions,
    postponements: value.postponements
  };
}

function narrowLegacyState(value: unknown) {
  if (!isLegacyState(value)) {
    throw new Error("Invalid legacy state");
  }
  return value;
}

function parseJson(raw: string): unknown {
  return JSON.parse(raw);
}

export function loadState(storage: Storage = window.localStorage): LoadResult {
  const rawV2 = storage.getItem(STORAGE_KEY);
  if (rawV2 !== null) {
    try {
      const parsed = parseJson(rawV2);
      if (isRecord(parsed) && parsed.version !== 2) {
        return { state: createEmptyState(), error: "Nieobslugiwana wersja lokalnych danych." };
      }
      if (!isAppState(parsed)) {
        return { state: createEmptyState(), error: "Nie mozna odczytac lokalnych danych." };
      }
      return { state: parsed };
    } catch {
      return { state: createEmptyState(), error: "Nie mozna odczytac lokalnych danych." };
    }
  }

  const rawV1 = storage.getItem(LEGACY_STORAGE_KEY);
  if (rawV1 === null) {
    return { state: createEmptyState() };
  }

  try {
    const parsed = narrowLegacyState(parseJson(rawV1));
    return { state: migrateLegacyState(parsed) };
  } catch {
    return { state: createEmptyState(), error: "Nie mozna odczytac lokalnych danych." };
  }
}

export function saveState(state: AppState, storage: Storage = window.localStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}
```

- [ ] **Step 4: Run storage tests**

Run:

```bash
npm run test:run -- src/storage/taskerStorage.test.ts
```

Expected: PASS.

---

### Task 3: Task Mutations For V2 Drafts

**Files:**
- Modify: `src/domain/tasks.ts`
- Modify: `src/domain/tasks.test.ts`

**Interfaces:**
- Consumes: `TaskDraft`, `TaskSchedule`, `AppState`, `DEFAULT_TASK_TYPE_ID`, `DEFAULT_PRIORITY_ID`.
- Produces: `addTask`, `updateTask`, `deactivateTask`, `completeTask`, `postponeTask` compatible with v2 tasks.

- [ ] **Step 1: Replace task mutation tests**

Replace `src/domain/tasks.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_PRIORITY_ID, DEFAULT_TASK_TYPE_ID } from "../storage/taskerStorage";
import { addTask, completeTask, deactivateTask, postponeTask, updateTask } from "./tasks";
import { buildTodayList } from "./todayList";
import type { AppState } from "./types";

const emptyState: AppState = {
  version: 2,
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
});
```

- [ ] **Step 2: Run task tests and verify they fail**

Run:

```bash
npm run test:run -- src/domain/tasks.test.ts
```

Expected: FAIL because `tasks.ts` still expects `recurrence` and `startDate` in drafts.

- [ ] **Step 3: Replace task mutation implementation**

Replace `src/domain/tasks.ts` with:

```ts
import { DEFAULT_PRIORITY_ID, DEFAULT_TASK_TYPE_ID } from "../storage/taskerStorage";
import type { AppState, Assignee, Category, TaskDraft } from "./types";

export type IdFactory = () => string;

const DEFAULT_CATEGORY_COLOR = "#228be6";

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function namesEqual(left: string, right: string): boolean {
  return normalizeName(left).localeCompare(normalizeName(right), "pl", { sensitivity: "accent" }) === 0;
}

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export const defaultIdFactory: IdFactory = () => createId("id");

function getOrCreateCategory(state: AppState, name: string, color: string | undefined, idFactory: IdFactory): { state: AppState; category: Category } {
  const normalized = normalizeName(name);
  const existing = state.categories.find((category) => namesEqual(category.name, normalized));
  if (existing) {
    return { state, category: existing };
  }

  const category = { id: idFactory(), name: normalized, color: color?.trim() || DEFAULT_CATEGORY_COLOR };
  return { state: { ...state, categories: [...state.categories, category] }, category };
}

function getOrCreateAssignee(state: AppState, name: string, idFactory: IdFactory): { state: AppState; assignee: Assignee } {
  const normalized = normalizeName(name);
  const existing = state.assignees.find((assignee) => namesEqual(assignee.name, normalized));
  if (existing) {
    return { state, assignee: existing };
  }

  const assignee = { id: idFactory(), name: normalized };
  return { state: { ...state, assignees: [...state.assignees, assignee] }, assignee };
}

function requireText(value: string, label: string): string {
  const normalized = normalizeName(value);
  if (normalized.length === 0) {
    throw new Error(`${label} is required`);
  }
  return normalized;
}

function firstActiveTaskTypeId(state: AppState): string {
  return state.taskTypes.find((item) => item.active)?.id ?? DEFAULT_TASK_TYPE_ID;
}

function firstActivePriorityId(state: AppState): string {
  return state.priorities.find((item) => item.active)?.id ?? DEFAULT_PRIORITY_ID;
}

function prepareDraft(state: AppState, draft: TaskDraft, idFactory: IdFactory) {
  const title = requireText(draft.title, "title");
  const categoryResult = getOrCreateCategory(state, requireText(draft.categoryName, "categoryName"), draft.categoryColor, idFactory);
  const assigneeResult = getOrCreateAssignee(categoryResult.state, requireText(draft.assigneeName, "assigneeName"), idFactory);

  return {
    state: assigneeResult.state,
    title,
    categoryId: categoryResult.category.id,
    assigneeId: assigneeResult.assignee.id,
    taskTypeId: draft.taskTypeId || firstActiveTaskTypeId(assigneeResult.state),
    priorityId: draft.priorityId || firstActivePriorityId(assigneeResult.state)
  };
}

export function addTask(state: AppState, draft: TaskDraft, nowIso: string, idFactory: IdFactory = defaultIdFactory): AppState {
  const taskId = idFactory();
  const prepared = prepareDraft(state, draft, idFactory);

  return {
    ...prepared.state,
    tasks: [
      ...prepared.state.tasks,
      {
        id: taskId,
        title: prepared.title,
        categoryId: prepared.categoryId,
        assigneeId: prepared.assigneeId,
        taskTypeId: prepared.taskTypeId,
        priorityId: prepared.priorityId,
        schedule: draft.schedule,
        active: draft.active,
        createdAt: nowIso,
        updatedAt: nowIso
      }
    ]
  };
}

export function updateTask(
  state: AppState,
  taskId: string,
  draft: TaskDraft,
  nowIso: string,
  idFactory: IdFactory = defaultIdFactory
): AppState {
  const prepared = prepareDraft(state, draft, idFactory);

  return {
    ...prepared.state,
    tasks: prepared.state.tasks.map((task) =>
      task.id === taskId
        ? {
            ...task,
            title: prepared.title,
            categoryId: prepared.categoryId,
            assigneeId: prepared.assigneeId,
            taskTypeId: prepared.taskTypeId,
            priorityId: prepared.priorityId,
            schedule: draft.schedule,
            active: draft.active,
            updatedAt: nowIso
          }
        : task
    )
  };
}

export function deactivateTask(state: AppState, taskId: string, nowIso: string): AppState {
  return {
    ...state,
    tasks: state.tasks.map((task) => (task.id === taskId ? { ...task, active: false, updatedAt: nowIso } : task))
  };
}

export function completeTask(
  state: AppState,
  taskId: string,
  scheduledDate: string,
  completedDate: string,
  idFactory: IdFactory = defaultIdFactory
): AppState {
  return {
    ...state,
    completions: [
      ...state.completions,
      {
        id: idFactory(),
        taskId,
        scheduledDate,
        completedDate
      }
    ]
  };
}

export function postponeTask(
  state: AppState,
  taskId: string,
  fromDate: string,
  toDate: string,
  createdAt: string,
  idFactory: IdFactory = defaultIdFactory
): AppState {
  return {
    ...state,
    postponements: [
      ...state.postponements,
      {
        id: idFactory(),
        taskId,
        fromDate,
        toDate,
        createdAt
      }
    ]
  };
}
```

- [ ] **Step 4: Run task tests**

Run:

```bash
npm run test:run -- src/domain/tasks.test.ts
```

Expected: PASS after Task 4 updates `todayList.ts`; if it still fails because `todayList.ts` has not been updated, continue to Task 4 before committing.

---

### Task 4: Today List For One-Time Tasks And Extended Filters

**Files:**
- Modify: `src/domain/todayList.ts`
- Modify: `src/domain/todayList.test.ts`

**Interfaces:**
- Consumes: `Task.schedule`, `TodayFilters` with `taskTypeId` and `priorityId`.
- Produces: `getCurrentScheduledDate(task, completions): string | undefined`, `buildTodayList(state, today, filters): TodayTask[]`.

- [ ] **Step 1: Replace today-list tests**

Replace `src/domain/todayList.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_PRIORITY_ID, DEFAULT_TASK_TYPE_ID } from "../storage/taskerStorage";
import { buildTodayList } from "./todayList";
import type { AppState, Task } from "./types";

const baseState: AppState = {
  version: 2,
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
```

- [ ] **Step 2: Run today-list tests and verify they fail**

Run:

```bash
npm run test:run -- src/domain/todayList.test.ts
```

Expected: FAIL because `todayList.ts` still reads `task.startDate`, `task.recurrence`, and two-field filters.

- [ ] **Step 3: Replace today-list implementation**

Replace `src/domain/todayList.ts` with:

```ts
import { compareDates } from "./dates";
import { getNextScheduledDate } from "./recurrence";
import type { AppState, Assignee, Category, Completion, Priority, Task, TaskType, TodayFilters, TodayTask } from "./types";

function getLatestCompletion(taskId: string, completions: Completion[]): Completion | undefined {
  return completions
    .filter((completion) => completion.taskId === taskId)
    .sort((left, right) => compareDates(right.completedDate, left.completedDate))[0];
}

function wasCompleted(taskId: string, scheduledDate: string, completions: Completion[]): boolean {
  return completions.some((completion) => completion.taskId === taskId && completion.scheduledDate === scheduledDate);
}

export function getCurrentScheduledDate(task: Task, completions: Completion[]): string | undefined {
  if (task.schedule.mode === "oneTime") {
    return wasCompleted(task.id, task.schedule.date, completions) ? undefined : task.schedule.date;
  }

  const latestCompletion = getLatestCompletion(task.id, completions);
  if (!latestCompletion) {
    return task.schedule.startDate;
  }

  return getNextScheduledDate(latestCompletion.completedDate, task.schedule.recurrence);
}

function wasPostponedFromToday(state: AppState, taskId: string, today: string): boolean {
  return state.postponements.some((postponement) => postponement.taskId === taskId && postponement.fromDate === today);
}

function findCategory(categories: Category[], id: string): Category {
  return categories.find((category) => category.id === id) ?? { id, name: "Nieznana kategoria", color: "#868e96" };
}

function findAssignee(assignees: Assignee[], id: string): Assignee {
  return assignees.find((assignee) => assignee.id === id) ?? { id, name: "Nieznana osoba" };
}

function findTaskType(taskTypes: TaskType[], id: string): TaskType {
  return taskTypes.find((taskType) => taskType.id === id) ?? { id, name: "Nieznany typ", active: false, order: 0 };
}

function findPriority(priorities: Priority[], id: string): Priority {
  return priorities.find((priority) => priority.id === id) ?? { id, name: "Nieznany priorytet", active: false, order: 0 };
}

function matchesFilters(task: Task, filters: TodayFilters): boolean {
  const categoryMatches = filters.categoryId === "" || task.categoryId === filters.categoryId;
  const assigneeMatches = filters.assigneeId === "" || task.assigneeId === filters.assigneeId;
  const taskTypeMatches = filters.taskTypeId === "" || task.taskTypeId === filters.taskTypeId;
  const priorityMatches = filters.priorityId === "" || task.priorityId === filters.priorityId;
  return categoryMatches && assigneeMatches && taskTypeMatches && priorityMatches;
}

export function buildTodayList(state: AppState, today: string, filters: TodayFilters): TodayTask[] {
  return state.tasks
    .filter((task) => task.active)
    .filter((task) => matchesFilters(task, filters))
    .map((task) => ({
      task,
      scheduledDate: getCurrentScheduledDate(task, state.completions)
    }))
    .filter((item): item is { task: Task; scheduledDate: string } => item.scheduledDate !== undefined)
    .filter((item) => compareDates(item.scheduledDate, today) <= 0)
    .filter((item) => !wasPostponedFromToday(state, item.task.id, today))
    .map((item) => ({
      task: item.task,
      category: findCategory(state.categories, item.task.categoryId),
      assignee: findAssignee(state.assignees, item.task.assigneeId),
      taskType: findTaskType(state.taskTypes, item.task.taskTypeId),
      priority: findPriority(state.priorities, item.task.priorityId),
      scheduledDate: item.scheduledDate,
      isOverdue: compareDates(item.scheduledDate, today) < 0,
      lastCompletedDate: getLatestCompletion(item.task.id, state.completions)?.completedDate
    }))
    .sort((left, right) => {
      const byDate = compareDates(left.scheduledDate, right.scheduledDate);
      if (byDate !== 0) {
        return byDate;
      }
      return left.task.title.localeCompare(right.task.title, "pl");
    });
}
```

- [ ] **Step 4: Run domain tests affected by v2**

Run:

```bash
npm run test:run -- src/domain/tasks.test.ts src/domain/todayList.test.ts src/domain/recurrence.test.ts src/domain/dates.test.ts
```

Expected: PASS.

---

### Task 5: Store Filters And Navigation State

**Files:**
- Modify: `src/state/taskerStore.ts`

**Interfaces:**
- Consumes: `AppView`, v2 `TodayFilters`, v2 `TaskDraft`.
- Produces: `TaskerStore.view`, `TaskerStore.setView(view: AppView): void`, `emptyFilters` with four fields.

- [ ] **Step 1: Replace store implementation**

Replace `src/state/taskerStore.ts` with:

```ts
import { create } from "zustand";
import { addDays, getTodayString } from "../domain/dates";
import { addTask, completeTask, deactivateTask, postponeTask, updateTask } from "../domain/tasks";
import type { AppState, AppView, TaskDraft, TodayFilters } from "../domain/types";
import { loadState, saveState } from "../storage/taskerStorage";

export const emptyFilters: TodayFilters = { categoryId: "", assigneeId: "", taskTypeId: "", priorityId: "" };

export type TaskerStore = {
  state: AppState;
  storageError?: string;
  filters: TodayFilters;
  view: AppView;
  setFilters: (filters: TodayFilters) => void;
  setView: (view: AppView) => void;
  addTask: (draft: TaskDraft, now?: Date) => void;
  updateTask: (taskId: string, draft: TaskDraft, now?: Date) => void;
  deactivateTask: (taskId: string, now?: Date) => void;
  completeTask: (taskId: string, scheduledDate: string, now?: Date) => void;
  postponeTask: (taskId: string, now?: Date) => void;
  reset: () => void;
};

function loadInitialStoreState() {
  const initial = loadState();
  return {
    state: initial.state,
    storageError: initial.error,
    filters: emptyFilters,
    view: "today" as AppView
  };
}

function persist(nextState: AppState): Pick<TaskerStore, "state"> {
  saveState(nextState);
  return { state: nextState };
}

export const useTaskerStore = create<TaskerStore>((set, get) => ({
  ...loadInitialStoreState(),
  setFilters: (filters) => set({ filters }),
  setView: (view) => set({ view }),
  addTask: (draft, now = new Date()) => {
    set(persist(addTask(get().state, draft, now.toISOString())));
  },
  updateTask: (taskId, draft, now = new Date()) => {
    set(persist(updateTask(get().state, taskId, draft, now.toISOString())));
  },
  deactivateTask: (taskId, now = new Date()) => {
    set(persist(deactivateTask(get().state, taskId, now.toISOString())));
  },
  completeTask: (taskId, scheduledDate, now = new Date()) => {
    const today = getTodayString(now);
    set(persist(completeTask(get().state, taskId, scheduledDate, today)));
  },
  postponeTask: (taskId, now = new Date()) => {
    const today = getTodayString(now);
    set(persist(postponeTask(get().state, taskId, today, addDays(today, 1), now.toISOString())));
  },
  reset: () => set(loadInitialStoreState())
}));

export function resetTaskerStore(): void {
  useTaskerStore.getState().reset();
}
```

- [ ] **Step 2: Run build to identify UI type errors**

Run:

```bash
npm run build
```

Expected: FAIL until components and tests are updated for v2 filters and draft shape in Tasks 6-7.

---

### Task 6: UI Compatibility And Navigation Shell

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/QuickAddForm.tsx`
- Modify: `src/components/TaskForm.tsx`
- Modify: `src/components/TaskFilters.tsx`
- Modify: `src/components/TodayTaskCard.tsx`

**Interfaces:**
- Consumes: `TaskDraft.schedule`, v2 `TodayTask`, store `view` and `setView`.
- Produces: Today view still works; new navigation buttons switch to placeholders for `tasks`, `calendar`, `categories`, `settings`, `history`, and `data`.

- [ ] **Step 1: Update quick add draft shape**

In `src/components/QuickAddForm.tsx`, replace the submitted draft body:

```ts
onSubmit({
  ...form,
  recurrence: { type: "daily" },
  startDate: today,
  active: true
});
```

with:

```ts
onSubmit({
  ...form,
  schedule: { mode: "recurring", startDate: today, recurrence: { type: "daily" } },
  active: true
});
```

- [ ] **Step 2: Update task form draft shape**

In `src/components/TaskForm.tsx`, change `defaultDraft` to return v2 draft fields:

```ts
function defaultDraft(task?: Task, categories: Category[] = [], assignees: Assignee[] = []): TaskDraft {
  const category = categories.find((item) => item.id === task?.categoryId);
  const assignee = assignees.find((item) => item.id === task?.assigneeId);

  return {
    title: task?.title ?? "",
    categoryName: category?.name ?? "",
    categoryColor: category?.color,
    assigneeName: assignee?.name ?? "",
    taskTypeId: task?.taskTypeId,
    priorityId: task?.priorityId,
    schedule: task?.schedule ?? { mode: "recurring", startDate: "", recurrence: { type: "daily" } },
    active: task?.active ?? true
  };
}
```

Then replace references to `draft.recurrence` with `draft.schedule.mode === "recurring" ? draft.schedule.recurrence : { type: "daily" }`, and replace `draft.startDate` with `draft.schedule.mode === "recurring" ? draft.schedule.startDate : draft.schedule.date`. Keep the current form visually simple; a fuller task form is implemented in the next feature plan.

- [ ] **Step 3: Update task filters for v2 fields**

In `src/components/TaskFilters.tsx`, keep category and assignee controls and preserve new fields when changing values:

```ts
onChange({ ...filters, categoryId })
```

and:

```ts
onChange({ ...filters, assigneeId: assigneeId ?? "" })
```

No visual controls for task type and priority are required in this foundation task; they are added in the task/configuration feature plans.

- [ ] **Step 4: Update task card metadata**

In `src/components/TodayTaskCard.tsx`, add task type and priority badges to the metadata group:

```tsx
<Badge variant="default">{item.taskType.name}</Badge>
<Badge variant="default">{item.priority.name}</Badge>
```

Place them after the assignee badge and before the completion text.

- [ ] **Step 5: Add navigation shell in App**

In `src/App.tsx`, read `view` and `setView` from the store:

```ts
const view = useTaskerStore((store) => store.view);
const setView = useTaskerStore((store) => store.setView);
```

Add this helper inside `App`:

```tsx
function PlaceholderView({ title, description }: { title: string; description: string }) {
  return (
    <Paper withBorder p="lg" radius="md" shadow="xs">
      <Stack gap="xs">
        <Title order={2}>{title}</Title>
        <Text c="dimmed">{description}</Text>
      </Stack>
    </Paper>
  );
}
```

Replace the single content `Paper` after the header with a navigation group and conditional content:

```tsx
<Group gap="xs" wrap="wrap">
  <Button variant={view === "today" ? "filled" : "default"} onClick={() => setView("today")}>Dzisiaj</Button>
  <Button variant={view === "tasks" ? "filled" : "default"} onClick={() => setView("tasks")}>Zadania</Button>
  <Button variant={view === "calendar" ? "filled" : "default"} onClick={() => setView("calendar")}>Kalendarz</Button>
  <Button variant={view === "categories" ? "filled" : "default"} onClick={() => setView("categories")}>Kategorie</Button>
  <Button variant={view === "settings" ? "filled" : "default"} onClick={() => setView("settings")}>Konfiguracja</Button>
  <Button variant={view === "history" ? "filled" : "default"} onClick={() => setView("history")}>Historia</Button>
  <Button variant={view === "data" ? "filled" : "default"} onClick={() => setView("data")}>Dane</Button>
</Group>
```

Use this conditional rendering:

```tsx
{view === "today" ? (
  <Paper withBorder p="lg" radius="md" shadow="xs">
    <Stack gap="md">
      {/* keep the existing Today content here */}
    </Stack>
  </Paper>
) : null}
{view === "tasks" ? <PlaceholderView title="Zadania" description="Tutaj powstanie osobny widok dodawania i edycji zadan." /> : null}
{view === "calendar" ? <PlaceholderView title="Kalendarz" description="Tutaj powstanie widok planowania zadan wedlug dat." /> : null}
{view === "categories" ? <PlaceholderView title="Kategorie" description="Tutaj powstanie zarzadzanie kategoriami i kolorami." /> : null}
{view === "settings" ? <PlaceholderView title="Konfiguracja zadan" description="Tutaj powstanie konfiguracja typow, priorytetow i slownikow." /> : null}
{view === "history" ? <PlaceholderView title="Historia" description="Tutaj powstanie lista wykonania zadan." /> : null}
{view === "data" ? <PlaceholderView title="Dane" description="Tutaj powstanie import i eksport lokalnych danych." /> : null}
```

- [ ] **Step 6: Run build**

Run:

```bash
npm run build
```

Expected: PASS after all component type errors are resolved.

---

### Task 7: Test Environment And App Flow Updates

**Files:**
- Modify: `src/test/setup.ts`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Consumes: `resetTaskerStore`, v2 storage key, navigation labels.
- Produces: passing UI tests under Mantine/jsdom.

- [ ] **Step 1: Add Mantine matchMedia polyfill**

Replace `src/test/setup.ts` with:

```ts
import "@testing-library/jest-dom/vitest";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false
  })
});
```

- [ ] **Step 2: Update app test setup**

In `src/App.test.tsx`, import `resetTaskerStore`:

```ts
import { resetTaskerStore } from "./state/taskerStore";
```

Update `beforeEach`:

```ts
beforeEach(() => {
  localStorage.clear();
  resetTaskerStore();
});
```

- [ ] **Step 3: Update app tests for v2 copy and navigation**

Add this test to `src/App.test.tsx`:

```tsx
it("navigates from Today to foundation placeholder views", async () => {
  renderApp();
  const user = userEvent.setup();

  await user.click(screen.getByRole("button", { name: "Kalendarz" }));
  expect(screen.getByRole("heading", { name: "Kalendarz" })).toBeInTheDocument();
  expect(screen.getByText("Tutaj powstanie widok planowania zadan wedlug dat.")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Konfiguracja" }));
  expect(screen.getByRole("heading", { name: "Konfiguracja zadan" })).toBeInTheDocument();
});
```

Keep existing flow tests passing by using the compatibility quick-add form from Task 6.

- [ ] **Step 4: Run UI tests**

Run:

```bash
npm run test:run -- src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Run all verification**

Run:

```bash
npm run test:run
npm run build
```

Expected: both commands exit with code 0.

- [ ] **Step 6: Commit foundation changes**

Run:

```bash
git add src/domain/types.ts src/storage/taskerStorage.ts src/storage/taskerStorage.test.ts src/domain/tasks.ts src/domain/tasks.test.ts src/domain/todayList.ts src/domain/todayList.test.ts src/state/taskerStore.ts src/App.tsx src/components/QuickAddForm.tsx src/components/TaskForm.tsx src/components/TaskFilters.tsx src/components/TodayTaskCard.tsx src/App.test.tsx src/test/setup.ts
git commit -m "feat: add tasker v2 foundation"
```

Expected: commit succeeds and includes only foundation implementation files.

---

## Self-Review

**Spec coverage:** This plan covers the foundation slice of the functional spec: local-only data, v2 versioned storage, one-time and recurring task data shape, categories with colors, task types, priorities, extended filters, Today as the start view, and navigation placeholders for Tasks, Calendar, Categories, Configuration, History, and Data. Full task CRUD UI, arbitrary-date postponement UI, calendar behavior, dictionary CRUD, history UI, import, and export are intentionally deferred to later plans.

**Placeholder scan:** The plan contains no unresolved marker strings or open implementation steps. Placeholder UI text is intentional product scaffolding for future modules and is explicitly tested.

**Type consistency:** `TaskDraft.schedule`, `Task.schedule`, `TodayFilters.taskTypeId`, `TodayFilters.priorityId`, `TaskerStore.view`, and `setView(view: AppView)` are introduced before they are consumed. Storage default IDs are reused by tasks and tests through exported constants.
