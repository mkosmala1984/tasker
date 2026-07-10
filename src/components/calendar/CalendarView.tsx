import { Button, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { useMemo, useState } from "react";
import { getCalendarDayDetails, getCalendarMonthDays } from "../../domain/calendar";
import { addMonths, formatPolishDateLabel } from "../../domain/dates";
import { useTaskerStore } from "../../state/taskerStore";
import { CalendarDayPanel } from "./CalendarDayPanel";
import { CalendarMonthGrid } from "./CalendarMonthGrid";

type Props = {
  today: string;
  onCreateTaskForDate: (date: string) => void;
  onEditTask: (taskId: string) => void;
};

export function CalendarView({ today, onCreateTaskForDate, onEditTask }: Props) {
  const state = useTaskerStore((store) => store.state);
  const selectedDate = useTaskerStore((store) => store.selectedCalendarDate);
  const setSelectedDate = useTaskerStore((store) => store.setSelectedCalendarDate);
  const postponeTaskToDate = useTaskerStore((store) => store.postponeTaskToDate);
  const [monthDate, setMonthDate] = useState(selectedDate);

  const days = useMemo(() => getCalendarMonthDays(state, monthDate, today), [state, monthDate, today]);
  const details = useMemo(() => getCalendarDayDetails(state, selectedDate), [state, selectedDate]);

  return (
    <Paper withBorder p="lg" radius="md" shadow="xs">
      <Stack gap="md">
        <Group justify="space-between" align="center" gap="md" wrap="wrap">
          <div>
            <Title order={2}>Kalendarz</Title>
            <Text c="dimmed">Planowanie zadan wedlug dat</Text>
          </div>
          <Group gap="xs">
            <Button type="button" variant="default" onClick={() => setMonthDate(addMonths(monthDate, -1))}>
              Poprzedni miesiac
            </Button>
            <Text fw={700}>{formatPolishDateLabel(`${monthDate.slice(0, 7)}-01`)}</Text>
            <Button type="button" variant="default" onClick={() => setMonthDate(addMonths(monthDate, 1))}>
              Nastepny miesiac
            </Button>
          </Group>
        </Group>

        <CalendarMonthGrid days={days} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
        <CalendarDayPanel
          details={details}
          onCreateTaskForDate={onCreateTaskForDate}
          onEditTask={onEditTask}
          onPostponeTaskToDate={postponeTaskToDate}
        />
      </Stack>
    </Paper>
  );
}
