import type { AppState, Priority, TaskType } from "../domain/types";
import { isValidState } from "../domain/stateValidation";

export const STORAGE_KEY = "tasker:v1";

export type LoadResult = {
  state: AppState;
  error?: string;
};

export const DEFAULT_TASK_TYPE_ID = "task-type-default";
export const DEFAULT_PRIORITY_ID = "priority-normal";

export function createDefaultTaskTypes(): TaskType[] {
  return [{ id: DEFAULT_TASK_TYPE_ID, name: "Zadanie", active: true, order: 0 }];
}

export function createDefaultPriorities(): Priority[] {
  return [{ id: DEFAULT_PRIORITY_ID, name: "Normalny", active: true, order: 0, color: "#868e96" }];
}

export function createEmptyState(): AppState {
  return {
    tasks: [],
    categories: [],
    assignees: [],
    taskTypes: createDefaultTaskTypes(),
    priorities: createDefaultPriorities(),
    completions: [],
    postponements: []
  };
}

export function loadState(storage: Storage = window.localStorage): LoadResult {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) {
    return { state: createEmptyState() };
  }

  try {
    const parsed = JSON.parse(raw);
    if (!isValidState(parsed)) {
      return { state: createEmptyState(), error: "Nie mozna odczytac lokalnych danych." };
    }
    return { state: parsed };
  } catch {
    return { state: createEmptyState(), error: "Nie mozna odczytac lokalnych danych." };
  }
}

export function saveState(state: AppState, storage: Storage = window.localStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}
