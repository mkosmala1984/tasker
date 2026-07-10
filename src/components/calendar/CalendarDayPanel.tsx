import { Badge, Button, Card, Group, Stack, Text, TextInput, Title } from "@mantine/core";
import { useState } from "react";
import type { CalendarDayDetails, CalendarTaskItem } from "../../domain/calendar";
import { formatPolishDateLabel } from "../../domain/dates";

type Props = {
  details: CalendarDayDetails;
  onCreateTaskForDate: (date: string) => void;
  onEditTask: (taskId: string) => void;
  onPostponeTaskToDate: (taskId: string, fromDate: string, toDate: string) => void;
};

function kindLabel(item: CalendarTaskItem): string {
  if (item.isPostponed) {
    return "Odlozone";
  }
  return item.kind === "oneTime" ? "Jednorazowe" : "Cykliczne";
}

export function CalendarDayPanel({ details, onCreateTaskForDate, onEditTask, onPostponeTaskToDate }: Props) {
  const [postponeDates, setPostponeDates] = useState<Record<string, string>>({});

  return (
    <Card withBorder radius="md" p="lg">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" gap="md">
          <div>
            <Title order={2}>{formatPolishDateLabel(details.date)}</Title>
            <Text c="dimmed">{details.items.length === 0 ? "Brak zadan w tym dniu" : `${details.items.length} zadania w tym dniu`}</Text>
          </div>
          <Button type="button" onClick={() => onCreateTaskForDate(details.date)}>
            Dodaj zadanie na ten dzien
          </Button>
        </Group>

        {details.items.map((item) => {
          const postponeValue = postponeDates[item.task.id] ?? "";

          return (
            <Card key={`${item.task.id}-${item.scheduledDate}-${item.displayDate}`} withBorder radius="sm" p="md">
              <Stack gap="sm">
                <Group justify="space-between" align="flex-start" gap="xs">
                  <Title order={3}>{item.task.title}</Title>
                  <Badge variant="light">{kindLabel(item)}</Badge>
                </Group>
                {item.isPostponed ? (
                  <Text size="sm" c="dimmed">
                    Pierwotna data: {item.scheduledDate}
                  </Text>
                ) : null}
                <Group gap="xs" align="end">
                  <Button type="button" variant="default" aria-label={`Edytuj ${item.task.title}`} onClick={() => onEditTask(item.task.id)}>
                    Edytuj
                  </Button>
                  <TextInput
                    label="Odloz na date"
                    type="date"
                    value={postponeValue}
                    onChange={(event) => setPostponeDates({ ...postponeDates, [item.task.id]: event.currentTarget.value })}
                  />
                  <Button
                    type="button"
                    variant="light"
                    aria-label={`Odloz ${item.task.title}`}
                    disabled={postponeValue.length === 0}
                    onClick={() => onPostponeTaskToDate(item.task.id, item.scheduledDate, postponeValue)}
                  >
                    Odloz
                  </Button>
                </Group>
              </Stack>
            </Card>
          );
        })}
      </Stack>
    </Card>
  );
}
