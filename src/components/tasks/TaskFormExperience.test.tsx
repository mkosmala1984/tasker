import { MantineProvider } from "@mantine/core";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TaskForm } from "../TaskForm";
import type { AppState, Task } from "../../domain/types";

const state: AppState = {
  tasks: [], categories: [{ id: "home", name: "Dom", color: "#40c057" }, { id: "work", name: "Praca", color: "#2266cc" }],
  assignees: [{ id: "ola", name: "Ola" }],
  taskTypes: [{ id: "task", name: "Zadanie", active: true, order: 0 }],
  priorities: [{ id: "normal", name: "Normalny", active: true, order: 0 }],
  completions: [], postponements: [],
};
const props = { state, today: "2026-10-19", submitLabel: "Zapisz zadanie", onCancel: vi.fn() };
const key = "tasker.taskFormPreferences.v1";
function mount(extra = {}) {
  return render(<MantineProvider><TaskForm {...props} onSubmit={vi.fn()} {...extra} /></MantineProvider>);
}

describe("task form experience", () => {
  beforeEach(() => localStorage.clear());

  it("locks inputs during a slow save and resets the calendar after adding", async () => {
    const user = userEvent.setup();
    let finish!: () => void;
    const pending = new Promise<void>(resolve => { finish = resolve; });
    mount({ onSubmitAndContinue: () => pending });
    await user.type(screen.getByLabelText("Nazwa zadania"), "Raport");
    await user.click(screen.getByRole("button", { name: "Następny miesiąc" }));
    await user.click(screen.getByRole("button", { name: "5 listopada 2026" }));
    await user.click(screen.getByRole("button", { name: "Zapisz i dodaj kolejne" }));
    expect(screen.getByLabelText("Nazwa zadania")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cykliczne" })).toBeDisabled();
    await act(async () => finish());
    await waitFor(() => expect(screen.getByLabelText("Nazwa zadania")).toHaveValue(""));
    expect(screen.getByLabelText("Nazwa zadania")).toHaveFocus();
    expect(screen.getByLabelText("Data zadania")).toHaveValue("2026-10-19");
    expect(screen.getByText("październik 2026")).toBeVisible();
  });

  it("keeps the true minimum date when opened for a later calendar date", () => {
    mount({ initialDate: "2026-11-05" });
    expect(screen.getByLabelText("Data zadania")).toHaveValue("2026-11-05");
    expect(screen.getByLabelText("Data zadania")).toHaveAttribute("min", "2026-10-19");
    expect(screen.getByText("październik 2026")).toBeVisible();
    expect(screen.getByRole("button", { name: "19 października 2026" })).toBeEnabled();
  });

  it("opens this month and allows today but blocks yesterday and earlier months", async () => {
    const user = userEvent.setup();
    mount();
    expect(screen.getByText("październik 2026")).toBeVisible();
    expect(screen.getByRole("button", { name: "18 października 2026" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "19 października 2026" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Poprzedni miesiąc" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Następny miesiąc" }));
    await user.click(screen.getByRole("button", { name: "5 listopada 2026" }));
    expect(screen.getByLabelText("Data zadania")).toHaveValue("2026-11-05");
    await user.click(screen.getByRole("button", { name: "Dzisiaj" }));
    expect(screen.getByLabelText("Data zadania")).toHaveValue("2026-10-19");
    expect(screen.getByText("październik 2026")).toBeVisible();
  });

  it("submits one-click choices and restores settings without title or date", async () => {
    const user = userEvent.setup(), submit = vi.fn();
    const view = mount({ onSubmit: submit });
    await user.type(screen.getByLabelText("Nazwa zadania"), "Raport");
    for (const name of ["Cykliczne", "Praca", "Ola", "Co N dni"]) await user.click(screen.getByRole("button", { name }));
    await user.clear(screen.getByLabelText("Liczba dni"));
    await user.type(screen.getByLabelText("Liczba dni"), "3");
    await user.click(screen.getByRole("button", { name: "Jutro" }));
    await user.click(screen.getByRole("button", { name: "Zapisz zadanie" }));
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ categoryName: "Praca", assigneeName: "Ola", schedule: { mode: "recurring", startDate: "2026-10-20", recurrence: { type: "everyNDays", intervalDays: 3 } } }));
    view.unmount(); mount();
    expect(screen.getByLabelText("Nazwa zadania")).toHaveValue("");
    expect(screen.getByLabelText("Data startu")).toHaveValue("2026-10-19");
    expect(screen.getByLabelText("Liczba dni")).toHaveValue("3");
    for (const name of ["Cykliczne", "Praca", "Ola", "Co N dni"]) expect(screen.getByRole("button", { name })).toHaveAttribute("aria-pressed", "true");
  });

  it("rejects manually entered dates before today", async () => {
    const user = userEvent.setup(), submit = vi.fn(); mount({ onSubmit: submit });
    await user.type(screen.getByLabelText("Nazwa zadania"), "Wizyta");
    fireEvent.change(screen.getByLabelText("Data zadania"), { target: { value: "2026-10-18" } });
    await user.click(screen.getByRole("button", { name: "Zapisz zadanie" }));
    expect(submit).not.toHaveBeenCalled();
    expect(screen.getByText("Wybierz dzisiaj lub późniejszą datę.")).toBeVisible();
  });

  it("does not overwrite saved settings when saving fails", async () => {
    const user = userEvent.setup(); mount({ onSubmit: vi.fn().mockRejectedValue(new Error("Brak zapisu")) });
    await user.type(screen.getByLabelText("Nazwa zadania"), "Raport");
    await user.click(screen.getByRole("button", { name: "Praca" }));
    await user.click(screen.getByRole("button", { name: "Zapisz zadanie" }));
    expect(await screen.findByText("Brak zapisu")).toBeVisible();
    expect(localStorage.getItem(key)).toBeNull();
    expect(screen.getByLabelText("Nazwa zadania")).toHaveValue("Raport");
  });

  it("clears remembered choices when remembering is turned off", async () => {
    const user = userEvent.setup(); const view = mount();
    await user.type(screen.getByLabelText("Nazwa zadania"), "Raport");
    await user.click(screen.getByRole("button", { name: "Praca" }));
    await user.click(screen.getByRole("button", { name: "Zapisz zadanie" }));
    view.unmount(); const second = mount();
    await user.click(screen.getByLabelText("Zapamiętaj wybory po zapisaniu"));
    await user.type(screen.getByLabelText("Nazwa zadania"), "Inne zadanie");
    await user.click(screen.getByRole("button", { name: "Zapisz zadanie" }));
    second.unmount(); mount();
    expect(screen.getByRole("button", { name: "Dom" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Zapamiętaj wybory po zapisaniu")).not.toBeChecked();
  });

  it("ignores corrupt or deleted remembered choices", () => {
    localStorage.setItem(key, "{"); const view = mount();
    expect(screen.getByRole("button", { name: "Dom" })).toHaveAttribute("aria-pressed", "true");
    view.unmount();
    localStorage.setItem(key, JSON.stringify({ enabled: true, choices: { categoryId: "deleted", assigneeId: "deleted", taskTypeId: "deleted", mode: "invalid", intervalDays: -2 } }));
    mount();
    expect(screen.getByRole("button", { name: "Dom" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Bez osoby" })).toHaveAttribute("aria-pressed", "true");
  });

  it("preserves an existing past start date when editing and ignores preferences", async () => {
    const user = userEvent.setup(), submit = vi.fn();
    const preferences = JSON.stringify({ enabled: true, choices: { mode: "oneTime", categoryId: "work", assigneeId: "", recurrenceType: "daily" } });
    localStorage.setItem(key, preferences);
    const task: Task = { id: "t", title: "Rośliny", categoryId: "home", assigneeId: "ola", taskTypeId: "task", priorityId: "normal", schedule: { mode: "recurring", startDate: "2026-09-01", recurrence: { type: "weekly" } }, active: true, createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-01T00:00:00Z" };
    mount({ task, onSubmit: submit });
    expect(screen.getByLabelText("Data startu")).toHaveValue("2026-09-01");
    expect(screen.getByText("październik 2026")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Zapisz zadanie" }));
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ schedule: task.schedule }));
    expect(localStorage.getItem(key)).toBe(preferences);
  });
});

