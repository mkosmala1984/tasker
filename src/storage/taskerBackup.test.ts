import { describe, expect, it } from "vitest";
import type { AppState } from "../domain/types";
import { createExportPayload, parseImportPayload, previewImport, serializeExportPayload } from "./taskerBackup";

const state: AppState = {
  tasks: [],
  categories: [{ id: "cat-home", name: "Dom", color: "#40c057" }],
  assignees: [{ id: "person-ola", name: "Ola" }],
  taskTypes: [{ id: "type-task", name: "Zadanie", active: true, order: 0 }],
  priorities: [{ id: "priority-normal", name: "Normalny", active: true, order: 0, color: "#868e96" }],
  completions: [],
  postponements: []
};

describe("taskerBackup", () => {
  it("creates a complete v2 export payload", () => {
    const payload = createExportPayload(state, "2026-07-07T08:00:00.000Z");

    expect(payload).toEqual({ version: 2, exportedAt: "2026-07-07T08:00:00.000Z", state });
  });

  it("serializes export payload as formatted JSON", () => {
    const serialized = serializeExportPayload(createExportPayload(state, "2026-07-07T08:00:00.000Z"));

    expect(JSON.parse(serialized)).toEqual({ version: 2, exportedAt: "2026-07-07T08:00:00.000Z", state });
  });

  it("previews a valid import with summary counts", () => {
    const parsed = previewImport(JSON.stringify(createExportPayload(state, "2026-07-07T08:00:00.000Z")));

    expect(parsed.state).toEqual(state);
    expect(parsed.summary).toEqual({
      taskCount: 0,
      categoryCount: 1,
      assigneeCount: 1,
      taskTypeCount: 1,
      priorityCount: 1,
      completionCount: 0,
      postponementCount: 0
    });
  });

  it("rejects invalid JSON", () => {
    expect(() => parseImportPayload("{bad-json")).toThrow("Plik importu nie jest poprawnym JSON.");
  });

  it("rejects unsupported versions", () => {
    expect(() => previewImport(JSON.stringify({ version: 1, exportedAt: "2026-07-07T08:00:00.000Z", state }))).toThrow(
      "Nieobslugiwana wersja kopii danych."
    );
  });

  it("rejects incomplete payloads without producing a state", () => {
    expect(() => previewImport(JSON.stringify({ version: 2, exportedAt: "2026-07-07T08:00:00.000Z", state: { tasks: [] } }))).toThrow(
      "Plik importu nie zawiera kompletnych danych Taskera."
    );
  });
});
