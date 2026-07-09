import { Button, Paper, Stack, Text, Title } from "@mantine/core";
import type { TodayTask } from "../domain/types";
import { TodayTaskCard } from "./TodayTaskCard";

type Props = {
  tasks: TodayTask[];
  onAdd: () => void;
  onComplete: (taskId: string, scheduledDate: string) => void;
  onPostpone: (taskId: string) => void;
  onDeactivate: (taskId: string) => void;
  onEdit: (taskId: string) => void;
};

export function TodayTaskList({ tasks, onAdd, onComplete, onPostpone, onDeactivate, onEdit }: Props) {
  if (tasks.length === 0) {
    return (
      <Paper component="section" withBorder p="lg" radius="md">
        <Stack align="flex-start" gap="sm">
          <Title order={2}>Brak zadan na dzisiaj</Title>
          <Text c="dimmed">Dodaj pierwsze zadanie albo zmien filtry.</Text>
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
          onComplete={onComplete}
          onPostpone={onPostpone}
          onDeactivate={onDeactivate}
          onEdit={onEdit}
        />
      ))}
    </section>
  );
}
