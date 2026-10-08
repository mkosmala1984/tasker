import type { AppState } from "./types";
import { collections } from "./syncOperations";

function record(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}
function text(x: unknown): x is string {
  return typeof x === "string" && x.trim().length > 0;
}
function date(x: unknown): boolean {
  return (
    typeof x === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(x) &&
    !Number.isNaN(Date.parse(x)) &&
    new Date(x).toISOString().slice(0, 10) === x
  );
}
function timestamp(x: unknown) {
  return typeof x === "string" && !Number.isNaN(Date.parse(x));
}
export function isValidState(x: unknown): x is AppState {
  if (!record(x)) return false;
  for (const collection of collections) {
    const items = x[collection];
    if (
      !Array.isArray(items) ||
      !items.every((v) => record(v) && text(v.id)) ||
      new Set(items.map((v) => v.id)).size !== items.length
    )
      return false;
  }
  const state = x as unknown as AppState;
  if (
    !state.categories.every((v) => text(v.name) && text(v.color)) ||
    !state.assignees.every((v) => text(v.name))
  )
    return false;
  if (
    ![...state.taskTypes, ...state.priorities].every(
      (v) =>
        text(v.name) &&
        typeof v.active === "boolean" &&
        Number.isFinite(v.order),
    )
  )
    return false;
  const has = (
    collection:
      "categories" | "assignees" | "taskTypes" | "priorities" | "tasks",
    id: string,
  ) => state[collection].some((v) => v.id === id);
  if (
    !state.tasks.every((v) => {
      if (
        !text(v.title) ||
        typeof v.active !== "boolean" ||
        !timestamp(v.createdAt) ||
        !timestamp(v.updatedAt)
      )
        return false;
      if (
        !has("categories", v.categoryId) ||
        !has("assignees", v.assigneeId) ||
        !has("taskTypes", v.taskTypeId) ||
        !has("priorities", v.priorityId)
      )
        return false;
      const s = v.schedule;
      if (!record(s)) return false;
      if (s.mode === "oneTime") return date(s.date);
      if (s.mode !== "recurring" || !date(s.startDate) || !record(s.recurrence))
        return false;
      const r = s.recurrence;
      return (
        ["daily", "weekly", "monthly", "quarterly"].includes(String(r.type)) ||
        (r.type === "everyNDays" &&
          Number.isInteger(r.intervalDays) &&
          Number(r.intervalDays) > 0)
      );
    })
  )
    return false;
  if (
    !state.completions.every(
      (v) =>
        has("tasks", v.taskId) &&
        date(v.scheduledDate) &&
        date(v.completedDate),
    )
  )
    return false;
  if (
    !state.postponements.every(
      (v) =>
        has("tasks", v.taskId) &&
        date(v.fromDate) &&
        date(v.toDate) &&
        timestamp(v.createdAt),
    )
  )
    return false;
  return true;
}
