import { MantineProvider } from "@mantine/core";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
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
    expect(screen.getByText("Tutaj powstanie widok planowania zadan wedlug dat.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Konfiguracja" }));
    expect(screen.getByRole("heading", { name: "Konfiguracja zadan" })).toBeInTheDocument();
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
    expect(stored).toContain("postponements");
    expect(stored).not.toContain("completedDate");
  });

  it("filters today list by category and assignee", async () => {
    renderApp();
    const user = userEvent.setup();
    await addDailyTask("Dom Oli", "Dom", "Ola");
    await addDailyTask("Praca Jana", "Praca", "Jan");

    const filters = screen.getByRole("region", { name: "Filtry" });
    await user.click(within(filters).getByRole("radio", { name: "Praca" }));
    const assigneeFilter = within(filters).getByLabelText("Osoba");
    await user.click(assigneeFilter);
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    const list = screen.getByRole("region", { name: "Zadania na dzisiaj" });
    expect(within(list).getByRole("heading", { name: "Praca Jana" })).toBeInTheDocument();
    expect(within(list).queryByRole("heading", { name: "Dom Oli" })).not.toBeInTheDocument();
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
});
