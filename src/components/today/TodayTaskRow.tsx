import { ActionIcon, Button, Group, Paper, Stack, Text } from "@mantine/core";
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
  const completionText = item.lastCompletedDate ? `Ostatnio wykonane: ${item.lastCompletedDate}` : "Jeszcze nie wykonano";

  return (
    <Paper className="today-task-row" component="article" withBorder>
      <Stack gap="sm">
        <Group className="today-task-header" justify="space-between" align="flex-start" gap="md">
          <Stack gap={2}>

            <Text className="today-task-title" fw={600}><span style={{backgroundColor: item.category.color, width: '16px', height: '16px', display: 'inline-block'}}></span> {item.task.title}</Text>
            <Text className="today-task-meta">
              {completionText}
            </Text>
          </Stack>
          <Group className="today-task-actions" gap={4} align="center" wrap="nowrap">
              <ActionIcon
                size={24}
                type="button"
                variant="subtle"
                aria-label={expanded ? `Ukryj szczegoly: ${item.task.title}` : `Pokaz szczegoly: ${item.task.title}`}
                aria-expanded={expanded}
                onClick={onToggleExpanded}
              >
                {expanded ? "-" : "+"}
              </ActionIcon>
            <Button className="today-complete-action" type="button" onClick={() => onComplete(item.task.id, item.scheduledDate)}>
              Wykonane
            </Button>
            <TodayPostponeMenu item={item} today={today} onPostponeToDate={onPostponeToDate} />
          </Group>
        </Group>
        {expanded ? <TodayTaskDetailsPanel item={item} /> : null}
      </Stack>
    </Paper>
  );
}
