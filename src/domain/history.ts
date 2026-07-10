import { compareDates } from "./dates";
import type { AppState, Task } from "./types";

export type HistoryFilters = {
  fromDate: string;
  toDate: string;
  categoryId: string;
  assigneeId: string;
  taskTypeId: string;
  priorityId: string;
};

export type HistoryRow = {
  completionId: string;
  taskId: string;
  title: string;
  scheduledDate: string;
  completedDate: string;
  categoryName: string;
  assigneeName: string;
  taskTypeName: string;
  priorityName: string;
};

export const emptyHistoryFilters: HistoryFilters = {
  fromDate: "",
  toDate: "",
  categoryId: "",
  assigneeId: "",
  taskTypeId: "",
  priorityId: ""
};

function fallbackTask(taskId: string): Task {
  return {
    id: taskId,
    title: "Nieznane zadanie",
    categoryId: "",
    assigneeId: "",
    taskTypeId: "",
    priorityId: "",
    schedule: { mode: "oneTime", date: "" },
    active: false,
    createdAt: "",
    updatedAt: ""
  };
}

function matchesFilters(task: Task, completedDate: string, filters: HistoryFilters): boolean {
  return (
    (filters.fromDate === "" || compareDates(completedDate, filters.fromDate) >= 0) &&
    (filters.toDate === "" || compareDates(completedDate, filters.toDate) <= 0) &&
    (filters.categoryId === "" || task.categoryId === filters.categoryId) &&
    (filters.assigneeId === "" || task.assigneeId === filters.assigneeId) &&
    (filters.taskTypeId === "" || task.taskTypeId === filters.taskTypeId) &&
    (filters.priorityId === "" || task.priorityId === filters.priorityId)
  );
}

export function buildHistoryList(state: AppState, filters: HistoryFilters): HistoryRow[] {
  return state.completions
    .map((completion) => {
      const task = state.tasks.find((item) => item.id === completion.taskId) ?? fallbackTask(completion.taskId);
      return { completion, task };
    })
    .filter(({ completion, task }) => matchesFilters(task, completion.completedDate, filters))
    .map(({ completion, task }) => ({
      completionId: completion.id,
      taskId: task.id,
      title: task.title,
      scheduledDate: completion.scheduledDate,
      completedDate: completion.completedDate,
      categoryName: state.categories.find((item) => item.id === task.categoryId)?.name ?? "Nieznana kategoria",
      assigneeName: state.assignees.find((item) => item.id === task.assigneeId)?.name ?? "Nieznana osoba",
      taskTypeName: state.taskTypes.find((item) => item.id === task.taskTypeId)?.name ?? "Nieznany typ",
      priorityName: state.priorities.find((item) => item.id === task.priorityId)?.name ?? "Nieznany priorytet"
    }))
    .sort((left, right) => {
      const byCompletedDate = compareDates(right.completedDate, left.completedDate);
      if (byCompletedDate !== 0) {
        return byCompletedDate;
      }
      return left.title.localeCompare(right.title, "pl");
    });
}
