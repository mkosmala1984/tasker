import type { AppState } from "../domain/types";

export type ExportPayload = {
  version: 2;
  exportedAt: string;
  state: AppState;
};

export type ImportSummary = {
  taskCount: number;
  categoryCount: number;
  assigneeCount: number;
  taskTypeCount: number;
  priorityCount: number;
  completionCount: number;
  postponementCount: number;
};

export type ImportPreview = {
  payload: ExportPayload;
  state: AppState;
  summary: ImportSummary;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasArray(value: Record<string, unknown>, key: string): boolean {
  return Array.isArray(value[key]);
}

function isAppState(value: unknown): value is AppState {
  return (
    isRecord(value) &&
    hasArray(value, "tasks") &&
    hasArray(value, "categories") &&
    hasArray(value, "assignees") &&
    hasArray(value, "taskTypes") &&
    hasArray(value, "priorities") &&
    hasArray(value, "completions") &&
    hasArray(value, "postponements")
  );
}

export function createExportPayload(state: AppState, exportedAt: string): ExportPayload {
  return { version: 2, exportedAt, state };
}

export function serializeExportPayload(payload: ExportPayload): string {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export function parseImportPayload(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Plik importu nie jest poprawnym JSON.");
  }
}

export function previewImport(raw: string): ImportPreview {
  const parsed = parseImportPayload(raw);
  if (!isRecord(parsed)) {
    throw new Error("Plik importu nie zawiera kompletnych danych Taskera.");
  }
  if (parsed.version !== 2) {
    throw new Error("Nieobslugiwana wersja kopii danych.");
  }
  if (typeof parsed.exportedAt !== "string" || !isAppState(parsed.state)) {
    throw new Error("Plik importu nie zawiera kompletnych danych Taskera.");
  }

  const payload = parsed as ExportPayload;
  return {
    payload,
    state: payload.state,
    summary: {
      taskCount: payload.state.tasks.length,
      categoryCount: payload.state.categories.length,
      assigneeCount: payload.state.assignees.length,
      taskTypeCount: payload.state.taskTypes.length,
      priorityCount: payload.state.priorities.length,
      completionCount: payload.state.completions.length,
      postponementCount: payload.state.postponements.length
    }
  };
}
