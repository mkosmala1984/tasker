# Tasker MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-only React app for recurring tasks, today's due list, completion, postponement, filtering, editing, deactivation, and durable browser storage.

**Architecture:** Use a Vite React TypeScript app with domain logic isolated under `src/domain/`, persistence isolated under `src/storage/`, and React components under `src/components/`. UI components call domain functions through a small state hook so recurrence, today-list, task mutation, and storage behavior remain independently testable.

**Tech Stack:** React, Vite, TypeScript, Vitest, React Testing Library, `localStorage`, CSS.

---

## File Structure

- Create `package.json`: npm scripts and dependencies for Vite, React, TypeScript, Vitest, jsdom, and Testing Library.
- Create `index.html`: Vite entry HTML.
- Create `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`: TypeScript and test configuration.
- Create `src/test/setup.ts`: Testing Library matchers.
- Create `src/main.tsx`: React app mount.
- Create `src/App.tsx`: top-level app shell, local-storage state wiring, filters, form, and today list composition.
- Create `src/App.test.tsx`: MVP UI flow tests.
- Create `src/styles.css`: responsive operational UI styling.
- Create `src/domain/types.ts`: canonical data model and input/view types.
- Create `src/domain/dates.ts`: local calendar date helpers for `YYYY-MM-DD`.
- Create `src/domain/dates.test.ts`: date helper tests.
- Create `src/domain/recurrence.ts`: recurrence date calculation.
- Create `src/domain/recurrence.test.ts`: recurrence tests for every supported rule.
- Create `src/domain/todayList.ts`: derive visible "Today" task rows from state.
- Create `src/domain/todayList.test.ts`: due, overdue, postponed, missing reference, and filter tests.
- Create `src/domain/tasks.ts`: add, edit, deactivate, complete, and postpone task operations.
- Create `src/domain/tasks.test.ts`: mutation tests, including completion based on actual completion date.
- Create `src/storage/taskerStorage.ts`: versioned `localStorage` read/write with safe fallback.
- Create `src/storage/taskerStorage.test.ts`: missing, invalid JSON, unknown version, valid state, and save tests.
- Create `src/hooks/useTaskerState.ts`: React state wrapper around storage and domain operations.
- Create `src/components/TaskForm.tsx`: create/edit form with inline category and assignee creation.
- Create `src/components/QuickAddForm.tsx`: always-visible quick-add form matching the mockup.
- Create `src/components/TaskFilters.tsx`: category and assignee filters.
- Create `src/components/TodayTaskList.tsx`: empty state and list rendering.
- Create `src/components/TodayTaskCard.tsx`: mockup-style task row with overdue/today badge, metadata pills, completion, postponement, edit, and deactivate actions.

## Mockup UX Requirements

The UI must follow the provided mockup:

- Use a centered app frame with a white header and a pale gray content background.
- Header shows `Tasker`, a human-readable Polish date such as `Niedziela, 5 lipca 2026`, and a blue `+ Dodaj zadanie` button.
- Main section starts with `Dzisiaj` and `Zadania wymagające reakcji`.
- Category filters are rounded tabs: `Wszystkie` plus one tab per stored category. The selected tab uses a blue outline and pale blue background.
- The assignee filter still exists for MVP requirements, but it is secondary and compact so category tabs remain the primary control from the mockup.
- Task cards are white, 8px radius, bordered, and spacious. Overdue cards have an orange vertical accent on the left.
- The right side of each card shows either `Dzisiaj` or `Zaległe od YYYY-MM-DD`.
- Metadata appears as pills: category, assignee, and `Ostatnio wykonane: YYYY-MM-DD` or `Jeszcze nie wykonane`.
- Primary task action is a green `Wykonane` button. `Odłóż na jutro` is an outlined neutral button.
- A `Szybkie dodanie` section is always visible below the task list with three full-width fields and a blue `Zapisz` button.
- The top `+ Dodaj zadanie` button focuses the first field in `Szybkie dodanie`.

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `src/test/setup.ts`

- [ ] **Step 1: Create the npm project manifest**

Create `package.json`:

```json
{
  "name": "tasker",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "test": "vitest",
    "test:run": "vitest run"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^19.0.2",
    "@types/react-dom": "^19.0.2",
    "jsdom": "^25.0.1",
    "typescript": "^5.7.2",
    "vite": "^6.0.7",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create Vite HTML entry**

Create `index.html`:

```html
<!doctype html>
<html lang="pl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Tasker</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Create TypeScript configuration**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "types": ["vitest/globals"]
  },
  "include": ["src", "vite.config.ts"]
}
```

Create `tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: Create Vite and Vitest configuration**

Create `vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    globals: true
  }
});
```

Create `src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 5: Install dependencies**

Run:

```bash
npm install
```

Expected: command exits with code 0 and creates `package-lock.json`.

- [ ] **Step 6: Verify scaffold test command**

Run:

```bash
npm run test:run -- --passWithNoTests
```

Expected: command exits with code 0 and reports no test files found.

- [ ] **Step 7: Commit scaffold**

```bash
git add package.json package-lock.json index.html tsconfig.json tsconfig.node.json vite.config.ts src/test/setup.ts
git commit -m "chore: scaffold Vite React app"
```

---

### Task 2: Shared Types and Date Helpers

**Files:**
- Create: `src/domain/types.ts`
- Create: `src/domain/dates.ts`
- Create: `src/domain/dates.test.ts`

- [ ] **Step 1: Write failing date helper tests**

Create `src/domain/dates.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { addDays, addMonths, compareDates, formatPolishDateLabel, getTodayString, isDateString } from "./dates";

describe("date helpers", () => {
  it("adds days using local calendar date strings", () => {
    expect(addDays("2026-07-05", 1)).toBe("2026-07-06");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("clamps month additions to the last valid day", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-11-30", 3)).toBe("2027-02-28");
  });

  it("compares date strings", () => {
    expect(compareDates("2026-07-04", "2026-07-05")).toBeLessThan(0);
    expect(compareDates("2026-07-05", "2026-07-05")).toBe(0);
    expect(compareDates("2026-07-06", "2026-07-05")).toBeGreaterThan(0);
  });

  it("validates YYYY-MM-DD dates", () => {
    expect(isDateString("2026-07-05")).toBe(true);
    expect(isDateString("2026-02-30")).toBe(false);
    expect(isDateString("05-07-2026")).toBe(false);
  });

  it("formats today's date from an injected Date", () => {
    expect(getTodayString(new Date(2026, 6, 5, 23, 30))).toBe("2026-07-05");
  });

  it("formats a Polish display label for the header date", () => {
    expect(formatPolishDateLabel("2026-07-05")).toBe("Niedziela, 5 lipca 2026");
  });
});
```

- [ ] **Step 2: Run date tests to verify they fail**

Run:

```bash
npm run test:run -- src/domain/dates.test.ts
```

Expected: FAIL because `src/domain/dates.ts` does not exist.

- [ ] **Step 3: Add shared domain types**

Create `src/domain/types.ts`:

```ts
export type RecurrenceRule =
  | { type: "daily" }
  | { type: "everyNDays"; intervalDays: number }
  | { type: "weekly" }
  | { type: "monthly" }
  | { type: "quarterly" };

export type Task = {
  id: string;
  title: string;
  categoryId: string;
  assigneeId: string;
  recurrence: RecurrenceRule;
  startDate: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Category = {
  id: string;
  name: string;
};

export type Assignee = {
  id: string;
  name: string;
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
  version: 1;
  tasks: Task[];
  categories: Category[];
  assignees: Assignee[];
  completions: Completion[];
  postponements: Postponement[];
};

export type TodayFilters = {
  categoryId: string;
  assigneeId: string;
};

export type TodayTask = {
  task: Task;
  category: Category;
  assignee: Assignee;
  scheduledDate: string;
  isOverdue: boolean;
  lastCompletedDate?: string;
};

export type TaskDraft = {
  title: string;
  categoryName: string;
  assigneeName: string;
  recurrence: RecurrenceRule;
  startDate: string;
  active: boolean;
};
```

- [ ] **Step 4: Implement date helpers**

Create `src/domain/dates.ts`:

```ts
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

type DateParts = {
  year: number;
  month: number;
  day: number;
};

function parseDateParts(value: string): DateParts {
  const match = DATE_PATTERN.exec(value);
  if (!match) {
    throw new Error(`Invalid date string: ${value}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error(`Invalid date string: ${value}`);
  }

  return { year, month, day };
}

function toDateString(parts: DateParts): string {
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${parts.year}-${month}-${day}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isDateString(value: string): boolean {
  try {
    parseDateParts(value);
    return true;
  } catch {
    return false;
  }
}

export function addDays(value: string, days: number): string {
  const parts = parseDateParts(value);
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return toDateString({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate()
  });
}

export function addMonths(value: string, months: number): string {
  const parts = parseDateParts(value);
  const targetMonthIndex = parts.month - 1 + months;
  const targetYear = parts.year + Math.floor(targetMonthIndex / 12);
  const normalizedMonthIndex = ((targetMonthIndex % 12) + 12) % 12;
  const targetMonth = normalizedMonthIndex + 1;
  const targetDay = Math.min(parts.day, daysInMonth(targetYear, targetMonth));

  return toDateString({
    year: targetYear,
    month: targetMonth,
    day: targetDay
  });
}

export function compareDates(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

export function getTodayString(now = new Date()): string {
  return toDateString({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate()
  });
}

export function formatPolishDateLabel(value: string): string {
  const parts = parseDateParts(value);
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const label = new Intl.DateTimeFormat("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}
```

- [ ] **Step 5: Run date tests to verify they pass**

Run:

```bash
npm run test:run -- src/domain/dates.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit shared types and date helpers**

```bash
git add src/domain/types.ts src/domain/dates.ts src/domain/dates.test.ts
git commit -m "feat: add domain date helpers"
```

---

### Task 3: Recurrence Rules

**Files:**
- Create: `src/domain/recurrence.ts`
- Create: `src/domain/recurrence.test.ts`

- [ ] **Step 1: Write failing recurrence tests**

Create `src/domain/recurrence.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getNextScheduledDate } from "./recurrence";

describe("getNextScheduledDate", () => {
  it("calculates daily recurrence", () => {
    expect(getNextScheduledDate("2026-07-05", { type: "daily" })).toBe("2026-07-06");
  });

  it("calculates every N days recurrence", () => {
    expect(getNextScheduledDate("2026-07-05", { type: "everyNDays", intervalDays: 3 })).toBe("2026-07-08");
  });

  it("rejects non-positive every N days intervals", () => {
    expect(() => getNextScheduledDate("2026-07-05", { type: "everyNDays", intervalDays: 0 })).toThrow(
      "intervalDays must be greater than 0"
    );
  });

  it("calculates weekly recurrence", () => {
    expect(getNextScheduledDate("2026-07-05", { type: "weekly" })).toBe("2026-07-12");
  });

  it("calculates monthly recurrence", () => {
    expect(getNextScheduledDate("2026-01-31", { type: "monthly" })).toBe("2026-02-28");
  });

  it("calculates quarterly recurrence", () => {
    expect(getNextScheduledDate("2026-11-30", { type: "quarterly" })).toBe("2027-02-28");
  });
});
```

- [ ] **Step 2: Run recurrence tests to verify they fail**

Run:

```bash
npm run test:run -- src/domain/recurrence.test.ts
```

Expected: FAIL because `src/domain/recurrence.ts` does not exist.

- [ ] **Step 3: Implement recurrence calculation**

Create `src/domain/recurrence.ts`:

```ts
import { addDays, addMonths } from "./dates";
import type { RecurrenceRule } from "./types";

export function getNextScheduledDate(fromDate: string, recurrence: RecurrenceRule): string {
  switch (recurrence.type) {
    case "daily":
      return addDays(fromDate, 1);
    case "everyNDays":
      if (recurrence.intervalDays <= 0) {
        throw new Error("intervalDays must be greater than 0");
      }
      return addDays(fromDate, recurrence.intervalDays);
    case "weekly":
      return addDays(fromDate, 7);
    case "monthly":
      return addMonths(fromDate, 1);
    case "quarterly":
      return addMonths(fromDate, 3);
  }
}
```

- [ ] **Step 4: Run recurrence tests to verify they pass**

Run:

```bash
npm run test:run -- src/domain/recurrence.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit recurrence rules**

```bash
git add src/domain/recurrence.ts src/domain/recurrence.test.ts
git commit -m "feat: calculate recurrence dates"
```

---

### Task 4: Today List Domain Logic

**Files:**
- Create: `src/domain/todayList.ts`
- Create: `src/domain/todayList.test.ts`

- [ ] **Step 1: Write failing today-list tests**

Create `src/domain/todayList.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildTodayList } from "./todayList";
import type { AppState } from "./types";

const baseState: AppState = {
  version: 1,
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
```

- [ ] **Step 2: Run today-list tests to verify they fail**

Run:

```bash
npm run test:run -- src/domain/todayList.test.ts
```

Expected: FAIL because `src/domain/todayList.ts` does not exist.

- [ ] **Step 3: Implement today-list derivation**

Create `src/domain/todayList.ts`:

```ts
import { compareDates } from "./dates";
import { getNextScheduledDate } from "./recurrence";
import type { AppState, Assignee, Category, Completion, Task, TodayFilters, TodayTask } from "./types";

function getLatestCompletion(taskId: string, completions: Completion[]): Completion | undefined {
  return completions
    .filter((completion) => completion.taskId === taskId)
    .sort((left, right) => compareDates(right.completedDate, left.completedDate))[0];
}

export function getCurrentScheduledDate(task: Task, completions: Completion[]): string {
  const latestCompletion = getLatestCompletion(task.id, completions);
  if (!latestCompletion) {
    return task.startDate;
  }

  return getNextScheduledDate(latestCompletion.completedDate, task.recurrence);
}

function wasPostponedFromToday(state: AppState, taskId: string, today: string): boolean {
  return state.postponements.some((postponement) => postponement.taskId === taskId && postponement.fromDate === today);
}

function findCategory(categories: Category[], id: string): Category {
  return categories.find((category) => category.id === id) ?? { id, name: "Nieznana kategoria" };
}

function findAssignee(assignees: Assignee[], id: string): Assignee {
  return assignees.find((assignee) => assignee.id === id) ?? { id, name: "Nieznana osoba" };
}

function matchesFilters(task: Task, filters: TodayFilters): boolean {
  const categoryMatches = filters.categoryId === "" || task.categoryId === filters.categoryId;
  const assigneeMatches = filters.assigneeId === "" || task.assigneeId === filters.assigneeId;
  return categoryMatches && assigneeMatches;
}

export function buildTodayList(state: AppState, today: string, filters: TodayFilters): TodayTask[] {
  return state.tasks
    .filter((task) => task.active)
    .filter((task) => matchesFilters(task, filters))
    .map((task) => ({
      task,
      scheduledDate: getCurrentScheduledDate(task, state.completions)
    }))
    .filter((item) => compareDates(item.scheduledDate, today) <= 0)
    .filter((item) => !wasPostponedFromToday(state, item.task.id, today))
    .map((item) => ({
      task: item.task,
      category: findCategory(state.categories, item.task.categoryId),
      assignee: findAssignee(state.assignees, item.task.assigneeId),
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

- [ ] **Step 4: Run today-list tests to verify they pass**

Run:

```bash
npm run test:run -- src/domain/todayList.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit today-list logic**

```bash
git add src/domain/todayList.ts src/domain/todayList.test.ts
git commit -m "feat: derive today's task list"
```

---

### Task 5: Task Mutations

**Files:**
- Create: `src/domain/tasks.ts`
- Create: `src/domain/tasks.test.ts`

- [ ] **Step 1: Write failing task mutation tests**

Create `src/domain/tasks.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { addTask, completeTask, deactivateTask, postponeTask, updateTask } from "./tasks";
import { buildTodayList } from "./todayList";
import type { AppState } from "./types";

const emptyState: AppState = {
  version: 1,
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

    const postponed = postponeTask(initial, "task-1", "2026-07-05", "2026-07-06", "2026-07-05T12:00:00.000Z", ids("postponement-1"));

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

- [ ] **Step 2: Run task mutation tests to verify they fail**

Run:

```bash
npm run test:run -- src/domain/tasks.test.ts
```

Expected: FAIL because `src/domain/tasks.ts` does not exist.

- [ ] **Step 3: Implement task mutations**

Create `src/domain/tasks.ts`:

```ts
import type { AppState, Assignee, Category, TaskDraft } from "./types";

export type IdFactory = () => string;

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

function getOrCreateCategory(state: AppState, name: string, idFactory: IdFactory): { state: AppState; category: Category } {
  const normalized = normalizeName(name);
  const existing = state.categories.find((category) => namesEqual(category.name, normalized));
  if (existing) {
    return { state, category: existing };
  }

  const category = { id: idFactory(), name: normalized };
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

function prepareDraft(state: AppState, draft: TaskDraft, idFactory: IdFactory) {
  const title = requireText(draft.title, "title");
  const categoryResult = getOrCreateCategory(state, requireText(draft.categoryName, "categoryName"), idFactory);
  const assigneeResult = getOrCreateAssignee(categoryResult.state, requireText(draft.assigneeName, "assigneeName"), idFactory);

  return {
    state: assigneeResult.state,
    title,
    categoryId: categoryResult.category.id,
    assigneeId: assigneeResult.assignee.id
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
        recurrence: draft.recurrence,
        startDate: draft.startDate,
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
            recurrence: draft.recurrence,
            startDate: draft.startDate,
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

- [ ] **Step 4: Run task mutation tests to verify they pass**

Run:

```bash
npm run test:run -- src/domain/tasks.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit task mutations**

```bash
git add src/domain/tasks.ts src/domain/tasks.test.ts
git commit -m "feat: add task mutations"
```

---

### Task 6: Versioned Local Storage

**Files:**
- Create: `src/storage/taskerStorage.ts`
- Create: `src/storage/taskerStorage.test.ts`

- [ ] **Step 1: Write failing storage tests**

Create `src/storage/taskerStorage.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createEmptyState, loadState, saveState, STORAGE_KEY } from "./taskerStorage";

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => Array.from(data.keys())[index] ?? null,
    removeItem: (key: string) => data.delete(key),
    setItem: (key: string, value: string) => {
      data.set(key, value);
    }
  };
}

describe("taskerStorage", () => {
  it("returns empty state when storage has no data", () => {
    const result = loadState(memoryStorage());

    expect(result.state).toEqual(createEmptyState());
    expect(result.error).toBeUndefined();
  });

  it("falls back to empty state for invalid JSON", () => {
    const result = loadState(memoryStorage({ [STORAGE_KEY]: "{bad-json" }));

    expect(result.state).toEqual(createEmptyState());
    expect(result.error).toBe("Nie można odczytać lokalnych danych.");
  });

  it("falls back to empty state for unknown version", () => {
    const result = loadState(memoryStorage({ [STORAGE_KEY]: JSON.stringify({ version: 2 }) }));

    expect(result.state).toEqual(createEmptyState());
    expect(result.error).toBe("Nieobsługiwana wersja lokalnych danych.");
  });

  it("loads a valid state", () => {
    const state = createEmptyState();
    const result = loadState(memoryStorage({ [STORAGE_KEY]: JSON.stringify(state) }));

    expect(result.state).toEqual(state);
  });

  it("saves state under a versioned key", () => {
    const storage = memoryStorage();
    const state = createEmptyState();

    saveState(state, storage);

    expect(storage.getItem(STORAGE_KEY)).toBe(JSON.stringify(state));
  });
});
```

- [ ] **Step 2: Run storage tests to verify they fail**

Run:

```bash
npm run test:run -- src/storage/taskerStorage.test.ts
```

Expected: FAIL because `src/storage/taskerStorage.ts` does not exist.

- [ ] **Step 3: Implement storage adapter**

Create `src/storage/taskerStorage.ts`:

```ts
import type { AppState } from "../domain/types";

export const STORAGE_KEY = "tasker:v1";

export type LoadResult = {
  state: AppState;
  error?: string;
};

export function createEmptyState(): AppState {
  return {
    version: 1,
    tasks: [],
    categories: [],
    assignees: [],
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
    value.version === 1 &&
    isArrayProperty(value, "tasks") &&
    isArrayProperty(value, "categories") &&
    isArrayProperty(value, "assignees") &&
    isArrayProperty(value, "completions") &&
    isArrayProperty(value, "postponements")
  );
}

export function loadState(storage: Storage = window.localStorage): LoadResult {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) {
    return { state: createEmptyState() };
  }

  try {
    const parsed = JSON.parse(raw);
    if (isRecord(parsed) && parsed.version !== 1) {
      return { state: createEmptyState(), error: "Nieobsługiwana wersja lokalnych danych." };
    }
    if (!isAppState(parsed)) {
      return { state: createEmptyState(), error: "Nie można odczytać lokalnych danych." };
    }
    return { state: parsed };
  } catch {
    return { state: createEmptyState(), error: "Nie można odczytać lokalnych danych." };
  }
}

export function saveState(state: AppState, storage: Storage = window.localStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}
```

- [ ] **Step 4: Run storage tests to verify they pass**

Run:

```bash
npm run test:run -- src/storage/taskerStorage.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit storage adapter**

```bash
git add src/storage/taskerStorage.ts src/storage/taskerStorage.test.ts
git commit -m "feat: persist tasker state locally"
```

---

### Task 7: React State Hook and App Shell

**Files:**
- Create: `src/hooks/useTaskerState.ts`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles.css`

- [ ] **Step 1: Create React state hook**

Create `src/hooks/useTaskerState.ts`:

```ts
import { useMemo, useState } from "react";
import { addDays, getTodayString } from "../domain/dates";
import { buildTodayList } from "../domain/todayList";
import { addTask, completeTask, deactivateTask, postponeTask, updateTask } from "../domain/tasks";
import type { AppState, TaskDraft, TodayFilters } from "../domain/types";
import { loadState, saveState } from "../storage/taskerStorage";

export function useTaskerState(now: Date = new Date()) {
  const initial = useMemo(() => loadState(), []);
  const [state, setState] = useState<AppState>(initial.state);
  const [storageError] = useState(initial.error);
  const [filters, setFilters] = useState<TodayFilters>({ categoryId: "", assigneeId: "" });
  const today = getTodayString(now);

  function persist(nextState: AppState) {
    setState(nextState);
    saveState(nextState);
  }

  return {
    state,
    storageError,
    filters,
    setFilters,
    today,
    todayTasks: buildTodayList(state, today, filters),
    addTask: (draft: TaskDraft) => persist(addTask(state, draft, now.toISOString())),
    updateTask: (taskId: string, draft: TaskDraft) => persist(updateTask(state, taskId, draft, now.toISOString())),
    deactivateTask: (taskId: string) => persist(deactivateTask(state, taskId, now.toISOString())),
    completeTask: (taskId: string, scheduledDate: string) => persist(completeTask(state, taskId, scheduledDate, today)),
    postponeTask: (taskId: string) => persist(postponeTask(state, taskId, today, addDays(today, 1), now.toISOString()))
  };
}
```

- [ ] **Step 2: Create app entry point**

Create `src/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 3: Create top-level app shell**

Create `src/App.tsx`:

```tsx
import { formatPolishDateLabel } from "./domain/dates";
import { QuickAddForm } from "./components/QuickAddForm";
import { TaskFilters } from "./components/TaskFilters";
import { TodayTaskList } from "./components/TodayTaskList";
import { useTaskerState } from "./hooks/useTaskerState";

type Props = {
  now?: Date;
};

export default function App({ now = new Date() }: Props) {
  const tasker = useTaskerState(now);

  function focusQuickAdd() {
    document.getElementById("quick-add-title")?.focus();
  }

  return (
    <main className="app-shell">
      <header className="app-header" aria-label="Tasker">
        <div>
          <h1>Tasker</h1>
          <p className="today-date">{formatPolishDateLabel(tasker.today)}</p>
        </div>
        <button className="blue-button" type="button" onClick={focusQuickAdd}>
          + Dodaj zadanie
        </button>
      </header>

      <section className="content-panel">
        <div className="section-heading">
          <h2>Dzisiaj</h2>
          <p>Zadania wymagające reakcji</p>
        </div>

        {tasker.storageError ? <p className="warning">{tasker.storageError}</p> : null}

        <TaskFilters
          categories={tasker.state.categories}
          assignees={tasker.state.assignees}
          filters={tasker.filters}
          onChange={tasker.setFilters}
        />

        <TodayTaskList
          tasks={tasker.todayTasks}
          categories={tasker.state.categories}
          assignees={tasker.state.assignees}
          onAdd={focusQuickAdd}
          onComplete={tasker.completeTask}
          onPostpone={tasker.postponeTask}
          onDeactivate={tasker.deactivateTask}
          onUpdate={tasker.updateTask}
        />

        <QuickAddForm
          categories={tasker.state.categories}
          assignees={tasker.state.assignees}
          today={tasker.today}
          onSubmit={tasker.addTask}
        />
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Add base styling**

Create `src/styles.css`:

```css
:root {
  color: #172033;
  background: #f6f7fb;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
}

button,
input,
select {
  font: inherit;
}

.app-shell {
  width: min(914px, calc(100% - 32px));
  margin: 0 auto;
  min-height: 100vh;
  border-right: 1px solid #d8e0ec;
  border-left: 1px solid #d8e0ec;
  background: #f3f6fb;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 26px;
  background: #ffffff;
  border-bottom: 1px solid #d8e0ec;
}

.app-header h1 {
  margin: 0;
  font-size: 1.85rem;
  letter-spacing: 0;
}

.today-date,
.section-heading p,
.meta {
  margin: 0;
  color: #5f6f89;
}

.content-panel {
  padding: 28px 26px 40px;
}

.section-heading {
  display: grid;
  gap: 6px;
  margin-bottom: 18px;
}

.section-heading h2 {
  margin: 0;
  font-size: 1.45rem;
}

.blue-button,
.complete-button,
.secondary-button,
.danger-button {
  min-height: 42px;
  border-radius: 7px;
  padding: 0 14px;
  font-weight: 700;
  cursor: pointer;
}

.blue-button {
  border: 0;
  color: #ffffff;
  background: #2f64e8;
}

.complete-button {
  border: 1px solid #a7e6bd;
  color: #096b38;
  background: #eafff0;
}

.secondary-button {
  border: 1px solid #cbd6e6;
  color: #111827;
  background: #ffffff;
  font-weight: 500;
}

.danger-button {
  border: 1px solid #f1b7b2;
  color: #9f1d16;
  background: #fff5f4;
}

.warning {
  margin: 0 0 16px;
  padding: 12px 16px;
  border-radius: 8px;
  background: #fff2cc;
  color: #594400;
}

.filters {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.category-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.category-tab {
  min-height: 43px;
  border: 1px solid #cbd6e6;
  border-radius: 999px;
  padding: 0 15px;
  color: #34445f;
  background: #ffffff;
  cursor: pointer;
}

.category-tab.is-selected {
  border-color: #9bbcff;
  color: #1552e8;
  background: #edf4ff;
  font-weight: 700;
}

.assignee-filter {
  min-width: 176px;
}

.task-form,
.quick-add,
.task-card,
.empty-state {
  background: #ffffff;
  border: 1px solid #dce2ea;
  border-radius: 8px;
}

.task-form {
  display: grid;
  gap: 16px;
  padding: 16px;
}

.quick-add {
  display: grid;
  gap: 12px;
  margin-top: 36px;
  padding: 24px 18px 18px;
}

.quick-add h2 {
  margin: 0;
  font-size: 1.25rem;
}

.field {
  display: grid;
  gap: 6px;
}

.field span {
  font-weight: 650;
}

.field input,
.field select {
  min-height: 44px;
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 0 12px;
  color: #172033;
  background: #eef2f7;
}

.form-actions,
.task-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.task-list {
  display: grid;
  gap: 14px;
}

.task-card {
  position: relative;
  display: grid;
  gap: 14px;
  padding: 20px 18px;
  overflow: hidden;
}

.task-card.is-overdue::before {
  position: absolute;
  inset: 0 auto 0 0;
  width: 5px;
  background: #f59e0b;
  content: "";
}

.task-card-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

.task-title {
  margin: 0;
  font-size: 1.25rem;
}

.status-pill,
.meta-pill {
  align-self: start;
  border-radius: 999px;
  padding: 8px 11px;
  font-size: 0.9rem;
}

.status-pill {
  background: #f3f5f8;
  color: #536176;
}

.status-pill.is-overdue {
  background: #fff1e7;
  color: #c84c0a;
}

.task-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.meta-pill {
  background: #f0f3f8;
  color: #40516d;
}

.empty-state {
  display: grid;
  justify-items: start;
  gap: 10px;
  padding: 24px;
}

@media (max-width: 720px) {
  .app-header,
  .task-card-header {
    align-items: stretch;
    flex-direction: column;
  }

  .app-header,
  .filters {
    display: grid;
  }

  .assignee-filter {
    min-width: 0;
  }
}
```

- [ ] **Step 5: Keep the app shell uncommitted until components exist**

Do not run `npm run build` or commit this task yet because `App.tsx` intentionally imports component files created in Task 8. Continue directly to Task 8, then run the build and commit the shell and components together.

---

### Task 8: React Components

**Files:**
- Create: `src/components/TaskFilters.tsx`
- Create: `src/components/TaskForm.tsx`
- Create: `src/components/QuickAddForm.tsx`
- Create: `src/components/TodayTaskCard.tsx`
- Create: `src/components/TodayTaskList.tsx`

- [ ] **Step 1: Create filters component**

Create `src/components/TaskFilters.tsx`:

```tsx
import type { Assignee, Category, TodayFilters } from "../domain/types";

type Props = {
  categories: Category[];
  assignees: Assignee[];
  filters: TodayFilters;
  onChange: (filters: TodayFilters) => void;
};

export function TaskFilters({ categories, assignees, filters, onChange }: Props) {
  return (
    <section className="filters" aria-label="Filtry">
      <div className="category-tabs" aria-label="Kategorie">
        <button
          className={filters.categoryId === "" ? "category-tab is-selected" : "category-tab"}
          type="button"
          onClick={() => onChange({ ...filters, categoryId: "" })}
        >
          Wszystkie
        </button>
        {categories.map((category) => (
          <button
            className={filters.categoryId === category.id ? "category-tab is-selected" : "category-tab"}
            key={category.id}
            type="button"
            onClick={() => onChange({ ...filters, categoryId: category.id })}
          >
            {category.name}
          </button>
        ))}
      </div>

      <label className="field assignee-filter">
        <span>Osoba</span>
        <select value={filters.assigneeId} onChange={(event) => onChange({ ...filters, assigneeId: event.target.value })}>
          <option value="">Wszystkie osoby</option>
          {assignees.map((assignee) => (
            <option key={assignee.id} value={assignee.id}>
              {assignee.name}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}
```

- [ ] **Step 2: Create task form component**

Create `src/components/TaskForm.tsx`:

```tsx
import { useState } from "react";
import type { Assignee, Category, RecurrenceRule, Task, TaskDraft } from "../domain/types";

type Props = {
  categories: Category[];
  assignees: Assignee[];
  task?: Task;
  onSubmit: (draft: TaskDraft) => void;
  onCancel: () => void;
};

function defaultDraft(task?: Task, categories: Category[] = [], assignees: Assignee[] = []): TaskDraft {
  const category = categories.find((item) => item.id === task?.categoryId);
  const assignee = assignees.find((item) => item.id === task?.assigneeId);

  return {
    title: task?.title ?? "",
    categoryName: category?.name ?? "",
    assigneeName: assignee?.name ?? "",
    recurrence: task?.recurrence ?? { type: "daily" },
    startDate: task?.startDate ?? "",
    active: task?.active ?? true
  };
}

function recurrenceType(recurrence: RecurrenceRule): RecurrenceRule["type"] {
  return recurrence.type;
}

export function TaskForm({ categories, assignees, task, onSubmit, onCancel }: Props) {
  const [draft, setDraft] = useState<TaskDraft>(() => defaultDraft(task, categories, assignees));

  function changeRecurrence(type: RecurrenceRule["type"]) {
    setDraft((current) => ({
      ...current,
      recurrence: type === "everyNDays" ? { type, intervalDays: 2 } : { type }
    }));
  }

  return (
    <form
      className="task-form"
      aria-label={task ? "Edytuj zadanie" : "Dodaj zadanie"}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(draft);
      }}
    >
      <label className="field">
        <span>Nazwa zadania</span>
        <input required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
      </label>

      <label className="field">
        <span>Kategoria</span>
        <input
          required
          list="tasker-categories"
          value={draft.categoryName}
          onChange={(event) => setDraft({ ...draft, categoryName: event.target.value })}
        />
        <datalist id="tasker-categories">
          {categories.map((category) => (
            <option key={category.id} value={category.name} />
          ))}
        </datalist>
      </label>

      <label className="field">
        <span>Osoba</span>
        <input
          required
          list="tasker-assignees"
          value={draft.assigneeName}
          onChange={(event) => setDraft({ ...draft, assigneeName: event.target.value })}
        />
        <datalist id="tasker-assignees">
          {assignees.map((assignee) => (
            <option key={assignee.id} value={assignee.name} />
          ))}
        </datalist>
      </label>

      <label className="field">
        <span>Data startu</span>
        <input required type="date" value={draft.startDate} onChange={(event) => setDraft({ ...draft, startDate: event.target.value })} />
      </label>

      <label className="field">
        <span>Powtarzanie</span>
        <select value={recurrenceType(draft.recurrence)} onChange={(event) => changeRecurrence(event.target.value as RecurrenceRule["type"])}>
          <option value="daily">Codziennie</option>
          <option value="everyNDays">Co N dni</option>
          <option value="weekly">Co tydzień</option>
          <option value="monthly">Co miesiąc</option>
          <option value="quarterly">Co kwartał</option>
        </select>
      </label>

      {draft.recurrence.type === "everyNDays" ? (
        <label className="field">
          <span>Liczba dni</span>
          <input
            required
            min={1}
            type="number"
            value={draft.recurrence.intervalDays}
            onChange={(event) =>
              setDraft({
                ...draft,
                recurrence: { type: "everyNDays", intervalDays: Number(event.target.value) }
              })
            }
          />
        </label>
      ) : null}

      <label className="field">
        <span>Status</span>
        <select value={draft.active ? "active" : "inactive"} onChange={(event) => setDraft({ ...draft, active: event.target.value === "active" })}>
          <option value="active">Aktywne</option>
          <option value="inactive">Nieaktywne</option>
        </select>
      </label>

      <div className="form-actions">
        <button className="blue-button" type="submit">
          Zapisz
        </button>
        <button className="secondary-button" type="button" onClick={onCancel}>
          Anuluj
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Create quick-add component**

Create `src/components/QuickAddForm.tsx`:

```tsx
import { useState } from "react";
import type { Assignee, Category, TaskDraft } from "../domain/types";

type Props = {
  categories: Category[];
  assignees: Assignee[];
  today: string;
  onSubmit: (draft: TaskDraft) => void;
};

const emptyForm = {
  title: "",
  categoryName: "",
  assigneeName: ""
};

export function QuickAddForm({ categories, assignees, today, onSubmit }: Props) {
  const [form, setForm] = useState(emptyForm);

  return (
    <form
      className="quick-add"
      aria-label="Szybkie dodanie"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          ...form,
          recurrence: { type: "daily" },
          startDate: today,
          active: true
        });
        setForm(emptyForm);
      }}
    >
      <h2>Szybkie dodanie</h2>

      <label className="field">
        <span>Nazwa zadania</span>
        <input
          id="quick-add-title"
          required
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
        />
      </label>

      <label className="field">
        <span>Kategoria</span>
        <input
          required
          list="quick-add-categories"
          value={form.categoryName}
          onChange={(event) => setForm({ ...form, categoryName: event.target.value })}
        />
        <datalist id="quick-add-categories">
          {categories.map((category) => (
            <option key={category.id} value={category.name} />
          ))}
        </datalist>
      </label>

      <label className="field">
        <span>Osoba</span>
        <input
          required
          list="quick-add-assignees"
          value={form.assigneeName}
          onChange={(event) => setForm({ ...form, assigneeName: event.target.value })}
        />
        <datalist id="quick-add-assignees">
          {assignees.map((assignee) => (
            <option key={assignee.id} value={assignee.name} />
          ))}
        </datalist>
      </label>

      <div className="form-actions">
        <button className="blue-button" type="submit">
          Zapisz
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Create task card component**

Create `src/components/TodayTaskCard.tsx`:

```tsx
import { useState } from "react";
import type { Assignee, Category, TaskDraft, TodayTask } from "../domain/types";
import { TaskForm } from "./TaskForm";

type Props = {
  item: TodayTask;
  categories: Category[];
  assignees: Assignee[];
  onComplete: (taskId: string, scheduledDate: string) => void;
  onPostpone: (taskId: string) => void;
  onDeactivate: (taskId: string) => void;
  onUpdate: (taskId: string, draft: TaskDraft) => void;
};

export function TodayTaskCard({ item, categories, assignees, onComplete, onPostpone, onDeactivate, onUpdate }: Props) {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <TaskForm
        task={item.task}
        categories={categories}
        assignees={assignees}
        onCancel={() => setIsEditing(false)}
        onSubmit={(draft) => {
          onUpdate(item.task.id, draft);
          setIsEditing(false);
        }}
      />
    );
  }

  const statusText = item.isOverdue ? `Zaległe od ${item.scheduledDate}` : "Dzisiaj";
  const completionText = item.lastCompletedDate ? `Ostatnio wykonane: ${item.lastCompletedDate}` : "Jeszcze nie wykonane";

  return (
    <article className={item.isOverdue ? "task-card is-overdue" : "task-card"}>
      <div className="task-card-header">
        <div>
          <h2 className="task-title">{item.task.title}</h2>
        </div>
        <span className={item.isOverdue ? "status-pill is-overdue" : "status-pill"}>{statusText}</span>
      </div>

      <div className="task-meta" aria-label="Szczegóły zadania">
        <span className="meta-pill">{item.category.name}</span>
        <span className="meta-pill">{item.assignee.name}</span>
        <span className="meta-pill">{completionText}</span>
      </div>

      <div className="task-actions">
        <button className="complete-button" type="button" onClick={() => onComplete(item.task.id, item.scheduledDate)}>
          Wykonane
        </button>
        <button className="secondary-button" type="button" onClick={() => onPostpone(item.task.id)}>
          Odłóż na jutro
        </button>
        <button className="secondary-button" type="button" onClick={() => setIsEditing(true)}>
          Edytuj
        </button>
        <button className="danger-button" type="button" onClick={() => onDeactivate(item.task.id)}>
          Dezaktywuj
        </button>
      </div>
    </article>
  );
}
```

- [ ] **Step 5: Create today list component**

Create `src/components/TodayTaskList.tsx`:

```tsx
import type { Assignee, Category, TaskDraft, TodayTask } from "../domain/types";
import { TodayTaskCard } from "./TodayTaskCard";

type Props = {
  tasks: TodayTask[];
  categories: Category[];
  assignees: Assignee[];
  onAdd: () => void;
  onComplete: (taskId: string, scheduledDate: string) => void;
  onPostpone: (taskId: string) => void;
  onDeactivate: (taskId: string) => void;
  onUpdate: (taskId: string, draft: TaskDraft) => void;
};

export function TodayTaskList({ tasks, categories, assignees, onAdd, onComplete, onPostpone, onDeactivate, onUpdate }: Props) {
  if (tasks.length === 0) {
    return (
      <section className="empty-state">
        <h2>Brak zadań na dziś</h2>
        <p className="meta">Dodaj pierwsze zadanie powtarzalne albo zmień filtry.</p>
        <button className="blue-button" type="button" onClick={onAdd}>
          Dodaj zadanie
        </button>
      </section>
    );
  }

  return (
    <section className="task-list" aria-label="Zadania na dziś">
      {tasks.map((item) => (
        <TodayTaskCard
          key={item.task.id}
          item={item}
          categories={categories}
          assignees={assignees}
          onComplete={onComplete}
          onPostpone={onPostpone}
          onDeactivate={onDeactivate}
          onUpdate={onUpdate}
        />
      ))}
    </section>
  );
}
```

- [ ] **Step 6: Run build to verify component integration**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit app shell and React components**

```bash
git add src/hooks/useTaskerState.ts src/main.tsx src/App.tsx src/styles.css src/components/TaskFilters.tsx src/components/TaskForm.tsx src/components/QuickAddForm.tsx src/components/TodayTaskCard.tsx src/components/TodayTaskList.tsx
git commit -m "feat: add tasker UI"
```

---

### Task 9: MVP UI Flow Tests

**Files:**
- Create: `src/App.test.tsx`

- [ ] **Step 1: Write UI flow tests**

Create `src/App.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import App from "./App";
import { STORAGE_KEY } from "./storage/taskerStorage";

function renderApp() {
  render(<App now={new Date(2026, 6, 5, 9, 0)} />);
}

async function addDailyTask(title: string, category: string, assignee: string) {
  const user = userEvent.setup();

  const form = screen.getByRole("form", { name: "Szybkie dodanie" });
  await user.type(within(form).getByLabelText("Nazwa zadania"), title);
  await user.type(within(form).getByLabelText("Kategoria"), category);
  await user.type(within(form).getByLabelText("Osoba"), assignee);
  await user.click(within(form).getByRole("button", { name: "Zapisz" }));
}

describe("App", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("adds a task and persists it in localStorage", async () => {
    renderApp();

    await addDailyTask("Podlać rośliny", "Dom", "Ola");

    expect(screen.getByRole("heading", { name: "Tasker" })).toBeInTheDocument();
    expect(screen.getByText("Niedziela, 5 lipca 2026")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Podlać rośliny" })).toBeInTheDocument();
    expect(screen.getAllByText("Dzisiaj").length).toBeGreaterThan(0);
    expect(screen.getByText("Jeszcze nie wykonane")).toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toContain("Podlać rośliny");
  });

  it("marks a task as complete and removes it from today", async () => {
    renderApp();
    const user = userEvent.setup();
    await addDailyTask("Podlać rośliny", "Dom", "Ola");

    await user.click(screen.getByRole("button", { name: "Wykonane" }));

    expect(screen.queryByRole("heading", { name: "Podlać rośliny" })).not.toBeInTheDocument();
    expect(screen.getByText("Brak zadań na dziś")).toBeInTheDocument();
  });

  it("postpones a task without recording completion", async () => {
    renderApp();
    const user = userEvent.setup();
    await addDailyTask("Podlać rośliny", "Dom", "Ola");

    await user.click(screen.getByRole("button", { name: "Odłóż na jutro" }));

    expect(screen.queryByRole("heading", { name: "Podlać rośliny" })).not.toBeInTheDocument();
    const stored = localStorage.getItem(STORAGE_KEY) ?? "";
    expect(stored).toContain("postponements");
    expect(stored).not.toContain("completedDate");
  });

  it("filters today list by category and assignee", async () => {
    renderApp();
    const user = userEvent.setup();
    await addDailyTask("Dom Oli", "Dom", "Ola");
    await addDailyTask("Praca Jana", "Praca", "Jan");

    const filters = screen.getByRole("region", { name: "Filtry" });
    await user.click(within(filters).getByRole("button", { name: "Praca" }));
    const assigneeFilter = within(filters).getByLabelText("Osoba");
    await user.selectOptions(assigneeFilter, within(assigneeFilter).getByRole("option", { name: "Jan" }));

    const list = screen.getByRole("region", { name: "Zadania na dziś" });
    expect(within(list).getByRole("heading", { name: "Praca Jana" })).toBeInTheDocument();
    expect(within(list).queryByRole("heading", { name: "Dom Oli" })).not.toBeInTheDocument();
  });

  it("edits and deactivates an existing task", async () => {
    renderApp();
    const user = userEvent.setup();
    await addDailyTask("Stara nazwa", "Dom", "Ola");

    await user.click(screen.getByRole("button", { name: "Edytuj" }));
    const form = screen.getByRole("form", { name: "Edytuj zadanie" });
    await user.clear(within(form).getByLabelText("Nazwa zadania"));
    await user.type(within(form).getByLabelText("Nazwa zadania"), "Nowa nazwa");
    await user.click(within(form).getByRole("button", { name: "Zapisz" }));

    expect(screen.getByRole("heading", { name: "Nowa nazwa" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Dezaktywuj" }));

    expect(screen.queryByRole("heading", { name: "Nowa nazwa" })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run UI tests**

Run:

```bash
npm run test:run -- src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run all tests**

Run:

```bash
npm run test:run
```

Expected: PASS.

- [ ] **Step 4: Commit UI tests**

```bash
git add src/App.test.tsx
git commit -m "test: cover tasker MVP flows"
```

---

### Task 10: Final Verification and Polish

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create README with local workflow**

Create `README.md`:

````md
# Tasker

Tasker is a local-first React app for recurring tasks. It stores data in the browser under the versioned `localStorage` key `tasker:v1`; it has no backend, login, or cross-device sync.

## Run locally

```bash
npm install
npm run dev
```

## Verify

```bash
npm run test:run
npm run build
```
````

- [ ] **Step 2: Run full verification**

Run:

```bash
npm run test:run
npm run build
```

Expected: both commands exit with code 0.

- [ ] **Step 3: Manual browser smoke test**

Run:

```bash
npm run dev
```

Open the printed local URL and verify:

- Header shows `Tasker`, a Polish date label such as `Niedziela, 5 lipca 2026`, and a blue `+ Dodaj zadanie` button.
- Click `+ Dodaj zadanie`; focus moves to the first field in `Szybkie dodanie`.
- Add task with title `Podlać rośliny`, category `Dom`, assignee `Ola`; task appears in `Dzisiaj` with a `Dzisiaj` status pill and `Jeszcze nie wykonane` metadata.
- Click `Wykonane`; task disappears and `localStorage.tasker:v1` contains one completion.
- Add another task, click `Odłóż na jutro`; task disappears and `localStorage.tasker:v1` contains one postponement and no new completion for that task.
- Add two tasks with different category/person pairs; filter by one category pill and one person; only the matching task remains visible.
- Refresh the page; stored categories, people, and still-due tasks remain available.

Stop the dev server with `Ctrl+C`.

- [ ] **Step 4: Commit final docs and polish**

```bash
git add README.md
git commit -m "docs: document tasker local workflow"
```

---

## Self-Review

**Spec coverage:** The plan covers React, Vite, TypeScript, localStorage under `tasker:v1`, today's list, recurrence rules, overdue carry-forward, completion, postponement, category/person creation, filtering, editing, deactivation, damaged storage fallback, domain tests, key UI flows, and the supplied mockup's header, category tabs, task-card status pills, metadata pills, and quick-add section.

**Placeholder scan:** The plan contains concrete files, commands, expected results, and code blocks for every implementation step. It does not rely on deferred implementation notes.

**Type consistency:** `Task`, `RecurrenceRule`, `Category`, `Assignee`, `Completion`, `Postponement`, `AppState`, `TodayFilters`, `TodayTask`, and `TaskDraft` are introduced in `src/domain/types.ts` and reused consistently across domain, storage, hook, and component tasks.
