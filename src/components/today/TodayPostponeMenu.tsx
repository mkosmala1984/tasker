import { Button, Popover, Stack, TextInput } from "@mantine/core";
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
      <Button type="button" variant="default" aria-label={`Odloz: ${item.task.title}`} onClick={() => setMenuOpen((value) => !value)}>
        Odloz
      </Button>
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
