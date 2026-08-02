import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TaskSchedule, TodayTask } from "../../domain/types";
import { TodayTaskDetailsPanel } from "./TodayTaskDetailsPanel";

function renderPanel(schedule: TaskSchedule) {
  const item: TodayTask = {
    task: {
      id: "task-1",
      title: "Podlać rośliny",
      categoryId: "cat-home",
      assigneeId: "person-ola",
      taskTypeId: "task-type-default",
      priorityId: "priority-normal",
      schedule,
      active: true,
      createdAt: "2026-08-02T08:00:00.000Z",
      updatedAt: "2026-08-02T08:00:00.000Z"
    },
    category: { id: "cat-home", name: "Dom", color: "#40c057" },
    assignee: { id: "person-ola", name: "Ola" },
    taskType: { id: "task-type-default", name: "Zadanie", active: true, order: 0 },
    priority: { id: "priority-normal", name: "Normalny", active: true, order: 0, color: "#868e96" },
    scheduledDate: "2026-08-02",
    isOverdue: false
  };

  render(
    <MantineProvider>
      <TodayTaskDetailsPanel item={item} />
    </MantineProvider>
  );
}

describe("TodayTaskDetailsPanel", () => {
  it("shows one-time frequency", () => {
    renderPanel({ mode: "oneTime", date: "2026-08-02" });

    expect(screen.getByText("Częstotliwość")).toBeInTheDocument();
    expect(screen.getByText("Jednorazowo")).toBeInTheDocument();
  });

  it("shows an every-N-days frequency", () => {
    renderPanel({ mode: "recurring", startDate: "2026-08-02", recurrence: { type: "everyNDays", intervalDays: 3 } });

    expect(screen.getByText("Co 3 dni")).toBeInTheDocument();
  });
});
