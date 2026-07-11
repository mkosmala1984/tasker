import { Grid, Paper, Text } from "@mantine/core";
import type { TodayTask } from "../../domain/types";

type Props = {
  item: TodayTask;
};

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
      </Grid>
    </Paper>
  );
}
