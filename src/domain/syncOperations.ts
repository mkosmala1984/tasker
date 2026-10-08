import type { AppState } from "./types";

export const collections = [
  "categories",
  "assignees",
  "taskTypes",
  "priorities",
  "tasks",
  "completions",
  "postponements",
] as const;
export type Collection = (typeof collections)[number];
export type Entity = { id: string; [key: string]: unknown };
export type Change = {
  collection: Collection;
  id: string;
  field: string;
  before: unknown;
  after: unknown;
};
export type SyncOperation = {
  id: string;
  sessionId: string;
  changes: Change[];
  references?: Partial<Record<Collection, Entity[]>>;
  aliases?: Record<string, string>;
  replacement?: { before: AppState; after: AppState };
};
export type SyncConflict = Change & {
  operationId: string;
  changeIndex?: number;
  local: unknown;
  remote: unknown;
};

// Equality is independent of object property insertion order and client clocks.
export function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) || Array.isArray(b))
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((v, i) => equal(v, b[i]))
    );
  const x = a as Record<string, unknown>,
    y = b as Record<string, unknown>;
  return (
    Object.keys(x).length === Object.keys(y).length &&
    Object.keys(x).every((k) => equal(x[k], y[k]))
  );
}
export function entities(state: AppState, collection: Collection): Entity[] {
  return state[collection] as unknown as Entity[];
}
export function order(state: AppState, collection: Collection): string[] {
  return [...entities(state, collection)]
    .sort(
      (a, b) => Number(a.order) - Number(b.order) || a.id.localeCompare(b.id),
    )
    .map((x) => x.id);
}
export function createOperation(
  before: AppState,
  after: AppState,
  sessionId: string,
  replace = false,
): SyncOperation {
  const operation: SyncOperation = {
    id: crypto.randomUUID(),
    sessionId,
    changes: [],
  };
  operation.references = Object.fromEntries(
    ["categories", "assignees", "tasks", "completions", "postponements"].map(
      (c) => [c, structuredClone(entities(before, c as Collection))],
    ),
  );
  if (replace) return { ...operation, replacement: { before, after } };
  for (const collection of collections) {
    const old = entities(before, collection),
      next = entities(after, collection);
    for (const id of new Set([...old, ...next].map((x) => x.id))) {
      const a = old.find((x) => x.id === id),
        b = next.find((x) => x.id === id);
      if (!a || !b) {
        if (!equal(a, b))
          operation.changes.push({
            collection,
            id,
            field: "$entity",
            before: a,
            after: b,
          });
      } else
        for (const field of new Set([...Object.keys(a), ...Object.keys(b)])) {
          if (field === "order") continue;
          if (!equal(a[field], b[field]))
            operation.changes.push({
              collection,
              id,
              field,
              before: a[field],
              after: b[field],
            });
        }
    }
    if (
      (collection === "priorities" || collection === "taskTypes") &&
      old.length === next.length &&
      !equal(order(before, collection), order(after, collection))
    ) {
      operation.changes.push({
        collection,
        id: "$order",
        field: "$order",
        before: order(before, collection),
        after: order(after, collection),
      });
    }
  }
  return operation;
}
