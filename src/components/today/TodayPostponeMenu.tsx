import { ActionIcon, Button, Popover, Stack, TextInput } from "@mantine/core";
import { useState } from "react";
import { addDays } from "../../domain/dates";
import type { TodayTask } from "../../domain/types";

type Props = {
  item: TodayTask;
  today: string;
  onPostponeToDate: (taskId: string, scheduledDate: string, toDate: string) => void;
};

export function TodayPostponeMenu({ item, today, onPostponeToDate }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customDate, setCustomDate] = useState("");

  function handlePostpone(toDate: string) {
    onPostponeToDate(item.task.id, item.scheduledDate, toDate);
    setMenuOpen(false);
    setCustomOpen(false);
    setCustomDate("");
  }

  return (
    <div className="today-postpone-menu">
      <Popover opened={menuOpen} onChange={setMenuOpen} position="bottom-end" withinPortal trapFocus returnFocus radius="md">
      <Popover.Target>
      <ActionIcon size={32} type="button" variant="subtle" color="var(--color-success)" title="Odłóż" aria-label={`Odłóż: ${item.task.title}`} aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}>
        <svg className="today-postpone-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6.4 2.6Q12 1.9 17.7 2.4M6.1 21.4Q12 22.1 17.9 21.5" />
          <path d="M7.1 2.8C6.4 7 8.8 8.9 11.8 11.7C15.8 14 17 17.4 16.8 21M17 2.8C17.3 6.6 15.4 9 12.1 11.9C8.8 14.3 6.7 17.4 7.1 21" strokeWidth="1.15" />
        </svg>
      </ActionIcon>
      </Popover.Target>
        <Popover.Dropdown className="today-postpone-panel" p="xs">
          <Stack gap="xs">
            <Button type="button" variant="subtle" onClick={() => handlePostpone(addDays(today, 1))}>
              Jutro
            </Button>
            <Button type="button" variant="subtle" onClick={() => handlePostpone(addDays(today, 7))}>
              Za tydzien
            </Button>
            <Button type="button" variant="subtle" onClick={() => setCustomOpen((value) => !value)}>
              Wybierz date
            </Button>
            {customOpen ? (
              <Stack>
                <TextInput
                  aria-label={`Wybierz date odlozenia: ${item.task.title}`}
                  type="date"
                  min={today}
                  value={customDate}
                  onChange={(event) => setCustomDate(event.currentTarget.value)}
                />
                <Button
                  type="button"
                  size="xs"
                  aria-label={`Zatwierdz odlozenie: ${item.task.title}`}
                  disabled={customDate === ""}
                  onClick={() => handlePostpone(customDate)}
                >
                  Zatwierdz
                </Button>
              </Stack>
            ) : null}
          </Stack>
        </Popover.Dropdown>
      </Popover>
    </div>
  );
}
