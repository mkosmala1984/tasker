import { describe, expect, it } from "vitest";
import { DEFAULT_PRIORITY_ID, DEFAULT_TASK_TYPE_ID } from "../storage/taskerStorage";
import {
  createEmptyTaskFormValues,
  taskFormValuesToDraft,
  taskToFormValues,
  validateTaskFormValues
} from "./taskForm";
import type { AppState, Task } from "./types";

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

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "Podlac rosliny",
    categoryId: "cat-home",
    assigneeId: "person-ola",
    taskTypeId: DEFAULT_TASK_TYPE_ID,
    priorityId: DEFAULT_PRIORITY_ID,
    schedule: { mode: "recurring", startDate: "2026-07-07", recurrence: { type: "daily" } },
    active: true,
    createdAt: "2026-07-07T08:00:00.000Z",
    updatedAt: "2026-07-07T08:00:00.000Z",
    ...overrides
  };
}

describe("task form mapping", () => {
  it("creates defaults from active dictionaries and today's date", () => {
    expect(createEmptyTaskFormValues(state, "2026-07-07")).toEqual({
      title: "",
      mode: "oneTime",
      oneTimeDate: "2026-07-07",
      recurringStartDate: "2026-07-07",
      recurrenceType: "daily",
      intervalDays: 2,
      categoryId: "cat-home",
      assigneeId: "person-ola",
      taskTypeId: DEFAULT_TASK_TYPE_ID,
      priorityId: "",
      active: true
    });
  });

  it("maps a one-time form into TaskDraft with dictionary names", () => {
    const draft = taskFormValuesToDraft(
      {
        title: "Zaplacic rachunek",
        mode: "oneTime",
        oneTimeDate: "2026-07-12",
        recurringStartDate: "2026-07-07",
        recurrenceType: "weekly",
        intervalDays: 2,
        categoryId: "cat-home",
        assigneeId: "person-ola",
        taskTypeId: "type-deadline",
        priorityId: "priority-high",
        active: true
      },
      state
    );

    expect(draft).toEqual({
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

  it("maps recurring every N days into TaskDraft", () => {
    const draft = taskFormValuesToDraft(
      {
        title: "Trening",
        mode: "recurring",
        oneTimeDate: "2026-07-07",
        recurringStartDate: "2026-07-10",
        recurrenceType: "everyNDays",
        intervalDays: 3,
        categoryId: "cat-home",
        assigneeId: "person-ola",
        taskTypeId: DEFAULT_TASK_TYPE_ID,
        priorityId: "",
        active: true
      },
      state
    );

    expect(draft).toMatchObject({
      priorityId: DEFAULT_PRIORITY_ID,
      schedule: { mode: "recurring", startDate: "2026-07-10", recurrence: { type: "everyNDays", intervalDays: 3 } }
    });
  });

  it("maps existing task into editable form values", () => {
    expect(
      taskToFormValues(
        task({
          title: "Raport",
          priorityId: "priority-high",
          schedule: { mode: "oneTime", date: "2026-07-12" }
        }),
        state
      )
    ).toMatchObject({
      title: "Raport",
      mode: "oneTime",
      oneTimeDate: "2026-07-12",
      priorityId: "priority-high"
    });
  });

  it("returns exact validation errors for missing required values and invalid interval", () => {
    const errors = validateTaskFormValues(
      {
        title: " ",
        mode: "recurring",
        oneTimeDate: "",
        recurringStartDate: "",
        recurrenceType: "everyNDays",
        intervalDays: 0,
        categoryId: "",
        assigneeId: "",
        taskTypeId: "",
        priorityId: "",
        active: true
      },
      { ...state, categories: [], assignees: [], taskTypes: [] }
    );

    expect(errors).toEqual({
      title: "Podaj nazwe zadania.",
      recurringStartDate: "Wybierz date startu.",
      intervalDays: "Liczba dni musi byc wieksza lub rowna 1.",
      categoryId: "Wybierz kategorie.",
      assigneeId: "Wybierz osobe.",
      taskTypeId: "Wybierz typ zadania.",
      dictionary: "Brakuje aktywnych slownikow wymaganych do zapisania zadania."
    });
  });
});
