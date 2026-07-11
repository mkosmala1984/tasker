import { Button, Paper, Stack, Text, Title } from "@mantine/core";
import type { TodayTask } from "../../domain/types";
import { TodayTaskRow } from "./TodayTaskRow";

type Props = {
  today: string;
  activeTasks: TodayTask[];
  expandedTaskIds: string[];
  onExpandedTaskIdsChange: (taskIds: string[]) => void;
  onAdd: () => void;
  onComplete: (taskId: string, scheduledDate: string) => void;
  onPostponeToDate: (taskId: string, scheduledDate: string, toDate: string) => void;
  onEdit: (taskId: string) => void;
  onDeactivate: (taskId: string) => void;
};

export function TodayActiveList({
  today,
  activeTasks,
  expandedTaskIds,
  onExpandedTaskIdsChange,
  onAdd,
  onComplete,
  onPostponeToDate,
  onEdit,
  onDeactivate
}: Props) {
  if (activeTasks.length === 0) {
    return (
      <Paper component="section" withBorder p="lg" radius="md">
        <Stack align="flex-start" gap="sm">
          <Title order={2}>Brak zadan na dzisiaj</Title>
          <Text c="dimmed">Wszystko domkniete. Dodaj nowe zadanie albo wroc tu jutro.</Text>
          <Button type="button" onClick={onAdd}>
            Dodaj zadanie
          </Button>
        </Stack>
      </Paper>
    );
  }

  return (
    <Stack component="section" aria-label="Aktywne zadania" gap="sm">
      {activeTasks.map((item) => {
        const expanded = expandedTaskIds.includes(item.task.id);
        return (
          <TodayTaskRow
            key={item.task.id}
            item={item}
            today={today}
            expanded={expanded}
            onToggleExpanded={() =>
              onExpandedTaskIdsChange(
                expanded ? expandedTaskIds.filter((taskId) => taskId !== item.task.id) : [...expandedTaskIds, item.task.id]
              )
            }
            onComplete={onComplete}
            onPostponeToDate={onPostponeToDate}
            onEdit={onEdit}
            onDeactivate={onDeactivate}
          />
        );
      })}
    </Stack>
  );
}
