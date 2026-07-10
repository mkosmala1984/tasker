import { MantineProvider } from "@mantine/core";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { STORAGE_KEY } from "./storage/taskerStorage";
import { resetTaskerStore } from "./state/taskerStore";

function renderApp({ now = new Date(2026, 6, 5, 9, 0) }: { now?: Date } = {}) {
  render(
    <MantineProvider>
      <App now={now} />
    </MantineProvider>
  );
}

function seedTaskState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      tasks: [
        {
          id: "task-1",
          title: "Podlac rosliny",
          categoryId: "cat-home",
          assigneeId: "person-ola",
          taskTypeId: "task-type-default",
          priorityId: "priority-normal",
          schedule: { mode: "recurring", startDate: "2026-07-07", recurrence: { type: "daily" } },
          active: true,
          createdAt: "2026-07-07T08:00:00.000Z",
          updatedAt: "2026-07-07T08:00:00.000Z"
        }
      ],
      categories: [{ id: "cat-home", name: "Dom", color: "#40c057" }],
      assignees: [{ id: "person-ola", name: "Ola" }],
      taskTypes: [{ id: "task-type-default", name: "Zadanie", active: true, order: 0 }],
      priorities: [{ id: "priority-normal", name: "Normalny", active: true, order: 0, color: "#868e96" }],
      completions: [],
      postponements: []
    })
  );
}

async function addDailyTask(title: string, category: string, assignee: string) {
  const user = userEvent.setup();

  const form = screen.getByRole("form", { name: "Szybkie dodanie" });
  await user.type(within(form).getByLabelText(/Nazwa zadania/), title);
  await user.type(within(form).getByLabelText(/Kategoria/), category);
  await user.type(within(form).getByLabelText(/Osoba/), assignee);
  await user.click(within(form).getByRole("button", { name: "Zapisz" }));
}

function seedState(state: unknown) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  resetTaskerStore();
}

describe("App", () => {
  beforeEach(() => {
    localStorage.clear();
    resetTaskerStore();
  });

  it("adds a task and persists it in localStorage", async () => {
    renderApp();

    await addDailyTask("Podlac rosliny", "Dom", "Ola");

    expect(screen.getByRole("heading", { name: "Tasker" })).toBeInTheDocument();
    expect(screen.getByText("Niedziela, 5 lipca 2026")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Podlac rosliny" })).toBeInTheDocument();
    expect(screen.getAllByText("Dzisiaj").length).toBeGreaterThan(0);
    expect(screen.getByText("Jeszcze nie wykonane")).toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toContain("Podlac rosliny");
  });

  it("opens the separate task editor from the header add button", async () => {
    renderApp();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "+ Dodaj zadanie" }));

    expect(screen.getByRole("heading", { name: "Dodaj zadanie" })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Dodaj zadanie" })).toBeInTheDocument();
  });

  it("navigates from Today to foundation placeholder views", async () => {
    renderApp();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Kalendarz" }));
    expect(screen.getByRole("heading", { name: "Kalendarz" })).toBeInTheDocument();
    expect(screen.getByText("Planowanie zadan wedlug dat")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Wtorek, 7 lipca 2026/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Konfiguracja" }));
    expect(screen.getByRole("heading", { name: "Konfiguracja zadan" })).toBeInTheDocument();
  });

  it("opens the task flow with a calendar-selected date", async () => {
    renderApp({ now: new Date("2026-07-07T08:00:00.000Z") });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Kalendarz" }));
    await user.click(screen.getByRole("button", { name: /^Środa, 8 lipca 2026/ }));
    await user.click(screen.getByRole("button", { name: "Dodaj zadanie na ten dzien" }));

    expect(screen.getByRole("heading", { name: "Dodaj zadanie" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("2026-07-08")).toBeInTheDocument();
  });

  it("marks a task as complete and removes it from today", async () => {
    renderApp();
    const user = userEvent.setup();
    await addDailyTask("Podlac rosliny", "Dom", "Ola");

    await user.click(screen.getByRole("button", { name: "Wykonane" }));

    expect(screen.queryByRole("heading", { name: "Podlac rosliny" })).not.toBeInTheDocument();
    expect(screen.getByText("Brak zadan na dzisiaj")).toBeInTheDocument();
  });

  it("postpones a task without recording completion", async () => {
    renderApp();
    const user = userEvent.setup();
    await addDailyTask("Podlac rosliny", "Dom", "Ola");

    await user.click(screen.getByRole("button", { name: "Odloz na jutro" }));

    expect(screen.queryByRole("heading", { name: "Podlac rosliny" })).not.toBeInTheDocument();
    const stored = localStorage.getItem(STORAGE_KEY) ?? "";
    expect(stored).toContain('"postponements"');
    expect(stored).toContain('"toDate":"2026-07-06"');
    expect(stored).not.toContain("completedDate");
  });

  it("filters today list by category, assignee, task type, and priority", async () => {
    seedState({
      tasks: [
        {
          id: "task-1",
          title: "Dom Oli",
          categoryId: "cat-home",
          assigneeId: "person-ola",
          taskTypeId: "type-task",
          priorityId: "priority-normal",
          schedule: { mode: "oneTime", date: "2026-07-05" },
          active: true,
          createdAt: "2026-07-05T08:00:00.000Z",
          updatedAt: "2026-07-05T08:00:00.000Z"
        },
        {
          id: "task-2",
          title: "Praca Jana",
          categoryId: "cat-work",
          assigneeId: "person-jan",
          taskTypeId: "type-deadline",
          priorityId: "priority-high",
          schedule: { mode: "oneTime", date: "2026-07-05" },
          active: true,
          createdAt: "2026-07-05T08:00:00.000Z",
          updatedAt: "2026-07-05T08:00:00.000Z"
        }
      ],
      categories: [
        { id: "cat-home", name: "Dom", color: "#40c057" },
        { id: "cat-work", name: "Praca", color: "#228be6" }
      ],
      assignees: [
        { id: "person-ola", name: "Ola" },
        { id: "person-jan", name: "Jan" }
      ],
      taskTypes: [
        { id: "type-task", name: "Zadanie", active: true, order: 0 },
        { id: "type-deadline", name: "Termin", active: true, order: 1 }
      ],
      priorities: [
        { id: "priority-normal", name: "Normalny", active: true, order: 0, color: "#868e96" },
        { id: "priority-high", name: "Wysoki", active: true, order: 1, color: "#fa5252" }
      ],
      completions: [],
      postponements: []
    });
    renderApp();
    const user = userEvent.setup();

    const filters = screen.getByRole("region", { name: "Filtry" });
    await user.click(within(filters).getByRole("radio", { name: "Praca" }));
    await user.click(within(filters).getByLabelText("Osoba"));
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    await user.click(within(filters).getByLabelText("Typ"));
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    await user.click(within(filters).getByLabelText("Priorytet"));
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    const list = screen.getByRole("region", { name: "Zadania na dzisiaj" });
    expect(within(list).getByRole("heading", { name: "Praca Jana" })).toBeInTheDocument();
    expect(within(list).queryByRole("heading", { name: "Dom Oli" })).not.toBeInTheDocument();
  });

  it("postpones a task to a selected date without recording completion", async () => {
    renderApp();
    const user = userEvent.setup();
    await addDailyTask("Podlac rosliny", "Dom", "Ola");

    await user.type(screen.getByLabelText("Data odlozenia: Podlac rosliny"), "2026-07-12");
    await user.click(screen.getByRole("button", { name: "Odloz do daty" }));

    expect(screen.queryByRole("heading", { name: "Podlac rosliny" })).not.toBeInTheDocument();
    const stored = localStorage.getItem(STORAGE_KEY) ?? "";
    expect(stored).toContain('"fromDate":"2026-07-05"');
    expect(stored).toContain('"toDate":"2026-07-12"');
    expect(stored).not.toContain("completedDate");
  });

  it("keeps recurring completion cycle based on the actual completion date", async () => {
    seedState({
      tasks: [
        {
          id: "task-1",
          title: "Przeglad",
          categoryId: "cat-home",
          assigneeId: "person-ola",
          taskTypeId: "type-task",
          priorityId: "priority-normal",
          schedule: { mode: "recurring", startDate: "2026-07-01", recurrence: { type: "weekly" } },
          active: true,
          createdAt: "2026-07-01T08:00:00.000Z",
          updatedAt: "2026-07-01T08:00:00.000Z"
        }
      ],
      categories: [{ id: "cat-home", name: "Dom", color: "#40c057" }],
      assignees: [{ id: "person-ola", name: "Ola" }],
      taskTypes: [{ id: "type-task", name: "Zadanie", active: true, order: 0 }],
      priorities: [{ id: "priority-normal", name: "Normalny", active: true, order: 0, color: "#868e96" }],
      completions: [],
      postponements: []
    });
    render(
      <MantineProvider>
        <App now={new Date(2026, 6, 3, 9, 0)} />
      </MantineProvider>
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Wykonane" }));

    const stored = localStorage.getItem(STORAGE_KEY) ?? "";
    expect(stored).toContain('"scheduledDate":"2026-07-01"');
    expect(stored).toContain('"completedDate":"2026-07-03"');
  });

  it("edits an existing task in the separate editor and deactivates it from the list", async () => {
    renderApp();
    const user = userEvent.setup();
    await addDailyTask("Stara nazwa", "Dom", "Ola");

    await user.click(screen.getByRole("button", { name: "Edytuj" }));
    const form = screen.getByRole("form", { name: "Edytuj zadanie" });
    await user.clear(within(form).getByLabelText(/Nazwa zadania/));
    await user.type(within(form).getByLabelText(/Nazwa zadania/), "Nowa nazwa");
    await user.click(within(form).getByRole("button", { name: "Zapisz zmiany" }));

    expect(screen.getByText("Nowa nazwa")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Dezaktywuj" }));

    expect(screen.getByText("Nowa nazwa")).toBeInTheDocument();
    expect(screen.getByText("Nieaktywne")).toBeInTheDocument();
  });

  it("creates a one-time task from the separate tasks view", async () => {
    seedTaskState();
    resetTaskerStore();
    renderApp({ now: new Date("2026-07-07T10:00:00.000Z") });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "+ Dodaj zadanie" }));
    expect(screen.getByRole("heading", { name: "Dodaj zadanie" })).toBeInTheDocument();

    await user.type(screen.getByLabelText("Nazwa zadania"), "Zaplacic rachunek");
    await user.clear(screen.getByLabelText("Data zadania"));
    await user.type(screen.getByLabelText("Data zadania"), "2026-07-12");
    await user.click(screen.getByRole("button", { name: "Zapisz zadanie" }));

    expect(screen.getByRole("heading", { name: "Zadania" })).toBeInTheDocument();
    expect(screen.getByText("Zaplacic rachunek")).toBeInTheDocument();
    expect(screen.getByText("Jednorazowe: 2026-07-12")).toBeInTheDocument();
  });

  it("edits a task into an every-N-days recurring task", async () => {
    seedTaskState();
    resetTaskerStore();
    renderApp({ now: new Date("2026-07-07T10:00:00.000Z") });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Zadania" }));
    await user.click(screen.getByRole("button", { name: "Edytuj" }));
    await user.clear(screen.getByLabelText("Nazwa zadania"));
    await user.type(screen.getByLabelText("Nazwa zadania"), "Trening");
    await user.selectOptions(screen.getByLabelText("Tryb"), "recurring");
    await user.selectOptions(screen.getByLabelText("Regula powtarzania"), "everyNDays");
    await user.clear(screen.getByLabelText("Liczba dni"));
    await user.type(screen.getByLabelText("Liczba dni"), "3");
    await user.click(screen.getByRole("button", { name: "Zapisz zmiany" }));

    expect(screen.getByText("Trening")).toBeInTheDocument();
    expect(screen.getByText("Cykliczne od 2026-07-07: co 3 dni")).toBeInTheDocument();
  });

  it("deactivates a task from the tasks list without removing it", async () => {
    seedTaskState();
    resetTaskerStore();
    renderApp({ now: new Date("2026-07-07T10:00:00.000Z") });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Zadania" }));
    await user.click(screen.getByRole("button", { name: "Dezaktywuj" }));

    expect(screen.getByText("Podlac rosliny")).toBeInTheDocument();
    expect(screen.getByText("Nieaktywne")).toBeInTheDocument();
  });

  it("opens the separate editor from a Today task card", async () => {
    seedTaskState();
    resetTaskerStore();
    renderApp({ now: new Date("2026-07-07T10:00:00.000Z") });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Edytuj" }));

    expect(screen.getByRole("heading", { name: "Edytuj zadanie" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Podlac rosliny")).toBeInTheDocument();
  });

  it("manages categories from the Kategorie view", async () => {
    renderApp();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Kategorie" }));
    await user.type(screen.getByLabelText("Nazwa kategorii"), "Dom");
    await user.clear(screen.getByLabelText("Kolor kategorii"));
    await user.type(screen.getByLabelText("Kolor kategorii"), "#40c057");
    await user.click(screen.getByRole("button", { name: "Dodaj kategorie" }));

    expect(screen.getByText("Dom")).toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toContain("#40c057");
  });

  it("manages task type and priority dictionaries from configuration", async () => {
    renderApp();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Konfiguracja" }));
    await user.type(screen.getByLabelText("Nowy typ zadania"), "Termin");
    await user.click(screen.getByRole("button", { name: "Dodaj typ" }));
    await user.type(screen.getByLabelText("Nowy priorytet"), "Pilny");
    await user.clear(screen.getByLabelText("Kolor priorytetu"));
    await user.type(screen.getByLabelText("Kolor priorytetu"), "#fa5252");
    await user.click(screen.getByRole("button", { name: "Dodaj priorytet" }));

    expect(screen.getByText("Termin")).toBeInTheDocument();
    expect(screen.getByText("Pilny")).toBeInTheDocument();
  });

  it("shows completion history as a filterable list without statistics", async () => {
    const storedState = {
      categories: [{ id: "cat-home", name: "Dom", color: "#40c057" }],
      assignees: [{ id: "person-ola", name: "Ola" }],
      taskTypes: [{ id: "type-task", name: "Zadanie", active: true, order: 0 }],
      priorities: [{ id: "priority-normal", name: "Normalny", active: true, order: 0, color: "#868e96" }],
      tasks: [
        {
          id: "task-1",
          title: "Podlac rosliny",
          categoryId: "cat-home",
          assigneeId: "person-ola",
          taskTypeId: "type-task",
          priorityId: "priority-normal",
          schedule: { mode: "oneTime", date: "2026-07-07" },
          active: true,
          createdAt: "2026-07-07T08:00:00.000Z",
          updatedAt: "2026-07-07T08:00:00.000Z"
        }
      ],
      completions: [{ id: "completion-1", taskId: "task-1", scheduledDate: "2026-07-07", completedDate: "2026-07-07" }],
      postponements: []
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedState));
    resetTaskerStore();
    renderApp();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Historia" }));

    expect(screen.getByRole("heading", { name: "Historia" })).toBeInTheDocument();
    expect(screen.getByText("Podlac rosliny")).toBeInTheDocument();
    expect(screen.getAllByText("2026-07-07").length).toBeGreaterThan(0);
    expect(screen.queryByText(/statysty/i)).not.toBeInTheDocument();
  });

  it("exports complete local data from the Dane view", async () => {
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:tasker-export");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    renderApp();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Dane" }));
    await user.click(screen.getByRole("button", { name: "Eksportuj dane" }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:tasker-export");
  });

  it("validates import before confirmation and does not overwrite data on error", async () => {
    renderApp();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Kategorie" }));
    await user.type(screen.getByLabelText("Nazwa kategorii"), "Dom");
    await user.click(screen.getByRole("button", { name: "Dodaj kategorie" }));

    await user.click(screen.getByRole("button", { name: "Dane" }));
    const badFile = new File(["{bad-json"], "bad.json", { type: "application/json" });
    await user.upload(screen.getByLabelText("Plik importu"), badFile);

    expect(await screen.findByText("Plik importu nie jest poprawnym JSON.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Kategorie" }));
    expect(screen.getByText("Dom")).toBeInTheDocument();
  });

  it("keeps non-scope modules as navigation-only placeholders", async () => {
    renderApp();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Zadania" }));
    expect(screen.getByRole("heading", { name: "Zadania" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Kalendarz" }));
    expect(screen.getByRole("heading", { name: "Kalendarz" })).toBeInTheDocument();
    expect(screen.getByText("Planowanie zadan wedlug dat")).toBeInTheDocument();
  });
});
