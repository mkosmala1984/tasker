import type { AppState } from "./types";
import {
  entities,
  equal,
  order,
  type Change,
  type Entity,
  type SyncConflict,
  type SyncOperation,
} from "./syncOperations";

function normalize(value: unknown) {
  return String(value).trim().toLocaleLowerCase("pl").normalize("NFKC");
}
function read(state: AppState, change: Change): unknown {
  if (change.field === "$order") return order(state, change.collection);
  const entity = entities(state, change.collection).find(
    (x) => x.id === change.id,
  );
  return change.field === "$entity" ? entity : entity?.[change.field];
}
export function applyChange(state: AppState, change: Change, value: unknown) {
  const list = entities(state, change.collection);
  if (change.field === "$order") {
    (value as string[]).forEach((id, i) => {
      const item = list.find((x) => x.id === id);
      if (item) item.order = i;
    });
  } else if (change.field === "$entity") {
    const i = list.findIndex((x) => x.id === change.id);
    if (value === undefined) {
      if (i >= 0) list.splice(i, 1);
    } else if (i >= 0) list[i] = structuredClone(value) as Entity;
    else list.push(structuredClone(value) as Entity);
  } else {
    const item = list.find((x) => x.id === change.id);
    if (item) item[change.field] = structuredClone(value);
  }
}
export function mergeOperations(base: AppState, operations: SyncOperation[]) {
  let state = structuredClone(base);
  const conflicts: SyncConflict[] = [],
    appliedIds: string[] = [],
    blocked = new Set<string>();
  const aliases = new Map<string, string>();
  const pendingProjection: Change[] = [];
  for (const operation of operations) {
    for (const [from, to] of Object.entries(operation.aliases ?? {}))
      aliases.set(from, to);
    for (const collection of ["categories", "assignees"] as const) {
      for (const reference of operation.references?.[collection] ?? []) {
        if (!entities(state, collection).some((x) => x.id === reference.id)) {
          const existing = entities(state, collection).find(
            (x) => normalize(x.name) === normalize(reference.name),
          );
          if (existing) aliases.set(reference.id, existing.id);
        }
      }
    }
    if (operation.replacement) {
      const { before, after } = operation.replacement;
      if (equal(state, before) || equal(state, after)) {
        state = structuredClone(after);
        appliedIds.push(operation.id);
      } else
        conflicts.push({
          operationId: operation.id,
          collection: "tasks",
          id: "$dataset",
          field: "$replace",
          before,
          after,
          local: after,
          remote: structuredClone(state),
        });
      continue;
    }
    const conflictStart = conflicts.length;
    const operationStart = structuredClone(state),
      mappedChanges: Change[] = [];
    for (const [changeIndex, original] of operation.changes.entries()) {
      const change = structuredClone(original);
      change.id = aliases.get(change.id) ?? change.id;
      if (
        change.after &&
        typeof change.after === "object" &&
        !Array.isArray(change.after)
      ) {
        const item = change.after as Entity;
        for (const field of ["categoryId", "assigneeId", "taskId"])
          if (typeof item[field] === "string")
            item[field] = aliases.get(item[field] as string) ?? item[field];
      }
      if (
        ["categoryId", "assigneeId", "taskId"].includes(change.field) &&
        typeof change.after === "string"
      )
        change.after = aliases.get(change.after) ?? change.after;
      let remote = read(state, change);
      if (change.field === "updatedAt") {
        if (
          typeof change.after === "string" &&
          (typeof remote !== "string" || change.after > remote)
        )
          applyChange(state, change, change.after);
        mappedChanges.push(change);
        continue;
      }
      if (
        change.field === "$entity" &&
        change.before === undefined &&
        change.after
      ) {
        const item = change.after as Entity;
        const duplicate = entities(state, change.collection).find((x) => {
          if (
            change.collection === "categories" ||
            change.collection === "assignees"
          )
            return normalize(x.name) === normalize(item.name);
          if (change.collection === "completions")
            return (
              x.taskId === item.taskId && x.scheduledDate === item.scheduledDate
            );
          if (change.collection === "postponements")
            return x.taskId === item.taskId && x.fromDate === item.fromDate;
          return false;
        });
        if (duplicate) {
          aliases.set(original.id, duplicate.id);
          change.id = duplicate.id;
          if (
            change.collection === "categories" ||
            change.collection === "assignees"
          ) {
            if (
              change.collection === "categories" &&
              !equal(duplicate.color, item.color)
            ) {
              change.field = "color";
              change.before = duplicate.color;
              change.after = item.color;
              // Same-name category creation has no shared color baseline.
              change.before = undefined;
              remote = duplicate.color;
            } else continue;
          } else {
            change.field =
              change.collection === "completions" ? "completedDate" : "toDate";
            change.before = undefined;
            change.after = item[change.field];
            remote = duplicate[change.field];
          }
        }
      }
      const dependent =
        blocked.has(change.id) ||
        (change.after &&
          typeof change.after === "object" &&
          Object.entries(change.after).some(
            ([k, v]) =>
              k.endsWith("Id") && typeof v === "string" && blocked.has(v),
          ));
      const missingEntity =
        change.field !== "$entity" &&
        change.field !== "$order" &&
        !entities(state, change.collection).some((x) => x.id === change.id);
      if (missingEntity) {
        const reference = operation.references?.[change.collection]?.find(
          (x) => x.id === original.id,
        );
        if (reference) {
          const restored = structuredClone(reference);
          for (const patch of operation.changes.filter(
            (x) =>
              x.collection === change.collection &&
              x.id === original.id &&
              !x.field.startsWith("$"),
          ))
            restored[patch.field] = structuredClone(patch.after);
          restored.id = change.id;
          for (const field of ["categoryId", "assigneeId", "taskId"])
            if (typeof restored[field] === "string")
              restored[field] =
                aliases.get(restored[field] as string) ?? restored[field];
          change.field = "$entity";
          change.before = reference;
          change.after = restored;
        }
      }
      if (
        !dependent &&
        !missingEntity &&
        (equal(remote, change.before) || equal(remote, change.after))
      ) {
        applyChange(state, change, change.after);
      } else {
        conflicts.push({
          ...change,
          operationId: operation.id,
          changeIndex,
          local: change.after,
          remote: structuredClone(remote),
        });
        if (change.collection !== "tasks") blocked.add(change.id);
      }
      mappedChanges.push(change);
    }
    if (conflicts.length === conflictStart) appliedIds.push(operation.id);
    else {
      state = operationStart;
      pendingProjection.push(...mappedChanges);
      mappedChanges.forEach((x) => blocked.add(x.id));
    }
  }
  let projected = structuredClone(state);
  for (const conflict of conflicts)
    if (conflict.field === "$replace")
      projected = structuredClone(conflict.local) as AppState;
  for (const change of pendingProjection)
    applyChange(projected, change, change.after);
  return { state, projected, conflicts, appliedIds };
}
