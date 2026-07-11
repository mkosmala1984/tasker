import { MantineProvider } from "@mantine/core";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { DEFAULT_PRIORITY_ID, DEFAULT_TASK_TYPE_ID, STORAGE_KEY } from "./storage/taskerStorage";
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

function seedTaskFormDictionaries() {
  seedState({
    tasks: [],
    categories: [{ id: "cat-home", name: "Dom", color: "#40c057" }],
    assignees: [{ id: "person-ola", name: "Ola" }],
    taskTypes: [{ id: DEFAULT_TASK_TYPE_ID, name: "Zadanie", active: true, order: 0 }],
    priorities: [{ id: DEFAULT_PRIORITY_ID, name: "Normalny", active: true, order: 0, color: "#868e96" }],
    completions: [],
    postponements: []
  });
}

function seedTodayTaskState() {
  seedState({
    tasks: [
      {
        id: "task-1",
        title: "Podlac rosliny",
        categoryId: "cat-home",
        assigneeId: "person-ola",
        taskTypeId: DEFAULT_TASK_TYPE_ID,
        priorityId: DEFAULT_PRIORITY_ID,
        schedule: { mode: "oneTime", date: "2026-07-05" },
        active: true,
        createdAt: "2026-07-05T08:00:00.000Z",
        updatedAt: "2026-07-05T08:00:00.000Z"
      }
    ],
    categories: [{ id: "cat-home", name: "Dom", color: "#40c057" }],
    assignees: [{ id: "person-ola", name: "Ola" }],
    taskTypes: [{ id: DEFAULT_TASK_TYPE_ID, name: "Zadanie", active: true, order: 0 }],
    priorities: [{ id: DEFAULT_PRIORITY_ID, name: "Normalny", active: true, order: 0, color: "#868e96" }],
    completions: [],
    postponements: []
  });
}

async function addDailyTask(title: string, category: string, assignee: string) {
  const user = userEvent.setup();

  await user.click(screen.getByRole("button", { name: "Zadania" }));
  await user.click(screen.getByRole("button", { name: "+ Dodaj zadanie" }));

  const form = screen.getByRole("form", { name: "Dodaj zadanie" });
  await user.type(within(form).getByLabelText(/Nazwa zadania/), title);
  await user.selectOptions(within(form).getByLabelText("Kategoria"), "cat-home");
  await user.selectOptions(within(form).getByLabelText("Osoba"), "person-ola");
  await user.click(within(form).getByRole("button", { name: "Zapisz zadanie" }));
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
    seedTaskFormDictionaries();
    renderApp();

    await addDailyTask("Podlac rosliny", "Dom", "Ola");

    expect(screen.queryByRole("heading", { name: "Tasker" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Zadania" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Podlac rosliny" })).toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toContain("Podlac rosliny");
  });

  it("opens the separate task editor from the tasks view add button", async () => {
    renderApp();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Zadania" }));
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
    seedTodayTaskState();
    renderApp();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Wykonane" }));

    expect(screen.queryByRole("heading", { name: "Podlac rosliny" })).not.toBeInTheDocument();
    expect(screen.getByText("Brak zadan na dzisiaj")).toBeInTheDocument();
  });

  it("renders the today operational header without filters", () => {
    seedTodayTaskState();
    renderApp({ now: new Date("2026-07-10T09:00:00.000Z") });

    expect(screen.getByRole("heading", { name: "Dzisiaj" })).toBeInTheDocument();
    expect(screen.getByText(/10 lipca 2026/)).toBeInTheDocument();
    expect(screen.getByText("1 zadanie")).toBeInTheDocument();
    expect(screen.queryByText("Filtrowanie")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /filtry/i })).not.toBeInTheDocument();
  });

  it("mounts the default visual theme on the app shell", () => {
    renderApp();
    expect(document.querySelector('[data-theme="olive-canvas"]')).toBeInTheDocument();
  });

  it("renders a compact active task row and expands inline details", async () => {
    seedTodayTaskState();
    renderApp();
    const user = userEvent.setup();

    expect(screen.getByText("Podlac rosliny")).toBeInTheDocument();
    expect(screen.getByText("Jeszcze nie wykonano")).toBeInTheDocument();
    expect(screen.queryByText("Kategoria")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Pokaz szczegoly: Podlac rosliny" }));

    expect(screen.getByText("Kategoria")).toBeInTheDocument();
    expect(screen.getByText("Dom")).toBeInTheDocument();
    expect(screen.getByText("Osoba")).toBeInTheDocument();
    expect(screen.getByText("Ola")).toBeInTheDocument();
  });

  it("shows the empty state when there are no active tasks", () => {
    renderApp({ now: new Date("2026-07-10T09:00:00.000Z") });
    expect(screen.getByText("Brak zadan na dzisiaj")).toBeInTheDocument();
  });

  it("postpones a task using the quick menu actions", async () => {
    seedTodayTaskState();
    renderApp();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Odloz: Podlac rosliny" }));
    await user.click(screen.getByRole("button", { name: "Jutro" }));

    expect(screen.queryByRole("heading", { name: "Podlac rosliny" })).not.toBeInTheDocument();
    const stored = localStorage.getItem(STORAGE_KEY) ?? "";
    expect(stored).toContain('"toDate":"2026-07-06"');
    expect(stored).not.toContain("completedDate");
  });

  it("allows selecting a custom postpone date from the quick menu", async () => {
    seedTodayTaskState();
    renderApp();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Odloz: Podlac rosliny" }));
    await user.click(screen.getByRole("button", { name: "Wybierz date" }));
    await user.type(screen.getByLabelText("Wybierz date odlozenia: Podlac rosliny"), "2026-07-12");
    await user.click(screen.getByRole("button", { name: "Zatwierdz odlozenie: Podlac rosliny" }));

    expect(screen.queryByRole("heading", { name: "Podlac rosliny" })).not.toBeInTheDocument();
    const stored = localStorage.getItem(STORAGE_KEY) ?? "";
    expect(stored).toContain('"fromDate":"2026-07-05"');
    expect(stored).toContain('"toDate":"2026-07-12"');
    expect(stored).not.toContain("completedDate");
  });

  it("moves completed tasks into the completed-today section immediately", async () => {
    seedTodayTaskState();
    renderApp();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Wykonane" }));

    expect(screen.queryByText("Podlac rosliny")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Wykonane dzisiaj (1)" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Wykonane dzisiaj (1)" }));
    expect(screen.getByText("Podlac rosliny")).toBeInTheDocument();
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

  it("creates a one-time task from the separate tasks view", async () => {
    seedTaskState();
    resetTaskerStore();
    renderApp({ now: new Date("2026-07-07T10:00:00.000Z") });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Zadania" }));
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
