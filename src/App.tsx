import { Alert, Button, Container, Paper, Stack, Title } from "@mantine/core";
import { useEffect } from "react";
import { CategoryManager } from "./components/CategoryManager";
import { CalendarView } from "./components/calendar/CalendarView";
import { DataTransferView } from "./components/DataTransferView";
import { DictionaryManager } from "./components/DictionaryManager";
import { HistoryView } from "./components/HistoryView";
import { TodayViewShell } from "./components/today/TodayViewShell";
import { TasksModuleView } from "./components/tasks/TasksModuleView";
import { formatPolishDateLabel, getTodayString } from "./domain/dates";
import { buildTodayTaskGroup } from "./domain/todayList";
import { useTaskerStore } from "./state/taskerStore";

type Props = {
  now?: Date;
};

type MenuIconName = "today" | "tasks" | "calendar" | "categories" | "settings" | "history" | "data";

function MenuIcon({ name }: { name: MenuIconName }) {
  const common = { width: 28, height: 28, viewBox: "0 0 28 28", fill: "none", "aria-hidden": true } as const;

  if (name === "tasks") {
    return <svg {...common}><rect x="5" y="4" width="18" height="20" rx="3" stroke="currentColor" strokeWidth="1.8" /><path d="m9 10 2 2 4-4M9 17h8M9 21h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  }
  if (name === "categories") {
    return <svg {...common}><rect x="4" y="4" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8" /><rect x="16" y="4" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8" /><rect x="4" y="16" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8" /><rect x="16" y="16" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8" /></svg>;
  }
  if (name === "settings") {
    return <svg {...common}><path d="M14 4v20M4 14h20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><rect x="10.5" y="4" width="7" height="5" rx="2" fill="var(--color-bg-surface)" stroke="currentColor" strokeWidth="1.8" /><rect x="10.5" y="19" width="7" height="5" rx="2" fill="var(--color-bg-surface)" stroke="currentColor" strokeWidth="1.8" /></svg>;
  }
  if (name === "history") {
    return <svg {...common}><path d="M6 8a9 9 0 1 1-1 9M6 8V4M6 8h4M14 9v5l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  }
  if (name === "data") {
    return <svg {...common}><path d="M6 7h16M6 14h16M6 21h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><circle cx="4" cy="7" r="1" fill="currentColor" /><circle cx="4" cy="14" r="1" fill="currentColor" /><circle cx="4" cy="21" r="1" fill="currentColor" /></svg>;
  }
  return <svg {...common}><rect x="4" y="6" width="20" height="18" rx="3" stroke="currentColor" strokeWidth="1.8" /><path d="M8 4v5M20 4v5M4 11h20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
}

export default function App({ now = new Date() }: Props) {
  const state = useTaskerStore((store) => store.state);
  const storageError = useTaskerStore((store) => store.storageError);
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
  const jsonHostingCredentials = useTaskerStore((store) => store.jsonHostingCredentials);
  const jsonHostingStatus = useTaskerStore((store) => store.jsonHostingStatus);
  const configureJsonHosting = useTaskerStore((store) => store.configureJsonHosting);
  const disconnectJsonHosting = useTaskerStore((store) => store.disconnectJsonHosting);
  const startJsonHostingSync = useTaskerStore((store) => store.startJsonHostingSync);
  const stopJsonHostingSync = useTaskerStore((store) => store.stopJsonHostingSync);
  const deactivateTask = useTaskerStore((store) => store.deactivateTask);
  const completeTask = useTaskerStore((store) => store.completeTask);
  const postponeTask = useTaskerStore((store) => store.postponeTask);
  const openTaskCreate = useTaskerStore((store) => store.openTaskCreate);
  const openTaskEdit = useTaskerStore((store) => store.openTaskEdit);
  const today = getTodayString(now);
  const todayGroup = buildTodayTaskGroup(state, today);

  useEffect(() => {
    startJsonHostingSync();
    return stopJsonHostingSync;
  }, [startJsonHostingSync, stopJsonHostingSync]);

  function handleCreateTask() {
    openTaskCreate();
  }

  function handleCreateTaskForDate(date: string) {
    openTaskCreate(date);
  }

  function handleEditTaskFromCalendar(taskId: string) {
    openTaskEdit(taskId);
  }

  function handleDeactivateTask(taskId: string) {
    deactivateTask(taskId, now);
  }

  function handleCompleteTask(taskId: string, scheduledDate: string) {
    completeTask(taskId, scheduledDate, now);
  }

  function handlePostponeTaskToDate(taskId: string, scheduledDate: string, toDate: string) {
    postponeTask(taskId, scheduledDate, toDate, now);
  }

  return (
    <Container className="app-shell app-frame" size="xl" data-theme="olive-canvas">
      <Stack gap="lg">
        <nav className="top-menu" aria-label="Główna nawigacja">
          {([
            ["today", "Dzisiaj"], ["tasks", "Zadania"], ["calendar", "Kalendarz"], ["categories", "Kategorie"],
            ["settings", "Konfiguracja"], ["history", "Historia"], ["data", "Dane"],
          ] as const).map(([menuView, label]) => (
            <Button
              key={menuView}
              className="top-menu-item"
              data-active={view === menuView || undefined}
              variant="subtle"
              onClick={() => setView(menuView)}
              leftSection={<MenuIcon name={menuView} />}
              h={'20px'}
            >
              {label}
            </Button>
          ))}
        </nav>

        {view === "today" ? (
          <Paper className="today-surface" withBorder p="lg" radius="md">
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
                onDeactivate={handleDeactivateTask}
                onEdit={openTaskEdit}
              />
            </Stack>
          </Paper>
        ) : null}
        {view === "tasks" ? <TasksModuleView today={today} /> : null}
        {view === "calendar" ? (
          <CalendarView today={today} onCreateTaskForDate={handleCreateTaskForDate} onEditTask={handleEditTaskFromCalendar} />
        ) : null}
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
            <DataTransferView
              state={state}
              onPreviewImport={previewImport}
              onApplyImport={applyImport}
              credentials={jsonHostingCredentials}
              status={jsonHostingStatus}
              onConfigureJsonHosting={configureJsonHosting}
              onDisconnectJsonHosting={disconnectJsonHosting}
            />
          </Paper>
        ) : null}
      </Stack>
    </Container>
  );
}
