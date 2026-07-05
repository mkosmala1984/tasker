import type { AppState } from "../domain/types";

export const STORAGE_KEY = "tasker:v1";

export type LoadResult = {
  state: AppState;
  error?: string;
};

export function createEmptyState(): AppState {
  return {
    version: 1,
    tasks: [],
    categories: [],
    assignees: [],
    completions: [],
    postponements: []
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isArrayProperty(value: Record<string, unknown>, key: string): boolean {
  return Array.isArray(value[key]);
}

function isAppState(value: unknown): value is AppState {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.version === 1 &&
    isArrayProperty(value, "tasks") &&
    isArrayProperty(value, "categories") &&
    isArrayProperty(value, "assignees") &&
    isArrayProperty(value, "completions") &&
    isArrayProperty(value, "postponements")
  );
}

export function loadState(storage: Storage = window.localStorage): LoadResult {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) {
    return { state: createEmptyState() };
  }

  try {
    const parsed = JSON.parse(raw);
    if (isRecord(parsed) && parsed.version !== 1) {
      return { state: createEmptyState(), error: "Nieobsługiwana wersja lokalnych danych." };
    }
    if (!isAppState(parsed)) {
      return { state: createEmptyState(), error: "Nie można odczytać lokalnych danych." };
    }
    return { state: parsed };
  } catch {
    return { state: createEmptyState(), error: "Nie można odczytać lokalnych danych." };
  }
}

export function saveState(state: AppState, storage: Storage = window.localStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}
