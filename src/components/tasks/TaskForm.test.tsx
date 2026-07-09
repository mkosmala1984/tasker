import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AppState } from "../../domain/types";
import { DEFAULT_PRIORITY_ID, DEFAULT_TASK_TYPE_ID } from "../../storage/taskerStorage";
import { TaskForm } from "../TaskForm";

const state: AppState = {
  tasks: [],
  categories: [{ id: "cat-home", name: "Dom", color: "#40c057" }],
  assignees: [{ id: "person-ola", name: "Ola" }],
  taskTypes: [
    { id: DEFAULT_TASK_TYPE_ID, name: "Zadanie", active: true, order: 0 },
    { id: "type-deadline", name: "Termin", active: true, order: 1 }
  ],
  priorities: [
    { id: DEFAULT_PRIORITY_ID, name: "Normalny", active: true, order: 0, color: "#868e96" },
    { id: "priority-high", name: "Wysoki", active: true, order: 1, color: "#fa5252" }
  ],
  completions: [],
  postponements: []
};

function renderForm(onSubmit = vi.fn()) {
  render(
    <MantineProvider>
      <TaskForm state={state} today="2026-07-07" submitLabel="Zapisz zadanie" onSubmit={onSubmit} onCancel={vi.fn()} />
    </MantineProvider>
  );
  return onSubmit;
}

describe("TaskForm", () => {
  it("submits a one-time task draft", async () => {
    const user = userEvent.setup();
    const onSubmit = renderForm();

    await user.type(screen.getByLabelText("Nazwa zadania"), "Zaplacic rachunek");
    await user.selectOptions(screen.getByLabelText("Typ zadania"), "type-deadline");
    await user.selectOptions(screen.getByLabelText("Priorytet"), "priority-high");
    await user.clear(screen.getByLabelText("Data zadania"));
    await user.type(screen.getByLabelText("Data zadania"), "2026-07-12");
    await user.click(screen.getByRole("button", { name: "Zapisz zadanie" }));

    expect(onSubmit).toHaveBeenCalledWith({
      title: "Zaplacic rachunek",
      categoryName: "Dom",
      categoryColor: "#40c057",
      assigneeName: "Ola",
      taskTypeId: "type-deadline",
      priorityId: "priority-high",
      schedule: { mode: "oneTime", date: "2026-07-12" },
      active: true
    });
  });

  it("shows recurrence controls only for recurring tasks", async () => {
    const user = userEvent.setup();
    renderForm();

    expect(screen.queryByLabelText("Regula powtarzania")).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Tryb"), "recurring");
    expect(screen.getByLabelText("Data startu")).toBeInTheDocument();
    expect(screen.getByLabelText("Regula powtarzania")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Regula powtarzania"), "everyNDays");
    expect(screen.getByLabelText("Liczba dni")).toBeInTheDocument();
  });

  it("shows validation messages and does not submit invalid values", async () => {
    const user = userEvent.setup();
    const onSubmit = renderForm();

    await user.clear(screen.getByLabelText("Nazwa zadania"));
    await user.selectOptions(screen.getByLabelText("Tryb"), "recurring");
    await user.selectOptions(screen.getByLabelText("Regula powtarzania"), "everyNDays");
    await user.clear(screen.getByLabelText("Data startu"));
    await user.clear(screen.getByLabelText("Liczba dni"));
    await user.type(screen.getByLabelText("Liczba dni"), "0");
    await user.click(screen.getByRole("button", { name: "Zapisz zadanie" }));

    expect(screen.getByText("Podaj nazwe zadania.")).toBeInTheDocument();
    expect(screen.getByText("Wybierz date startu.")).toBeInTheDocument();
    expect(screen.getByText("Liczba dni musi byc wieksza lub rowna 1.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
