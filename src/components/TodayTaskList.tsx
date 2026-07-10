import { Button, Paper, Stack, Text, Title } from "@mantine/core";
import type { Assignee, Category, Priority, TaskType, TodayTask } from "../domain/types";
import { TodayTaskCard } from "./TodayTaskCard";

type Props = {
  tasks: TodayTask[];
  categories: Category[];
  assignees: Assignee[];
  taskTypes: TaskType[];
  priorities: Priority[];
  onAdd: () => void;
  onComplete: (taskId: string, scheduledDate: string) => void;
  onPostponeTomorrow: (taskId: string, scheduledDate: string) => void;
  onPostponeToDate: (taskId: string, scheduledDate: string, toDate: string) => void;
  onDeactivate: (taskId: string) => void;
  onEdit: (taskId: string) => void;
};

export function TodayTaskList({ tasks, onAdd, onComplete, onPostponeTomorrow, onPostponeToDate, onDeactivate, onEdit }: Props) {
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
          onPostponeTomorrow={onPostponeTomorrow}
          onPostponeToDate={onPostponeToDate}
          onDeactivate={onDeactivate}
          onEdit={onEdit}
        />
      ))}
    </section>
  );
}
