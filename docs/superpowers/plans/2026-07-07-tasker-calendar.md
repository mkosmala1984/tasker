# Tasker Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Calendar planning view so users can browse days, see one-time tasks and future recurring occurrences, select a day, create a task for that date, edit a task from that day, and postpone a task to a selected date.

**Architecture:** Build calendar behavior as testable domain logic in `src/domain/calendar.ts`, keep arbitrary-date postponement in existing task/store mutations, and replace the foundation Calendar placeholder with focused UI components under `src/components/calendar/`. The Calendar view consumes the v2 task model from the foundation plan and the task form/navigation behavior from the task module; it must not add history, import, or export behavior.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, React Testing Library, Mantine, Zustand, browser `localStorage`.

## Global Constraints

- Local-only application: no accounts, backend, or synchronization.
- Dates are calendar dates in `YYYY-MM-DD`, without time or timezone.
- Interface copy remains Polish.
- Calendar is an additional planning view; Today remains the start view.
- Show one-time tasks and future recurring task occurrences.
- Allow adding a task for the selected date, editing a task from a calendar day, and postponing a task to any selected date.
- Do not implement history, import, or export in this plan.
- Keep date and recurrence logic outside React components and covered by unit tests.
- Use ASCII in source and docs unless the touched file already intentionally uses non-ASCII.
- This plan assumes `docs/superpowers/plans/2026-07-07-tasker-foundation.md` has been implemented first: `Task.schedule`, `AppView`, task types, priorities, category colors, and Calendar navigation placeholder exist.
- This plan assumes the task module already provides a task form flow compatible with `TaskDraft.schedule` and can save both `oneTime` and `recurring` tasks. If the task module exposes different file names, keep the interfaces in this plan and adapt only the import paths.

---

## File Structure

- Create `src/domain/calendar.ts`: pure calendar projection helpers. It owns month grid calculation, day selection details, one-time task placement, recurring occurrence generation inside a bounded range, and postponed target placement.
- Create `src/domain/calendar.test.ts`: tests for month grids, selected-day details, one-time tasks, future recurring occurrences, completed recurring shifts, inactive tasks, and postponed tasks.
- Modify `src/domain/tasks.ts`: keep existing `postponeTask(state, taskId, fromDate, toDate, createdAt, idFactory)` as the domain primitive; reject a `toDate` value that is not a valid `YYYY-MM-DD` calendar date.
- Modify `src/domain/tasks.test.ts`: add coverage for arbitrary-date postponement and invalid postponement dates.
- Modify `src/state/taskerStore.ts`: add selected calendar date state and `postponeTaskToDate(taskId, fromDate, toDate, now?)`; keep existing `postponeTask(taskId, now?)` as the Today shortcut for tomorrow.
- Create `src/state/taskerStore.test.ts`: test store-level selected date updates and arbitrary-date postponement persistence.
- Create `src/components/calendar/CalendarView.tsx`: top-level Calendar view. It renders month controls, day grid, selected day panel, and wires add/edit/postpone actions to the store/task module.
- Create `src/components/calendar/CalendarMonthGrid.tsx`: presentational month grid with selectable days and compact task indicators.
- Create `src/components/calendar/CalendarDayPanel.tsx`: selected-day task list with actions: add for date, edit, postpone to date.
- Create `src/components/calendar/CalendarView.test.tsx`: UI tests for selecting a day, seeing tasks, adding for a date, editing from a day, and postponing to a selected date.
- Modify `src/App.tsx`: replace the foundation Calendar placeholder with `CalendarView`; keep other placeholders unchanged.
- Modify `src/App.test.tsx`: update navigation test so the Calendar button opens the real Calendar view.

---

### Task 1: Calendar Domain Projection

**Files:**
- Create: `src/domain/calendar.ts`
- Create: `src/domain/calendar.test.ts`

**Interfaces:**
- Consumes: `AppState`, `Task`, `TaskSchedule`, `Postponement`, `Completion`, `compareDates`, `addDays`, `addMonths`, `getNextScheduledDate`, `getCurrentScheduledDate`.
- Produces:
  - `type CalendarTaskKind = "oneTime" | "recurring"`
  - `type CalendarTaskItem = { task: Task; scheduledDate: string; displayDate: string; kind: CalendarTaskKind; isPostponed: boolean }`
  - `type CalendarDay = { date: string; isCurrentMonth: boolean; isToday: boolean; items: CalendarTaskItem[] }`
  - `type CalendarDayDetails = { date: string; items: CalendarTaskItem[] }`
  - `getCalendarMonthDays(state: AppState, monthDate: string, today: string): CalendarDay[]`
  - `getCalendarDayDetails(state: AppState, date: string): CalendarDayDetails`

- [ ] **Step 1: Write failing calendar domain tests**

Create `src/domain/calendar.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getCalendarDayDetails, getCalendarMonthDays } from "./calendar";
import type { AppState, Task } from "./types";

const baseState: AppState = {
  tasks: [],
  categories: [{ id: "cat-home", name: "Dom", color: "#40c057" }],
  assignees: [{ id: "person-ola", name: "Ola" }],
  taskTypes: [{ id: "type-task", name: "Zadanie", active: true, order: 0 }],
  priorities: [{ id: "priority-normal", name: "Normalny", active: true, order: 0, color: "#868e96" }],
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
    schedule: { mode: "oneTime", date: "2026-07-08" },
    active: true,
    createdAt: "2026-07-01T08:00:00.000Z",
    updatedAt: "2026-07-01T08:00:00.000Z",
    ...overrides
  };
}

describe("calendar domain", () => {
  it("builds a complete Monday-first month grid and marks today", () => {
    const days = getCalendarMonthDays(baseState, "2026-07-15", "2026-07-07");

    expect(days).toHaveLength(35);
    expect(days[0]).toMatchObject({ date: "2026-06-29", isCurrentMonth: false });
    expect(days[2]).toMatchObject({ date: "2026-07-01", isCurrentMonth: true });
    expect(days[8]).toMatchObject({ date: "2026-07-07", isToday: true });
    expect(days[34]).toMatchObject({ date: "2026-08-02", isCurrentMonth: false });
  });

  it("places one-time tasks on their calendar date", () => {
    const state = { ...baseState, tasks: [task()] };

    const details = getCalendarDayDetails(state, "2026-07-08");

    expect(details.items.map((item) => item.task.title)).toEqual(["Podlac rosliny"]);
    expect(details.items[0]).toMatchObject({
      scheduledDate: "2026-07-08",
      displayDate: "2026-07-08",
      kind: "oneTime",
      isPostponed: false
    });
  });

  it("generates future recurring occurrences within the visible month", () => {
    const state: AppState = {
      ...baseState,
      tasks: [
        task({
          id: "task-recurring",
          title: "Trening",
          schedule: { mode: "recurring", startDate: "2026-07-02", recurrence: { type: "weekly" } }
        })
      ]
    };

    const days = getCalendarMonthDays(state, "2026-07-01", "2026-07-07");
    const datesWithItems = days.filter((day) => day.items.length > 0).map((day) => day.date);

    expect(datesWithItems).toEqual(["2026-07-02", "2026-07-09", "2026-07-16", "2026-07-23", "2026-07-30"]);
  });

  it("starts recurring projections from the next occurrence after the latest completion", () => {
    const state: AppState = {
      ...baseState,
      tasks: [
        task({
          id: "task-recurring",
          title: "Trening",
          schedule: { mode: "recurring", startDate: "2026-07-01", recurrence: { type: "weekly" } }
        })
      ],
      completions: [
        {
          id: "completion-1",
          taskId: "task-recurring",
          scheduledDate: "2026-07-01",
          completedDate: "2026-07-03"
        }
      ]
    };

    const days = getCalendarMonthDays(state, "2026-07-01", "2026-07-07");
    const datesWithItems = days.filter((day) => day.items.length > 0).map((day) => day.date);

    expect(datesWithItems).toEqual(["2026-07-10", "2026-07-17", "2026-07-24", "2026-07-31"]);
  });

  it("does not show inactive tasks", () => {
    const state = { ...baseState, tasks: [task({ active: false })] };

    expect(getCalendarDayDetails(state, "2026-07-08").items).toEqual([]);
  });

  it("places a postponed task on the postponed target date", () => {
    const state: AppState = {
      ...baseState,
      tasks: [task()],
      postponements: [
        {
          id: "postponement-1",
          taskId: "task-1",
          fromDate: "2026-07-08",
          toDate: "2026-07-12",
          createdAt: "2026-07-08T08:00:00.000Z"
        }
      ]
    };

    expect(getCalendarDayDetails(state, "2026-07-08").items).toEqual([]);
    expect(getCalendarDayDetails(state, "2026-07-12").items[0]).toMatchObject({
      scheduledDate: "2026-07-08",
      displayDate: "2026-07-12",
      isPostponed: true
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/domain/calendar.test.ts`

Expected: FAIL with an import error for `./calendar`.

- [ ] **Step 3: Implement calendar domain helpers**

Create `src/domain/calendar.ts`:

```ts
import { addDays, compareDates, isDateString } from "./dates";
import { getNextScheduledDate } from "./recurrence";
import { getCurrentScheduledDate } from "./todayList";
import type { AppState, Postponement, Task } from "./types";

export type CalendarTaskKind = "oneTime" | "recurring";

export type CalendarTaskItem = {
  task: Task;
  scheduledDate: string;
  displayDate: string;
  kind: CalendarTaskKind;
  isPostponed: boolean;
};

export type CalendarDay = {
  date: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  items: CalendarTaskItem[];
};

export type CalendarDayDetails = {
  date: string;
  items: CalendarTaskItem[];
};

function monthStart(value: string): string {
  if (!isDateString(value)) {
    throw new Error(`Invalid month date: ${value}`);
  }
  return `${value.slice(0, 7)}-01`;
}

function monthNumber(value: string): string {
  return value.slice(0, 7);
}

function dayOfWeekMondayFirst(value: string): number {
  const date = new Date(`${value}T00:00:00.000Z`);
  return (date.getUTCDay() + 6) % 7;
}

function visibleRange(monthDate: string): { start: string; end: string; month: string } {
  const startOfMonth = monthStart(monthDate);
  const firstOffset = dayOfWeekMondayFirst(startOfMonth);
  const start = addDays(startOfMonth, -firstOffset);
  let end = addDays(start, 34);

  while (monthNumber(end) === monthNumber(startOfMonth)) {
    end = addDays(end, 7);
  }

  return { start, end, month: monthNumber(startOfMonth) };
}

function latestPostponementFor(taskId: string, scheduledDate: string, postponements: Postponement[]): Postponement | undefined {
  return postponements
    .filter((postponement) => postponement.taskId === taskId && postponement.fromDate === scheduledDate)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
}

function pushOccurrence(items: CalendarTaskItem[], state: AppState, task: Task, scheduledDate: string, kind: CalendarTaskKind) {
  const postponement = latestPostponementFor(task.id, scheduledDate, state.postponements);
  items.push({
    task,
    scheduledDate,
    displayDate: postponement?.toDate ?? scheduledDate,
    kind,
    isPostponed: postponement !== undefined
  });
}

function collectTaskItems(state: AppState, rangeStart: string, rangeEnd: string): CalendarTaskItem[] {
  const items: CalendarTaskItem[] = [];

  for (const task of state.tasks.filter((candidate) => candidate.active)) {
    if (task.schedule.mode === "oneTime") {
      pushOccurrence(items, state, task, task.schedule.date, "oneTime");
      continue;
    }

    const firstScheduledDate = getCurrentScheduledDate(task, state.completions);
    if (firstScheduledDate === undefined) {
      continue;
    }

    let scheduledDate = firstScheduledDate;
    while (compareDates(scheduledDate, rangeEnd) <= 0) {
      if (compareDates(scheduledDate, rangeStart) >= 0) {
        pushOccurrence(items, state, task, scheduledDate, "recurring");
      }
      scheduledDate = getNextScheduledDate(scheduledDate, task.schedule.recurrence);
    }
  }

  return items
    .filter((item) => compareDates(item.displayDate, rangeStart) >= 0 && compareDates(item.displayDate, rangeEnd) <= 0)
    .sort((left, right) => {
      const byDisplayDate = compareDates(left.displayDate, right.displayDate);
      if (byDisplayDate !== 0) {
        return byDisplayDate;
      }
      return left.task.title.localeCompare(right.task.title, "pl");
    });
}

export function getCalendarMonthDays(state: AppState, monthDate: string, today: string): CalendarDay[] {
  const range = visibleRange(monthDate);
  const items = collectTaskItems(state, range.start, range.end);
  const days: CalendarDay[] = [];

  for (let date = range.start; compareDates(date, range.end) <= 0; date = addDays(date, 1)) {
    days.push({
      date,
      isCurrentMonth: monthNumber(date) === range.month,
      isToday: date === today,
      items: items.filter((item) => item.displayDate === date)
    });
  }

  return days;
}

export function getCalendarDayDetails(state: AppState, date: string): CalendarDayDetails {
  const items = collectTaskItems(state, date, date);
  return { date, items };
}
```

- [ ] **Step 4: Run calendar domain tests**

Run: `npm run test:run -- src/domain/calendar.test.ts`

Expected: PASS.

- [ ] **Step 5: Run date and recurrence regression tests**

Run: `npm run test:run -- src/domain/dates.test.ts src/domain/recurrence.test.ts src/domain/todayList.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit domain projection**

Run:

```bash
git add src/domain/calendar.ts src/domain/calendar.test.ts
git commit -m "feat: add calendar task projection"
```

Expected: commit succeeds with only the two calendar domain files.

---

### Task 2: Store State For Calendar Selection And Arbitrary Postponement

**Files:**
- Modify: `src/domain/tasks.ts`
- Modify: `src/domain/tasks.test.ts`
- Modify: `src/state/taskerStore.ts`
- Create: `src/state/taskerStore.test.ts`

**Interfaces:**
- Consumes: `postponeTask(state, taskId, fromDate, toDate, createdAt, idFactory)`, `getTodayString`, `addDays`.
- Produces:
  - `TaskerStore.selectedCalendarDate: string`
  - `TaskerStore.setSelectedCalendarDate(date: string): void`
  - `TaskerStore.postponeTaskToDate(taskId: string, fromDate: string, toDate: string, now?: Date): void`

- [ ] **Step 1: Add arbitrary-date postponement tests**

In `src/domain/tasks.test.ts`, add these cases inside the existing `describe("task mutations", ...)` block:

```ts
it("postpones a task to an arbitrary future date", () => {
  const postponed = postponeTask(
    stateWithOneTask,
    "task-1",
    "2026-07-08",
    "2026-07-20",
    "2026-07-08T08:00:00.000Z",
    ids("postponement-1")
  );

  expect(postponed.completions).toHaveLength(0);
  expect(postponed.postponements).toEqual([
    {
      id: "postponement-1",
      taskId: "task-1",
      fromDate: "2026-07-08",
      toDate: "2026-07-20",
      createdAt: "2026-07-08T08:00:00.000Z"
    }
  ]);
});

it("rejects invalid arbitrary postponement dates", () => {
  expect(() =>
    postponeTask(
      stateWithOneTask,
      "task-1",
      "2026-07-08",
      "2026-02-31",
      "2026-07-08T08:00:00.000Z",
      ids("postponement-1")
    )
  ).toThrow("toDate must be a valid calendar date");
});
```

If the task module renamed `stateWithOneTask`, create it in the test file with one active v2 task:

```ts
const stateWithOneTask: AppState = {
  ...emptyState,
  tasks: [
    {
      id: "task-1",
      title: "Podlac rosliny",
      categoryId: "cat-1",
      assigneeId: "assignee-1",
      taskTypeId: DEFAULT_TASK_TYPE_ID,
      priorityId: DEFAULT_PRIORITY_ID,
      schedule: { mode: "oneTime", date: "2026-07-08" },
      active: true,
      createdAt: "2026-07-05T08:00:00.000Z",
      updatedAt: "2026-07-05T08:00:00.000Z"
    }
  ],
  categories: [{ id: "cat-1", name: "Dom", color: "#40c057" }],
  assignees: [{ id: "assignee-1", name: "Ola" }]
};
```

- [ ] **Step 2: Run task mutation tests and verify the new validation fails**

Run: `npm run test:run -- src/domain/tasks.test.ts`

Expected: FAIL on `rejects invalid arbitrary postponement dates` because `postponeTask` has not validated `toDate` yet.

- [ ] **Step 3: Validate arbitrary postponement dates**

In `src/domain/tasks.ts`, add the import:

```ts
import { isDateString } from "./dates";
```

At the start of `postponeTask`, before returning the new state, add:

```ts
if (!isDateString(toDate)) {
  throw new Error("toDate must be a valid calendar date");
}
```

- [ ] **Step 4: Run task mutation tests**

Run: `npm run test:run -- src/domain/tasks.test.ts`

Expected: PASS.

- [ ] **Step 5: Write store tests for calendar date and arbitrary postponement**

Create `src/state/taskerStore.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { STORAGE_KEY } from "../storage/taskerStorage";
import { resetTaskerStore, useTaskerStore } from "./taskerStore";

beforeEach(() => {
  localStorage.clear();
  resetTaskerStore();
});

describe("taskerStore calendar state", () => {
  it("stores the selected calendar date", () => {
    useTaskerStore.getState().setSelectedCalendarDate("2026-07-20");

    expect(useTaskerStore.getState().selectedCalendarDate).toBe("2026-07-20");
  });

  it("postpones a task to an arbitrary date and persists the change", () => {
    useTaskerStore.getState().addTask(
      {
        title: "Podlac rosliny",
        categoryName: "Dom",
        assigneeName: "Ola",
        schedule: { mode: "oneTime", date: "2026-07-08" },
        active: true
      },
      new Date("2026-07-05T08:00:00.000Z")
    );

    const taskId = useTaskerStore.getState().state.tasks[0].id;
    useTaskerStore
      .getState()
      .postponeTaskToDate(taskId, "2026-07-08", "2026-07-20", new Date("2026-07-08T08:00:00.000Z"));

    expect(useTaskerStore.getState().state.postponements[0]).toMatchObject({
      taskId,
      fromDate: "2026-07-08",
      toDate: "2026-07-20"
    });
    expect(localStorage.getItem(STORAGE_KEY)).toContain("2026-07-20");
  });
});
```

- [ ] **Step 6: Run store tests and verify they fail**

Run: `npm run test:run -- src/state/taskerStore.test.ts`

Expected: FAIL because `selectedCalendarDate`, `setSelectedCalendarDate`, and `postponeTaskToDate` do not exist yet.

- [ ] **Step 7: Add calendar state to the store**

In `src/state/taskerStore.ts`, update the `TaskerStore` type:

```ts
selectedCalendarDate: string;
setSelectedCalendarDate: (date: string) => void;
postponeTaskToDate: (taskId: string, fromDate: string, toDate: string, now?: Date) => void;
```

Update `loadInitialStoreState()` to include today's date:

```ts
const today = getTodayString();
return {
  state: initial.state,
  storageError: initial.error,
  filters: emptyFilters,
  view: "today" as AppView,
  selectedCalendarDate: today
};
```

Add actions in the Zustand object:

```ts
setSelectedCalendarDate: (date) => set({ selectedCalendarDate: date }),
postponeTaskToDate: (taskId, fromDate, toDate, now = new Date()) => {
  set(persist(postponeTask(get().state, taskId, fromDate, toDate, now.toISOString())));
},
```

Keep the existing Today shortcut:

```ts
postponeTask: (taskId, now = new Date()) => {
  const today = getTodayString(now);
  set(persist(postponeTask(get().state, taskId, today, addDays(today, 1), now.toISOString())));
},
```

- [ ] **Step 8: Run store and task tests**

Run: `npm run test:run -- src/state/taskerStore.test.ts src/domain/tasks.test.ts`

Expected: PASS.

- [ ] **Step 9: Commit store changes**

Run:

```bash
git add src/domain/tasks.ts src/domain/tasks.test.ts src/state/taskerStore.ts src/state/taskerStore.test.ts
git commit -m "feat: add calendar date postponement state"
```

Expected: commit succeeds with only task/store changes.

---

### Task 3: Calendar UI Components

**Files:**
- Create: `src/components/calendar/CalendarMonthGrid.tsx`
- Create: `src/components/calendar/CalendarDayPanel.tsx`
- Create: `src/components/calendar/CalendarView.tsx`
- Create: `src/components/calendar/CalendarView.test.tsx`

**Interfaces:**
- Consumes: `getCalendarMonthDays`, `getCalendarDayDetails`, `CalendarTaskItem`, `TaskDraft`, `useTaskerStore`.
- Produces:
  - `CalendarView({ today, onCreateTaskForDate, onEditTask }: Props)`
  - `CalendarMonthGrid({ days, selectedDate, onSelectDate }: Props)`
  - `CalendarDayPanel({ details, onCreateTaskForDate, onEditTask, onPostponeTaskToDate }: Props)`

- [ ] **Step 1: Write Calendar UI tests**

Create `src/components/calendar/CalendarView.test.tsx`:

```tsx
import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetTaskerStore, useTaskerStore } from "../../state/taskerStore";
import { CalendarView } from "./CalendarView";

function renderCalendar() {
  const onCreateTaskForDate = vi.fn();
  const onEditTask = vi.fn();
  render(
    <MantineProvider>
      <CalendarView
        today="2026-07-07"
        onCreateTaskForDate={onCreateTaskForDate}
        onEditTask={onEditTask}
      />
    </MantineProvider>
  );
  return { onCreateTaskForDate, onEditTask };
}

beforeEach(() => {
  localStorage.clear();
  resetTaskerStore();
});

describe("CalendarView", () => {
  it("selects a day and starts creating a task for that date", async () => {
    const user = userEvent.setup();
    const { onCreateTaskForDate } = renderCalendar();

    await user.click(screen.getByRole("button", { name: /8 lipca 2026/ }));
    await user.click(screen.getByRole("button", { name: "Dodaj zadanie na ten dzien" }));

    expect(onCreateTaskForDate).toHaveBeenCalledWith("2026-07-08");
  });

  it("shows one-time tasks in the selected day and starts editing from the day panel", async () => {
    useTaskerStore.getState().addTask(
      {
        title: "Zaplacic rachunek",
        categoryName: "Finanse",
        assigneeName: "Ola",
        schedule: { mode: "oneTime", date: "2026-07-08" },
        active: true
      },
      new Date("2026-07-05T08:00:00.000Z")
    );
    const taskId = useTaskerStore.getState().state.tasks[0].id;
    const user = userEvent.setup();
    const { onEditTask } = renderCalendar();

    await user.click(screen.getByRole("button", { name: /8 lipca 2026/ }));

    expect(screen.getByText("Zaplacic rachunek")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edytuj Zaplacic rachunek" }));

    expect(onEditTask).toHaveBeenCalledWith(taskId);
  });

  it("shows future recurring occurrences", async () => {
    useTaskerStore.getState().addTask(
      {
        title: "Trening",
        categoryName: "Zdrowie",
        assigneeName: "Ola",
        schedule: { mode: "recurring", startDate: "2026-07-02", recurrence: { type: "weekly" } },
        active: true
      },
      new Date("2026-07-01T08:00:00.000Z")
    );
    const user = userEvent.setup();
    renderCalendar();

    await user.click(screen.getByRole("button", { name: /9 lipca 2026/ }));

    expect(screen.getByText("Trening")).toBeInTheDocument();
    expect(screen.getByText("Cykliczne")).toBeInTheDocument();
  });

  it("postpones a selected-day task to a chosen date", async () => {
    useTaskerStore.getState().addTask(
      {
        title: "Zadzwonic",
        categoryName: "Dom",
        assigneeName: "Ola",
        schedule: { mode: "oneTime", date: "2026-07-08" },
        active: true
      },
      new Date("2026-07-05T08:00:00.000Z")
    );
    const user = userEvent.setup();
    renderCalendar();

    await user.click(screen.getByRole("button", { name: /8 lipca 2026/ }));
    await user.type(screen.getByLabelText("Odloz na date"), "2026-07-20");
    await user.click(screen.getByRole("button", { name: "Odloz Zadzwonic" }));

    expect(useTaskerStore.getState().state.postponements[0]).toMatchObject({
      fromDate: "2026-07-08",
      toDate: "2026-07-20"
    });
  });
});
```

- [ ] **Step 2: Run Calendar UI tests and verify they fail**

Run: `npm run test:run -- src/components/calendar/CalendarView.test.tsx`

Expected: FAIL with an import error for `./CalendarView`.

- [ ] **Step 3: Create the month grid component**

Create `src/components/calendar/CalendarMonthGrid.tsx`:

```tsx
import { Badge, Button, SimpleGrid, Stack, Text } from "@mantine/core";
import type { CalendarDay } from "../../domain/calendar";
import { formatPolishDateLabel } from "../../domain/dates";

type Props = {
  days: CalendarDay[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
};

const WEEKDAYS = ["Pon", "Wto", "Sro", "Czw", "Pia", "Sob", "Nie"];

export function CalendarMonthGrid({ days, selectedDate, onSelectDate }: Props) {
  return (
    <Stack gap="xs">
      <SimpleGrid cols={7} spacing="xs">
        {WEEKDAYS.map((day) => (
          <Text key={day} fw={700} size="sm" ta="center">
            {day}
          </Text>
        ))}
      </SimpleGrid>

      <SimpleGrid cols={7} spacing="xs">
        {days.map((day) => {
          const label = formatPolishDateLabel(day.date);
          const selected = day.date === selectedDate;

          return (
            <Button
              key={day.date}
              type="button"
              variant={selected ? "filled" : day.isToday ? "light" : "default"}
              color={day.isCurrentMonth ? "blue" : "gray"}
              aria-label={`${label}${day.items.length > 0 ? `, ${day.items.length} zadania` : ""}`}
              onClick={() => onSelectDate(day.date)}
              styles={{ root: { minHeight: 76, height: "auto", padding: 8 } }}
            >
              <Stack gap={4} align="center">
                <Text size="sm" fw={day.isToday ? 700 : 500}>
                  {Number(day.date.slice(8, 10))}
                </Text>
                {day.items.length > 0 ? (
                  <Badge size="xs" variant={selected ? "white" : "light"}>
                    {day.items.length}
                  </Badge>
                ) : null}
              </Stack>
            </Button>
          );
        })}
      </SimpleGrid>
    </Stack>
  );
}
```

- [ ] **Step 4: Create the selected day panel**

Create `src/components/calendar/CalendarDayPanel.tsx`:

```tsx
import { Badge, Button, Card, Group, Stack, Text, TextInput, Title } from "@mantine/core";
import { useState } from "react";
import type { CalendarDayDetails, CalendarTaskItem } from "../../domain/calendar";
import { formatPolishDateLabel } from "../../domain/dates";

type Props = {
  details: CalendarDayDetails;
  onCreateTaskForDate: (date: string) => void;
  onEditTask: (taskId: string) => void;
  onPostponeTaskToDate: (taskId: string, fromDate: string, toDate: string) => void;
};

function kindLabel(item: CalendarTaskItem): string {
  if (item.isPostponed) {
    return "Odlozone";
  }
  return item.kind === "oneTime" ? "Jednorazowe" : "Cykliczne";
}

export function CalendarDayPanel({ details, onCreateTaskForDate, onEditTask, onPostponeTaskToDate }: Props) {
  const [postponeDates, setPostponeDates] = useState<Record<string, string>>({});

  return (
    <Card withBorder radius="md" p="lg">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" gap="md">
          <div>
            <Title order={2}>{formatPolishDateLabel(details.date)}</Title>
            <Text c="dimmed">{details.items.length === 0 ? "Brak zadan w tym dniu" : `${details.items.length} zadania w tym dniu`}</Text>
          </div>
          <Button type="button" onClick={() => onCreateTaskForDate(details.date)}>
            Dodaj zadanie na ten dzien
          </Button>
        </Group>

        {details.items.map((item) => {
          const postponeValue = postponeDates[item.task.id] ?? "";

          return (
            <Card key={`${item.task.id}-${item.scheduledDate}-${item.displayDate}`} withBorder radius="sm" p="md">
              <Stack gap="sm">
                <Group justify="space-between" align="flex-start" gap="xs">
                  <Title order={3}>{item.task.title}</Title>
                  <Badge variant="light">{kindLabel(item)}</Badge>
                </Group>
                {item.isPostponed ? (
                  <Text size="sm" c="dimmed">
                    Pierwotna data: {item.scheduledDate}
                  </Text>
                ) : null}
                <Group gap="xs" align="end">
                  <Button type="button" variant="default" aria-label={`Edytuj ${item.task.title}`} onClick={() => onEditTask(item.task.id)}>
                    Edytuj
                  </Button>
                  <TextInput
                    label="Odloz na date"
                    type="date"
                    value={postponeValue}
                    onChange={(event) => setPostponeDates({ ...postponeDates, [item.task.id]: event.currentTarget.value })}
                  />
                  <Button
                    type="button"
                    variant="light"
                    aria-label={`Odloz ${item.task.title}`}
                    disabled={postponeValue.length === 0}
                    onClick={() => onPostponeTaskToDate(item.task.id, item.scheduledDate, postponeValue)}
                  >
                    Odloz
                  </Button>
                </Group>
              </Stack>
            </Card>
          );
        })}
      </Stack>
    </Card>
  );
}
```

- [ ] **Step 5: Create the Calendar view**

Create `src/components/calendar/CalendarView.tsx`:

```tsx
import { Button, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { useMemo, useState } from "react";
import { addMonths, formatPolishDateLabel } from "../../domain/dates";
import { getCalendarDayDetails, getCalendarMonthDays } from "../../domain/calendar";
import { useTaskerStore } from "../../state/taskerStore";
import { CalendarDayPanel } from "./CalendarDayPanel";
import { CalendarMonthGrid } from "./CalendarMonthGrid";

type Props = {
  today: string;
  onCreateTaskForDate: (date: string) => void;
  onEditTask: (taskId: string) => void;
};

export function CalendarView({ today, onCreateTaskForDate, onEditTask }: Props) {
  const state = useTaskerStore((store) => store.state);
  const selectedDate = useTaskerStore((store) => store.selectedCalendarDate);
  const setSelectedDate = useTaskerStore((store) => store.setSelectedCalendarDate);
  const postponeTaskToDate = useTaskerStore((store) => store.postponeTaskToDate);
  const [monthDate, setMonthDate] = useState(selectedDate);

  const days = useMemo(() => getCalendarMonthDays(state, monthDate, today), [state, monthDate, today]);
  const details = useMemo(() => getCalendarDayDetails(state, selectedDate), [state, selectedDate]);

  return (
    <Paper withBorder p="lg" radius="md" shadow="xs">
      <Stack gap="md">
        <Group justify="space-between" align="center" gap="md" wrap="wrap">
          <div>
            <Title order={2}>Kalendarz</Title>
            <Text c="dimmed">Planowanie zadan wedlug dat</Text>
          </div>
          <Group gap="xs">
            <Button type="button" variant="default" onClick={() => setMonthDate(addMonths(monthDate, -1))}>
              Poprzedni miesiac
            </Button>
            <Text fw={700}>{formatPolishDateLabel(`${monthDate.slice(0, 7)}-01`)}</Text>
            <Button type="button" variant="default" onClick={() => setMonthDate(addMonths(monthDate, 1))}>
              Nastepny miesiac
            </Button>
          </Group>
        </Group>

        <CalendarMonthGrid days={days} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
        <CalendarDayPanel
          details={details}
          onCreateTaskForDate={onCreateTaskForDate}
          onEditTask={onEditTask}
          onPostponeTaskToDate={postponeTaskToDate}
        />
      </Stack>
    </Paper>
  );
}
```

- [ ] **Step 6: Run Calendar UI tests**

Run: `npm run test:run -- src/components/calendar/CalendarView.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit Calendar UI components**

Run:

```bash
git add src/components/calendar/CalendarMonthGrid.tsx src/components/calendar/CalendarDayPanel.tsx src/components/calendar/CalendarView.tsx src/components/calendar/CalendarView.test.tsx
git commit -m "feat: add calendar planning view"
```

Expected: commit succeeds with only Calendar UI component files.

---

### Task 4: Wire Calendar Into App And Task Flow

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Consumes: `CalendarView`, store `setView("calendar")`, task module create/edit entry points.
- Produces: Calendar navigation opens the real Calendar view and task actions route to the task module.

- [ ] **Step 1: Update App tests for real Calendar navigation**

In `src/App.test.tsx`, replace the foundation placeholder assertion:

```tsx
expect(screen.getByText("Tutaj powstanie widok planowania zadan wedlug dat.")).toBeInTheDocument();
```

with:

```tsx
expect(screen.getByText("Planowanie zadan wedlug dat")).toBeInTheDocument();
expect(screen.getByRole("button", { name: /7 lipca 2026/ })).toBeInTheDocument();
```

Add this integration test:

```tsx
it("opens the task flow with a calendar-selected date", async () => {
  renderApp({ now: new Date("2026-07-07T08:00:00.000Z") });
  const user = userEvent.setup();

  await user.click(screen.getByRole("button", { name: "Kalendarz" }));
  await user.click(screen.getByRole("button", { name: /8 lipca 2026/ }));
  await user.click(screen.getByRole("button", { name: "Dodaj zadanie na ten dzien" }));

  expect(screen.getByRole("heading", { name: "Zadania" })).toBeInTheDocument();
  expect(screen.getByDisplayValue("2026-07-08")).toBeInTheDocument();
});
```

If the task module uses a route-like state instead of rendering the form inside `App`, assert the public task form behavior it provides: selected view is `tasks`, create mode is active, and the date field is prefilled with `2026-07-08`.

- [ ] **Step 2: Run App tests and verify Calendar wiring fails**

Run: `npm run test:run -- src/App.test.tsx`

Expected: FAIL because `App.tsx` still renders the Calendar placeholder and does not pass calendar task actions into the task flow.

- [ ] **Step 3: Replace the Calendar placeholder in App**

In `src/App.tsx`, import:

```ts
import { CalendarView } from "./components/calendar/CalendarView";
```

Add these handlers inside `App`, using the task module's existing create/edit entry points:

```ts
function handleCreateTaskForDate(date: string) {
  startCreatingTask({
    schedule: { mode: "oneTime", date }
  });
  setView("tasks");
}

function handleEditTaskFromCalendar(taskId: string) {
  startEditingTask(taskId);
  setView("tasks");
}
```

If the task module exposes different names, keep the behavior identical:

```ts
setTaskFormIntent({ mode: "create", initialDate: date });
setView("tasks");
```

and:

```ts
setTaskFormIntent({ mode: "edit", taskId });
setView("tasks");
```

Replace the foundation Calendar placeholder branch:

```tsx
{view === "calendar" ? <PlaceholderView title="Kalendarz" description="Tutaj powstanie widok planowania zadan wedlug dat." /> : null}
```

with:

```tsx
{view === "calendar" ? (
  <CalendarView
    today={today}
    onCreateTaskForDate={handleCreateTaskForDate}
    onEditTask={handleEditTaskFromCalendar}
  />
) : null}
```

- [ ] **Step 4: Run App tests**

Run: `npm run test:run -- src/App.test.tsx`

Expected: PASS.

- [ ] **Step 5: Run Calendar and App tests together**

Run: `npm run test:run -- src/components/calendar/CalendarView.test.tsx src/App.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit App wiring**

Run:

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat: wire calendar into app navigation"
```

Expected: commit succeeds with only App wiring files.

---

### Task 5: Verification And Regression Pass

**Files:**
- No source files unless verification exposes a defect in files modified by Tasks 1-4.

**Interfaces:**
- Consumes: all test suites and production build.
- Produces: verified Calendar slice ready for review.

- [ ] **Step 1: Run all unit and UI tests**

Run:

```bash
npm run test:run
```

Expected: PASS. The output should report all Vitest suites passing, including:

```text
src/domain/calendar.test.ts
src/components/calendar/CalendarView.test.tsx
src/state/taskerStore.test.ts
src/App.test.tsx
```

- [ ] **Step 2: Run production build**

Run:

```bash
npm run build
```

Expected: PASS with Vite producing a production bundle and no TypeScript errors.

- [ ] **Step 3: Manual browser smoke test**

Run:

```bash
npm run dev
```

Expected: Vite prints a local URL such as:

```text
Local: http://localhost:5173/
```

Open the URL and verify:

- Today remains the first view.
- Clicking `Kalendarz` opens the real Calendar view.
- Selecting `8 lipca 2026` changes the selected-day panel.
- `Dodaj zadanie na ten dzien` opens the task form with `2026-07-08`.
- A one-time task saved for `2026-07-08` appears on that day.
- A recurring weekly task starting `2026-07-02` appears on `2026-07-02`, `2026-07-09`, `2026-07-16`, `2026-07-23`, and `2026-07-30`.
- Editing a task from the day panel opens the task form for that task.
- Entering `2026-07-20` in `Odloz na date` and clicking the task postpone button moves the task from its original day to `2026-07-20`.

Stop the dev server after the smoke test.

- [ ] **Step 4: Check changed files**

Run:

```bash
git status --short
```

Expected: clean working tree if all task commits were made, or only intentional uncommitted files if the implementer is batching commits in the current environment.

---

## Self-Review

**Spec coverage:** This plan covers the Calendar scope from the functional spec: browsing tasks by date, showing future recurring occurrences, showing one-time tasks, selecting a day, adding a new task for the selected date, editing a task from a day, and postponing a task to a selected date. It keeps Today as the start view and does not add history, import, or export.

**Placeholder scan:** The plan contains no unresolved implementation markers. The only conditional wording is constrained to integration with the separate task module because that module is outside this plan's source context; required behavior and fallback interface names are still concrete.

**Type consistency:** Calendar domain types are introduced before UI consumption. `postponeTaskToDate(taskId, fromDate, toDate, now?)`, `selectedCalendarDate`, and `setSelectedCalendarDate(date)` are defined before `CalendarView` uses them. `CalendarTaskItem.scheduledDate` remains the original occurrence date, while `displayDate` is the date where the item appears after postponement.
