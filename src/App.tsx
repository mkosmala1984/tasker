import { Alert, Button, Container, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { CategoryManager } from "./components/CategoryManager";
import { DataTransferView } from "./components/DataTransferView";
import { DictionaryManager } from "./components/DictionaryManager";
import { HistoryView } from "./components/HistoryView";
import { QuickAddForm } from "./components/QuickAddForm";
import { TaskFilters } from "./components/TaskFilters";
import { TasksModuleView } from "./components/tasks/TasksModuleView";
import { TodayTaskList } from "./components/TodayTaskList";
import { formatPolishDateLabel, getTodayString } from "./domain/dates";
import { buildTodayList } from "./domain/todayList";
import type { TaskDraft } from "./domain/types";
import { useTaskerStore } from "./state/taskerStore";

type Props = {
  now?: Date;
};

export default function App({ now = new Date() }: Props) {
  const state = useTaskerStore((store) => store.state);
  const storageError = useTaskerStore((store) => store.storageError);
  const filters = useTaskerStore((store) => store.filters);
  const setFilters = useTaskerStore((store) => store.setFilters);
  const historyFilters = useTaskerStore((store) => store.historyFilters);
  const setHistoryFilters = useTaskerStore((store) => store.setHistoryFilters);
  const view = useTaskerStore((store) => store.view);
  const setView = useTaskerStore((store) => store.setView);
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
  const previewImport = useTaskerStore((store) => store.previewImport);
  const applyImport = useTaskerStore((store) => store.applyImport);
  const addTask = useTaskerStore((store) => store.addTask);
  const deactivateTask = useTaskerStore((store) => store.deactivateTask);
  const completeTask = useTaskerStore((store) => store.completeTask);
  const postponeTask = useTaskerStore((store) => store.postponeTask);
  const openTaskCreate = useTaskerStore((store) => store.openTaskCreate);
  const openTaskEdit = useTaskerStore((store) => store.openTaskEdit);
  const today = getTodayString(now);
  const todayTasks = buildTodayList(state, today, filters);

  function handleCreateTask() {
    openTaskCreate();
  }

  function handleAddTask(draft: TaskDraft) {
    addTask(draft, now);
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

  return (
    <Container className="app-shell" size="md">
      <Stack gap="lg" py="xl">
        <Paper withBorder p="lg" radius="md" shadow="xs">
          <Group justify="space-between" align="center" gap="md" wrap="wrap">
            <div>
              <Title order={1}>Tasker</Title>
              <Text c="dimmed">{formatPolishDateLabel(today)}</Text>
            </div>
            <Button type="button" onClick={handleCreateTask}>
              + Dodaj zadanie
            </Button>
          </Group>
        </Paper>

        <Group gap="xs" wrap="wrap">
          <Button variant={view === "today" ? "filled" : "default"} onClick={() => setView("today")}>
            Dzisiaj
          </Button>
          <Button variant={view === "tasks" ? "filled" : "default"} onClick={() => setView("tasks")}>
            Zadania
          </Button>
          <Button variant={view === "calendar" ? "filled" : "default"} onClick={() => setView("calendar")}>
            Kalendarz
          </Button>
          <Button variant={view === "categories" ? "filled" : "default"} onClick={() => setView("categories")}>
            Kategorie
          </Button>
          <Button variant={view === "settings" ? "filled" : "default"} onClick={() => setView("settings")}>
            Konfiguracja
          </Button>
          <Button variant={view === "history" ? "filled" : "default"} onClick={() => setView("history")}>
            Historia
          </Button>
          <Button variant={view === "data" ? "filled" : "default"} onClick={() => setView("data")}>
            Dane
          </Button>
        </Group>

        {view === "today" ? (
          <Paper withBorder p="lg" radius="md" shadow="xs">
            <Stack gap="md">
              <div>
                <Title order={2}>Dzisiaj</Title>
                <Text c="dimmed">Zadania wymagajace reakcji</Text>
              </div>

              {storageError ? (
                <Alert color="yellow" title="Problem z lokalnymi danymi">
                  {storageError}
                </Alert>
              ) : null}

              <TaskFilters
                categories={state.categories}
                assignees={state.assignees}
                filters={filters}
                onChange={setFilters}
              />

              <TodayTaskList
                tasks={todayTasks}
                onAdd={handleCreateTask}
                onComplete={handleCompleteTask}
                onPostpone={handlePostponeTask}
                onDeactivate={handleDeactivateTask}
                onEdit={openTaskEdit}
              />

              <QuickAddForm
                categories={state.categories}
                assignees={state.assignees}
                today={today}
                onSubmit={handleAddTask}
              />
            </Stack>
          </Paper>
        ) : null}
        {view === "tasks" ? <TasksModuleView today={today} /> : null}
        {view === "calendar" ? <PlaceholderView title="Kalendarz" description="Tutaj powstanie widok planowania zadan wedlug dat." /> : null}
        {view === "categories" ? (
          <Paper withBorder p="lg" radius="md" shadow="xs">
            <CategoryManager categories={state.categories} onAdd={addCategory} onUpdate={updateCategory} onDeactivate={deactivateCategory} />
          </Paper>
        ) : null}
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
        {view === "history" ? (
          <Paper withBorder p="lg" radius="md" shadow="xs">
            <HistoryView state={state} filters={historyFilters} onFiltersChange={setHistoryFilters} />
          </Paper>
        ) : null}
        {view === "data" ? (
          <Paper withBorder p="lg" radius="md" shadow="xs">
            <DataTransferView state={state} onPreviewImport={previewImport} onApplyImport={applyImport} />
          </Paper>
        ) : null}
      </Stack>
    </Container>
  );
}
