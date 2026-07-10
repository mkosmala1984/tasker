import { Badge, Button, SimpleGrid, Stack, Text } from "@mantine/core";
import type { CalendarDay } from "../../domain/calendar";
import { formatPolishDateLabel } from "../../domain/dates";

type Props = {
  days: CalendarDay[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
};

const WEEKDAYS = ["Pon", "Wto", "Sro", "Czw", "Pia", "Sob", "Nie"];

export function CalendarMonthGrid({ days, selectedDate, onSelectDate }: Props) {
  return (
    <Stack gap="xs">
      <SimpleGrid cols={7} spacing="xs">
        {WEEKDAYS.map((day) => (
          <Text key={day} fw={700} size="sm" ta="center">
            {day}
          </Text>
        ))}
      </SimpleGrid>

      <SimpleGrid cols={7} spacing="xs">
        {days.map((day) => {
          const label = formatPolishDateLabel(day.date);
          const selected = day.date === selectedDate;

          return (
            <Button
              key={day.date}
              type="button"
              variant={selected ? "filled" : day.isToday ? "light" : "default"}
              color={day.isCurrentMonth ? "blue" : "gray"}
              aria-label={`${label}${day.items.length > 0 ? `, ${day.items.length} zadania` : ""}`}
              onClick={() => onSelectDate(day.date)}
              styles={{ root: { minHeight: 76, height: "auto", padding: 8 } }}
            >
              <Stack gap={4} align="center">
                <Text size="sm" fw={day.isToday ? 700 : 500}>
                  {Number(day.date.slice(8, 10))}
                </Text>
                {day.items.length > 0 ? (
                  <Badge size="xs" variant={selected ? "white" : "light"}>
                    {day.items.length}
                  </Badge>
                ) : null}
              </Stack>
            </Button>
          );
        })}
      </SimpleGrid>
    </Stack>
  );
}
