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
