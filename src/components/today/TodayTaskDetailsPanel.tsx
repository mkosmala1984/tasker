import { Grid, Paper, Text } from "@mantine/core";
import type { TaskSchedule, TodayTask } from "../../domain/types";

type Props = {
  item: TodayTask;
};

function getFrequencyLabel(schedule: TaskSchedule): string {
  if (schedule.mode === "oneTime") return "Jednorazowo";

  const intervalDays = schedule.recurrence.type === "daily" ? 1 :
    schedule.recurrence.type === "everyNDays" ? schedule.recurrence.intervalDays :
    schedule.recurrence.type === "weekly" ? 7 :
    schedule.recurrence.type === "monthly" ? 30 : 90;

  return intervalDays === 1 ? "Co 1 dzień" : `Co ${intervalDays} dni`;
}

export function TodayTaskDetailsPanel({ item }: Props) {
  return (
    <Paper className="today-task-details" withBorder radius="md" p="md">
      <Grid>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <Text className="today-task-detail-label" fw={500}>Kategoria</Text>
          <Text className="today-task-detail-value">{item.category.name}</Text>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <Text className="today-task-detail-label" fw={500}>Osoba</Text>
          <Text className="today-task-detail-value">{item.assignee.name}</Text>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <Text className="today-task-detail-label" fw={500}>Typ</Text>
          <Text className="today-task-detail-value">{item.taskType.name}</Text>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <Text className="today-task-detail-label" fw={500}>Priorytet</Text>
          <Text className="today-task-detail-value">{item.priority.name}</Text>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <Text className="today-task-detail-label" fw={500}>Częstotliwość</Text>
          <Text className="today-task-detail-value">{getFrequencyLabel(item.task.schedule)}</Text>
        </Grid.Col>
      </Grid>
    </Paper>
  );
}
