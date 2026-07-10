import { DEFAULT_PRIORITY_ID } from "../storage/taskerStorage";
import type { AppState, RecurrenceRule, Task, TaskDraft, TaskMode } from "./types";

export type TaskFormValues = {
  title: string;
  mode: TaskMode;
  oneTimeDate: string;
  recurringStartDate: string;
  recurrenceType: RecurrenceRule["type"];
  intervalDays: number;
  categoryId: string;
  assigneeId: string;
  taskTypeId: string;
  priorityId: string;
  active: boolean;
};

export type TaskFormErrors = Partial<Record<keyof TaskFormValues | "dictionary", string>>;

export const UNASSIGNED_ASSIGNEE_NAME = "Bez osoby";

export const recurrenceOptions: Array<{ value: RecurrenceRule["type"]; label: string }> = [
  { value: "daily", label: "Codziennie" },
  { value: "everyNDays", label: "Co N dni" },
  { value: "weekly", label: "Co tydzien" },
  { value: "monthly", label: "Co miesiac" },
  { value: "quarterly", label: "Co kwartal" }
];

function firstActive<T extends { id: string; active?: boolean; order?: number }>(items: T[]): T | undefined {
  return [...items]
    .filter((item) => item.active !== false)
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))[0];
}

function requiredDateForTask(task: Task): string {
  return task.schedule.mode === "oneTime" ? task.schedule.date : task.schedule.startDate;
}

function recurrenceForTask(task: Task): RecurrenceRule {
  return task.schedule.mode === "recurring" ? task.schedule.recurrence : { type: "daily" };
}

function buildRecurrence(values: TaskFormValues): RecurrenceRule {
  if (values.recurrenceType === "everyNDays") {
    return { type: "everyNDays", intervalDays: values.intervalDays };
  }
  return { type: values.recurrenceType };
}

export function createEmptyTaskFormValues(state: AppState, today: string): TaskFormValues {
  return {
    title: "",
    mode: "oneTime",
    oneTimeDate: today,
    recurringStartDate: today,
    recurrenceType: "daily",
    intervalDays: 2,
    categoryId: firstActive(state.categories)?.id ?? "",
    assigneeId: "",
    taskTypeId: firstActive(state.taskTypes)?.id ?? "",
    priorityId: "",
    active: true
  };
}

export function taskToFormValues(task: Task, state: AppState): TaskFormValues {
  const recurrence = recurrenceForTask(task);
  const date = requiredDateForTask(task);
  return {
    title: task.title,
    mode: task.schedule.mode,
    oneTimeDate: date,
    recurringStartDate: date,
    recurrenceType: recurrence.type,
    intervalDays: recurrence.type === "everyNDays" ? recurrence.intervalDays : 2,
    categoryId: state.categories.some((category) => category.id === task.categoryId) ? task.categoryId : "",
    assigneeId: state.assignees.some((assignee) => assignee.id === task.assigneeId) ? task.assigneeId : "",
    taskTypeId: state.taskTypes.some((taskType) => taskType.id === task.taskTypeId) ? task.taskTypeId : "",
    priorityId: state.priorities.some((priority) => priority.id === task.priorityId) ? task.priorityId : "",
    active: task.active
  };
}

export function validateTaskFormValues(values: TaskFormValues, state: AppState): TaskFormErrors {
  const errors: TaskFormErrors = {};
  if (values.title.trim().length === 0) {
    errors.title = "Podaj nazwe zadania.";
  }
  if (values.mode === "oneTime" && values.oneTimeDate.length === 0) {
    errors.oneTimeDate = "Wybierz date zadania.";
  }
  if (values.mode === "recurring" && values.recurringStartDate.length === 0) {
    errors.recurringStartDate = "Wybierz date startu.";
  }
  if (values.mode === "recurring" && values.recurrenceType === "everyNDays" && values.intervalDays < 1) {
    errors.intervalDays = "Liczba dni musi byc wieksza lub rowna 1.";
  }
  if (values.categoryId.length === 0) {
    errors.categoryId = "Wybierz kategorie.";
  }
  if (values.taskTypeId.length === 0) {
    errors.taskTypeId = "Wybierz typ zadania.";
  }
  if (
    state.categories.filter((category) => category.id === values.categoryId).length === 0 ||
    (values.assigneeId.length > 0 && state.assignees.filter((assignee) => assignee.id === values.assigneeId).length === 0) ||
    state.taskTypes.filter((taskType) => taskType.id === values.taskTypeId).length === 0
  ) {
    errors.dictionary = "Brakuje aktywnych slownikow wymaganych do zapisania zadania.";
  }
  return errors;
}

export function taskFormValuesToDraft(values: TaskFormValues, state: AppState): TaskDraft {
  const category = state.categories.find((item) => item.id === values.categoryId);
  const assignee = state.assignees.find((item) => item.id === values.assigneeId);
  const priorityId = values.priorityId || firstActive(state.priorities)?.id || DEFAULT_PRIORITY_ID;

  if (!category || (values.assigneeId.length > 0 && !assignee)) {
    throw new Error("Task form references missing dictionary item");
  }

  return {
    title: values.title.trim(),
    categoryName: category.name,
    categoryColor: category.color,
    assigneeName: assignee?.name ?? UNASSIGNED_ASSIGNEE_NAME,
    taskTypeId: values.taskTypeId,
    priorityId,
    schedule:
      values.mode === "oneTime"
        ? { mode: "oneTime", date: values.oneTimeDate }
        : { mode: "recurring", startDate: values.recurringStartDate, recurrence: buildRecurrence(values) },
    active: values.active
  };
}
