# Today Operational Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the `Dzisiaj` screen into an operational task view with inline details, a quick postpone menu, no top filters, and a collapsible `Wykonane dzisiaj` section.

**Architecture:** Keep task completion and postponement in the existing Zustand store and domain functions, but move the `today` UI into focused presentational components under a dedicated `src/components/today/` folder. Extend the `today` domain selector to return active and completed-today data, then let the new view manage only local UI state such as expanded rows and open menus.

**Tech Stack:** React, TypeScript, Zustand, Mantine, Vitest, Testing Library, Vite

## Global Constraints

- Remove filters rendered above the task list in the `Dzisiaj` view.
- Keep the existing domain logic, local storage model, and app navigation intact.
- `Wykonane` must move a task out of the active list immediately and into `Wykonane dzisiaj` with no confirmation step.
- `Odloz` must open a quick menu with `Jutro`, `Za tydzien`, and `Wybierz date`.
- Details must expand inline under the task row instead of navigating away.
- The view must remain keyboard-accessible.
- The design should stay desktop-first but remain usable on narrower widths.
- Final verification must include `npm run test:run` and `npm run build`.

---

## File Structure

- Modify: `src/domain/types.ts`
  - Add view-model types for the rebuilt today screen.
- Modify: `src/domain/todayList.ts`
  - Replace the single active-list selector with a selector that returns active items and completed-today items.
- Modify: `src/domain/todayList.test.ts`
  - Add selector tests for completed-today grouping and active/completed separation.
- Modify: `src/App.tsx`
  - Replace inline `today` layout, remove `TaskFilters`, and mount the new `TodayViewShell`.
- Create: `src/components/today/TodayViewShell.tsx`
  - Compose header, active list, and completed section; own local UI state.
- Create: `src/components/today/TodaySummaryHeader.tsx`
  - Render the screen title, formatted date, and count badge.
- Create: `src/components/today/TodayActiveList.tsx`
  - Render active rows or an empty state.
- Create: `src/components/today/TodayTaskRow.tsx`
  - Render the compact row, main actions, expand toggle, and additional menu trigger.
- Create: `src/components/today/TodayTaskDetailsPanel.tsx`
  - Render inline task metadata.
- Create: `src/components/today/TodayPostponeMenu.tsx`
  - Render quick postpone options and inline date selection.
- Create: `src/components/today/TodayCompletedSection.tsx`
  - Render the collapsible `Wykonane dzisiaj` section.
- Modify: `src/App.test.tsx`
  - Replace old `today` expectations with tests for the new operational behavior.
- Optionally delete or stop importing: `src/components/TaskFilters.tsx`, `src/components/TodayTaskList.tsx`, `src/components/TodayTaskCard.tsx`
  - Remove only after the new components are wired and tests pass.

### Task 1: Add Today View-Model Selector

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/domain/todayList.ts`
- Test: `src/domain/todayList.test.ts`

**Interfaces:**
- Consumes: `AppState`, `TodayTask`, `compareDates`, `getCurrentScheduledDate(state.tasks[i], state.completions)`
- Produces: 
  - `type TodayTaskGroup = { active: TodayTask[]; completedToday: TodayTask[] }`
  - `function buildTodayTaskGroup(state: AppState, today: string): TodayTaskGroup`

- [ ] **Step 1: Write the failing selector tests**

```ts
it("separates tasks completed today from active items", () => {
  const state: AppState = {
    ...baseState,
    tasks: [
      task({ id: "task-active", title: "Aktywne", schedule: { mode: "oneTime", date: "2026-07-10" } }),
      task({ id: "task-done", title: "Wykonane", schedule: { mode: "oneTime", date: "2026-07-10" } })
    ],
    completions: [
      { id: "completion-1", taskId: "task-done", scheduledDate: "2026-07-10", completedDate: "2026-07-10" }
    ]
  };

  const group = buildTodayTaskGroup(state, "2026-07-10");

  expect(group.active.map((item) => item.task.title)).toEqual(["Aktywne"]);
  expect(group.completedToday.map((item) => item.task.title)).toEqual(["Wykonane"]);
});

it("does not include tasks completed on an earlier day in completed-today", () => {
  const state: AppState = {
    ...baseState,
    tasks: [task({ id: "task-1", schedule: { mode: "oneTime", date: "2026-07-09" } })],
    completions: [{ id: "completion-1", taskId: "task-1", scheduledDate: "2026-07-09", completedDate: "2026-07-09" }]
  };

  const group = buildTodayTaskGroup(state, "2026-07-10");

  expect(group.active).toHaveLength(0);
  expect(group.completedToday).toHaveLength(0);
});
```

- [ ] **Step 2: Run the selector tests to verify they fail**

Run: `npm run test:run -- src/domain/todayList.test.ts`
Expected: FAIL with `buildTodayTaskGroup is not defined` or equivalent missing-export errors.

- [ ] **Step 3: Add the new types and selector**

```ts
// src/domain/types.ts
export type TodayTaskGroup = {
  active: TodayTask[];
  completedToday: TodayTask[];
};
```

```ts
// src/domain/todayList.ts
function buildTodayTaskItem(state: AppState, task: Task, today: string): TodayTask | undefined {
  const scheduledDate = getCurrentScheduledDate(task, state.completions);
  if (scheduledDate === undefined || compareDates(scheduledDate, today) > 0 || isHiddenByPostponement(state, task.id, today)) {
    return undefined;
  }

  return {
    task,
    category: findCategory(state.categories, task.categoryId),
    assignee: findAssignee(state.assignees, task.assigneeId),
    taskType: findTaskType(state.taskTypes, task.taskTypeId),
    priority: findPriority(state.priorities, task.priorityId),
    scheduledDate,
    isOverdue: compareDates(scheduledDate, today) < 0,
    lastCompletedDate: getLatestCompletion(task.id, state.completions)?.completedDate
  };
}

export function buildTodayTaskGroup(state: AppState, today: string): TodayTaskGroup {
  const completedTodayIds = new Set(
    state.completions.filter((completion) => completion.completedDate === today).map((completion) => completion.taskId)
  );

  const items = state.tasks
    .filter((task) => task.active)
    .map((task) => buildTodayTaskItem(state, task, today))
    .filter((item): item is TodayTask => item !== undefined)
    .sort((left, right) => {
      const byDate = compareDates(left.scheduledDate, right.scheduledDate);
      return byDate !== 0 ? byDate : left.task.title.localeCompare(right.task.title, "pl");
    });

  return {
    active: items.filter((item) => !completedTodayIds.has(item.task.id)),
    completedToday: items.filter((item) => completedTodayIds.has(item.task.id))
  };
}
```

- [ ] **Step 4: Keep the old export temporarily for safe migration**

```ts
export function buildTodayList(state: AppState, today: string, _filters: TodayFilters): TodayTask[] {
  return buildTodayTaskGroup(state, today).active;
}
```

- [ ] **Step 5: Run the selector tests to verify they pass**

Run: `npm run test:run -- src/domain/todayList.test.ts`
Expected: PASS for the new grouping tests and existing sorting/postponement coverage.

- [ ] **Step 6: Commit**

```bash
git add src/domain/types.ts src/domain/todayList.ts src/domain/todayList.test.ts
git commit -m "feat: add today task grouping selector"
```

### Task 2: Build the New Today View Shell and Header

**Files:**
- Create: `src/components/today/TodayViewShell.tsx`
- Create: `src/components/today/TodaySummaryHeader.tsx`
- Modify: `src/App.tsx`
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes:
  - `buildTodayTaskGroup(state, today): TodayTaskGroup`
  - `formatPolishDateLabel(today): string`
  - `completeTask(taskId, scheduledDate, now)`
  - `postponeTask(taskId, scheduledDate, toDate, now)`
- Produces:
  - `function TodayViewShell(props: TodayViewShellProps): JSX.Element`
  - `type TodayViewShellProps = { today: string; dateLabel: string; activeTasks: TodayTask[]; completedToday: TodayTask[]; onComplete(...): void; onPostponeToDate(...): void; onEdit(taskId: string): void; onDeactivate(taskId: string): void; onAdd(): void }`

- [ ] **Step 1: Write the failing app-level tests for the new top area**

```ts
it("renders the today operational header without filters", () => {
  seedTodayTaskState();
  renderApp({ now: new Date("2026-07-10T09:00:00.000Z") });

  expect(screen.getByRole("heading", { name: "Dzisiaj" })).toBeInTheDocument();
  expect(screen.getByText("Piatek, 10 lipca 2026")).toBeInTheDocument();
  expect(screen.getByText("1 zadanie")).toBeInTheDocument();
  expect(screen.queryByText("Filtrowanie")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /filtry/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the app test to verify it fails**

Run: `npm run test:run -- src/App.test.tsx -t "renders the today operational header without filters"`
Expected: FAIL because the current app still renders filter controls and not the new counter badge.

- [ ] **Step 3: Create the header and shell components**

```tsx
// src/components/today/TodaySummaryHeader.tsx
import { Badge, Group, Stack, Text, Title } from "@mantine/core";

type Props = { dateLabel: string; activeCount: number };

export function TodaySummaryHeader({ dateLabel, activeCount }: Props) {
  const countLabel = activeCount === 1 ? "1 zadanie" : `${activeCount} zadania`;
  return (
    <Group justify="space-between" align="flex-start">
      <Stack gap={4}>
        <Title order={1}>Dzisiaj</Title>
        <Text c="dimmed">{dateLabel}</Text>
      </Stack>
      <Badge color="green" variant="light" size="lg">
        {countLabel}
      </Badge>
    </Group>
  );
}
```

```tsx
// src/components/today/TodayViewShell.tsx
import { Stack } from "@mantine/core";
import { useState } from "react";
import type { TodayTask } from "../../domain/types";
import { TodaySummaryHeader } from "./TodaySummaryHeader";
import { TodayActiveList } from "./TodayActiveList";
import { TodayCompletedSection } from "./TodayCompletedSection";

export type TodayViewShellProps = {
  today: string;
  dateLabel: string;
  activeTasks: TodayTask[];
  completedToday: TodayTask[];
  onAdd: () => void;
  onComplete: (taskId: string, scheduledDate: string) => void;
  onPostponeToDate: (taskId: string, scheduledDate: string, toDate: string) => void;
  onEdit: (taskId: string) => void;
  onDeactivate: (taskId: string) => void;
};

export function TodayViewShell(props: TodayViewShellProps) {
  const [expandedTaskIds, setExpandedTaskIds] = useState<string[]>([]);
  const [completedOpen, setCompletedOpen] = useState(false);

  return (
    <Stack gap="lg">
      <TodaySummaryHeader dateLabel={props.dateLabel} activeCount={props.activeTasks.length} />
      <TodayActiveList {...props} expandedTaskIds={expandedTaskIds} onExpandedTaskIdsChange={setExpandedTaskIds} />
      <TodayCompletedSection tasks={props.completedToday} open={completedOpen} onToggle={() => setCompletedOpen((value) => !value)} />
    </Stack>
  );
}
```

- [ ] **Step 4: Replace the old inline today view in `App.tsx`**

```tsx
const today = getTodayString(now);
const todayGroup = buildTodayTaskGroup(state, today);

{view === "today" ? (
  <Paper withBorder p="lg" radius="md" shadow="xs">
    <Stack gap="md">
      {storageError ? (
        <Alert color="yellow" title="Problem z lokalnymi danymi">
          {storageError}
        </Alert>
      ) : null}
      <TodayViewShell
        today={today}
        dateLabel={formatPolishDateLabel(today)}
        activeTasks={todayGroup.active}
        completedToday={todayGroup.completedToday}
        onAdd={handleCreateTask}
        onComplete={handleCompleteTask}
        onPostponeToDate={handlePostponeTaskToDate}
        onEdit={openTaskEdit}
        onDeactivate={handleDeactivateTask}
      />
    </Stack>
  </Paper>
) : null}
```

- [ ] **Step 5: Run the targeted app test**

Run: `npm run test:run -- src/App.test.tsx -t "renders the today operational header without filters"`
Expected: PASS, with no `Filtrowanie` block in the DOM.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/components/today/TodayViewShell.tsx src/components/today/TodaySummaryHeader.tsx src/App.test.tsx
git commit -m "feat: mount today operational shell"
```

### Task 3: Implement Active Rows, Inline Details, and Empty State

**Files:**
- Create: `src/components/today/TodayActiveList.tsx`
- Create: `src/components/today/TodayTaskRow.tsx`
- Create: `src/components/today/TodayTaskDetailsPanel.tsx`
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes:
  - `TodayTask`
  - `expandedTaskIds: string[]`
  - `onComplete(taskId: string, scheduledDate: string): void`
- Produces:
  - `function TodayActiveList(props: TodayActiveListProps): JSX.Element`
  - `function TodayTaskRow(props: TodayTaskRowProps): JSX.Element`
  - `function TodayTaskDetailsPanel({ item }: { item: TodayTask }): JSX.Element`

- [ ] **Step 1: Write failing tests for active row rendering and detail expansion**

```ts
it("renders a compact active task row and expands inline details", async () => {
  seedTodayTaskState();
  renderApp({ now: new Date("2026-07-10T09:00:00.000Z") });
  const user = userEvent.setup();

  expect(screen.getByText("Podlac rosliny")).toBeInTheDocument();
  expect(screen.getByText("Jeszcze nie wykonano")).toBeInTheDocument();
  expect(screen.queryByText("Kategoria")).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Pokaz szczegoly: Podlac rosliny" }));

  expect(screen.getByText("Kategoria")).toBeInTheDocument();
  expect(screen.getByText("Dom")).toBeInTheDocument();
  expect(screen.getByText("Osoba")).toBeInTheDocument();
  expect(screen.getByText("Ola")).toBeInTheDocument();
});

it("shows the empty state when there are no active tasks", () => {
  renderApp({ now: new Date("2026-07-10T09:00:00.000Z") });
  expect(screen.getByText("Brak zadan na dzisiaj")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the targeted tests to verify they fail**

Run: `npm run test:run -- src/App.test.tsx -t "renders a compact active task row and expands inline details"`
Expected: FAIL because there is no detail toggle button or inline metadata panel yet.

- [ ] **Step 3: Implement the active list and row components**

```tsx
// src/components/today/TodayActiveList.tsx
import { Button, Paper, Stack, Text, Title } from "@mantine/core";
import type { TodayTask } from "../../domain/types";
import { TodayTaskRow } from "./TodayTaskRow";

export function TodayActiveList({ activeTasks, onAdd, ...rowProps }: TodayActiveListProps) {
  if (activeTasks.length === 0) {
    return (
      <Paper component="section" withBorder p="lg" radius="md">
        <Stack align="flex-start" gap="sm">
          <Title order={2}>Brak zadan na dzisiaj</Title>
          <Text c="dimmed">Wszystko domkniete. Dodaj nowe zadanie albo wroc tu jutro.</Text>
          <Button type="button" onClick={onAdd}>Dodaj zadanie</Button>
        </Stack>
      </Paper>
    );
  }

  return (
    <Stack component="section" aria-label="Aktywne zadania" gap="sm">
      {activeTasks.map((item) => <TodayTaskRow key={item.task.id} item={item} {...rowProps} />)}
    </Stack>
  );
}
```

```tsx
// src/components/today/TodayTaskDetailsPanel.tsx
import { Grid, Paper, Text } from "@mantine/core";
import type { TodayTask } from "../../domain/types";

export function TodayTaskDetailsPanel({ item }: { item: TodayTask }) {
  return (
    <Paper withBorder radius="md" p="md">
      <Grid>
        <Grid.Col span={6}><Text fw={500}>Kategoria</Text><Text>{item.category.name}</Text></Grid.Col>
        <Grid.Col span={6}><Text fw={500}>Osoba</Text><Text>{item.assignee.name}</Text></Grid.Col>
        <Grid.Col span={6}><Text fw={500}>Typ</Text><Text>{item.taskType.name}</Text></Grid.Col>
        <Grid.Col span={6}><Text fw={500}>Priorytet</Text><Text>{item.priority.name}</Text></Grid.Col>
      </Grid>
    </Paper>
  );
}
```

```tsx
// src/components/today/TodayTaskRow.tsx
import { ActionIcon, Badge, Button, Group, Paper, Stack, Text } from "@mantine/core";
import type { TodayTask } from "../../domain/types";
import { TodayTaskDetailsPanel } from "./TodayTaskDetailsPanel";

export function TodayTaskRow({ item, expanded, onToggleExpanded, onComplete, ...rest }: TodayTaskRowProps) {
  return (
    <Paper component="article" withBorder radius="md" p="md">
      <Stack gap="sm">
        <Group justify="space-between" align="center">
          <Stack gap={2}>
            <Text fw={600}>{item.task.title}</Text>
            <Text c="dimmed" size="sm">{item.lastCompletedDate ? `Ostatnio wykonane: ${item.lastCompletedDate}` : "Jeszcze nie wykonano"}</Text>
          </Stack>
          <Group gap="xs">
            <Badge color={item.isOverdue ? "orange" : "gray"} variant="light">
              {item.isOverdue ? `${item.scheduledDate}` : "Na dzis"}
            </Badge>
            <Button color="green" onClick={() => onComplete(item.task.id, item.scheduledDate)}>Wykonane</Button>
            <ActionIcon
              variant="subtle"
              aria-label={expanded ? `Ukryj szczegoly: ${item.task.title}` : `Pokaz szczegoly: ${item.task.title}`}
              onClick={onToggleExpanded}
            />
          </Group>
        </Group>
        {expanded ? <TodayTaskDetailsPanel item={item} /> : null}
      </Stack>
    </Paper>
  );
}
```

- [ ] **Step 4: Wire expanded row state through `TodayViewShell`**

```tsx
const expanded = expandedTaskIds.includes(item.task.id);
const toggleExpanded = () =>
  setExpandedTaskIds((current) =>
    current.includes(item.task.id) ? current.filter((id) => id !== item.task.id) : [...current, item.task.id]
  );
```

- [ ] **Step 5: Run the targeted tests**

Run: `npm run test:run -- src/App.test.tsx -t "renders a compact active task row and expands inline details"`
Expected: PASS for compact rendering, expansion, and empty-state behavior.

- [ ] **Step 6: Commit**

```bash
git add src/components/today/TodayActiveList.tsx src/components/today/TodayTaskRow.tsx src/components/today/TodayTaskDetailsPanel.tsx src/components/today/TodayViewShell.tsx src/App.test.tsx
git commit -m "feat: add active today rows with inline details"
```

### Task 4: Implement the Quick Postpone Menu

**Files:**
- Create: `src/components/today/TodayPostponeMenu.tsx`
- Modify: `src/components/today/TodayTaskRow.tsx`
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes:
  - `onPostponeToDate(taskId: string, scheduledDate: string, toDate: string): void`
  - `today: string`
- Produces:
  - `function TodayPostponeMenu(props: TodayPostponeMenuProps): JSX.Element`
  - Postpone options `Jutro`, `Za tydzien`, `Wybierz date`

- [ ] **Step 1: Write failing tests for quick postpone actions**

```ts
it("postpones a task using the quick menu actions", async () => {
  seedTodayTaskState();
  renderApp({ now: new Date("2026-07-10T09:00:00.000Z") });
  const user = userEvent.setup();

  await user.click(screen.getByRole("button", { name: "Odloz: Podlac rosliny" }));
  await user.click(screen.getByRole("menuitem", { name: "Jutro" }));

  expect(screen.queryByText("Podlac rosliny")).not.toBeInTheDocument();
  expect(localStorage.getItem(STORAGE_KEY)).toContain('"toDate":"2026-07-11"');
});

it("allows selecting a custom postpone date from the quick menu", async () => {
  seedTodayTaskState();
  renderApp({ now: new Date("2026-07-10T09:00:00.000Z") });
  const user = userEvent.setup();

  await user.click(screen.getByRole("button", { name: "Odloz: Podlac rosliny" }));
  await user.click(screen.getByRole("menuitem", { name: "Wybierz date" }));
  await user.type(screen.getByLabelText("Wybierz date odlozenia: Podlac rosliny"), "2026-07-20");
  await user.click(screen.getByRole("button", { name: "Zatwierdz odlozenie: Podlac rosliny" }));

  expect(localStorage.getItem(STORAGE_KEY)).toContain('"toDate":"2026-07-20"');
});
```

- [ ] **Step 2: Run the postpone tests to verify they fail**

Run: `npm run test:run -- src/App.test.tsx -t "postpones a task using the quick menu actions"`
Expected: FAIL because the current UI only exposes `Odloz na jutro` and date input fields.

- [ ] **Step 3: Implement the quick postpone menu component**

```tsx
// src/components/today/TodayPostponeMenu.tsx
import { Button, Menu, Stack, TextInput } from "@mantine/core";
import { addDays } from "../../domain/dates";
import { useState } from "react";

export function TodayPostponeMenu({ item, today, onPostponeToDate }: TodayPostponeMenuProps) {
  const [customOpen, setCustomOpen] = useState(false);
  const [customDate, setCustomDate] = useState("");

  return (
    <Menu withinPortal={false}>
      <Menu.Target>
        <Button variant="default" aria-label={`Odloz: ${item.task.title}`}>Odloz</Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item onClick={() => onPostponeToDate(item.task.id, item.scheduledDate, addDays(today, 1))}>Jutro</Menu.Item>
        <Menu.Item onClick={() => onPostponeToDate(item.task.id, item.scheduledDate, addDays(today, 7))}>Za tydzien</Menu.Item>
        <Menu.Item onClick={() => setCustomOpen(true)}>Wybierz date</Menu.Item>
        {customOpen ? (
          <Stack p="xs">
            <TextInput
              type="date"
              aria-label={`Wybierz date odlozenia: ${item.task.title}`}
              value={customDate}
              min={today}
              onChange={(event) => setCustomDate(event.currentTarget.value)}
            />
            <Button
              size="xs"
              aria-label={`Zatwierdz odlozenie: ${item.task.title}`}
              disabled={customDate === ""}
              onClick={() => onPostponeToDate(item.task.id, item.scheduledDate, customDate)}
            >
              Zatwierdz
            </Button>
          </Stack>
        ) : null}
      </Menu.Dropdown>
    </Menu>
  );
}
```

- [ ] **Step 4: Replace the row postpone controls with the menu**

```tsx
<TodayPostponeMenu item={item} today={today} onPostponeToDate={onPostponeToDate} />
```

- [ ] **Step 5: Run the postpone tests**

Run: `npm run test:run -- src/App.test.tsx -t "postpones a task using the quick menu actions"`
Expected: PASS for `Jutro`, `Za tydzien`, and custom date flows.

- [ ] **Step 6: Commit**

```bash
git add src/components/today/TodayPostponeMenu.tsx src/components/today/TodayTaskRow.tsx src/App.test.tsx
git commit -m "feat: add quick postpone menu to today tasks"
```

### Task 5: Implement the Completed-Today Section

**Files:**
- Create: `src/components/today/TodayCompletedSection.tsx`
- Modify: `src/components/today/TodayViewShell.tsx`
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes:
  - `completedToday: TodayTask[]`
  - `open: boolean`
- Produces:
  - `function TodayCompletedSection(props: TodayCompletedSectionProps): JSX.Element`

- [ ] **Step 1: Write failing tests for the completed section**

```ts
it("moves completed tasks into the completed-today section immediately", async () => {
  seedTodayTaskState();
  renderApp({ now: new Date("2026-07-10T09:00:00.000Z") });
  const user = userEvent.setup();

  await user.click(screen.getByRole("button", { name: "Wykonane" }));

  expect(screen.queryByText("Podlac rosliny")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Wykonane dzisiaj (1)" })).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Wykonane dzisiaj (1)" }));
  expect(screen.getByText("Podlac rosliny")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the completed-section test to verify it fails**

Run: `npm run test:run -- src/App.test.tsx -t "moves completed tasks into the completed-today section immediately"`
Expected: FAIL because the current empty state appears instead of a completed list.

- [ ] **Step 3: Implement the completed section component**

```tsx
// src/components/today/TodayCompletedSection.tsx
import { Button, Collapse, Group, Paper, Stack, Text } from "@mantine/core";
import type { TodayTask } from "../../domain/types";

export function TodayCompletedSection({ tasks, open, onToggle }: TodayCompletedSectionProps) {
  return (
    <Paper withBorder radius="md" p="md" component="section" aria-label="Wykonane dzisiaj">
      <Stack gap="sm">
        <Group justify="space-between">
          <Button variant="subtle" onClick={onToggle}>
            {`Wykonane dzisiaj (${tasks.length})`}
          </Button>
        </Group>
        <Collapse in={open}>
          <Stack gap="xs">
            {tasks.length === 0 ? <Text c="dimmed">Brak wykonanych zadan dzisiaj.</Text> : null}
            {tasks.map((item) => (
              <Paper key={item.task.id} withBorder radius="sm" p="sm">
                <Text fw={500}>{item.task.title}</Text>
                <Text size="sm" c="dimmed">{item.lastCompletedDate ? `Wykonane: ${item.lastCompletedDate}` : "Wykonane dzisiaj"}</Text>
              </Paper>
            ))}
          </Stack>
        </Collapse>
      </Stack>
    </Paper>
  );
}
```

- [ ] **Step 4: Keep the section always visible in the shell**

```tsx
<TodayCompletedSection
  tasks={props.completedToday}
  open={completedOpen}
  onToggle={() => setCompletedOpen((value) => !value)}
/>
```

- [ ] **Step 5: Run the completed-section test**

Run: `npm run test:run -- src/App.test.tsx -t "moves completed tasks into the completed-today section immediately"`
Expected: PASS, with the task disappearing from the active list and appearing under the collapsible completed section.

- [ ] **Step 6: Commit**

```bash
git add src/components/today/TodayCompletedSection.tsx src/components/today/TodayViewShell.tsx src/App.test.tsx
git commit -m "feat: add completed today section"
```

### Task 6: Clean Up Legacy Today Components and Final Regression Pass

**Files:**
- Modify: `src/App.test.tsx`
- Delete or stop using: `src/components/TaskFilters.tsx`
- Delete or stop using: `src/components/TodayTaskList.tsx`
- Delete or stop using: `src/components/TodayTaskCard.tsx`
- Verify: `src/App.tsx`, `src/components/today/*.tsx`, `src/domain/todayList.ts`

**Interfaces:**
- Consumes:
  - `TodayViewShell`
  - `buildTodayTaskGroup`
- Produces:
  - A single wired `today` screen with no dead imports or conflicting expectations

- [ ] **Step 1: Update or remove old today-specific tests**

```ts
// Replace these expectations:
expect(screen.getByRole("button", { name: "Odloz na jutro" })).not.toBeInTheDocument();
expect(screen.queryByLabelText(/Data odlozenia:/)).not.toBeInTheDocument();

// Keep these flows:
expect(screen.getByRole("button", { name: "Wykonane" })).toBeInTheDocument();
expect(screen.getByRole("button", { name: /Odloz:/ })).toBeInTheDocument();
```

- [ ] **Step 2: Remove dead imports and unused components**

```tsx
// src/App.tsx
import { TodayViewShell } from "./components/today/TodayViewShell";
// Remove:
// import { TaskFilters } from "./components/TaskFilters";
// import { TodayTaskList } from "./components/TodayTaskList";
```

```bash
git rm src/components/TodayTaskList.tsx src/components/TodayTaskCard.tsx
```

- [ ] **Step 3: Run the full test suite**

Run: `npm run test:run`
Expected: PASS for domain tests, UI tests, and updated today-view coverage.

- [ ] **Step 4: Run the production build**

Run: `npm run build`
Expected: PASS with a successful Vite production bundle and no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/App.test.tsx src/domain/todayList.ts src/domain/todayList.test.ts src/domain/types.ts src/components/today
git commit -m "refactor: finalize today operational redesign"
```

## Self-Review

- Spec coverage:
  - no filters above the list: Task 2 and Task 6
  - new header with date and count: Task 2
  - compact operational rows: Task 3
  - inline details: Task 3
  - quick postpone menu: Task 4
  - completed-today section: Task 5
  - immediate move after completion: Task 1 and Task 5
  - keyboard-aware controls: Tasks 3, 4, and 5 through accessible labels and menu behavior
- Placeholder scan:
  - no `TODO`, `TBD`, or unnamed functions remain
  - every task contains exact file paths, commands, and concrete code targets
- Type consistency:
  - `buildTodayTaskGroup(state, today): TodayTaskGroup` is introduced before UI tasks consume it
  - UI tasks consistently use `activeTasks`, `completedToday`, and `onPostponeToDate`

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-10-today-operational-redesign.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
