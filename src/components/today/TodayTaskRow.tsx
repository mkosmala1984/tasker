import { ActionIcon, Badge, Button, Group, Paper, Stack, Text } from "@mantine/core";
import type { TodayTask } from "../../domain/types";
import { TodayPostponeMenu } from "./TodayPostponeMenu";
import { TodayTaskDetailsPanel } from "./TodayTaskDetailsPanel";

type Props = {
  item: TodayTask;
  today: string;
  expanded: boolean;
  onToggleExpanded: () => void;
  onComplete: (taskId: string, scheduledDate: string) => void;
  onPostponeToDate: (taskId: string, scheduledDate: string, toDate: string) => void;
  onEdit: (taskId: string) => void;
  onDeactivate: (taskId: string) => void;
};

export function TodayTaskRow({ item, today, expanded, onToggleExpanded, onComplete, onPostponeToDate }: Props) {
  const statusText = item.isOverdue ? item.scheduledDate : "Na dzis";
  const completionText = item.lastCompletedDate ? `Ostatnio wykonane: ${item.lastCompletedDate}` : "Jeszcze nie wykonano";

  return (
    <Paper component="article" withBorder radius="md" p="md">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" gap="md">
          <Stack gap={2}>
            <Text fw={600}>{item.task.title}</Text>
            <Text c="dimmed" size="sm">
              {completionText}
            </Text>
          </Stack>
          <Group gap="xs" align="center">
            <Badge color={item.isOverdue ? "orange" : "gray"} variant="light">
              {statusText}
            </Badge>
            <Button type="button" color="green" onClick={() => onComplete(item.task.id, item.scheduledDate)}>
              Wykonane
            </Button>
            <TodayPostponeMenu item={item} today={today} onPostponeToDate={onPostponeToDate} />
            <ActionIcon
              type="button"
              variant="subtle"
              aria-label={expanded ? `Ukryj szczegoly: ${item.task.title}` : `Pokaz szczegoly: ${item.task.title}`}
              onClick={onToggleExpanded}
            >
              {expanded ? "-" : "+"}
            </ActionIcon>
          </Group>
        </Group>
        {expanded ? <TodayTaskDetailsPanel item={item} /> : null}
      </Stack>
    </Paper>
  );
}
