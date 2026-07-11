import { Button, Paper, Stack, Text } from "@mantine/core";
import type { TodayTask } from "../../domain/types";

type Props = {
  tasks: TodayTask[];
  open: boolean;
  onToggle: () => void;
};

export function TodayCompletedSection({ tasks, open, onToggle }: Props) {
  return (
    <Paper withBorder radius="md" p="md" component="section" aria-label="Wykonane dzisiaj">
      <Stack gap="sm">
        <Button type="button" variant="subtle" onClick={onToggle}>
          {`Wykonane dzisiaj (${tasks.length})`}
        </Button>
        {open ? (
          <Stack gap="xs">
            {tasks.length === 0 ? <Text c="dimmed">Brak wykonanych zadan dzisiaj.</Text> : null}
            {tasks.map((item) => (
              <Paper key={item.task.id} withBorder radius="sm" p="sm">
                <Text fw={500}>{item.task.title}</Text>
                <Text size="sm" c="dimmed">
                  {item.lastCompletedDate ? `Wykonane: ${item.lastCompletedDate}` : "Wykonane dzisiaj"}
                </Text>
              </Paper>
            ))}
          </Stack>
        ) : null}
      </Stack>
    </Paper>
  );
}
