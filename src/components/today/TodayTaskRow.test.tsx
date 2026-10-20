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

function renderRow(todayTask: TodayTask, expanded = false) {
  render(
    <MantineProvider>
      <TodayTaskRow
        item={todayTask}
        today="2026-07-05"
        expanded={expanded}
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
  it("hides the latest completion date when details are collapsed", () => {
    renderRow(item({ lastCompletedDate: "2026-07-04", completionCount: 2 }));

    expect(screen.queryByText(/2026-07-04/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Wykonano/)).not.toBeInTheDocument();
  });

  it("shows that a task has not been completed yet in its details", () => {
    renderRow(item(), true);

    expect(screen.getByText("Jeszcze nie wykonano")).toBeInTheDocument();
    expect(screen.queryByText(/Wykonano: 0 razy/)).not.toBeInTheDocument();
  });
});
