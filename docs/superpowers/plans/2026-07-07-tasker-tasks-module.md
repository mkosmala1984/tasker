# Tasker Tasks Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zbudowac modul "Zadania" po fundamencie v2: osobny widok listy zadan oraz osobny widok tworzenia i edycji zadan jednorazowych i cyklicznych.

**Architecture:** Plan zaklada, ze plan `docs/superpowers/plans/2026-07-07-tasker-foundation.md` zostal juz wykonany i repo ma model v2 (`Task.schedule`, `TaskType`, `Priority`, `AppView`, rozszerzony store). Logika mapowania formularza do `TaskDraft` zostaje w czystym module domenowym, a React odpowiada za stan pol formularza, walidacje prezentacyjna i nawigacje miedzy lista a edytorem. Widok "Dzisiaj" przestaje zawierac pelna edycje inline i prowadzi do osobnego edytora zadania.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, React Testing Library, Mantine, Zustand, browser `localStorage`.

## Global Constraints

- Local-only application: no accounts, backend, or synchronization.
- Dates are calendar dates in `YYYY-MM-DD`, without time or timezone.
- Interface copy remains Polish.
- Existing domain behavior for recurring tasks, overdue tasks, completion, postponement to tomorrow, filtering, and local persistence must keep working.
- Use ASCII in source and docs unless the touched file already intentionally uses non-ASCII.
- Nie implementowac kalendarza, historii, importu, eksportu ani pelnego CRUD slownikow.
- Modul zadan uzywa istniejacych slownikow z fundamentu: `categories`, `assignees`, `taskTypes`, `priorities`.
- Typ zadania jest prezentacyjny i filtrujacy; nie zmienia automatycznie trybu, daty ani reguly powtarzania.
- Priorytet jest opcjonalny w formularzu; zapis bez wyboru ma uzyc domyslnego priorytetu z fundamentu.
- Zadania nieaktywne pozostaja w danych, ale nie sa wymagajace reakcji w planie.
- Ten plan nie wymaga commitow; po kazdym tasku wykonaj `git diff --check` jako checkpoint.

---

## File Structure

- Create `src/domain/taskForm.ts`: czyste helpery formularza zadan: `TaskFormValues`, `TaskFormErrors`, `taskToFormValues`, `createEmptyTaskFormValues`, `validateTaskFormValues`, `taskFormValuesToDraft`, etykiety regul powtarzania.
- Create `src/domain/taskForm.test.ts`: testy mapowania formularza dla zadan jednorazowych, cyklicznych, priorytetu opcjonalnego i walidacji `everyNDays`.
- Modify `src/state/taskerStore.ts`: dodac stan podwidoku modulu zadan: `taskEditorTaskId`, `openTaskCreate`, `openTaskEdit`, `closeTaskEditor`; zachowac `view: AppView`.
- Modify `src/components/TaskForm.tsx`: przepisac obecny prosty formularz na pelen formularz modulu zadan z polami: nazwa, typ, tryb, data/data startu, regula powtarzania, kategoria, osoba, opcjonalny priorytet, aktywnosc.
- Create `src/components/tasks/TaskListView.tsx`: lista wszystkich zadan z metadanymi, akcjami "Edytuj", "Dezaktywuj" i przyciskiem "Dodaj zadanie".
- Create `src/components/tasks/TaskEditorView.tsx`: osobny widok tworzenia/edycji, laczacy `TaskForm` ze store i nawigacja powrotna do listy zadan.
- Create `src/components/tasks/TasksModuleView.tsx`: przelacznik miedzy lista i edytorem w obrebie `view === "tasks"`.
- Modify `src/components/TodayTaskCard.tsx`: akcja "Edytuj" otwiera osobny edytor w module zadan zamiast renderowac formularz inline.
- Modify `src/components/TodayTaskList.tsx`: przekazac `onEdit(taskId)` zamiast `onUpdate`.
- Modify `src/App.tsx`: przycisk "+ Dodaj zadanie" i stan pusty Today otwieraja osobny widok tworzenia; dotychczasowa plansza "Zadania" zostaje zastapiona `TasksModuleView`.
- Modify `src/App.test.tsx`: pokryc nawigacje do tworzenia/edycji, zapis jednorazowego zadania, zapis cyklicznego zadania i dezaktywacje.
- Create `src/components/tasks/TaskForm.test.tsx`: testy interakcji formularza, komunikatow walidacyjnych i warunkowego pola `Co N dni`.

---

### Task 1: Domain Form Mapping And Validation

**Files:**
- Create: `src/domain/taskForm.ts`
- Create: `src/domain/taskForm.test.ts`

**Interfaces:**
- Consumes: `AppState`, `Task`, `TaskDraft`, `TaskMode`, `RecurrenceRule`, `DEFAULT_PRIORITY_ID` from the v2 foundation.
- Produces:
  - `type TaskFormValues`
  - `type TaskFormErrors = Partial<Record<keyof TaskFormValues | "dictionary", string>>`
  - `createEmptyTaskFormValues(state: AppState, today: string): TaskFormValues`
  - `taskToFormValues(task: Task, state: AppState): TaskFormValues`
  - `validateTaskFormValues(values: TaskFormValues, state: AppState): TaskFormErrors`
  - `taskFormValuesToDraft(values: TaskFormValues, state: AppState): TaskDraft`
  - `recurrenceOptions: Array<{ value: RecurrenceRule["type"]; label: string }>`

- [ ] **Step 1: Write failing domain tests**

Create `src/domain/taskForm.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_PRIORITY_ID, DEFAULT_TASK_TYPE_ID } from "../storage/taskerStorage";
import {
  createEmptyTaskFormValues,
  taskFormValuesToDraft,
  taskToFormValues,
  validateTaskFormValues
} from "./taskForm";
import type { AppState, Task } from "./types";

const state: AppState = {
  version: 2,
  tasks: [],
  categories: [{ id: "cat-home", name: "Dom", color: "#40c057" }],
  assignees: [{ id: "person-ola", name: "Ola" }],
  taskTypes: [
    { id: DEFAULT_TASK_TYPE_ID, name: "Zadanie", active: true, order: 0 },
    { id: "type-deadline", name: "Termin", active: true, order: 1 }
  ],
  priorities: [
    { id: DEFAULT_PRIORITY_ID, name: "Normalny", active: true, order: 0, color: "#868e96" },
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
    taskTypeId: DEFAULT_TASK_TYPE_ID,
    priorityId: DEFAULT_PRIORITY_ID,
    schedule: { mode: "recurring", startDate: "2026-07-07", recurrence: { type: "daily" } },
    active: true,
    createdAt: "2026-07-07T08:00:00.000Z",
    updatedAt: "2026-07-07T08:00:00.000Z",
    ...overrides
  };
}

describe("task form mapping", () => {
  it("creates defaults from active dictionaries and today's date", () => {
    expect(createEmptyTaskFormValues(state, "2026-07-07")).toEqual({
      title: "",
      mode: "oneTime",
      oneTimeDate: "2026-07-07",
      recurringStartDate: "2026-07-07",
      recurrenceType: "daily",
      intervalDays: 2,
      categoryId: "cat-home",
      assigneeId: "person-ola",
      taskTypeId: DEFAULT_TASK_TYPE_ID,
      priorityId: "",
      active: true
    });
  });

  it("maps a one-time form into TaskDraft with dictionary names", () => {
    const draft = taskFormValuesToDraft(
      {
        title: "Zaplacic rachunek",
        mode: "oneTime",
        oneTimeDate: "2026-07-12",
        recurringStartDate: "2026-07-07",
        recurrenceType: "weekly",
        intervalDays: 2,
        categoryId: "cat-home",
        assigneeId: "person-ola",
        taskTypeId: "type-deadline",
        priorityId: "priority-high",
        active: true
      },
      state
    );

    expect(draft).toEqual({
      title: "Zaplacic rachunek",
      categoryName: "Dom",
      categoryColor: "#40c057",
      assigneeName: "Ola",
      taskTypeId: "type-deadline",
      priorityId: "priority-high",
      schedule: { mode: "oneTime", date: "2026-07-12" },
      active: true
    });
  });

  it("maps recurring every N days into TaskDraft", () => {
    const draft = taskFormValuesToDraft(
      {
        title: "Trening",
        mode: "recurring",
        oneTimeDate: "2026-07-07",
        recurringStartDate: "2026-07-10",
        recurrenceType: "everyNDays",
        intervalDays: 3,
        categoryId: "cat-home",
        assigneeId: "person-ola",
        taskTypeId: DEFAULT_TASK_TYPE_ID,
        priorityId: "",
        active: true
      },
      state
    );

    expect(draft).toMatchObject({
      priorityId: DEFAULT_PRIORITY_ID,
      schedule: { mode: "recurring", startDate: "2026-07-10", recurrence: { type: "everyNDays", intervalDays: 3 } }
    });
  });

  it("maps existing task into editable form values", () => {
    expect(
      taskToFormValues(
        task({
          title: "Raport",
          priorityId: "priority-high",
          schedule: { mode: "oneTime", date: "2026-07-12" }
        }),
        state
      )
    ).toMatchObject({
      title: "Raport",
      mode: "oneTime",
      oneTimeDate: "2026-07-12",
      priorityId: "priority-high"
    });
  });

  it("returns exact validation errors for missing required values and invalid interval", () => {
    const errors = validateTaskFormValues(
      {
        title: " ",
        mode: "recurring",
        oneTimeDate: "",
        recurringStartDate: "",
        recurrenceType: "everyNDays",
        intervalDays: 0,
        categoryId: "",
        assigneeId: "",
        taskTypeId: "",
        priorityId: "",
        active: true
      },
      { ...state, categories: [], assignees: [], taskTypes: [] }
    );

    expect(errors).toEqual({
      title: "Podaj nazwe zadania.",
      recurringStartDate: "Wybierz date startu.",
      intervalDays: "Liczba dni musi byc wieksza lub rowna 1.",
      categoryId: "Wybierz kategorie.",
      assigneeId: "Wybierz osobe.",
      taskTypeId: "Wybierz typ zadania.",
      dictionary: "Brakuje aktywnych slownikow wymaganych do zapisania zadania."
    });
  });
});
```

- [ ] **Step 2: Run the new domain tests and verify failure**

Run:

```bash
npm run test:run -- src/domain/taskForm.test.ts
```

Expected: FAIL with module resolution error for `./taskForm`.

- [ ] **Step 3: Implement domain form helpers**

Create `src/domain/taskForm.ts`:

```ts
import { DEFAULT_PRIORITY_ID } from "../storage/taskerStorage";
import type { AppState, RecurrenceRule, Task, TaskDraft, TaskMode } from "./types";

export type TaskFormValues = {
  title: string;
  mode: TaskMode;
  oneTimeDate: string;
  recurringStartDate: string;
  recurrenceType: RecurrenceRule["type"];
  intervalDays: number;
  categoryId: string;
  assigneeId: string;
  taskTypeId: string;
  priorityId: string;
  active: boolean;
};

export type TaskFormErrors = Partial<Record<keyof TaskFormValues | "dictionary", string>>;

export const recurrenceOptions: Array<{ value: RecurrenceRule["type"]; label: string }> = [
  { value: "daily", label: "Codziennie" },
  { value: "everyNDays", label: "Co N dni" },
  { value: "weekly", label: "Co tydzien" },
  { value: "monthly", label: "Co miesiac" },
  { value: "quarterly", label: "Co kwartal" }
];

function firstActive<T extends { id: string; active?: boolean; order?: number }>(items: T[]): T | undefined {
  return [...items]
    .filter((item) => item.active !== false)
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))[0];
}

function requiredDateForTask(task: Task): string {
  return task.schedule.mode === "oneTime" ? task.schedule.date : task.schedule.startDate;
}

function recurrenceForTask(task: Task): RecurrenceRule {
  return task.schedule.mode === "recurring" ? task.schedule.recurrence : { type: "daily" };
}

function buildRecurrence(values: TaskFormValues): RecurrenceRule {
  if (values.recurrenceType === "everyNDays") {
    return { type: "everyNDays", intervalDays: values.intervalDays };
  }
  return { type: values.recurrenceType };
}

export function createEmptyTaskFormValues(state: AppState, today: string): TaskFormValues {
  return {
    title: "",
    mode: "oneTime",
    oneTimeDate: today,
    recurringStartDate: today,
    recurrenceType: "daily",
    intervalDays: 2,
    categoryId: firstActive(state.categories)?.id ?? "",
    assigneeId: firstActive(state.assignees)?.id ?? "",
    taskTypeId: firstActive(state.taskTypes)?.id ?? "",
    priorityId: "",
    active: true
  };
}

export function taskToFormValues(task: Task, state: AppState): TaskFormValues {
  const recurrence = recurrenceForTask(task);
  const date = requiredDateForTask(task);
  return {
    title: task.title,
    mode: task.schedule.mode,
    oneTimeDate: task.schedule.mode === "oneTime" ? date : date,
    recurringStartDate: task.schedule.mode === "recurring" ? date : date,
    recurrenceType: recurrence.type,
    intervalDays: recurrence.type === "everyNDays" ? recurrence.intervalDays : 2,
    categoryId: state.categories.some((category) => category.id === task.categoryId) ? task.categoryId : "",
    assigneeId: state.assignees.some((assignee) => assignee.id === task.assigneeId) ? task.assigneeId : "",
    taskTypeId: state.taskTypes.some((taskType) => taskType.id === task.taskTypeId) ? task.taskTypeId : "",
    priorityId: state.priorities.some((priority) => priority.id === task.priorityId) ? task.priorityId : "",
    active: task.active
  };
}

export function validateTaskFormValues(values: TaskFormValues, state: AppState): TaskFormErrors {
  const errors: TaskFormErrors = {};
  if (values.title.trim().length === 0) {
    errors.title = "Podaj nazwe zadania.";
  }
  if (values.mode === "oneTime" && values.oneTimeDate.length === 0) {
    errors.oneTimeDate = "Wybierz date zadania.";
  }
  if (values.mode === "recurring" && values.recurringStartDate.length === 0) {
    errors.recurringStartDate = "Wybierz date startu.";
  }
  if (values.mode === "recurring" && values.recurrenceType === "everyNDays" && values.intervalDays < 1) {
    errors.intervalDays = "Liczba dni musi byc wieksza lub rowna 1.";
  }
  if (values.categoryId.length === 0) {
    errors.categoryId = "Wybierz kategorie.";
  }
  if (values.assigneeId.length === 0) {
    errors.assigneeId = "Wybierz osobe.";
  }
  if (values.taskTypeId.length === 0) {
    errors.taskTypeId = "Wybierz typ zadania.";
  }
  if (state.categories.length === 0 || state.assignees.length === 0 || state.taskTypes.length === 0) {
    errors.dictionary = "Brakuje aktywnych slownikow wymaganych do zapisania zadania.";
  }
  return errors;
}

export function taskFormValuesToDraft(values: TaskFormValues, state: AppState): TaskDraft {
  const category = state.categories.find((item) => item.id === values.categoryId);
  const assignee = state.assignees.find((item) => item.id === values.assigneeId);
  const priorityId = values.priorityId || firstActive(state.priorities)?.id || DEFAULT_PRIORITY_ID;

  if (!category || !assignee) {
    throw new Error("Task form references missing dictionary item");
  }

  return {
    title: values.title.trim(),
    categoryName: category.name,
    categoryColor: category.color,
    assigneeName: assignee.name,
    taskTypeId: values.taskTypeId,
    priorityId,
    schedule:
      values.mode === "oneTime"
        ? { mode: "oneTime", date: values.oneTimeDate }
        : { mode: "recurring", startDate: values.recurringStartDate, recurrence: buildRecurrence(values) },
    active: values.active
  };
}
```

- [ ] **Step 4: Run domain form tests**

Run:

```bash
npm run test:run -- src/domain/taskForm.test.ts
```

Expected: PASS.

- [ ] **Step 5: Check formatting-sensitive diff**

Run:

```bash
git diff --check
```

Expected: no output and exit code 0.

---

### Task 2: Store Task Editor State

**Files:**
- Modify: `src/state/taskerStore.ts`

**Interfaces:**
- Consumes: foundation `TaskerStore.view`, `setView(view: AppView)`, `addTask`, `updateTask`, `deactivateTask`.
- Produces:
  - `taskEditorTaskId: string | null | undefined`
  - `openTaskCreate(): void`
  - `openTaskEdit(taskId: string): void`
  - `closeTaskEditor(): void`

- [ ] **Step 1: Add store state and actions**

In `src/state/taskerStore.ts`, extend `TaskerStore`:

```ts
  taskEditorTaskId?: string | null;
  openTaskCreate: () => void;
  openTaskEdit: (taskId: string) => void;
  closeTaskEditor: () => void;
```

Update `loadInitialStoreState()`:

```ts
  return {
    state: initial.state,
    storageError: initial.error,
    filters: emptyFilters,
    view: "today" as AppView,
    taskEditorTaskId: undefined
  };
```

Add actions in the `create<TaskerStore>` initializer:

```ts
  openTaskCreate: () => set({ view: "tasks", taskEditorTaskId: null }),
  openTaskEdit: (taskId) => set({ view: "tasks", taskEditorTaskId: taskId }),
  closeTaskEditor: () => set({ taskEditorTaskId: undefined }),
```

- [ ] **Step 2: Keep generic navigation from leaking stale editor state**

Replace the foundation `setView` action:

```ts
  setView: (view) => set({ view }),
```

with:

```ts
  setView: (view) => set({ view, taskEditorTaskId: undefined }),
```

This intentionally closes the task editor whenever the user uses top-level navigation.

- [ ] **Step 3: Run TypeScript build**

Run:

```bash
npm run build
```

Expected: PASS. No component uses the new actions yet.

- [ ] **Step 4: Check formatting-sensitive diff**

Run:

```bash
git diff --check
```

Expected: no output and exit code 0.

---

### Task 3: Full Task Form Component

**Files:**
- Modify: `src/components/TaskForm.tsx`
- Create: `src/components/tasks/TaskForm.test.tsx`

**Interfaces:**
- Consumes: `TaskFormValues` helpers from Task 1.
- Produces: `TaskForm` props:

```ts
type Props = {
  state: AppState;
  today: string;
  task?: Task;
  submitLabel: string;
  onSubmit: (draft: TaskDraft) => void;
  onCancel: () => void;
};
```

- [ ] **Step 1: Write failing component tests**

Create `src/components/tasks/TaskForm.test.tsx`:

```tsx
import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_PRIORITY_ID, DEFAULT_TASK_TYPE_ID } from "../../storage/taskerStorage";
import { TaskForm } from "../TaskForm";
import type { AppState } from "../../domain/types";

const state: AppState = {
  version: 2,
  tasks: [],
  categories: [{ id: "cat-home", name: "Dom", color: "#40c057" }],
  assignees: [{ id: "person-ola", name: "Ola" }],
  taskTypes: [
    { id: DEFAULT_TASK_TYPE_ID, name: "Zadanie", active: true, order: 0 },
    { id: "type-deadline", name: "Termin", active: true, order: 1 }
  ],
  priorities: [
    { id: DEFAULT_PRIORITY_ID, name: "Normalny", active: true, order: 0, color: "#868e96" },
    { id: "priority-high", name: "Wysoki", active: true, order: 1, color: "#fa5252" }
  ],
  completions: [],
  postponements: []
};

function renderForm(onSubmit = vi.fn()) {
  render(
    <MantineProvider>
      <TaskForm state={state} today="2026-07-07" submitLabel="Zapisz zadanie" onSubmit={onSubmit} onCancel={vi.fn()} />
    </MantineProvider>
  );
  return onSubmit;
}

describe("TaskForm", () => {
  it("submits a one-time task draft", async () => {
    const user = userEvent.setup();
    const onSubmit = renderForm();

    await user.type(screen.getByLabelText("Nazwa zadania"), "Zaplacic rachunek");
    await user.selectOptions(screen.getByLabelText("Typ zadania"), "type-deadline");
    await user.selectOptions(screen.getByLabelText("Priorytet"), "priority-high");
    await user.clear(screen.getByLabelText("Data zadania"));
    await user.type(screen.getByLabelText("Data zadania"), "2026-07-12");
    await user.click(screen.getByRole("button", { name: "Zapisz zadanie" }));

    expect(onSubmit).toHaveBeenCalledWith({
      title: "Zaplacic rachunek",
      categoryName: "Dom",
      categoryColor: "#40c057",
      assigneeName: "Ola",
      taskTypeId: "type-deadline",
      priorityId: "priority-high",
      schedule: { mode: "oneTime", date: "2026-07-12" },
      active: true
    });
  });

  it("shows recurrence controls only for recurring tasks", async () => {
    const user = userEvent.setup();
    renderForm();

    expect(screen.queryByLabelText("Regula powtarzania")).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Tryb"), "recurring");
    expect(screen.getByLabelText("Data startu")).toBeInTheDocument();
    expect(screen.getByLabelText("Regula powtarzania")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Regula powtarzania"), "everyNDays");
    expect(screen.getByLabelText("Liczba dni")).toBeInTheDocument();
  });

  it("renders validation errors without submitting", async () => {
    const user = userEvent.setup();
    const onSubmit = renderForm();

    await user.click(screen.getByRole("button", { name: "Zapisz zadanie" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Podaj nazwe zadania.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run component test and verify failure**

Run:

```bash
npm run test:run -- src/components/tasks/TaskForm.test.tsx
```

Expected: FAIL because `TaskForm` still has the foundation compatibility props.

- [ ] **Step 3: Replace TaskForm with the full form**

Replace `src/components/TaskForm.tsx` with:

```tsx
import { Alert, Button, Checkbox, Group, NativeSelect, NumberInput, Paper, Stack, Text, TextInput } from "@mantine/core";
import { useState } from "react";
import {
  createEmptyTaskFormValues,
  recurrenceOptions,
  taskFormValuesToDraft,
  taskToFormValues,
  validateTaskFormValues
} from "../domain/taskForm";
import type { AppState, Task, TaskDraft, TaskMode } from "../domain/types";
import type { TaskFormErrors, TaskFormValues } from "../domain/taskForm";

type Props = {
  state: AppState;
  today: string;
  task?: Task;
  submitLabel: string;
  onSubmit: (draft: TaskDraft) => void;
  onCancel: () => void;
};

function activeOptions(items: Array<{ id: string; name: string; active?: boolean; order?: number }>) {
  return [...items]
    .filter((item) => item.active !== false)
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
    .map((item) => ({ value: item.id, label: item.name }));
}

function priorityOptions(state: AppState) {
  return [{ value: "", label: "Bez priorytetu" }, ...activeOptions(state.priorities)];
}

function updateMode(values: TaskFormValues, mode: TaskMode): TaskFormValues {
  return { ...values, mode };
}

export function TaskForm({ state, today, task, submitLabel, onSubmit, onCancel }: Props) {
  const [values, setValues] = useState<TaskFormValues>(() =>
    task ? taskToFormValues(task, state) : createEmptyTaskFormValues(state, today)
  );
  const [errors, setErrors] = useState<TaskFormErrors>({});

  function submit() {
    const nextErrors = validateTaskFormValues(values, state);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    onSubmit(taskFormValuesToDraft(values, state));
  }

  return (
    <Paper component="form" withBorder p="lg" radius="md" aria-label={task ? "Edytuj zadanie" : "Dodaj zadanie"} onSubmit={(event) => {
      event.preventDefault();
      submit();
    }}>
      <Stack gap="sm">
        {errors.dictionary ? (
          <Alert color="yellow" title="Brak slownikow">
            {errors.dictionary}
          </Alert>
        ) : null}

        <TextInput
          label="Nazwa zadania"
          required
          value={values.title}
          error={errors.title}
          onChange={(event) => setValues({ ...values, title: event.currentTarget.value })}
        />

        <NativeSelect
          label="Typ zadania"
          required
          value={values.taskTypeId}
          error={errors.taskTypeId}
          data={activeOptions(state.taskTypes)}
          onChange={(event) => setValues({ ...values, taskTypeId: event.currentTarget.value })}
        />

        <NativeSelect
          label="Tryb"
          value={values.mode}
          onChange={(event) => setValues(updateMode(values, event.currentTarget.value as TaskMode))}
          data={[
            { value: "oneTime", label: "Jednorazowe" },
            { value: "recurring", label: "Cykliczne" }
          ]}
        />

        {values.mode === "oneTime" ? (
          <TextInput
            label="Data zadania"
            required
            type="date"
            value={values.oneTimeDate}
            error={errors.oneTimeDate}
            onChange={(event) => setValues({ ...values, oneTimeDate: event.currentTarget.value })}
          />
        ) : (
          <>
            <TextInput
              label="Data startu"
              required
              type="date"
              value={values.recurringStartDate}
              error={errors.recurringStartDate}
              onChange={(event) => setValues({ ...values, recurringStartDate: event.currentTarget.value })}
            />
            <NativeSelect
              label="Regula powtarzania"
              value={values.recurrenceType}
              data={recurrenceOptions}
              onChange={(event) => setValues({ ...values, recurrenceType: event.currentTarget.value as TaskFormValues["recurrenceType"] })}
            />
            {values.recurrenceType === "everyNDays" ? (
              <NumberInput
                label="Liczba dni"
                required
                min={1}
                value={values.intervalDays}
                error={errors.intervalDays}
                onChange={(value) => setValues({ ...values, intervalDays: Number(value) })}
              />
            ) : null}
          </>
        )}

        <NativeSelect
          label="Kategoria"
          required
          value={values.categoryId}
          error={errors.categoryId}
          data={activeOptions(state.categories)}
          onChange={(event) => setValues({ ...values, categoryId: event.currentTarget.value })}
        />

        <NativeSelect
          label="Osoba"
          required
          value={values.assigneeId}
          error={errors.assigneeId}
          data={activeOptions(state.assignees)}
          onChange={(event) => setValues({ ...values, assigneeId: event.currentTarget.value })}
        />

        <NativeSelect
          label="Priorytet"
          value={values.priorityId}
          data={priorityOptions(state)}
          onChange={(event) => setValues({ ...values, priorityId: event.currentTarget.value })}
        />

        <Checkbox
          label="Aktywne"
          checked={values.active}
          onChange={(event) => setValues({ ...values, active: event.currentTarget.checked })}
        />

        <Text c="dimmed" size="sm">
          Nieaktywne zadanie pozostaje w danych, ale nie pojawia sie w planie jako wymagajace reakcji.
        </Text>

        <Group gap="xs">
          <Button type="submit">{submitLabel}</Button>
          <Button type="button" variant="default" onClick={onCancel}>
            Anuluj
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}
```

- [ ] **Step 4: Run form tests**

Run:

```bash
npm run test:run -- src/domain/taskForm.test.ts src/components/tasks/TaskForm.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Run build**

Run:

```bash
npm run build
```

Expected: FAIL until callers are updated in Tasks 4 and 5.

---

### Task 4: Tasks List And Editor Views

**Files:**
- Create: `src/components/tasks/TaskListView.tsx`
- Create: `src/components/tasks/TaskEditorView.tsx`
- Create: `src/components/tasks/TasksModuleView.tsx`

**Interfaces:**
- Consumes: `TaskForm` from Task 3 and store actions from Task 2.
- Produces: `TasksModuleView({ today }: { today: string })`.

- [ ] **Step 1: Create task list view**

Create `src/components/tasks/TaskListView.tsx`:

```tsx
import { Badge, Button, Card, Group, Stack, Text, Title } from "@mantine/core";
import type { AppState, Task } from "../../domain/types";

type Props = {
  state: AppState;
  onCreate: () => void;
  onEdit: (taskId: string) => void;
  onDeactivate: (taskId: string) => void;
};

function findName<T extends { id: string; name: string }>(items: T[], id: string, fallback: string): string {
  return items.find((item) => item.id === id)?.name ?? fallback;
}

function scheduleText(task: Task): string {
  if (task.schedule.mode === "oneTime") {
    return `Jednorazowe: ${task.schedule.date}`;
  }
  if (task.schedule.recurrence.type === "everyNDays") {
    return `Cykliczne od ${task.schedule.startDate}: co ${task.schedule.recurrence.intervalDays} dni`;
  }
  const labels: Record<Exclude<Task["schedule"], { mode: "oneTime" }>["recurrence"]["type"], string> = {
    daily: "codziennie",
    everyNDays: "co N dni",
    weekly: "co tydzien",
    monthly: "co miesiac",
    quarterly: "co kwartal"
  };
  return `Cykliczne od ${task.schedule.startDate}: ${labels[task.schedule.recurrence.type]}`;
}

export function TaskListView({ state, onCreate, onEdit, onDeactivate }: Props) {
  const tasks = [...state.tasks].sort((left, right) => left.title.localeCompare(right.title, "pl"));

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <div>
          <Title order={2}>Zadania</Title>
          <Text c="dimmed">Tworzenie, edycja i dezaktywacja zadan.</Text>
        </div>
        <Button type="button" onClick={onCreate}>
          + Dodaj zadanie
        </Button>
      </Group>

      {tasks.length === 0 ? (
        <Card withBorder radius="md" p="lg">
          <Stack align="flex-start" gap="sm">
            <Title order={3}>Brak zadan</Title>
            <Text c="dimmed">Dodaj pierwsze zadanie jednorazowe albo cykliczne.</Text>
            <Button type="button" onClick={onCreate}>
              Dodaj zadanie
            </Button>
          </Stack>
        </Card>
      ) : null}

      {tasks.map((task) => (
        <Card key={task.id} withBorder radius="md" p="lg">
          <Stack gap="sm">
            <Group justify="space-between" align="flex-start">
              <Title order={3}>{task.title}</Title>
              <Badge color={task.active ? "green" : "gray"} variant="light">
                {task.active ? "Aktywne" : "Nieaktywne"}
              </Badge>
            </Group>
            <Group gap="xs">
              <Badge variant="default">{findName(state.categories, task.categoryId, "Nieznana kategoria")}</Badge>
              <Badge variant="default">{findName(state.assignees, task.assigneeId, "Nieznana osoba")}</Badge>
              <Badge variant="default">{findName(state.taskTypes, task.taskTypeId, "Nieznany typ")}</Badge>
              <Badge variant="default">{findName(state.priorities, task.priorityId, "Bez priorytetu")}</Badge>
            </Group>
            <Text size="sm" c="dimmed">{scheduleText(task)}</Text>
            <Group gap="xs">
              <Button type="button" variant="default" onClick={() => onEdit(task.id)}>
                Edytuj
              </Button>
              <Button type="button" color="red" variant="light" disabled={!task.active} onClick={() => onDeactivate(task.id)}>
                Dezaktywuj
              </Button>
            </Group>
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}
```

- [ ] **Step 2: Create editor view**

Create `src/components/tasks/TaskEditorView.tsx`:

```tsx
import { Alert, Button, Group, Stack, Title } from "@mantine/core";
import { TaskForm } from "../TaskForm";
import type { AppState, TaskDraft } from "../../domain/types";

type Props = {
  state: AppState;
  today: string;
  taskId?: string | null;
  onCreate: (draft: TaskDraft) => void;
  onUpdate: (taskId: string, draft: TaskDraft) => void;
  onCancel: () => void;
};

export function TaskEditorView({ state, today, taskId, onCreate, onUpdate, onCancel }: Props) {
  const task = taskId ? state.tasks.find((item) => item.id === taskId) : undefined;

  if (taskId && !task) {
    return (
      <Stack align="flex-start" gap="md">
        <Alert color="yellow" title="Nie znaleziono zadania">
          Zadanie moglo zostac usuniete albo dane lokalne zostaly odswiezone.
        </Alert>
        <Button type="button" variant="default" onClick={onCancel}>
          Wroc do listy zadan
        </Button>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Title order={2}>{task ? "Edytuj zadanie" : "Dodaj zadanie"}</Title>
        <Button type="button" variant="default" onClick={onCancel}>
          Wroc do listy
        </Button>
      </Group>
      <TaskForm
        state={state}
        today={today}
        task={task}
        submitLabel={task ? "Zapisz zmiany" : "Zapisz zadanie"}
        onCancel={onCancel}
        onSubmit={(draft) => {
          if (task) {
            onUpdate(task.id, draft);
          } else {
            onCreate(draft);
          }
        }}
      />
    </Stack>
  );
}
```

- [ ] **Step 3: Create module switcher**

Create `src/components/tasks/TasksModuleView.tsx`:

```tsx
import { Paper } from "@mantine/core";
import { TaskEditorView } from "./TaskEditorView";
import { TaskListView } from "./TaskListView";
import { useTaskerStore } from "../../state/taskerStore";
import type { TaskDraft } from "../../domain/types";

type Props = {
  today: string;
};

export function TasksModuleView({ today }: Props) {
  const state = useTaskerStore((store) => store.state);
  const taskEditorTaskId = useTaskerStore((store) => store.taskEditorTaskId);
  const openTaskCreate = useTaskerStore((store) => store.openTaskCreate);
  const openTaskEdit = useTaskerStore((store) => store.openTaskEdit);
  const closeTaskEditor = useTaskerStore((store) => store.closeTaskEditor);
  const addTask = useTaskerStore((store) => store.addTask);
  const updateTask = useTaskerStore((store) => store.updateTask);
  const deactivateTask = useTaskerStore((store) => store.deactivateTask);

  function handleCreate(draft: TaskDraft) {
    addTask(draft);
    closeTaskEditor();
  }

  function handleUpdate(taskId: string, draft: TaskDraft) {
    updateTask(taskId, draft);
    closeTaskEditor();
  }

  return (
    <Paper withBorder p="lg" radius="md" shadow="xs">
      {taskEditorTaskId !== undefined ? (
        <TaskEditorView
          state={state}
          today={today}
          taskId={taskEditorTaskId}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
          onCancel={closeTaskEditor}
        />
      ) : (
        <TaskListView state={state} onCreate={openTaskCreate} onEdit={openTaskEdit} onDeactivate={deactivateTask} />
      )}
    </Paper>
  );
}
```

- [ ] **Step 4: Run build to expose integration failures**

Run:

```bash
npm run build
```

Expected: FAIL until `App.tsx`, `TodayTaskList.tsx`, and `TodayTaskCard.tsx` call the new interfaces.

---

### Task 5: App Integration And Today Edit Navigation

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/TodayTaskList.tsx`
- Modify: `src/components/TodayTaskCard.tsx`

**Interfaces:**
- Consumes: `TasksModuleView`, store `openTaskCreate`, `openTaskEdit`.
- Produces: top-level "+ Dodaj zadanie" opens the task editor; Today card "Edytuj" opens the same editor.

- [ ] **Step 1: Update TodayTaskCard to remove inline form editing**

In `src/components/TodayTaskCard.tsx`, remove `useState`, `TaskForm`, `TaskDraft`, `categories`, `assignees`, and `onUpdate` usage. The props become:

```ts
type Props = {
  item: TodayTask;
  onComplete: (taskId: string, scheduledDate: string) => void;
  onPostpone: (taskId: string) => void;
  onDeactivate: (taskId: string) => void;
  onEdit: (taskId: string) => void;
};
```

Replace the edit button:

```tsx
<Button type="button" variant="default" onClick={() => onEdit(item.task.id)}>
  Edytuj
</Button>
```

- [ ] **Step 2: Update TodayTaskList props**

In `src/components/TodayTaskList.tsx`, replace edit/update props with:

```ts
  onEdit: (taskId: string) => void;
```

Update the empty-state copy:

```tsx
<Text c="dimmed">Dodaj pierwsze zadanie albo zmien filtry.</Text>
```

Pass only the required props to `TodayTaskCard`:

```tsx
<TodayTaskCard
  key={item.task.id}
  item={item}
  onComplete={onComplete}
  onPostpone={onPostpone}
  onDeactivate={onDeactivate}
  onEdit={onEdit}
/>
```

- [ ] **Step 3: Replace App task screen with module**

In `src/App.tsx`, import:

```ts
import { TasksModuleView } from "./components/tasks/TasksModuleView";
```

Read new store actions:

```ts
const openTaskCreate = useTaskerStore((store) => store.openTaskCreate);
const openTaskEdit = useTaskerStore((store) => store.openTaskEdit);
```

Replace `focusQuickAdd` with:

```ts
function handleCreateTask() {
  openTaskCreate();
}
```

Update the header button:

```tsx
<Button type="button" onClick={handleCreateTask}>
  + Dodaj zadanie
</Button>
```

Update `TodayTaskList` props:

```tsx
<TodayTaskList
  tasks={todayTasks}
  onAdd={handleCreateTask}
  onComplete={handleCompleteTask}
  onPostpone={handlePostponeTask}
  onDeactivate={handleDeactivateTask}
  onEdit={openTaskEdit}
/>
```

Replace the existing `view === "tasks"` content with:

```tsx
{view === "tasks" ? <TasksModuleView today={today} /> : null}
```

Keep `QuickAddForm` only in the Today view for fast entry if it still exists after foundation; this module does not extend quick add.

- [ ] **Step 4: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 5: Check formatting-sensitive diff**

Run:

```bash
git diff --check
```

Expected: no output and exit code 0.

---

### Task 6: App Flow Tests For Tasks Module

**Files:**
- Modify: `src/App.test.tsx`

**Interfaces:**
- Consumes: `TasksModuleView` integration from Tasks 4-5.
- Produces: regression coverage for create, edit, deactivate, and Today-to-editor navigation.

- [ ] **Step 1: Add test seed helper**

In `src/App.test.tsx`, add helpers near existing test utilities:

```tsx
function seedV2State() {
  localStorage.setItem(
    "tasker:v2",
    JSON.stringify({
      version: 2,
      tasks: [
        {
          id: "task-1",
          title: "Podlac rosliny",
          categoryId: "cat-home",
          assigneeId: "person-ola",
          taskTypeId: "task-type-default",
          priorityId: "priority-normal",
          schedule: { mode: "recurring", startDate: "2026-07-07", recurrence: { type: "daily" } },
          active: true,
          createdAt: "2026-07-07T08:00:00.000Z",
          updatedAt: "2026-07-07T08:00:00.000Z"
        }
      ],
      categories: [{ id: "cat-home", name: "Dom", color: "#40c057" }],
      assignees: [{ id: "person-ola", name: "Ola" }],
      taskTypes: [{ id: "task-type-default", name: "Zadanie", active: true, order: 0 }],
      priorities: [{ id: "priority-normal", name: "Normalny", active: true, order: 0, color: "#868e96" }],
      completions: [],
      postponements: []
    })
  );
}
```

- [ ] **Step 2: Add creation test**

Add this test:

```tsx
it("creates a one-time task from the separate tasks view", async () => {
  seedV2State();
  resetTaskerStore();
  renderApp({ now: new Date("2026-07-07T10:00:00.000Z") });
  const user = userEvent.setup();

  await user.click(screen.getByRole("button", { name: "+ Dodaj zadanie" }));
  expect(screen.getByRole("heading", { name: "Dodaj zadanie" })).toBeInTheDocument();

  await user.type(screen.getByLabelText("Nazwa zadania"), "Zaplacic rachunek");
  await user.clear(screen.getByLabelText("Data zadania"));
  await user.type(screen.getByLabelText("Data zadania"), "2026-07-12");
  await user.click(screen.getByRole("button", { name: "Zapisz zadanie" }));

  expect(screen.getByRole("heading", { name: "Zadania" })).toBeInTheDocument();
  expect(screen.getByText("Zaplacic rachunek")).toBeInTheDocument();
  expect(screen.getByText("Jednorazowe: 2026-07-12")).toBeInTheDocument();
});
```

- [ ] **Step 3: Add recurring edit test**

Add this test:

```tsx
it("edits a task into an every-N-days recurring task", async () => {
  seedV2State();
  resetTaskerStore();
  renderApp({ now: new Date("2026-07-07T10:00:00.000Z") });
  const user = userEvent.setup();

  await user.click(screen.getByRole("button", { name: "Zadania" }));
  await user.click(screen.getByRole("button", { name: "Edytuj" }));
  await user.clear(screen.getByLabelText("Nazwa zadania"));
  await user.type(screen.getByLabelText("Nazwa zadania"), "Trening");
  await user.selectOptions(screen.getByLabelText("Tryb"), "recurring");
  await user.selectOptions(screen.getByLabelText("Regula powtarzania"), "everyNDays");
  await user.clear(screen.getByLabelText("Liczba dni"));
  await user.type(screen.getByLabelText("Liczba dni"), "3");
  await user.click(screen.getByRole("button", { name: "Zapisz zmiany" }));

  expect(screen.getByText("Trening")).toBeInTheDocument();
  expect(screen.getByText("Cykliczne od 2026-07-07: co 3 dni")).toBeInTheDocument();
});
```

- [ ] **Step 4: Add deactivate test**

Add this test:

```tsx
it("deactivates a task from the tasks list without removing it", async () => {
  seedV2State();
  resetTaskerStore();
  renderApp({ now: new Date("2026-07-07T10:00:00.000Z") });
  const user = userEvent.setup();

  await user.click(screen.getByRole("button", { name: "Zadania" }));
  await user.click(screen.getByRole("button", { name: "Dezaktywuj" }));

  expect(screen.getByText("Podlac rosliny")).toBeInTheDocument();
  expect(screen.getByText("Nieaktywne")).toBeInTheDocument();
});
```

- [ ] **Step 5: Add Today edit navigation test**

Add this test:

```tsx
it("opens the separate editor from a Today task card", async () => {
  seedV2State();
  resetTaskerStore();
  renderApp({ now: new Date("2026-07-07T10:00:00.000Z") });
  const user = userEvent.setup();

  await user.click(screen.getByRole("button", { name: "Edytuj" }));

  expect(screen.getByRole("heading", { name: "Edytuj zadanie" })).toBeInTheDocument();
  expect(screen.getByDisplayValue("Podlac rosliny")).toBeInTheDocument();
});
```

- [ ] **Step 6: Run app tests and verify failures if integration is incomplete**

Run:

```bash
npm run test:run -- src/App.test.tsx
```

Expected: PASS after Tasks 2-5 are complete. If FAIL, fix only the integration mismatch shown by the assertion or TypeScript error.

---

### Task 7: Full Verification

**Files:**
- No source changes expected unless verification finds a task-module regression.

**Interfaces:**
- Consumes: all previous tasks.
- Produces: verified task module ready for review.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm run test:run -- src/domain/taskForm.test.ts src/components/tasks/TaskForm.test.tsx src/App.test.tsx
```

Expected: all listed suites PASS.

- [ ] **Step 2: Run all tests**

Run:

```bash
npm run test:run
```

Expected: PASS and no unhandled React `act` warnings.

- [ ] **Step 3: Run production build**

Run:

```bash
npm run build
```

Expected: PASS, including `tsc --noEmit` and Vite build.

- [ ] **Step 4: Check changed files**

Run:

```bash
git status --short
```

Expected: only task-module files are changed:

```text
 M src/App.test.tsx
 M src/App.tsx
 M src/components/TaskForm.tsx
 M src/components/TodayTaskCard.tsx
 M src/components/TodayTaskList.tsx
 M src/state/taskerStore.ts
?? src/components/tasks/
?? src/domain/taskForm.test.ts
?? src/domain/taskForm.ts
```

- [ ] **Step 5: Check whitespace and conflict markers**

Run:

```bash
git diff --check
rg -n "<<<<<<<|=======|>>>>>>>" src docs
```

Expected: `git diff --check` has no output; `rg` has no matches.

---

## Self-Review

**Spec coverage:** Plan obejmuje modul "Zadania" z osobnym widokiem tworzenia i edycji, zadania jednorazowe, zadania cykliczne, pola: nazwa, typ, tryb, data/data startu, regula powtarzania, kategoria, osoba, opcjonalny priorytet i aktywnosc. Obejmuje edycje oraz dezaktywacje bez usuwania danych.

**Out of scope:** Plan nie implementuje kalendarza, historii wykonania, importu, eksportu, odkladania na dowolna date ani pelnego CRUD slownikow. Kategorie, osoby, typy i priorytety sa tylko konsumowane jako istniejace slowniki z fundamentu.

**Marker scan:** Plan nie zawiera otwartych markerow implementacyjnych. Wszystkie nowe pliki maja konkretne sciezki, interfejsy, kroki testowe, komendy i oczekiwane wyniki.

**Type consistency:** `TaskFormValues` mapuje sie do foundation `TaskDraft`; `TaskForm` przyjmuje `AppState`, `today`, opcjonalne `task` i zwraca `TaskDraft`; `TasksModuleView` uzywa `taskEditorTaskId === undefined` dla listy, `null` dla tworzenia i `string` dla edycji. Store actions `openTaskCreate`, `openTaskEdit`, `closeTaskEditor` sa zdefiniowane przed uzyciem w komponentach.
