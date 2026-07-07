import { MantineProvider } from "@mantine/core";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import App from "./App";
import { STORAGE_KEY } from "./storage/taskerStorage";

function renderApp() {
  render(
    <MantineProvider>
      <App now={new Date(2026, 6, 5, 9, 0)} />
    </MantineProvider>
  );
}

async function addDailyTask(title: string, category: string, assignee: string) {
  const user = userEvent.setup();

  const form = screen.getByRole("form", { name: "Szybkie dodanie" });
  await user.type(within(form).getByLabelText("Nazwa zadania"), title);
  await user.type(within(form).getByLabelText("Kategoria"), category);
  await user.type(within(form).getByLabelText("Osoba"), assignee);
  await user.click(within(form).getByRole("button", { name: "Zapisz" }));
}

describe("App", () => {
  beforeEach(() => {
    localStorage.clear();
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

  it("moves focus from the header add button to quick add", async () => {
    renderApp();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "+ Dodaj zadanie" }));

    expect(screen.getByLabelText("Nazwa zadania")).toHaveFocus();
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
    await user.click(screen.getByRole("option", { name: "Jan" }));

    const list = screen.getByRole("region", { name: "Zadania na dzisiaj" });
    expect(within(list).getByRole("heading", { name: "Praca Jana" })).toBeInTheDocument();
    expect(within(list).queryByRole("heading", { name: "Dom Oli" })).not.toBeInTheDocument();
  });

  it("edits and deactivates an existing task", async () => {
    renderApp();
    const user = userEvent.setup();
    await addDailyTask("Stara nazwa", "Dom", "Ola");

    await user.click(screen.getByRole("button", { name: "Edytuj" }));
    const form = screen.getByRole("form", { name: "Edytuj zadanie" });
    await user.clear(within(form).getByLabelText("Nazwa zadania"));
    await user.type(within(form).getByLabelText("Nazwa zadania"), "Nowa nazwa");
    await user.click(within(form).getByRole("button", { name: "Zapisz" }));

    expect(screen.getByRole("heading", { name: "Nowa nazwa" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Dezaktywuj" }));

    expect(screen.queryByRole("heading", { name: "Nowa nazwa" })).not.toBeInTheDocument();
  });
});
