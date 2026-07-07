# Zustand State Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Tasker's local React state hook with a Zustand-backed application store while preserving the current local-first behavior.

**Architecture:** A new `src/state/taskerStore.ts` module owns persisted `AppState`, filter state, localStorage load errors, and task actions. `App.tsx` reads store slices through Zustand selectors and keeps passing props to existing child components.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, Mantine, Zustand.

## Global Constraints

- Preserve the local-first storage behavior under localStorage key `tasker:v1`.
- Keep the existing domain functions as the source of task business logic.
- Keep current child component props unchanged unless a test proves a change is needed.
- Do not add backend sync, authentication, data migrations, new task features, or persisted filters.
- Reset store state in tests so cases do not leak state through the singleton store.

---

## File Structure

- `package.json`: add `zustand` to runtime dependencies.
- `package-lock.json`: update with the installed `zustand` package.
- `src/state/taskerStore.ts`: create the Zustand store, actions, selectors, and reset helper.
- `src/App.tsx`: replace `useTaskerState` with Zustand selectors and existing domain-derived values.
- `src/hooks/useTaskerState.ts`: remove after `App.tsx` no longer imports it.
- `src/App.test.tsx`: reset the Zustand store in `beforeEach`.

---

### Task 1: Add Zustand Store

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/state/taskerStore.ts`

**Interfaces:**
- Consumes: `AppState`, `TaskDraft`, `TodayFilters` from `src/domain/types.ts`; `loadState`, `saveState` from `src/storage/taskerStorage.ts`; task mutation functions from `src/domain/tasks.ts`.
- Produces:
  - `type TaskerStore`
  - `const emptyFilters: TodayFilters`
  - `const useTaskerStore: UseBoundStore<StoreApi<TaskerStore>>`
  - `function resetTaskerStore(): void`

- [ ] **Step 1: Install Zustand dependency**

Run:

```powershell
npm install zustand
```

Expected: `package.json` contains `"zustand"` in `dependencies`, and `package-lock.json` is updated.

- [ ] **Step 2: Create the store module**

Create `src/state/taskerStore.ts` with:

```ts
import { create } from "zustand";
import { addDays, getTodayString } from "../domain/dates";
import { addTask, completeTask, deactivateTask, postponeTask, updateTask } from "../domain/tasks";
import type { AppState, TaskDraft, TodayFilters } from "../domain/types";
import { loadState, saveState } from "../storage/taskerStorage";

export const emptyFilters: TodayFilters = { categoryId: "", assigneeId: "" };

export type TaskerStore = {
  state: AppState;
  storageError?: string;
  filters: TodayFilters;
  setFilters: (filters: TodayFilters) => void;
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
    filters: emptyFilters
  };
}

function persist(nextState: AppState): Pick<TaskerStore, "state"> {
  saveState(nextState);
  return { state: nextState };
}

export const useTaskerStore = create<TaskerStore>((set, get) => ({
  ...loadInitialStoreState(),
  setFilters: (filters) => set({ filters }),
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

- [ ] **Step 3: Run TypeScript check**

Run:

```powershell
npm run build
```

Expected: TypeScript check and Vite production build pass with the new store module present and the old hook still in use.

- [ ] **Step 4: Commit Task 1**

Run:

```powershell
git add package.json package-lock.json src/state/taskerStore.ts
git commit -m "feat: add tasker zustand store"
```

Expected: commit contains only the dependency and store module.

---

### Task 2: Wire App to Store

**Files:**
- Modify: `src/App.tsx`
- Delete: `src/hooks/useTaskerState.ts`

**Interfaces:**
- Consumes: `useTaskerStore` from `src/state/taskerStore.ts`.
- Produces: `App` component that computes `today` and `todayTasks` locally from selected store slices and passes existing props to children.

- [ ] **Step 1: Replace the hook import and store reads**

Modify `src/App.tsx` so the imports are:

```ts
import { Alert, Button, Container, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { QuickAddForm } from "./components/QuickAddForm";
import { TaskFilters } from "./components/TaskFilters";
import { TodayTaskList } from "./components/TodayTaskList";
import { formatPolishDateLabel, getTodayString } from "./domain/dates";
import { buildTodayList } from "./domain/todayList";
import { useTaskerStore } from "./state/taskerStore";
```

Inside `App`, replace `const tasker = useTaskerState(now);` with:

```ts
const state = useTaskerStore((store) => store.state);
const storageError = useTaskerStore((store) => store.storageError);
const filters = useTaskerStore((store) => store.filters);
const setFilters = useTaskerStore((store) => store.setFilters);
const addTask = useTaskerStore((store) => store.addTask);
const updateTask = useTaskerStore((store) => store.updateTask);
const deactivateTask = useTaskerStore((store) => store.deactivateTask);
const completeTask = useTaskerStore((store) => store.completeTask);
const postponeTask = useTaskerStore((store) => store.postponeTask);
const today = getTodayString(now);
const todayTasks = buildTodayList(state, today, filters);
```

- [ ] **Step 2: Pass date-aware action wrappers**

Still in `App.tsx`, add these wrappers below `focusQuickAdd`:

```ts
function handleAddTask(draft: Parameters<typeof addTask>[0]) {
  addTask(draft, now);
}

function handleUpdateTask(taskId: string, draft: Parameters<typeof updateTask>[1]) {
  updateTask(taskId, draft, now);
}

function handleDeactivateTask(taskId: string) {
  deactivateTask(taskId, now);
}

function handleCompleteTask(taskId: string, scheduledDate: string) {
  completeTask(taskId, scheduledDate, now);
}

function handlePostponeTask(taskId: string) {
  postponeTask(taskId, now);
}
```

- [ ] **Step 3: Replace JSX references**

In `src/App.tsx`, replace:

```tsx
{formatPolishDateLabel(tasker.today)}
```

with:

```tsx
{formatPolishDateLabel(today)}
```

Replace all other `tasker.*` references with the selected values:

```tsx
storageError
state.categories
state.assignees
filters
setFilters
todayTasks
handleCompleteTask
handlePostponeTask
handleDeactivateTask
handleUpdateTask
today
handleAddTask
```

- [ ] **Step 4: Delete the obsolete hook**

Delete `src/hooks/useTaskerState.ts`.

- [ ] **Step 5: Run focused app tests**

Run:

```powershell
npm run test:run -- src/App.test.tsx
```

Expected: tests may fail from store state leaking between tests. That failure is addressed in Task 3.

- [ ] **Step 6: Commit Task 2**

Run:

```powershell
git add src/App.tsx src/hooks/useTaskerState.ts
git commit -m "refactor: read tasker state from zustand"
```

Expected: commit contains the `App` migration and hook removal.

---

### Task 3: Reset Store in Tests and Verify

**Files:**
- Modify: `src/App.test.tsx`

**Interfaces:**
- Consumes: `resetTaskerStore` from `src/state/taskerStore.ts`.
- Produces: deterministic app tests that clear both browser storage and the singleton Zustand store.

- [ ] **Step 1: Import store reset helper**

Add this import to `src/App.test.tsx`:

```ts
import { resetTaskerStore } from "./state/taskerStore";
```

- [ ] **Step 2: Reset store in `beforeEach`**

Change the `beforeEach` body to:

```ts
beforeEach(() => {
  localStorage.clear();
  resetTaskerStore();
});
```

- [ ] **Step 3: Run app tests**

Run:

```powershell
npm run test:run -- src/App.test.tsx
```

Expected: all `App` tests pass.

- [ ] **Step 4: Run full test suite**

Run:

```powershell
npm run test:run
```

Expected: all tests pass.

- [ ] **Step 5: Run production build**

Run:

```powershell
npm run build
```

Expected: TypeScript check and Vite production build pass.

- [ ] **Step 6: Commit Task 3**

Run:

```powershell
git add src/App.test.tsx
git commit -m "test: reset tasker zustand store"
```

Expected: commit contains only the test reset change if no earlier task needed adjustment.
