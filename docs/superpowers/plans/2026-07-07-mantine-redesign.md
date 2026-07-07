# Mantine UI Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Mantine components to Tasker and lightly redesign the "Dzisiaj" screen without changing task behavior or storage.

**Architecture:** Keep all domain logic and state hooks unchanged. Add Mantine at the app boundary, then replace presentation-only JSX in `App.tsx` and `src/components` with Mantine components while preserving labels, button names, form roles, and callbacks used by tests.

**Tech Stack:** React 19, Vite 5, TypeScript 5, Vitest, Testing Library, Mantine `@mantine/core`, Mantine `@mantine/hooks`.

## Global Constraints

- Preserve current local-first behavior and the `localStorage` data format.
- Do not change recurrence, today-list, storage, or task mutation domain logic.
- Keep the screen focused on the current "Dzisiaj" workflow.
- Use Mantine for buttons, inputs, selects, segmented category filters, cards, badges, alerts, and layout primitives.
- Keep visible Polish labels and action names compatible with existing UI tests.
- Leave unrelated untracked files such as `.idea/` untouched.
- Verify with `npm run test:run` and `npm run build`.

---

## File Structure

- Modify `package.json` and `package-lock.json`: add Mantine dependencies through `npm install @mantine/core @mantine/hooks`.
- Modify `src/main.tsx`: import Mantine styles and wrap `App` in `MantineProvider`.
- Modify `src/styles.css`: remove most component-level styling and keep app background, shell sizing, and small responsive helpers.
- Modify `src/App.tsx`: convert the app shell, header, content panel, heading, primary action, and storage warning to Mantine components.
- Modify `src/components/TaskFilters.tsx`: replace category button tabs and native assignee select with Mantine `SegmentedControl` and `Select`.
- Modify `src/components/TodayTaskList.tsx`: convert empty state and list spacing to Mantine layout.
- Modify `src/components/TodayTaskCard.tsx`: convert task display and actions to Mantine `Card`, `Badge`, `Group`, `Stack`, and `Button`.
- Modify `src/components/QuickAddForm.tsx`: convert quick-add fields and actions to Mantine `TextInput`, `Paper`, `Stack`, and `Button`.
- Modify `src/components/TaskForm.tsx`: convert edit fields to Mantine inputs while preserving form state and submit behavior.
- Modify `src/App.test.tsx` only if Mantine changes accessible roles in a way that requires test queries to target the same user-visible labels more robustly.

---

### Task 1: Install Mantine and Add Provider

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/main.tsx`
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes: existing default export `App` from `src/App.tsx`.
- Produces: app root rendered inside `MantineProvider`, with Mantine global CSS loaded before local CSS.

- [ ] **Step 1: Run the current test suite as baseline**

Run:

```bash
npm run test:run
```

Expected: PASS for the existing domain and UI tests before UI migration work starts.

- [ ] **Step 2: Install Mantine dependencies**

Run:

```bash
npm install @mantine/core @mantine/hooks
```

Expected: `package.json` contains `@mantine/core` and `@mantine/hooks`, and `package-lock.json` is updated.

- [ ] **Step 3: Wrap the app with MantineProvider**

Edit `src/main.tsx` to this shape:

```tsx
import "@mantine/core/styles.css";
import { MantineProvider } from "@mantine/core";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MantineProvider>
      <App />
    </MantineProvider>
  </StrictMode>
);
```

- [ ] **Step 4: Verify provider integration**

Run:

```bash
npm run test:run
```

Expected: PASS. A failure here means the provider or dependency install broke the existing render path.

- [ ] **Step 5: Commit**

Run:

```bash
git add package.json package-lock.json src/main.tsx
git commit -m "feat: add mantine provider"
```

Expected: one commit containing only dependency and provider setup.

---

### Task 2: Convert App Shell to Mantine

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes: `useTaskerState(now)`, `formatPolishDateLabel(tasker.today)`, and child component props unchanged.
- Produces: the same `TaskFilters`, `TodayTaskList`, and `QuickAddForm` calls inside a Mantine shell.

- [ ] **Step 1: Run the focused UI tests before editing**

Run:

```bash
npm run test:run -- src/App.test.tsx
```

Expected: PASS before shell changes.

- [ ] **Step 2: Replace the shell JSX**

Edit `src/App.tsx` so imports and component structure use Mantine while preserving `focusQuickAdd`:

```tsx
import { Alert, Button, Container, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { QuickAddForm } from "./components/QuickAddForm";
import { TaskFilters } from "./components/TaskFilters";
import { TodayTaskList } from "./components/TodayTaskList";
import { formatPolishDateLabel } from "./domain/dates";
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
    <Container className="app-shell" size="md">
      <Stack gap="lg" py="xl">
        <Paper withBorder p="lg" radius="md" shadow="xs">
          <Group justify="space-between" align="center" gap="md" wrap="wrap">
            <div>
              <Title order={1}>Tasker</Title>
              <Text c="dimmed">{formatPolishDateLabel(tasker.today)}</Text>
            </div>
            <Button type="button" onClick={focusQuickAdd}>
              + Dodaj zadanie
            </Button>
          </Group>
        </Paper>

        <Paper withBorder p="lg" radius="md" shadow="xs">
          <Stack gap="md">
            <div>
              <Title order={2}>Dzisiaj</Title>
              <Text c="dimmed">Zadania wymagajace reakcji</Text>
            </div>

            {tasker.storageError ? (
              <Alert color="yellow" title="Problem z lokalnymi danymi">
                {tasker.storageError}
              </Alert>
            ) : null}

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
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}
```

- [ ] **Step 3: Trim CSS to page-level concerns**

Edit `src/styles.css` so it keeps only global layout and small helper classes needed by the current components:

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
  background: #f6f7fb;
}

button,
input,
select {
  font: inherit;
}

.app-shell {
  min-height: 100vh;
}

.task-list {
  display: grid;
  gap: 14px;
}

@media (max-width: 720px) {
  .app-shell {
    padding-right: 12px;
    padding-left: 12px;
  }
}
```

- [ ] **Step 4: Verify shell behavior**

Run:

```bash
npm run test:run -- src/App.test.tsx
```

Expected: PASS, including the focus test for the `+ Dodaj zadanie` button.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/App.tsx src/styles.css
git commit -m "feat: convert app shell to mantine"
```

Expected: one commit containing only shell and CSS changes.

---

### Task 3: Convert Filters and Task Cards

**Files:**
- Modify: `src/components/TaskFilters.tsx`
- Modify: `src/components/TodayTaskList.tsx`
- Modify: `src/components/TodayTaskCard.tsx`
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes: existing `TaskFilters`, `TodayTaskList`, and `TodayTaskCard` props unchanged.
- Produces: filter callbacks, complete/postpone/deactivate/edit callbacks, and task card rendering unchanged from the caller perspective.

- [ ] **Step 1: Run focused tests before editing**

Run:

```bash
npm run test:run -- src/App.test.tsx
```

Expected: PASS before component migration.

- [ ] **Step 2: Convert `TaskFilters` to Mantine**

Edit `src/components/TaskFilters.tsx` to use Mantine controls:

```tsx
import { Group, Select, SegmentedControl, Stack } from "@mantine/core";
import type { Assignee, Category, TodayFilters } from "../domain/types";

type Props = {
  categories: Category[];
  assignees: Assignee[];
  filters: TodayFilters;
  onChange: (filters: TodayFilters) => void;
};

export function TaskFilters({ categories, assignees, filters, onChange }: Props) {
  const categoryData = [
    { label: "Wszystkie", value: "" },
    ...categories.map((category) => ({ label: category.name, value: category.id }))
  ];

  const assigneeData = [
    { label: "Wszystkie osoby", value: "" },
    ...assignees.map((assignee) => ({ label: assignee.name, value: assignee.id }))
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
    </Group>
  );
}
```

- [ ] **Step 3: Convert `TodayTaskList` empty state**

Edit `src/components/TodayTaskList.tsx`:

```tsx
import { Button, Paper, Stack, Text, Title } from "@mantine/core";
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
      <Paper component="section" withBorder p="lg" radius="md">
        <Stack align="flex-start" gap="sm">
          <Title order={2}>Brak zadan na dzisiaj</Title>
          <Text c="dimmed">Dodaj pierwsze zadanie powtarzalne albo zmien filtry.</Text>
          <Button type="button" onClick={onAdd}>
            Dodaj zadanie
          </Button>
        </Stack>
      </Paper>
    );
  }

  return (
    <section className="task-list" aria-label="Zadania na dzisiaj">
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

- [ ] **Step 4: Convert `TodayTaskCard` display and actions**

Edit `src/components/TodayTaskCard.tsx`:

```tsx
import { Badge, Button, Card, Group, Stack, Text, Title } from "@mantine/core";
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

  const statusText = item.isOverdue ? `Zalegle od ${item.scheduledDate}` : "Dzisiaj";
  const completionText = item.lastCompletedDate ? `Ostatnio wykonane: ${item.lastCompletedDate}` : "Jeszcze nie wykonane";

  return (
    <Card component="article" withBorder radius="md" shadow="xs" p="lg">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" gap="md">
          <Title order={2}>{item.task.title}</Title>
          <Badge color={item.isOverdue ? "orange" : "blue"} variant="light">
            {statusText}
          </Badge>
        </Group>

        <Group aria-label="Szczegoly zadania" gap="xs">
          <Badge variant="default">{item.category.name}</Badge>
          <Badge variant="default">{item.assignee.name}</Badge>
          <Text c="dimmed" size="sm">
            {completionText}
          </Text>
        </Group>

        <Group gap="xs">
          <Button type="button" color="green" variant="light" onClick={() => onComplete(item.task.id, item.scheduledDate)}>
            Wykonane
          </Button>
          <Button type="button" variant="default" onClick={() => onPostpone(item.task.id)}>
            Odloz na jutro
          </Button>
          <Button type="button" variant="default" onClick={() => setIsEditing(true)}>
            Edytuj
          </Button>
          <Button type="button" color="red" variant="light" onClick={() => onDeactivate(item.task.id)}>
            Dezaktywuj
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
```

- [ ] **Step 5: Update UI tests only if accessible text changed**

If test fixtures still contain mojibake strings from prior source encoding, update `src/App.test.tsx` expected labels to match the corrected visible labels:

```tsx
expect(screen.getByText("Brak zadan na dzisiaj")).toBeInTheDocument();
await user.click(screen.getByRole("button", { name: "Odloz na jutro" }));
const list = screen.getByRole("region", { name: "Zadania na dzisiaj" });
```

Do not weaken tests to query by class names or implementation details.

- [ ] **Step 6: Verify filters and card workflows**

Run:

```bash
npm run test:run -- src/App.test.tsx
```

Expected: PASS for completing, postponing, filtering, editing, and deactivating tasks.

- [ ] **Step 7: Commit**

Run:

```bash
git add src/components/TaskFilters.tsx src/components/TodayTaskList.tsx src/components/TodayTaskCard.tsx src/App.test.tsx
git commit -m "feat: migrate task list to mantine"
```

Expected: one commit containing list, filter, card, and any necessary accessibility-test updates.

---

### Task 4: Convert Quick Add and Edit Forms

**Files:**
- Modify: `src/components/QuickAddForm.tsx`
- Modify: `src/components/TaskForm.tsx`
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes: existing `TaskDraft`, `Category`, `Assignee`, and form props unchanged.
- Produces: the same `onSubmit(draft)` payloads and `onCancel()` behavior.

- [ ] **Step 1: Run focused tests before editing**

Run:

```bash
npm run test:run -- src/App.test.tsx
```

Expected: PASS before form migration.

- [ ] **Step 2: Convert `QuickAddForm` to Mantine**

Edit `src/components/QuickAddForm.tsx`:

```tsx
import { Button, Paper, Stack, TextInput, Title } from "@mantine/core";
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
    <Paper
      component="form"
      withBorder
      p="lg"
      radius="md"
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
      <Stack gap="sm">
        <Title order={2}>Szybkie dodanie</Title>

        <TextInput
          id="quick-add-title"
          label="Nazwa zadania"
          required
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.currentTarget.value })}
        />

        <TextInput
          label="Kategoria"
          required
          list="quick-add-categories"
          value={form.categoryName}
          onChange={(event) => setForm({ ...form, categoryName: event.currentTarget.value })}
        />
        <datalist id="quick-add-categories">
          {categories.map((category) => (
            <option key={category.id} value={category.name} />
          ))}
        </datalist>

        <TextInput
          label="Osoba"
          required
          list="quick-add-assignees"
          value={form.assigneeName}
          onChange={(event) => setForm({ ...form, assigneeName: event.currentTarget.value })}
        />
        <datalist id="quick-add-assignees">
          {assignees.map((assignee) => (
            <option key={assignee.id} value={assignee.name} />
          ))}
        </datalist>

        <Button type="submit" w="fit-content">
          Zapisz
        </Button>
      </Stack>
    </Paper>
  );
}
```

- [ ] **Step 3: Convert `TaskForm` to Mantine**

Edit `src/components/TaskForm.tsx`:

```tsx
import { Button, Group, NativeSelect, NumberInput, Paper, Stack, TextInput } from "@mantine/core";
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
    <Paper
      component="form"
      withBorder
      p="lg"
      radius="md"
      aria-label={task ? "Edytuj zadanie" : "Dodaj zadanie"}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(draft);
      }}
    >
      <Stack gap="sm">
        <TextInput label="Nazwa zadania" required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.currentTarget.value })} />

        <TextInput
          label="Kategoria"
          required
          list="tasker-categories"
          value={draft.categoryName}
          onChange={(event) => setDraft({ ...draft, categoryName: event.currentTarget.value })}
        />
        <datalist id="tasker-categories">
          {categories.map((category) => (
            <option key={category.id} value={category.name} />
          ))}
        </datalist>

        <TextInput
          label="Osoba"
          required
          list="tasker-assignees"
          value={draft.assigneeName}
          onChange={(event) => setDraft({ ...draft, assigneeName: event.currentTarget.value })}
        />
        <datalist id="tasker-assignees">
          {assignees.map((assignee) => (
            <option key={assignee.id} value={assignee.name} />
          ))}
        </datalist>

        <TextInput
          label="Data startu"
          required
          type="date"
          value={draft.startDate}
          onChange={(event) => setDraft({ ...draft, startDate: event.currentTarget.value })}
        />

        <NativeSelect
          label="Powtarzanie"
          value={recurrenceType(draft.recurrence)}
          onChange={(event) => changeRecurrence(event.currentTarget.value as RecurrenceRule["type"])}
          data={[
            { value: "daily", label: "Codziennie" },
            { value: "everyNDays", label: "Co N dni" },
            { value: "weekly", label: "Co tydzien" },
            { value: "monthly", label: "Co miesiac" },
            { value: "quarterly", label: "Co kwartal" }
          ]}
        />

        {draft.recurrence.type === "everyNDays" ? (
          <NumberInput
            label="Liczba dni"
            required
            min={1}
            value={draft.recurrence.intervalDays}
            onChange={(value) =>
              setDraft({
                ...draft,
                recurrence: { type: "everyNDays", intervalDays: Number(value) }
              })
            }
          />
        ) : null}

        <NativeSelect
          label="Status"
          value={draft.active ? "active" : "inactive"}
          onChange={(event) => setDraft({ ...draft, active: event.currentTarget.value === "active" })}
          data={[
            { value: "active", label: "Aktywne" },
            { value: "inactive", label: "Nieaktywne" }
          ]}
        />

        <Group gap="xs">
          <Button type="submit">Zapisz</Button>
          <Button type="button" variant="default" onClick={onCancel}>
            Anuluj
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}
```

- [ ] **Step 4: Verify add and edit workflows**

Run:

```bash
npm run test:run -- src/App.test.tsx
```

Expected: PASS for adding tasks, focus movement, editing, and deactivating.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/components/QuickAddForm.tsx src/components/TaskForm.tsx
git commit -m "feat: migrate task forms to mantine"
```

Expected: one commit containing only form migration.

---

### Task 5: Final Polish and Verification

**Files:**
- Modify: `src/styles.css`
- Modify: `src/App.test.tsx` only if test names need final accessible-label corrections.
- Test: all tests and production build.

**Interfaces:**
- Consumes: all migrated Mantine components from previous tasks.
- Produces: a complete, buildable Mantine UI migration with unchanged app behavior.

- [ ] **Step 1: Check git diff for accidental domain changes**

Run:

```bash
git diff -- src/domain src/hooks src/storage
```

Expected: no output. If there is output, revert only accidental changes in those paths or intentionally explain why a domain change is needed before continuing.

- [ ] **Step 2: Run the full test suite**

Run:

```bash
npm run test:run
```

Expected: PASS for all test files.

- [ ] **Step 3: Run the production build**

Run:

```bash
npm run build
```

Expected: TypeScript completes with no errors and Vite produces a production build.

- [ ] **Step 4: Review final changed files**

Run:

```bash
git status --short
```

Expected: only Mantine migration files are modified, plus `.idea/` remains untracked and untouched.

- [ ] **Step 5: Commit final cleanup if needed**

If Step 4 shows final cleanup changes after the task commits, run:

```bash
git add src/styles.css src/App.test.tsx
git commit -m "chore: polish mantine migration"
```

Expected: final cleanup commit exists only when there were actual cleanup changes.

