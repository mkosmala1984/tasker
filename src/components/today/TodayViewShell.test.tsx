import { MantineProvider } from "@mantine/core";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TodayTask } from "../../domain/types";
import { TodayViewShell } from "./TodayViewShell";

function todayTask({
  id,
  title,
  categoryId,
  categoryName
}: {
  id: string;
  title: string;
  categoryId: string;
  categoryName: string;
}): TodayTask {
  return {
    task: {
      id,
      title,
      categoryId,
      assigneeId: "person-ola",
      taskTypeId: "type-task",
      priorityId: "priority-normal",
      schedule: { mode: "oneTime", date: "2026-07-05" },
      active: true,
      createdAt: "2026-07-05T08:00:00.000Z",
      updatedAt: "2026-07-05T08:00:00.000Z"
    },
    category: { id: categoryId, name: categoryName, color: "#40c057" },
    assignee: { id: "person-ola", name: "Ola" },
    taskType: { id: "type-task", name: "Zadanie", active: true, order: 0 },
    priority: { id: "priority-normal", name: "Normalny", active: true, order: 0 },
    scheduledDate: "2026-07-05",
    isOverdue: false,
    completionCount: 0
  };
}

const activeTasks = [
  todayTask({ id: "task-home-a", title: "Alfa dom", categoryId: "cat-home", categoryName: "Dom" }),
  todayTask({ id: "task-work", title: "Beta praca", categoryId: "cat-work", categoryName: "Praca" }),
  todayTask({ id: "task-home-c", title: "Gamma dom", categoryId: "cat-home", categoryName: "Dom" })
];

function renderView() {
  render(
    <MantineProvider>
      <TodayViewShell
        today="2026-07-05"
        dateLabel="5 lipca 2026"
        activeTasks={activeTasks}
        completedToday={[]}
        categories={[
          { id: "cat-home", name: "Dom", color: "#40c057" },
          { id: "cat-work", name: "Praca", color: "#228be6" },
          { id: "cat-empty", name: "Pusta", color: "#868e96" }
        ]}
        onAdd={vi.fn()}
        onComplete={vi.fn()}
        onPostponeToDate={vi.fn()}
        onEdit={vi.fn()}
        onDeactivate={vi.fn()}
      />
    </MantineProvider>
  );
}

describe("TodayViewShell layout", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows category columns by default and preserves task order inside each column", () => {
    renderView();

    expect(screen.getByRole("button", { name: "Kolumny", pressed: true })).toBeInTheDocument();
    const columns = screen.getAllByRole("region", { name: /Kategoria:/ });
    expect(columns.map((column) => column.getAttribute("aria-label"))).toEqual(["Kategoria: Dom", "Kategoria: Praca"]);
    expect(within(columns[0]).getAllByRole("article").map((task) => task.textContent)).toEqual([
      expect.stringContaining("Alfa dom"),
      expect.stringContaining("Gamma dom")
    ]);
    expect(within(columns[1]).getAllByRole("article")[0]).toHaveTextContent("Beta praca");
  });

  it("switches to the flat list and remembers that choice", async () => {
    renderView();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Lista" }));

    expect(screen.getByRole("button", { name: "Lista", pressed: true })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Aktywne zadania" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /Kategoria:/ })).not.toBeInTheDocument();
    expect(localStorage.getItem("tasker.todayLayout")).toBe("list");
  });

  it("restores a remembered list choice", () => {
    localStorage.setItem("tasker.todayLayout", "list");

    renderView();

    expect(screen.getByRole("button", { name: "Lista", pressed: true })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Aktywne zadania" })).toBeInTheDocument();
  });
});
