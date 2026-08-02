import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetTaskerStore, useTaskerStore } from "../../state/taskerStore";
import { CalendarView } from "./CalendarView";

function renderCalendar() {
  const onCreateTaskForDate = vi.fn();
  const onEditTask = vi.fn();
  useTaskerStore.getState().setSelectedCalendarDate("2026-07-07");
  render(
    <MantineProvider>
      <CalendarView today="2026-07-07" onCreateTaskForDate={onCreateTaskForDate} onEditTask={onEditTask} />
    </MantineProvider>
  );
  return { onCreateTaskForDate, onEditTask };
}

beforeEach(() => {
  localStorage.clear();
  resetTaskerStore();
});

describe("CalendarView", () => {
  it("selects a day and starts creating a task for that date", async () => {
    const user = userEvent.setup();
    const { onCreateTaskForDate } = renderCalendar();

    await user.click(screen.getByRole("button", { name: /^Środa, 8 lipca 2026/ }));
    await user.click(screen.getByRole("button", { name: "Dodaj zadanie na ten dzien" }));

    expect(onCreateTaskForDate).toHaveBeenCalledWith("2026-07-08");
  });

  it("shows one-time tasks in the selected day and starts editing from the day panel", async () => {
    useTaskerStore.getState().addTask(
      {
        title: "Zaplacic rachunek",
        categoryName: "Finanse",
        assigneeName: "Ola",
        schedule: { mode: "oneTime", date: "2026-07-08" },
        active: true
      },
      new Date("2026-07-05T08:00:00.000Z")
    );
    const taskId = useTaskerStore.getState().state.tasks[0].id;
    const user = userEvent.setup();
    const { onEditTask } = renderCalendar();

    await user.click(screen.getByRole("button", { name: /^Środa, 8 lipca 2026/ }));

    expect(screen.getByText("Zaplacic rachunek")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edytuj Zaplacic rachunek" }));

    expect(onEditTask).toHaveBeenCalledWith(taskId);
  });

  it("shows future recurring occurrences", async () => {
    useTaskerStore.getState().addTask(
      {
        title: "Trening",
        categoryName: "Zdrowie",
        assigneeName: "Ola",
        schedule: { mode: "recurring", startDate: "2026-07-02", recurrence: { type: "weekly" } },
        active: true
      },
      new Date("2026-07-01T08:00:00.000Z")
    );
    const user = userEvent.setup();
    renderCalendar();

    await user.click(screen.getByRole("button", { name: /^Czwartek, 9 lipca 2026/ }));

    expect(screen.getByText("Trening")).toBeInTheDocument();
    expect(screen.getByText("Cykliczne")).toBeInTheDocument();
  });

  it("postpones a selected-day task to a chosen date", async () => {
    useTaskerStore.getState().addTask(
      {
        title: "Zadzwonic",
        categoryName: "Dom",
        assigneeName: "Ola",
        schedule: { mode: "oneTime", date: "2026-07-08" },
        active: true
      },
      new Date("2026-07-05T08:00:00.000Z")
    );
    const user = userEvent.setup();
    renderCalendar();

    await user.click(screen.getByRole("button", { name: /^Środa, 8 lipca 2026/ }));
    await user.type(screen.getByLabelText("Odloz na date"), "2026-07-20");
    await user.click(screen.getByRole("button", { name: "Odloz Zadzwonic" }));

    expect(useTaskerStore.getState().state.postponements[0]).toMatchObject({
      fromDate: "2026-07-08",
      toDate: "2026-07-20"
    });
  });
});
