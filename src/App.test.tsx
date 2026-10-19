import { MantineProvider } from "@mantine/core";
import { act, render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { getTodayString } from "./domain/dates";
import { DEFAULT_PRIORITY_ID, DEFAULT_TASK_TYPE_ID, STORAGE_KEY } from "./storage/taskerStorage";
import { resetTaskerStore, useTaskerStore } from "./state/taskerStore";
import { SyncJournal } from "./storage/syncJournal";

function renderApp({ now = new Date(2026, 6, 5, 9, 0) }: { now?: Date } = {}) {
  useTaskerStore.getState().setSelectedCalendarDate(getTodayString(now));
  render(
    <MantineProvider env="test">
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

async function seedTaskFormDictionaries() {
  await seedState({
    tasks: [],
    categories: [{ id: "cat-home", name: "Dom", color: "#40c057" }],
    assignees: [{ id: "person-ola", name: "Ola" }],
    taskTypes: [{ id: DEFAULT_TASK_TYPE_ID, name: "Zadanie", active: true, order: 0 }],
    priorities: [{ id: DEFAULT_PRIORITY_ID, name: "Normalny", active: true, order: 0, color: "#868e96" }],
    completions: [],
    postponements: []
  });
}

async function seedTodayTaskState() {
  await seedState({
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
  await user.click(within(within(form).getByRole("group", { name: "Kategoria" })).getByRole("button", { name: category }));
  await user.click(within(within(form).getByRole("group", { name: "Osoba" })).getByRole("button", { name: assignee }));
  await user.click(within(form).getByRole("button", { name: "Zapisz zadanie" }));
  await waitFor(() => {
    expect(screen.queryByRole("alert", { name: "Zapis przerwany" })?.textContent).toBeUndefined();
    expect(screen.queryByRole("heading", { name: "Zadania" })).toBeInTheDocument();
  });
}

async function seedState(state: unknown) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  await resetTaskerStore();
}

describe("App", () => {
  beforeEach(async () => {
    localStorage.clear();
    await resetTaskerStore();
  });

  it("shows active task counts by category and refreshes after deactivation", async () => {
    await seedTaskFormDictionaries();
    const store = useTaskerStore.getState();
    for (const [title, categoryName, active] of [
      ["Podlewanie", "Dom", true],
      ["Sprzątanie", "Dom", true],
      ["Nieaktywne", "Dom", false],
      ["Raport", "Praca", true]
    ] as const) {
      await store.addTask({
        title, categoryName, assigneeName: "Ola", active,
        schedule: { mode: "oneTime", date: "2027-01-01" }
      });
    }
    await store.addCategory({ name: "Zdrowie", color: "#228be6" });
    renderApp();
    await userEvent.setup().click(screen.getByRole("button", { name: "Statystyki" }));

    const table = screen.getByRole("table");
    expect(within(table).getByRole("row", { name: "Dom 2" })).toBeInTheDocument();
    expect(within(table).getByRole("row", { name: "Praca 1" })).toBeInTheDocument();
    expect(within(table).getByRole("row", { name: "Zdrowie 0" })).toBeInTheDocument();

    const taskId = useTaskerStore.getState().state.tasks.find(task => task.title === "Podlewanie")!.id;
    await act(async () => { await store.deactivateTask(taskId); });
    expect(within(table).getByRole("row", { name: "Dom 1" })).toBeInTheDocument();
  });

  it("shows an empty statistics view when there are no categories", async () => {
    await seedState({ ...useTaskerStore.getState().state, categories: [], tasks: [] });
    renderApp();
    await userEvent.setup().click(screen.getByRole("button", { name: "Statystyki" }));
    expect(screen.getByText("Brak kategorii do wyświetlenia.")).toBeInTheDocument();
  });

  it("adds a task and persists it in the journal", async () => {
    await seedTaskFormDictionaries();
    renderApp();

    await addDailyTask("Podlac rosliny", "Dom", "Ola");
    expect(screen.queryByRole("alert", { name: "Zapis przerwany" })?.textContent).toBeUndefined();

    expect(screen.queryByRole("heading", { name: "Tasker" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Zadania" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Podlac rosliny" })).toBeInTheDocument();
    expect(JSON.stringify(useTaskerStore.getState().state)).toContain("Podlac rosliny");
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
    await seedTodayTaskState();
    renderApp();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Wykonane" }));

    expect(screen.queryByRole("heading", { name: "Podlac rosliny" })).not.toBeInTheDocument();
    expect(screen.getByText("Brak zadan na dzisiaj")).toBeInTheDocument();
  });

  it("renders the today view without filters", async () => {
    await seedTodayTaskState();
    renderApp({ now: new Date("2026-07-10T09:00:00.000Z") });

    expect(screen.queryByText("Filtrowanie")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /filtry/i })).not.toBeInTheDocument();
  });

  it("mounts the default visual theme on the app shell", () => {
    renderApp();
    expect(document.querySelector('[data-theme="olive-canvas"]')).toBeInTheDocument();
  });

  it("starts active synchronization on mount and stops it on unmount", () => {
    const originalStart = useTaskerStore.getState().startSync;
    const originalStop = useTaskerStore.getState().stopSync;
    const startSync = vi.fn();
    const stopSync = vi.fn();
    useTaskerStore.setState({ startSync, stopSync });

    try {
      const { unmount } = render(
        <MantineProvider>
          <App />
        </MantineProvider>
      );

      expect(startSync).toHaveBeenCalledOnce();
      unmount();
      expect(stopSync).toHaveBeenCalledOnce();
    } finally {
      useTaskerStore.setState({ startSync: originalStart, stopSync: originalStop });
    }
  });

  it("renders a compact active task row and expands inline details", async () => {
    await seedTodayTaskState();
    renderApp();
    const user = userEvent.setup();

    expect(screen.getByText("Podlac rosliny")).toBeInTheDocument();
    expect(screen.getByText("Jeszcze nie wykonano")).toBeInTheDocument();
    expect(screen.queryByText("Kategoria")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Pokaz szczegoly: Podlac rosliny" }));

    expect(screen.getByText("Kategoria")).toBeInTheDocument();
    expect(screen.getByText("Dom", { selector: ".today-task-detail-value" })).toBeInTheDocument();
    expect(screen.getByText("Osoba")).toBeInTheDocument();
    expect(screen.getByText("Ola")).toBeInTheDocument();
  });

  it("shows the empty state when there are no active tasks", () => {
    renderApp({ now: new Date("2026-07-10T09:00:00.000Z") });
    expect(screen.getByText("Brak zadan na dzisiaj")).toBeInTheDocument();
  });

  it("postpones a task using the quick menu actions", async () => {
    await seedTodayTaskState();
    renderApp();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Odloz: Podlac rosliny" }));
    await user.click(screen.getByRole("button", { name: "Jutro" }));

    expect(screen.queryByRole("heading", { name: "Podlac rosliny" })).not.toBeInTheDocument();
    const stored = JSON.stringify(useTaskerStore.getState().state);
    expect(stored).toContain('"toDate":"2026-07-06"');
    expect(stored).not.toContain("completedDate");
  });

  it("allows selecting a custom postpone date from the quick menu", async () => {
    await seedTodayTaskState();
    renderApp();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Odloz: Podlac rosliny" }));
    await user.click(screen.getByRole("button", { name: "Wybierz date" }));
    await user.type(screen.getByLabelText("Wybierz date odlozenia: Podlac rosliny"), "2026-07-12");
    await user.click(screen.getByRole("button", { name: "Zatwierdz odlozenie: Podlac rosliny" }));

    expect(screen.queryByRole("heading", { name: "Podlac rosliny" })).not.toBeInTheDocument();
    const stored = JSON.stringify(useTaskerStore.getState().state);
    expect(stored).toContain('"fromDate":"2026-07-05"');
    expect(stored).toContain('"toDate":"2026-07-12"');
    expect(stored).not.toContain("completedDate");
  });

  it("moves completed tasks into the completed-today section after a pending save", async () => {
    await seedTodayTaskState();
    renderApp();
    const user = userEvent.setup();

    let releaseSave!: () => void;
    const pendingSave = new Promise<void>(resolve => { releaseSave = resolve; });
    const append = SyncJournal.prototype.append;
    const appendSpy = vi.spyOn(SyncJournal.prototype, "append").mockImplementationOnce(async function (this: SyncJournal, ...args) {
      await pendingSave;
      return append.apply(this, args);
    });
    try {
      await user.click(screen.getByRole("button", { name: "Wykonane" }));
      expect(screen.getByText("Podlac rosliny")).toBeInTheDocument();
      releaseSave();

      await waitFor(() => {
        expect(screen.queryByText("Podlac rosliny")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Wykonane dzisiaj (1)" })).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Wykonane dzisiaj (1)" }));
      expect(screen.getByText("Podlac rosliny")).toBeInTheDocument();
    } finally {
      releaseSave();
      appendSpy.mockRestore();
    }
  });

  it("keeps recurring completion cycle based on the actual completion date", async () => {
    await seedState({
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

    const stored = JSON.stringify(useTaskerStore.getState().state);
    expect(stored).toContain('"scheduledDate":"2026-07-01"');
    expect(stored).toContain('"completedDate":"2026-07-03"');
  });

  it("creates a one-time task from the separate tasks view", async () => {
    seedTaskState();
    await resetTaskerStore();
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

  it("adds consecutive tasks without closing the form or losing earlier tasks", async () => {
    seedTaskState();
    await resetTaskerStore();
    renderApp({ now: new Date("2026-07-07T10:00:00.000Z") });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Zadania" }));
    await user.click(screen.getByRole("button", { name: "+ Dodaj zadanie" }));
    for (const title of ["Pierwsze nowe", "Drugie nowe"]) {
      await user.type(screen.getByLabelText("Nazwa zadania"), title);
      await user.click(screen.getByRole("button", { name: "Zapisz i dodaj kolejne" }));
      await waitFor(() => expect(screen.getByLabelText("Nazwa zadania")).toHaveValue(""));
      expect(screen.getByLabelText("Nazwa zadania")).toHaveFocus();
      expect(screen.getByRole("heading", { name: "Dodaj zadanie" })).toBeVisible();
    }
    await user.click(screen.getByRole("button", { name: "Anuluj" }));
    expect(useTaskerStore.getState().state.tasks.map(task => task.title)).toEqual(expect.arrayContaining(["Podlac rosliny", "Pierwsze nowe", "Drugie nowe"]));
    expect(screen.getByText("Pierwsze nowe")).toBeVisible();
    expect(screen.getByText("Drugie nowe")).toBeVisible();
  });

  it("edits a task into an every-N-days recurring task", async () => {
    seedTaskState();
    await resetTaskerStore();
    renderApp({ now: new Date("2026-07-07T10:00:00.000Z") });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Zadania" }));
    await user.click(screen.getByRole("button", { name: "Edytuj" }));
    await user.clear(screen.getByLabelText("Nazwa zadania"));
    await user.type(screen.getByLabelText("Nazwa zadania"), "Trening");
    await user.click(screen.getByRole("button", { name: "Cykliczne" }));
    await user.click(screen.getByRole("button", { name: "Co N dni" }));
    await user.clear(screen.getByLabelText("Liczba dni"));
    await user.type(screen.getByLabelText("Liczba dni"), "3");
    await user.click(screen.getByRole("button", { name: "Zapisz zmiany" }));

    expect(await screen.findByText("Trening")).toBeInTheDocument();
    expect(screen.getByText("Cykliczne od 2026-07-07: co 3 dni")).toBeInTheDocument();
  });

  it("deactivates a task from the tasks list without removing it", async () => {
    seedTaskState();
    await resetTaskerStore();
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
    expect(JSON.stringify(useTaskerStore.getState().state)).toContain("#40c057");
  });

  it("adds, renames and removes an unused person from configuration", async () => {
    renderApp();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Konfiguracja" }));
    await user.type(screen.getByLabelText("Nazwa osoby"), "  Anna  ");
    await user.click(screen.getByRole("button", { name: "Dodaj osobę" }));
    const row = (await screen.findByText("Anna")).closest("tr")!;
    await user.click(within(row).getByRole("button", { name: "Edytuj" }));
    await user.clear(screen.getByLabelText("Nazwa osoby Anna"));
    await user.type(screen.getByLabelText("Nazwa osoby Anna"), "Ania");
    await user.click(within(row).getByRole("button", { name: "Zapisz" }));
    expect(await screen.findByText("Ania")).toBeInTheDocument();
    await user.click(within(row).getByRole("button", { name: "Usuń" }));
    await waitFor(() => expect(screen.queryByText("Ania")).not.toBeInTheDocument());
    expect(useTaskerStore.getState().state.assignees).not.toEqual(expect.arrayContaining([expect.objectContaining({ name: "Ania" })]));
  });

  it("keeps a referenced person's identity when renamed and blocks removal", async () => {
    seedTaskState();
    await resetTaskerStore();
    renderApp();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Konfiguracja" }));
    const person = useTaskerStore.getState().state.assignees[0];
    const row = screen.getByText(person.name).closest("tr")!;
    expect(within(row).getByRole("button", { name: "Usuń" })).toBeDisabled();
    await user.click(within(row).getByRole("button", { name: "Edytuj" }));
    await user.clear(screen.getByLabelText(`Nazwa osoby ${person.name}`));
    await user.type(screen.getByLabelText(`Nazwa osoby ${person.name}`), "Nowa osoba");
    await user.click(within(row).getByRole("button", { name: "Zapisz" }));
    expect(await screen.findByText("Nowa osoba")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Zadania" }));
    expect(screen.getByText("Nowa osoba")).toBeInTheDocument();
    expect(useTaskerStore.getState().state.tasks[0].assigneeId).toBe(person.id);
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
    await resetTaskerStore();
    renderApp();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Historia" }));

    expect(screen.getByRole("heading", { name: "Historia" })).toBeInTheDocument();
    expect(screen.getByText("Podlac rosliny")).toBeInTheDocument();
    expect(screen.getAllByText("2026-07-07").length).toBeGreaterThan(0);
    expect(screen.queryByRole("heading", { name: "Statystyki" })).not.toBeInTheDocument();
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

  it("forwards Tigris configuration and disconnection from the Dane view to the store", async () => {
    const originalConfigure = useTaskerStore.getState().configureTigris;
    const originalDisconnect = useTaskerStore.getState().disconnectTigris;
    const configureTigris = vi.fn().mockResolvedValue(undefined);
    const disconnectTigris = vi.fn();
    useTaskerStore.setState({ configureTigris, disconnectTigris, tigrisCredentials: undefined });

    try {
      renderApp();
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Dane" }));
      await user.type(screen.getByLabelText("Bucket Tigris"), "tasker");
      await user.clear(screen.getByLabelText("Klucz obiektu Tigris"));
      await user.type(screen.getByLabelText("Klucz obiektu Tigris"), "shared/tasker.json");
      await user.type(screen.getByLabelText("ID klucza dostepu Tigris"), "tid_key");
      await user.type(screen.getByLabelText("Tajny klucz dostepu Tigris"), "tsec_secret");
      await user.click(screen.getByRole("button", { name: "Polacz z Tigris" }));

      expect(configureTigris).toHaveBeenCalledWith({ bucket: "tasker", objectKey: "shared/tasker.json", accessKeyId: "tid_key", secretAccessKey: "tsec_secret" });

      act(() => {
        useTaskerStore.setState({ tigrisCredentials: { bucket: "tasker", objectKey: "shared/tasker.json", accessKeyId: "tid_key", secretAccessKey: "tsec_secret" } });
      });
      await user.click(screen.getByRole("button", { name: "Rozlacz Tigris" }));
      expect(disconnectTigris).toHaveBeenCalledOnce();
    } finally {
      act(() => {
        useTaskerStore.setState({ configureTigris: originalConfigure, disconnectTigris: originalDisconnect, tigrisCredentials: undefined });
      });
    }
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
