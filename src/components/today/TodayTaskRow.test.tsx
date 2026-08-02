import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TodayTask } from "../../domain/types";
import { TodayTaskRow } from "./TodayTaskRow";

function item(overrides: Partial<TodayTask> = {}): TodayTask {
  return {
    task: {
      id: "task-1",
      title: "Podlac rosliny",
      categoryId: "cat-1",
      assigneeId: "person-1",
      taskTypeId: "type-1",
      priorityId: "priority-1",
      schedule: { mode: "oneTime", date: "2026-07-05" },
      active: true,
      createdAt: "2026-07-05T08:00:00.000Z",
      updatedAt: "2026-07-05T08:00:00.000Z"
    },
    category: { id: "cat-1", name: "Dom", color: "#40c057" },
    assignee: { id: "person-1", name: "Ola" },
    taskType: { id: "type-1", name: "Zadanie", active: true, order: 0 },
    priority: { id: "priority-1", name: "Normalny", active: true, order: 0 },
    scheduledDate: "2026-07-05",
    isOverdue: false,
    completionCount: 0,
    ...overrides
  };
}

function renderRow(todayTask: TodayTask) {
  render(
    <MantineProvider>
      <TodayTaskRow
        item={todayTask}
        today="2026-07-05"
        expanded={false}
        onToggleExpanded={vi.fn()}
        onComplete={vi.fn()}
        onPostponeToDate={vi.fn()}
        onEdit={vi.fn()}
        onDeactivate={vi.fn()}
      />
    </MantineProvider>
  );
}

describe("TodayTaskRow", () => {
  it("shows the latest completion date and total number of completions", () => {
    renderRow(item({ lastCompletedDate: "2026-07-04", completionCount: 2 }));

    expect(screen.getByText("Ostatnio wykonane: 2026-07-04 · Wykonano: 2 razy")).toBeInTheDocument();
  });

  it("shows that a task has not been completed yet", () => {
    renderRow(item());

    expect(screen.getByText("Jeszcze nie wykonano")).toBeInTheDocument();
    expect(screen.queryByText(/Wykonano: 0 razy/)).not.toBeInTheDocument();
  });
});
