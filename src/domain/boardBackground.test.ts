import { describe, expect, it } from "vitest";
import { createEmptyState } from "../storage/taskerStorage";
import { isValidState } from "./stateValidation";
import { createOperation } from "./syncOperations";
import { mergeOperations } from "./syncMerge";
import { previewImport, createExportPayload } from "../storage/taskerBackup";
import { setBoardBackground, type BoardBackgroundImage } from "./boardBackground";

const image: BoardBackgroundImage = { name: "beach.png", dataUrl: "data:image/png;base64,aGVsbG8=" };
const other: BoardBackgroundImage = { name: "flowers.webp", dataUrl: "data:image/webp;base64,d29ybGQ=" };

describe("board background data", () => {
  it("accepts old data and includes the entire image in backup round trips", () => {
    const old = createEmptyState();
    expect(isValidState(old)).toBe(true);
    const state = setBoardBackground(old, image);
    expect(isValidState(state)).toBe(true);
    expect(previewImport(JSON.stringify(createExportPayload(state, new Date().toISOString()))).state).toEqual(state);
    expect(old).not.toHaveProperty("backgrounds");
    expect(isValidState({ ...state, backgrounds: [{ id: "today", image: { name: "x", dataUrl: "https://example.com/x" } }] })).toBe(false);
  });

  it("synchronizes uploads onto old datasets and avoids duplicating image references in task operations", () => {
    const base = createEmptyState();
    const next = setBoardBackground(base, image);
    const upload = createOperation(base, next, "a");
    expect(mergeOperations(base, [upload]).state).toEqual(next);
    const taskEdit = createOperation(next, { ...next, assignees: [{ id: "a", name: "Anna" }] }, "a");
    expect(taskEdit.references).not.toHaveProperty("backgrounds");
  });

  it("treats concurrent first uploads as a conflict and keeps image names and data together", () => {
    const base = createEmptyState();
    const local = createOperation(base, setBoardBackground(base, image), "a");
    const result = mergeOperations(setBoardBackground(base, other), [local]);
    expect(result.conflicts).toHaveLength(1);
    expect(result.projected.backgrounds?.[0].image).toEqual(image);
    expect(result.state.backgrounds?.[0].image).toEqual(other);
  });

  it("synchronizes reset and detects a concurrent reset versus replacement", () => {
    const base = setBoardBackground(createEmptyState(), image);
    const reset = createOperation(base, setBoardBackground(base, null), "a");
    expect(mergeOperations(base, [reset]).state.backgrounds?.[0].image).toBeNull();
    expect(mergeOperations(setBoardBackground(base, other), [reset]).conflicts).toHaveLength(1);
  });
});
