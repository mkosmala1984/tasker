import { ActionIcon, Group, Paper, Stack, Text } from "@mantine/core";
import type { TodayTask } from "../../domain/types";
import { TodayPostponeMenu } from "./TodayPostponeMenu";
import { TodayTaskDetailsPanel } from "./TodayTaskDetailsPanel";

const completedIconUrl = new URL("../../assets/completed-dry-brush.svg", import.meta.url).href;

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
  return (
    <Paper className="today-task-row" component="article" withBorder onClick={onToggleExpanded}>
      <Stack gap="sm">
        <Group className="today-task-header" align="center" gap="xs" wrap="nowrap">
            <Text
              component="button"
              type="button"
              className="today-task-title"
              fw={600}
              aria-label={expanded ? `Ukryj szczegoly: ${item.task.title}` : `Pokaz szczegoly: ${item.task.title}`}
              aria-expanded={expanded}
              onClick={(event) => {
                event.stopPropagation();
                onToggleExpanded();
              }}
            >
              <span className="today-task-color" style={{ backgroundColor: item.category.color }} aria-hidden="true" />
              <span>{item.task.title}</span>
            </Text>
          <Group className="today-task-actions" gap={4} align="center" wrap="nowrap" onClick={(event) => event.stopPropagation()}>
            <ActionIcon variant="subtle" color="var(--color-success)" size={32} type="button" aria-label="Wykonane" title="Wykonane" onClick={() => onComplete(item.task.id, item.scheduledDate)}>
              <span className="today-complete-icon" aria-hidden="true" style={{ maskImage: `url("${completedIconUrl}")` }} />
            </ActionIcon>
            <TodayPostponeMenu item={item} today={today} onPostponeToDate={onPostponeToDate} />
          </Group>
        </Group>
        {expanded ? <TodayTaskDetailsPanel item={item} /> : null}
      </Stack>
    </Paper>
  );
}
