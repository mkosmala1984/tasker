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
