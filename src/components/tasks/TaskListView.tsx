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
            <Text size="sm" c="dimmed">
              {scheduleText(task)}
            </Text>
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
