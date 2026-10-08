import { describe, expect, it } from "vitest";
import { createEmptyState } from "../storage/taskerStorage";
import { createOperation } from "./syncOperations";
import { mergeOperations } from "./syncMerge";

function fixture() {
  return {
    ...createEmptyState(),
    categories: [{ id: "c", name: "Dom", color: "red" }],
    assignees: [{ id: "a", name: "Ja" }],
    tasks: [
      {
        id: "t",
        title: "Pierwsze",
        categoryId: "c",
        assigneeId: "a",
        taskTypeId: "task-type-default",
        priorityId: "priority-normal",
        schedule: { mode: "oneTime" as const, date: "2026-10-08" },
        active: true,
        createdAt: "2026-10-08T00:00:00.000Z",
        updatedAt: "2026-10-08T00:00:00.000Z",
      },
    ],
  };
}
describe("three-way operations", () => {
  it("keeps timestamps for display without using clocks to select field values", () => {
    const base = fixture(),
      next = structuredClone(base);
    next.tasks[0].title = "Moje";
    next.tasks[0].updatedAt = "2026-10-09T00:00:00.000Z";
    expect(
      mergeOperations(base, [createOperation(base, next, "s")]).state.tasks[0]
        .updatedAt,
    ).toBe(next.tasks[0].updatedAt);
  });
  it("keeps task creation and its dictionaries atomic when a dependency conflicts", () => {
    const base = createEmptyState(),
      next = fixture(),
      remote = createEmptyState();
    remote.categories.push({ id: "remote-c", name: "Dom", color: "blue" });
    const result = mergeOperations(remote, [createOperation(base, next, "s")]);
    expect(result.conflicts.length).toBeGreaterThan(0);
    expect(result.state.assignees).toEqual([]);
    expect(result.state.tasks).toEqual([]);
    expect(result.projected.tasks).toHaveLength(1);
  });
  it("remaps references after the creating operation has already been acknowledged", () => {
    const base = fixture(),
      next = structuredClone(base);
    next.categories[0].color = "green";
    const remote = fixture();
    remote.categories[0].id = "remote-c";
    remote.tasks[0].categoryId = "remote-c";
    const result = mergeOperations(remote, [createOperation(base, next, "s")]);
    expect(result.conflicts).toEqual([]);
    expect(result.state.categories[0].color).toBe("green");
  });
  it("merges independent fields without overwriting the remote edit", () => {
    const base = fixture();
    const next = structuredClone(base);
    next.tasks[0].title = "Lokalne";
    const remote = structuredClone(base);
    remote.tasks[0].active = false;
    const result = mergeOperations(remote, [
      createOperation(base, next, "session"),
    ]);
    expect(result.state.tasks[0]).toMatchObject({
      title: "Lokalne",
      active: false,
    });
    expect(result.conflicts).toEqual([]);
  });
  it("retains both values when the same field changes differently", () => {
    const base = fixture();
    const next = structuredClone(base);
    next.tasks[0].title = "Moje";
    const remote = structuredClone(base);
    remote.tasks[0].title = "Zdalne";
    const result = mergeOperations(remote, [
      createOperation(base, next, "session"),
    ]);
    expect(result.state.tasks[0].title).toBe("Zdalne");
    expect(result.projected.tasks[0].title).toBe("Moje");
    expect(result.conflicts[0]).toMatchObject({
      field: "title",
      local: "Moje",
      remote: "Zdalne",
    });
    expect(result.appliedIds).toEqual([]);
  });
  it("deduplicates completion by occurrence and detects differing completion dates", () => {
    const base = fixture();
    const next = structuredClone(base);
    next.completions.push({
      id: "local",
      taskId: "t",
      scheduledDate: "2026-10-08",
      completedDate: "2026-10-08",
    });
    const remote = structuredClone(base);
    remote.completions.push({ ...next.completions[0], id: "remote" });
    const operation = createOperation(base, next, "session");
    expect(mergeOperations(remote, [operation]).state.completions).toHaveLength(
      1,
    );
    remote.completions[0].completedDate = "2026-10-09";
    expect(mergeOperations(remote, [operation]).conflicts).toHaveLength(1);
  });
  it("remaps concurrently created category and assignee references", () => {
    const base = createEmptyState();
    const next = fixture();
    const remote = createEmptyState();
    remote.categories.push({ id: "remote-c", name: " dom ", color: "red" });
    remote.assignees.push({ id: "remote-a", name: "JA" });
    const result = mergeOperations(remote, [
      createOperation(base, next, "session"),
    ]);
    expect(result.state.categories).toHaveLength(1);
    expect(result.state.assignees).toHaveLength(1);
    expect(result.state.tasks[0]).toMatchObject({
      categoryId: "remote-c",
      assigneeId: "remote-a",
    });
  });
  it("does not automatically replace a changed dataset with an import", () => {
    const base = fixture();
    const remote = structuredClone(base);
    remote.tasks[0].title = "Nowe";
    const result = mergeOperations(remote, [
      createOperation(base, createEmptyState(), "s", true),
    ]);
    expect(result.conflicts[0].field).toBe("$replace");
    expect(result.state.tasks[0].title).toBe("Nowe");
  });
});
