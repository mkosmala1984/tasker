# Tasker Today Postponement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the target "Dzisiaj" work view after foundation v2 and the task module: overdue handling, four-dimension filters, completion, postponement to tomorrow, and postponement to an arbitrary date.

**Architecture:** Keep date, recurrence, filtering, completion, and postponement rules in `src/domain/`; keep persistence-triggering actions in `src/state/taskerStore.ts`; keep the Today UI in focused components under `src/components/`. Postponement changes task visibility without changing completion history or recurring-cycle calculation.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, React Testing Library, Mantine, Zustand, browser `localStorage`.

## Global Constraints

- Baseline: the foundation plan is complete, including `Task.schedule`, `TaskType`, `Priority`, four-field `TodayFilters`, and current Tasker storage.
- Baseline: the task module can create and edit one-time and recurring tasks with category, assignee, task type, priority, active flag, and date schedule.
- Local-only application: no accounts, backend, synchronization, notifications, or backend date services.
- Dates are calendar dates in `YYYY-MM-DD`, without time or timezone.
- Interface copy remains Polish.
- The "Dzisiaj" view is the start and work view; this plan does not implement a full calendar view.
- This plan does not implement history UI, import, export, dictionary CRUD, or analytics.
- Completing a recurring task keeps the current rule: the next occurrence is calculated from the actual completion date.
- Postponing is not completion and must not create or modify completion records.
- Use ASCII in source and docs unless the touched file already intentionally uses non-ASCII.

---

## File Structure

- Modify `src/domain/todayList.ts`: centralize Today visibility rules for one-time tasks, recurring tasks, overdue tasks, completed occurrences, and latest postponements; expose only tasks actionable on or before the selected `today`.
- Modify `src/domain/todayList.test.ts`: add domain coverage for one-time tasks, recurring tasks, overdue tasks, hidden future postponements, reappearing postponed tasks, four filters, missing dictionary records, and sort order.
- Modify `src/domain/tasks.ts`: keep completion behavior intact and make postponement creation accept the current scheduled date plus a target date; validate that the target date is a non-empty calendar date.
- Modify `src/domain/tasks.test.ts`: add mutation coverage proving postponement records are created without completion records and recurring completion still advances from actual completion date.
- Modify `src/state/taskerStore.ts`: replace the Today-only `postponeTask(taskId, now?)` action with `postponeTask(taskId, scheduledDate, toDate, now?)`; add `postponeTaskToTomorrow(taskId, scheduledDate, now?)` as the quick action used by the card.
- Modify `src/components/TaskFilters.tsx`: render filters for category, assignee, task type, and priority using existing v2 dictionaries and preserve all filter fields on every change.
- Modify `src/components/TodayTaskCard.tsx`: show category, assignee, type, priority, due status, and completion metadata; expose actions for complete, postpone to tomorrow, postpone to selected date, edit, and deactivate.
- Modify `src/components/TodayTaskList.tsx`: pass the expanded dictionaries and postponement callbacks through to each card; keep the empty state and add button.
- Modify `src/App.tsx`: pass `taskTypes`, `priorities`, and the new postponement handlers into Today filters and list; keep Today as the view that owns this workflow.
- Modify `src/App.test.tsx`: cover user flows for four filters, completion, postpone to tomorrow, arbitrary-date postponement, and recurring-cycle preservation through UI-visible behavior.

---

### Task 1: Domain Today Visibility Rules

**Files:**
- Modify: `src/domain/todayList.ts`
- Modify: `src/domain/todayList.test.ts`

**Interfaces:**
- Consumes: `AppState`, `Task`, `Completion`, `Postponement`, `TodayFilters`, `TodayTask`, `getNextScheduledDate(fromDate: string, recurrence: RecurrenceRule): string`, `compareDates(left: string, right: string): number`.
- Produces: `getCurrentScheduledDate(task: Task, completions: Completion[]): string | undefined`, `buildTodayList(state: AppState, today: string, filters: TodayFilters): TodayTask[]`.

- [ ] **Step 1: Replace Today-list tests with target v2 coverage**

Replace `src/domain/todayList.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import { buildTodayList, getCurrentScheduledDate } from "./todayList";
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
```

- [ ] **Step 2: Run the Today-list tests and verify failure before implementation**

Run:

```bash
npm run test:run -- src/domain/todayList.test.ts
```

Expected: FAIL with assertions or TypeScript errors around missing arbitrary-date postponement visibility and four-field Today filtering.

- [ ] **Step 3: Replace Today-list implementation**

Replace `src/domain/todayList.ts` with:

```ts
import { compareDates } from "./dates";
import { getNextScheduledDate } from "./recurrence";
import type { AppState, Assignee, Category, Completion, Postponement, Priority, Task, TaskType, TodayFilters, TodayTask } from "./types";

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

function getLatestPostponement(taskId: string, postponements: Postponement[]): Postponement | undefined {
  return postponements
    .filter((postponement) => postponement.taskId === taskId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
}

function isHiddenByPostponement(state: AppState, taskId: string, today: string): boolean {
  const latestPostponement = getLatestPostponement(taskId, state.postponements);
  return latestPostponement !== undefined && compareDates(today, latestPostponement.toDate) < 0;
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
  return (
    (filters.categoryId === "" || task.categoryId === filters.categoryId) &&
    (filters.assigneeId === "" || task.assigneeId === filters.assigneeId) &&
    (filters.taskTypeId === "" || task.taskTypeId === filters.taskTypeId) &&
    (filters.priorityId === "" || task.priorityId === filters.priorityId)
  );
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
    .filter((item) => !isHiddenByPostponement(state, item.task.id, today))
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

- [ ] **Step 4: Run Today-list tests and verify pass**

Run:

```bash
npm run test:run -- src/domain/todayList.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

Run:

```bash
git add src/domain/todayList.ts src/domain/todayList.test.ts
git commit -m "feat: finalize today list domain rules"
```

Expected: commit succeeds and includes only the Today-list domain files.

---

### Task 2: Postponement Mutation And Store Actions

**Files:**
- Modify: `src/domain/tasks.ts`
- Modify: `src/domain/tasks.test.ts`
- Modify: `src/state/taskerStore.ts`

**Interfaces:**
- Consumes: existing `completeTask(state, taskId, scheduledDate, completedDate, idFactory?)`, existing `postponeTask(state, taskId, fromDate, toDate, createdAt, idFactory?)`, `addDays(date: string, days: number): string`, `getTodayString(now: Date): string`.
- Produces: domain `postponeTask(state: AppState, taskId: string, fromDate: string, toDate: string, createdAt: string, idFactory?: IdFactory): AppState`; store `postponeTask(taskId: string, scheduledDate: string, toDate: string, now?: Date): void`; store `postponeTaskToTomorrow(taskId: string, scheduledDate: string, now?: Date): void`.

- [ ] **Step 1: Add mutation tests for postponement and recurring completion**

In `src/domain/tasks.test.ts`, add these tests inside the existing `describe("task mutations", () => { ... })` block. If the file was replaced by the foundation plan, reuse its `emptyState` and `ids` helpers exactly as defined there.

```ts
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
```

- [ ] **Step 2: Run task mutation tests and verify failure before implementation**

Run:

```bash
npm run test:run -- src/domain/tasks.test.ts
```

Expected: FAIL if `postponeTask` does not validate `toDate`, or if test imports for `buildTodayList`, `DEFAULT_TASK_TYPE_ID`, and `DEFAULT_PRIORITY_ID` are missing.

- [ ] **Step 3: Update `postponeTask` domain validation**

In `src/domain/tasks.ts`, add this helper near `requireText`:

```ts
function requireDate(value: string, label: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} is required`);
  }
  return value;
}
```

Then replace the body of `postponeTask` with:

```ts
const from = requireDate(fromDate, "fromDate");
const to = requireDate(toDate, "toDate");

return {
  ...state,
  postponements: [
    ...state.postponements,
    {
      id: idFactory(),
      taskId,
      fromDate: from,
      toDate: to,
      createdAt
    }
  ]
};
```

- [ ] **Step 4: Update store action signatures**

In `src/state/taskerStore.ts`, change the `TaskerStore` action fields from:

```ts
postponeTask: (taskId: string, now?: Date) => void;
```

to:

```ts
postponeTask: (taskId: string, scheduledDate: string, toDate: string, now?: Date) => void;
postponeTaskToTomorrow: (taskId: string, scheduledDate: string, now?: Date) => void;
```

Replace the current store implementation of `postponeTask` with:

```ts
postponeTask: (taskId, scheduledDate, toDate, now = new Date()) => {
  set(persist(postponeTask(get().state, taskId, scheduledDate, toDate, now.toISOString())));
},
postponeTaskToTomorrow: (taskId, scheduledDate, now = new Date()) => {
  const today = getTodayString(now);
  set(persist(postponeTask(get().state, taskId, scheduledDate, addDays(today, 1), now.toISOString())));
},
```

- [ ] **Step 5: Run mutation and store type checks**

Run:

```bash
npm run test:run -- src/domain/tasks.test.ts src/domain/todayList.test.ts
npm run build
```

Expected: tests PASS; build may FAIL only in UI files that still use the old `onPostpone(taskId)` shape. Those UI failures are resolved in Task 3.

- [ ] **Step 6: Commit Task 2 after UI compile errors are resolved by Task 3**

Do not commit while the build has expected UI type errors. After Task 3 passes build, include these files in the Task 3 commit or make a separate commit:

```bash
git add src/domain/tasks.ts src/domain/tasks.test.ts src/state/taskerStore.ts
git commit -m "feat: add arbitrary-date postponement action"
```

Expected: commit succeeds only after `npm run build` exits with code 0.

---

### Task 3: Today Filters And Card Actions UI

**Files:**
- Modify: `src/components/TaskFilters.tsx`
- Modify: `src/components/TodayTaskCard.tsx`
- Modify: `src/components/TodayTaskList.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `TodayFilters`, `Category[]`, `Assignee[]`, `TaskType[]`, `Priority[]`, `TodayTask`, store `postponeTask`, store `postponeTaskToTomorrow`.
- Produces: `TaskFilters` props with four dictionaries; `TodayTaskCard` callbacks `onPostponeTomorrow(taskId, scheduledDate)` and `onPostponeToDate(taskId, scheduledDate, toDate)`.

- [ ] **Step 1: Expand `TaskFilters` props and controls**

Replace `src/components/TaskFilters.tsx` with:

```tsx
import { Group, Select, SegmentedControl, Stack } from "@mantine/core";
import type { Assignee, Category, Priority, TaskType, TodayFilters } from "../domain/types";

type Props = {
  categories: Category[];
  assignees: Assignee[];
  taskTypes: TaskType[];
  priorities: Priority[];
  filters: TodayFilters;
  onChange: (filters: TodayFilters) => void;
};

export function TaskFilters({ categories, assignees, taskTypes, priorities, filters, onChange }: Props) {
  const categoryData = [
    { label: "Wszystkie", value: "" },
    ...categories.map((category) => ({ label: category.name, value: category.id }))
  ];

  const assigneeData = [
    { label: "Wszystkie osoby", value: "" },
    ...assignees.map((assignee) => ({ label: assignee.name, value: assignee.id }))
  ];

  const taskTypeData = [
    { label: "Wszystkie typy", value: "" },
    ...taskTypes.filter((taskType) => taskType.active).map((taskType) => ({ label: taskType.name, value: taskType.id }))
  ];

  const priorityData = [
    { label: "Wszystkie priorytety", value: "" },
    ...priorities.filter((priority) => priority.active).map((priority) => ({ label: priority.name, value: priority.id }))
  ];

  return (
    <Group component="section" aria-label="Filtry" justify="space-between" align="end" gap="md">
      <Stack gap={6}>
        <SegmentedControl
          aria-label="Kategorie"
          data={categoryData}
          value={filters.categoryId}
          onChange={(categoryId) => onChange({ ...filters, categoryId })}
        />
      </Stack>

      <Select
        label="Osoba"
        data={assigneeData}
        value={filters.assigneeId}
        onChange={(assigneeId) => onChange({ ...filters, assigneeId: assigneeId ?? "" })}
        allowDeselect={false}
        w={{ base: "100%", sm: 220 }}
      />

      <Select
        label="Typ"
        data={taskTypeData}
        value={filters.taskTypeId}
        onChange={(taskTypeId) => onChange({ ...filters, taskTypeId: taskTypeId ?? "" })}
        allowDeselect={false}
        w={{ base: "100%", sm: 220 }}
      />

      <Select
        label="Priorytet"
        data={priorityData}
        value={filters.priorityId}
        onChange={(priorityId) => onChange({ ...filters, priorityId: priorityId ?? "" })}
        allowDeselect={false}
        w={{ base: "100%", sm: 220 }}
      />
    </Group>
  );
}
```

- [ ] **Step 2: Expand Today card props and selected-date state**

In `src/components/TodayTaskCard.tsx`, change imports to include `TextInput`:

```tsx
import { Badge, Button, Card, Group, Stack, Text, TextInput, Title } from "@mantine/core";
```

Change the prop callbacks from:

```ts
onPostpone: (taskId: string) => void;
```

to:

```ts
onPostponeTomorrow: (taskId: string, scheduledDate: string) => void;
onPostponeToDate: (taskId: string, scheduledDate: string, toDate: string) => void;
```

Inside the component, add state after `isEditing`:

```ts
const [postponeDate, setPostponeDate] = useState("");
```

- [ ] **Step 3: Update card metadata badges**

In `src/components/TodayTaskCard.tsx`, replace the metadata group with:

```tsx
<Group aria-label="Szczegoly zadania" gap="xs">
  <Badge variant="default">{item.category.name}</Badge>
  <Badge variant="default">{item.assignee.name}</Badge>
  <Badge variant="default">{item.taskType.name}</Badge>
  <Badge variant="default">{item.priority.name}</Badge>
  <Text c="dimmed" size="sm">
    {completionText}
  </Text>
</Group>
```

- [ ] **Step 4: Update card postponement actions**

In `src/components/TodayTaskCard.tsx`, replace the current postpone button:

```tsx
<Button type="button" variant="default" onClick={() => onPostpone(item.task.id)}>
  Odloz na jutro
</Button>
```

with:

```tsx
<Button type="button" variant="default" onClick={() => onPostponeTomorrow(item.task.id, item.scheduledDate)}>
  Odloz na jutro
</Button>
<TextInput
  aria-label={`Data odlozenia: ${item.task.title}`}
  type="date"
  value={postponeDate}
  min={item.scheduledDate}
  onChange={(event) => setPostponeDate(event.currentTarget.value)}
  w={{ base: "100%", sm: 170 }}
/>
<Button
  type="button"
  variant="default"
  disabled={postponeDate === ""}
  onClick={() => {
    onPostponeToDate(item.task.id, item.scheduledDate, postponeDate);
    setPostponeDate("");
  }}
>
  Odloz do daty
</Button>
```

- [ ] **Step 5: Expand Today list props**

In `src/components/TodayTaskList.tsx`, add imports and props for `TaskType` and `Priority`:

```ts
import type { Assignee, Category, Priority, TaskDraft, TaskType, TodayTask } from "../domain/types";
```

Change the prop block to include:

```ts
taskTypes: TaskType[];
priorities: Priority[];
onPostponeTomorrow: (taskId: string, scheduledDate: string) => void;
onPostponeToDate: (taskId: string, scheduledDate: string, toDate: string) => void;
```

Remove the old `onPostpone: (taskId: string) => void;` prop.

Update the component signature and pass the new callbacks to `TodayTaskCard`:

```tsx
<TodayTaskCard
  key={item.task.id}
  item={item}
  categories={categories}
  assignees={assignees}
  onComplete={onComplete}
  onPostponeTomorrow={onPostponeTomorrow}
  onPostponeToDate={onPostponeToDate}
  onDeactivate={onDeactivate}
  onUpdate={onUpdate}
/>
```

The `taskTypes` and `priorities` props are accepted by `TodayTaskList` for symmetry with `TaskFilters`; the card receives resolved dictionary records through `TodayTask`.

- [ ] **Step 6: Wire filters and postponement actions in App**

In `src/App.tsx`, replace:

```ts
const postponeTask = useTaskerStore((store) => store.postponeTask);
```

with:

```ts
const postponeTask = useTaskerStore((store) => store.postponeTask);
const postponeTaskToTomorrow = useTaskerStore((store) => store.postponeTaskToTomorrow);
```

Replace:

```ts
function handlePostponeTask(taskId: string) {
  postponeTask(taskId, now);
}
```

with:

```ts
function handlePostponeTaskToTomorrow(taskId: string, scheduledDate: string) {
  postponeTaskToTomorrow(taskId, scheduledDate, now);
}

function handlePostponeTaskToDate(taskId: string, scheduledDate: string, toDate: string) {
  postponeTask(taskId, scheduledDate, toDate, now);
}
```

Update `TaskFilters` props:

```tsx
<TaskFilters
  categories={state.categories}
  assignees={state.assignees}
  taskTypes={state.taskTypes}
  priorities={state.priorities}
  filters={filters}
  onChange={setFilters}
/>
```

Update `TodayTaskList` props:

```tsx
<TodayTaskList
  tasks={todayTasks}
  categories={state.categories}
  assignees={state.assignees}
  taskTypes={state.taskTypes}
  priorities={state.priorities}
  onAdd={focusQuickAdd}
  onComplete={handleCompleteTask}
  onPostponeTomorrow={handlePostponeTaskToTomorrow}
  onPostponeToDate={handlePostponeTaskToDate}
  onDeactivate={handleDeactivateTask}
  onUpdate={handleUpdateTask}
/>
```

- [ ] **Step 7: Run build**

Run:

```bash
npm run build
```

Expected: PASS. If it fails, the errors should point to a remaining old `onPostpone` prop or missing `taskTypes`/`priorities` props; update that exact call site and rerun.

- [ ] **Step 8: Commit Task 2 and Task 3 together if Task 2 was waiting on UI**

Run:

```bash
git add src/domain/tasks.ts src/domain/tasks.test.ts src/state/taskerStore.ts src/components/TaskFilters.tsx src/components/TodayTaskCard.tsx src/components/TodayTaskList.tsx src/App.tsx
git commit -m "feat: add today postponement controls"
```

Expected: commit succeeds and includes the mutation, store, and Today UI files.

---

### Task 4: App Flow Tests For Today Workflows

**Files:**
- Modify: `src/App.test.tsx`

**Interfaces:**
- Consumes: rendered `App now={new Date(2026, 6, 5, 9, 0)}`, `STORAGE_KEY`, `resetTaskerStore`, UI labels from Task 3.
- Produces: UI coverage for category/person/type/priority filters, completion, quick postponement, arbitrary-date postponement, and persistence shape.

- [ ] **Step 1: Add a helper that seeds v2 state for dictionary-heavy UI tests**

In `src/App.test.tsx`, add this helper near `addDailyTask`:

```ts
function seedState(state: unknown) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  resetTaskerStore();
}
```

- [ ] **Step 2: Add UI test for all Today filters**

Add this test inside `describe("App", () => { ... })`:

```tsx
it("filters today list by category, assignee, task type, and priority", async () => {
  seedState({
    tasks: [
      {
        id: "task-1",
        title: "Dom Oli",
        categoryId: "cat-home",
        assigneeId: "person-ola",
        taskTypeId: "type-task",
        priorityId: "priority-normal",
        schedule: { mode: "oneTime", date: "2026-07-05" },
        active: true,
        createdAt: "2026-07-05T08:00:00.000Z",
        updatedAt: "2026-07-05T08:00:00.000Z"
      },
      {
        id: "task-2",
        title: "Praca Jana",
        categoryId: "cat-work",
        assigneeId: "person-jan",
        taskTypeId: "type-deadline",
        priorityId: "priority-high",
        schedule: { mode: "oneTime", date: "2026-07-05" },
        active: true,
        createdAt: "2026-07-05T08:00:00.000Z",
        updatedAt: "2026-07-05T08:00:00.000Z"
      }
    ],
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
  });
  renderApp();
  const user = userEvent.setup();

  const filters = screen.getByRole("region", { name: "Filtry" });
  await user.click(within(filters).getByRole("radio", { name: "Praca" }));
  await user.click(within(filters).getByLabelText("Osoba"));
  await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
  await user.click(within(filters).getByLabelText("Typ"));
  await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
  await user.click(within(filters).getByLabelText("Priorytet"));
  await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");

  const list = screen.getByRole("region", { name: "Zadania na dzisiaj" });
  expect(within(list).getByRole("heading", { name: "Praca Jana" })).toBeInTheDocument();
  expect(within(list).queryByRole("heading", { name: "Dom Oli" })).not.toBeInTheDocument();
});
```

- [ ] **Step 3: Update existing quick-postpone UI test**

Replace the old "postpones a task without recording completion" test body with:

```tsx
renderApp();
const user = userEvent.setup();
await addDailyTask("Podlac rosliny", "Dom", "Ola");

await user.click(screen.getByRole("button", { name: "Odloz na jutro" }));

expect(screen.queryByRole("heading", { name: "Podlac rosliny" })).not.toBeInTheDocument();
const stored = localStorage.getItem(STORAGE_KEY) ?? "";
expect(stored).toContain('"postponements"');
expect(stored).toContain('"toDate":"2026-07-06"');
expect(stored).not.toContain("completedDate");
```

- [ ] **Step 4: Add arbitrary-date postponement UI test**

Add this test:

```tsx
it("postpones a task to a selected date without recording completion", async () => {
  renderApp();
  const user = userEvent.setup();
  await addDailyTask("Podlac rosliny", "Dom", "Ola");

  await user.type(screen.getByLabelText("Data odlozenia: Podlac rosliny"), "2026-07-12");
  await user.click(screen.getByRole("button", { name: "Odloz do daty" }));

  expect(screen.queryByRole("heading", { name: "Podlac rosliny" })).not.toBeInTheDocument();
  const stored = localStorage.getItem(STORAGE_KEY) ?? "";
  expect(stored).toContain('"fromDate":"2026-07-05"');
  expect(stored).toContain('"toDate":"2026-07-12"');
  expect(stored).not.toContain("completedDate");
});
```

- [ ] **Step 5: Add UI test for recurring completion behavior**

Add this test:

```tsx
it("keeps recurring completion cycle based on the actual completion date", async () => {
  seedState({
    tasks: [
      {
        id: "task-1",
        title: "Przeglad",
        categoryId: "cat-home",
        assigneeId: "person-ola",
        taskTypeId: "type-task",
        priorityId: "priority-normal",
        schedule: { mode: "recurring", startDate: "2026-07-01", recurrence: { type: "weekly" } },
        active: true,
        createdAt: "2026-07-01T08:00:00.000Z",
        updatedAt: "2026-07-01T08:00:00.000Z"
      }
    ],
    categories: [{ id: "cat-home", name: "Dom", color: "#40c057" }],
    assignees: [{ id: "person-ola", name: "Ola" }],
    taskTypes: [{ id: "type-task", name: "Zadanie", active: true, order: 0 }],
    priorities: [{ id: "priority-normal", name: "Normalny", active: true, order: 0, color: "#868e96" }],
    completions: [],
    postponements: []
  });
  render(
    <MantineProvider>
      <App now={new Date(2026, 6, 3, 9, 0)} />
    </MantineProvider>
  );
  const user = userEvent.setup();

  await user.click(screen.getByRole("button", { name: "Wykonane" }));

  const stored = localStorage.getItem(STORAGE_KEY) ?? "";
  expect(stored).toContain('"scheduledDate":"2026-07-01"');
  expect(stored).toContain('"completedDate":"2026-07-03"');
});
```

- [ ] **Step 6: Run App tests**

Run:

```bash
npm run test:run -- src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit Task 4**

Run:

```bash
git add src/App.test.tsx
git commit -m "test: cover today postponement flows"
```

Expected: commit succeeds and includes only `src/App.test.tsx`.

---

### Task 5: Full Verification

**Files:**
- No source edits expected.

**Interfaces:**
- Consumes: all implementation tasks.
- Produces: verified Today workflow with passing domain tests, UI tests, and production build.

- [ ] **Step 1: Run focused domain verification**

Run:

```bash
npm run test:run -- src/domain/tasks.test.ts src/domain/todayList.test.ts src/domain/recurrence.test.ts src/domain/dates.test.ts
```

Expected: PASS for all listed test files.

- [ ] **Step 2: Run focused UI verification**

Run:

```bash
npm run test:run -- src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run the full test suite**

Run:

```bash
npm run test:run
```

Expected: PASS with all Vitest suites exiting code 0.

- [ ] **Step 4: Run the production build**

Run:

```bash
npm run build
```

Expected: PASS; TypeScript exits without errors and Vite finishes building the app.

- [ ] **Step 5: Inspect git status**

Run:

```bash
git status --short
```

Expected: clean working tree if all task commits were made. If execution intentionally did not commit, expected output lists only files changed by this plan's tasks.

---

## Self-Review

**Spec coverage:** This plan covers the requested slice of the functional spec: the target Today list, one-time tasks, recurring tasks, overdue tasks, category/person/type/priority filters, completion, postponement to tomorrow, arbitrary-date postponement, and unchanged recurring-cycle behavior. It intentionally excludes full calendar UI, history UI, import, export, and dictionary CRUD.

**Placeholder scan:** The plan contains no unresolved implementation markers. The word "placeholder" is not used as a future work instruction, and every code-changing step includes concrete code or an exact replacement target.

**Type consistency:** The plan consistently uses the v2 foundation names `Task.schedule`, `TodayFilters.categoryId`, `TodayFilters.assigneeId`, `TodayFilters.taskTypeId`, `TodayFilters.priorityId`, `TodayTask.taskType`, `TodayTask.priority`, `postponeTask(taskId, scheduledDate, toDate, now?)`, and `postponeTaskToTomorrow(taskId, scheduledDate, now?)`.

**Execution note:** This planning task edited only `docs/superpowers/plans/2026-07-07-tasker-today-postponement.md`. Do not implement application code until a user explicitly starts plan execution.
