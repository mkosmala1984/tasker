import { Badge, Group, Stack, Text, Title } from "@mantine/core";

type Props = {
  dateLabel: string;
  activeCount: number;
};

function getCountLabel(activeCount: number): string {
  if (activeCount === 1) {
    return "1 zadanie";
  }

  const lastDigit = activeCount % 10;
  const lastTwoDigits = activeCount % 100;
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)) {
    return `${activeCount} zadania`;
  }

  return `${activeCount} zadan`;
}

export function TodaySummaryHeader({ dateLabel, activeCount }: Props) {
  return (
    <Group justify="space-between" align="flex-start" gap="md">
      <Stack gap={4}>
        <Title order={1}>Dzisiaj</Title>
        <Text c="dimmed">{dateLabel}</Text>
      </Stack>
      <Badge color="green" variant="light" size="lg">
        {getCountLabel(activeCount)}
      </Badge>
    </Group>
  );
}
