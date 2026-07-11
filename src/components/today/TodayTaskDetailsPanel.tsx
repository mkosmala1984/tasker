import { Grid, Paper, Text } from "@mantine/core";
import type { TodayTask } from "../../domain/types";

type Props = {
  item: TodayTask;
};

export function TodayTaskDetailsPanel({ item }: Props) {
  return (
    <Paper withBorder radius="md" p="md">
      <Grid>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <Text fw={500}>Kategoria</Text>
          <Text>{item.category.name}</Text>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <Text fw={500}>Osoba</Text>
          <Text>{item.assignee.name}</Text>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <Text fw={500}>Typ</Text>
          <Text>{item.taskType.name}</Text>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <Text fw={500}>Priorytet</Text>
          <Text>{item.priority.name}</Text>
        </Grid.Col>
      </Grid>
    </Paper>
  );
}
