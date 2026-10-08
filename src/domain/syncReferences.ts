import type { AppState } from "./types";
import {
  entities,
  type Collection,
  type Entity,
  type SyncOperation,
} from "./syncOperations";

export const referenceCollections: Record<string, Collection> = {
  categoryId: "categories",
  assigneeId: "assignees",
  taskTypeId: "taskTypes",
  priorityId: "priorities",
  taskId: "tasks",
};
export function isReferenced(
  state: AppState,
  collection: Collection,
  id: string,
): boolean {
  return Object.entries(referenceCollections).some(
    ([field, target]) =>
      target === collection &&
      [...state.tasks, ...state.completions, ...state.postponements].some(
        (item) => (item as unknown as Entity)[field] === id,
      ),
  );
}
export function missingReferences(state: AppState, value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  return Object.entries(referenceCollections).some(
    ([field, target]) =>
      typeof (value as Entity)[field] === "string" &&
      !entities(state, target).some(
        (item) => item.id === (value as Entity)[field],
      ),
  );
}
// Restoring a task explicitly includes only its absent dependencies; existing remote values stay intact.
export function restoreReferences(
  state: AppState,
  value: unknown,
  operations: SyncOperation[],
) {
  if (!value || typeof value !== "object") return;
  for (const [field, target] of Object.entries(referenceCollections)) {
    const id = (value as Entity)[field];
    if (
      typeof id !== "string" ||
      entities(state, target).some((item) => item.id === id)
    )
      continue;
    const reference = operations
      .flatMap((op) => op.references?.[target] ?? [])
      .find((item) => item.id === id);
    if (reference) {
      entities(state, target).push(structuredClone(reference));
      restoreReferences(state, reference, operations);
    }
  }
}
