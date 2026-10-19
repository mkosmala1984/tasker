import { createEmptyTaskFormValues, isUnassignedAssigneeName, recurrenceOptions, type TaskFormValues } from "../domain/taskForm";
import type { AppState } from "../domain/types";

const KEY = "tasker.taskFormPreferences.v1";
type Choices = Pick<TaskFormValues, "mode" | "categoryId" | "assigneeId" | "taskTypeId" | "priorityId" | "recurrenceType" | "intervalDays">;

export function loadTaskFormPreferences(state: AppState, today: string) {
  const values = createEmptyTaskFormValues(state, today);
  let enabled = true;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
    enabled = saved?.enabled !== false;
    const choices = enabled ? saved?.choices : undefined;
    if (!choices || typeof choices !== "object") return { values, enabled };
    if (choices.mode === "oneTime" || choices.mode === "recurring") values.mode = choices.mode;
    if (recurrenceOptions.some(option => option.value === choices.recurrenceType)) values.recurrenceType = choices.recurrenceType;
    if (Number.isSafeInteger(choices.intervalDays) && choices.intervalDays >= 1) values.intervalDays = choices.intervalDays;
    const dictionaries = {
      categoryId: state.categories,
      assigneeId: state.assignees.filter(person => !isUnassignedAssigneeName(person.name)),
      taskTypeId: state.taskTypes,
      priorityId: state.priorities,
    };
    for (const key of Object.keys(dictionaries) as Array<keyof typeof dictionaries>) {
      if (dictionaries[key].some((item: { id: string; active?: boolean }) => item.id === choices[key] && item.active !== false)) values[key] = choices[key];
    }
  } catch {
    // Preferences must never prevent opening the form.
  }
  return { values, enabled };
}

export function saveTaskFormPreferences(values: TaskFormValues, enabled: boolean): boolean {
  const { mode, categoryId, assigneeId, taskTypeId, priorityId, recurrenceType, intervalDays } = values;
  const choices: Choices = { mode, categoryId, assigneeId, taskTypeId, priorityId, recurrenceType, intervalDays };
  try {
    localStorage.setItem(KEY, JSON.stringify(enabled ? { enabled, choices } : { enabled }));
    return true;
  } catch {
    return false;
  }
}
