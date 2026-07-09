import { DEFAULT_PRIORITY_ID, DEFAULT_TASK_TYPE_ID } from "../storage/taskerStorage";
import type { AppState, Assignee, Category, TaskDraft } from "./types";

export type IdFactory = () => string;

const DEFAULT_CATEGORY_COLOR = "#228be6";

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function namesEqual(left: string, right: string): boolean {
  return normalizeName(left).localeCompare(normalizeName(right), "pl", { sensitivity: "accent" }) === 0;
}

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export const defaultIdFactory: IdFactory = () => createId("id");

function getOrCreateCategory(state: AppState, name: string, color: string | undefined, idFactory: IdFactory): { state: AppState; category: Category } {
  const normalized = normalizeName(name);
  const existing = state.categories.find((category) => namesEqual(category.name, normalized));
  if (existing) {
    return { state, category: existing };
  }

  const category = { id: idFactory(), name: normalized, color: color?.trim() || DEFAULT_CATEGORY_COLOR };
  return { state: { ...state, categories: [...state.categories, category] }, category };
}

function getOrCreateAssignee(state: AppState, name: string, idFactory: IdFactory): { state: AppState; assignee: Assignee } {
  const normalized = normalizeName(name);
  const existing = state.assignees.find((assignee) => namesEqual(assignee.name, normalized));
  if (existing) {
    return { state, assignee: existing };
  }

  const assignee = { id: idFactory(), name: normalized };
  return { state: { ...state, assignees: [...state.assignees, assignee] }, assignee };
}

function requireText(value: string, label: string): string {
  const normalized = normalizeName(value);
  if (normalized.length === 0) {
    throw new Error(`${label} is required`);
  }
  return normalized;
}

function firstActiveTaskTypeId(state: AppState): string {
  return state.taskTypes.find((item) => item.active)?.id ?? DEFAULT_TASK_TYPE_ID;
}

function firstActivePriorityId(state: AppState): string {
  return state.priorities.find((item) => item.active)?.id ?? DEFAULT_PRIORITY_ID;
}

function prepareDraft(state: AppState, draft: TaskDraft, idFactory: IdFactory) {
  const title = requireText(draft.title, "title");
  const categoryResult = getOrCreateCategory(state, requireText(draft.categoryName, "categoryName"), draft.categoryColor, idFactory);
  const assigneeResult = getOrCreateAssignee(categoryResult.state, requireText(draft.assigneeName, "assigneeName"), idFactory);

  return {
    state: assigneeResult.state,
    title,
    categoryId: categoryResult.category.id,
    assigneeId: assigneeResult.assignee.id,
    taskTypeId: draft.taskTypeId || firstActiveTaskTypeId(assigneeResult.state),
    priorityId: draft.priorityId || firstActivePriorityId(assigneeResult.state)
  };
}

export function addTask(state: AppState, draft: TaskDraft, nowIso: string, idFactory: IdFactory = defaultIdFactory): AppState {
  const taskId = idFactory();
  const prepared = prepareDraft(state, draft, idFactory);

  return {
    ...prepared.state,
    tasks: [
      ...prepared.state.tasks,
      {
        id: taskId,
        title: prepared.title,
        categoryId: prepared.categoryId,
        assigneeId: prepared.assigneeId,
        taskTypeId: prepared.taskTypeId,
        priorityId: prepared.priorityId,
        schedule: draft.schedule,
        active: draft.active,
        createdAt: nowIso,
        updatedAt: nowIso
      }
    ]
  };
}

export function updateTask(
  state: AppState,
  taskId: string,
  draft: TaskDraft,
  nowIso: string,
  idFactory: IdFactory = defaultIdFactory
): AppState {
  const prepared = prepareDraft(state, draft, idFactory);

  return {
    ...prepared.state,
    tasks: prepared.state.tasks.map((task) =>
      task.id === taskId
        ? {
            ...task,
            title: prepared.title,
            categoryId: prepared.categoryId,
            assigneeId: prepared.assigneeId,
            taskTypeId: prepared.taskTypeId,
            priorityId: prepared.priorityId,
            schedule: draft.schedule,
            active: draft.active,
            updatedAt: nowIso
          }
        : task
    )
  };
}

export function deactivateTask(state: AppState, taskId: string, nowIso: string): AppState {
  return {
    ...state,
    tasks: state.tasks.map((task) => (task.id === taskId ? { ...task, active: false, updatedAt: nowIso } : task))
  };
}

export function completeTask(
  state: AppState,
  taskId: string,
  scheduledDate: string,
  completedDate: string,
  idFactory: IdFactory = defaultIdFactory
): AppState {
  return {
    ...state,
    completions: [
      ...state.completions,
      {
        id: idFactory(),
        taskId,
        scheduledDate,
        completedDate
      }
    ]
  };
}

export function postponeTask(
  state: AppState,
  taskId: string,
  fromDate: string,
  toDate: string,
  createdAt: string,
  idFactory: IdFactory = defaultIdFactory
): AppState {
  return {
    ...state,
    postponements: [
      ...state.postponements,
      {
        id: idFactory(),
        taskId,
        fromDate,
        toDate,
        createdAt
      }
    ]
  };
}
