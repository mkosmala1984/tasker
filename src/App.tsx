import { Alert, Button, Container, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { QuickAddForm } from "./components/QuickAddForm";
import { TaskFilters } from "./components/TaskFilters";
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
  const addTask = useTaskerStore((store) => store.addTask);
  const updateTask = useTaskerStore((store) => store.updateTask);
  const deactivateTask = useTaskerStore((store) => store.deactivateTask);
  const completeTask = useTaskerStore((store) => store.completeTask);
  const postponeTask = useTaskerStore((store) => store.postponeTask);
  const today = getTodayString(now);
  const todayTasks = buildTodayList(state, today, filters);

  function focusQuickAdd() {
    document.getElementById("quick-add-title")?.focus();
  }

  function handleAddTask(draft: TaskDraft) {
    addTask(draft, now);
  }

  function handleUpdateTask(taskId: string, draft: TaskDraft) {
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

  return (
    <Container className="app-shell" size="md">
      <Stack gap="lg" py="xl">
        <Paper withBorder p="lg" radius="md" shadow="xs">
          <Group justify="space-between" align="center" gap="md" wrap="wrap">
            <div>
              <Title order={1}>Tasker</Title>
              <Text c="dimmed">{formatPolishDateLabel(today)}</Text>
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
              categories={state.categories}
              assignees={state.assignees}
              onAdd={focusQuickAdd}
              onComplete={handleCompleteTask}
              onPostpone={handlePostponeTask}
              onDeactivate={handleDeactivateTask}
              onUpdate={handleUpdateTask}
            />

            <QuickAddForm
              categories={state.categories}
              assignees={state.assignees}
              today={today}
              onSubmit={handleAddTask}
            />
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}
