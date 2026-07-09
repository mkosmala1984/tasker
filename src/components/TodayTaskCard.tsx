import { Badge, Button, Card, Group, Stack, Text, Title } from "@mantine/core";
import type { TodayTask } from "../domain/types";

type Props = {
  item: TodayTask;
  onComplete: (taskId: string, scheduledDate: string) => void;
  onPostpone: (taskId: string) => void;
  onDeactivate: (taskId: string) => void;
  onEdit: (taskId: string) => void;
};

export function TodayTaskCard({ item, onComplete, onPostpone, onDeactivate, onEdit }: Props) {
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
          <Badge variant="default">{item.taskType.name}</Badge>
          <Badge variant="default">{item.priority.name}</Badge>
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
          <Button type="button" variant="default" onClick={() => onEdit(item.task.id)}>
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
