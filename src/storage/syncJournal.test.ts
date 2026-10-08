import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { SyncJournal } from "./syncJournal";
import { createEmptyState } from "./taskerStorage";
import { createOperation } from "../domain/syncOperations";
import { addTask, updateTask } from "../domain/tasks";
import { isValidState } from "../domain/stateValidation";

describe("durable journal", () => {
  it("keeps the remote category identity when its color is selected remotely", async () => {
    const journal = new SyncJournal(crypto.randomUUID()),
      base = createEmptyState();
    await journal.initialize("a", base);
    const next = addTask(
      base,
      {
        title: "Moje",
        categoryName: "Dom",
        categoryColor: "#ff0000",
        assigneeName: "Ja",
        schedule: { mode: "oneTime", date: "2026-10-08" },
        active: true,
      },
      new Date().toISOString(),
    );
    await journal.append("a", createOperation(base, next, "s"));
    const state = structuredClone(base);
    state.categories.push({ id: "remote", name: "Dom", color: "#0000ff" });
    let record = await journal.acceptRemote("a", {
      envelope: {
        version: 2,
        revision: 1,
        updatedAt: new Date().toISOString(),
        state,
        appliedOperationIds: [],
      },
      etag: "e1",
    });
    const color = record.conflicts.find((x) => x.field === "color")!;
    record = await journal.resolve(
      "a",
      color.operationId,
      color.field,
      color.id,
      "remote",
    );
    expect(record.conflicts).toEqual([]);
    expect(record.state.tasks[0].categoryId).toBe("remote");
    expect(isValidState(record.state)).toBe(true);
  });
  it("restores the required dictionaries together with an explicitly restored task", async () => {
    const journal = new SyncJournal(crypto.randomUUID());
    const draft = {
      title: "Pierwsze",
      categoryName: "Dom",
      assigneeName: "Ja",
      schedule: { mode: "oneTime" as const, date: "2026-10-08" },
      active: true,
    };
    const base = addTask(createEmptyState(), draft, new Date().toISOString());
    await journal.initialize("a", base);
    await journal.acceptRemote("a", {
      envelope: {
        version: 2,
        revision: 1,
        updatedAt: new Date().toISOString(),
        state: base,
        appliedOperationIds: [],
      },
      etag: "e1",
    });
    await journal.append(
      "a",
      createOperation(
        base,
        updateTask(
          base,
          base.tasks[0].id,
          { ...draft, title: "Moje" },
          new Date().toISOString(),
        ),
        "s",
      ),
    );
    let record = await journal.acceptRemote("a", {
      envelope: {
        version: 2,
        revision: 2,
        updatedAt: new Date().toISOString(),
        state: createEmptyState(),
        appliedOperationIds: [],
      },
      etag: "e2",
    });
    const conflict = record.conflicts[0];
    record = await journal.resolve(
      "a",
      conflict.operationId,
      conflict.field,
      conflict.id,
      "local",
    );
    expect(record.conflicts).toEqual([]);
    expect(record.state.tasks[0].title).toBe("Moje");
    expect(isValidState(record.state)).toBe(true);
  });
  it("lets the user restore a locally edited task removed by a remote replacement", async () => {
    const journal = new SyncJournal(crypto.randomUUID());
    const draft = {
      title: "Pierwsze",
      categoryName: "Dom",
      assigneeName: "Ja",
      schedule: { mode: "oneTime" as const, date: "2026-10-08" },
      active: true,
    };
    const base = addTask(createEmptyState(), draft, new Date().toISOString());
    await journal.initialize("a", base);
    const next = updateTask(
      base,
      base.tasks[0].id,
      { ...draft, title: "Moje" },
      new Date().toISOString(),
    );
    await journal.append("a", createOperation(base, next, "s"));
    const state = { ...base, tasks: [] };
    const record = await journal.acceptRemote("a", {
      envelope: {
        version: 2,
        revision: 1,
        updatedAt: new Date().toISOString(),
        state,
        appliedOperationIds: [],
      },
      etag: "e1",
    });
    // Legacy migration selection is resolved first if this is the first remote read.
    let resolved = record;
    for (let i = 0; i < 4 && resolved.conflicts.length; i++) {
      const c = resolved.conflicts[0];
      resolved = await journal.resolve(
        "a",
        c.operationId,
        c.field,
        c.id,
        c.field === "$replace" ? "remote" : "local",
      );
    }
    expect(resolved.conflicts).toEqual([]);
    expect(resolved.state.tasks[0]?.title).toBe("Moje");
  });
  it("resolves a conflict after remapping a concurrently created category", async () => {
    const journal = new SyncJournal(crypto.randomUUID()),
      base = createEmptyState();
    await journal.initialize("a", base);
    const next = structuredClone(base);
    next.categories.push({ id: "local", name: "Dom", color: "red" });
    await journal.append("a", createOperation(base, next, "s"));
    const state = structuredClone(base);
    state.categories.push({ id: "remote", name: "Dom", color: "blue" });
    const record = await journal.acceptRemote("a", {
      envelope: {
        version: 2,
        revision: 1,
        updatedAt: new Date().toISOString(),
        state,
        appliedOperationIds: [],
      },
      etag: "e1",
    });
    const conflict = record.conflicts[0];
    const resolved = await journal.resolve(
      "a",
      conflict.operationId,
      conflict.field,
      conflict.id,
      "local",
    );
    expect(resolved.conflicts).toEqual([]);
    expect(resolved.state.categories).toEqual([
      { id: "remote", name: "Dom", color: "red" },
    ]);
  });
  it("resolves a category conflict without breaking its dependent new task", async () => {
    const journal = new SyncJournal(crypto.randomUUID()),
      base = createEmptyState();
    await journal.initialize("a", base);
    const next = addTask(
      base,
      {
        title: "Moje",
        categoryName: "Dom",
        categoryColor: "#ff0000",
        assigneeName: "Ja",
        schedule: { mode: "oneTime", date: "2026-10-08" },
        active: true,
      },
      new Date().toISOString(),
    );
    await journal.append("a", createOperation(base, next, "s"));
    const state = structuredClone(base);
    state.categories.push({ id: "remote", name: "Dom", color: "#0000ff" });
    let record = await journal.acceptRemote("a", {
      envelope: {
        version: 2,
        revision: 1,
        updatedAt: new Date().toISOString(),
        state,
        appliedOperationIds: [],
      },
      etag: "e1",
    });
    for (let i = 0; i < 4 && record.conflicts.length; i++) {
      const c = record.conflicts[0];
      record = await journal.resolve(
        "a",
        c.operationId,
        c.field,
        c.id,
        "local",
      );
    }
    expect(record.conflicts).toEqual([]);
    expect(record.state.tasks[0].categoryId).toBe("remote");
  });
  it("serializes two tabs and persists their operations across restart", async () => {
    const name = crypto.randomUUID(),
      a = new SyncJournal(name),
      b = new SyncJournal(name);
    const base = createEmptyState();
    await a.initialize("local", base);
    const x = structuredClone(base);
    x.categories.push({ id: "a", name: "A", color: "red" });
    const y = structuredClone(base);
    y.categories.push({ id: "b", name: "B", color: "blue" });
    await Promise.all([
      a.append("local", createOperation(base, x, "a")),
      b.append("local", createOperation(base, y, "b")),
    ]);
    const restored = await new SyncJournal(name).read("local");
    expect(restored.state.categories.map((x) => x.id).sort()).toEqual([
      "a",
      "b",
    ]);
    expect(restored.operations).toHaveLength(2);
  });
  it("acknowledges only sent operations and preserves an edit made during PUT", async () => {
    const journal = new SyncJournal(crypto.randomUUID());
    const base = createEmptyState();
    await journal.initialize("remote", base);
    const first = structuredClone(base);
    first.categories.push({ id: "a", name: "A", color: "red" });
    const op = createOperation(base, first, "s");
    await journal.append("remote", op);
    const second = structuredClone(first);
    second.categories.push({ id: "b", name: "B", color: "red" });
    await journal.append("remote", createOperation(first, second, "s"));
    await journal.acceptRemote("remote", {
      envelope: {
        version: 2,
        revision: 1,
        updatedAt: new Date().toISOString(),
        state: first,
        appliedOperationIds: [op.id],
      },
      etag: "e1",
    });
    const record = await journal.read("remote");
    expect(record.operations).toHaveLength(1);
    expect(record.state.categories).toHaveLength(2);
  });
  it("isolates datasets and rejects a stale import preview", async () => {
    const journal = new SyncJournal(crypto.randomUUID());
    const base = createEmptyState();
    await journal.initialize("a", base);
    await journal.initialize("b", base);
    const next = structuredClone(base);
    next.categories.push({ id: "a", name: "A", color: "red" });
    await journal.append("a", createOperation(base, next, "s"));
    expect((await journal.read("b")).operations).toHaveLength(0);
    await expect(
      journal.append("a", createOperation(base, base, "s", true), 0),
    ).rejects.toThrow(/ponownie/);
  });
  it("does not roll back the baseline from a stale replica", async () => {
    const journal = new SyncJournal(crypto.randomUUID());
    const base = createEmptyState();
    await journal.initialize("a", base);
    const remote = {
      version: 2 as const,
      revision: 2,
      updatedAt: new Date().toISOString(),
      state: base,
      appliedOperationIds: [],
    };
    await journal.acceptRemote("a", { envelope: remote, etag: "e2" });
    await expect(
      journal.acceptRemote("a", {
        envelope: { ...remote, revision: 1 },
        etag: "e1",
      }),
    ).rejects.toThrow(/starsz/);
    expect((await journal.read("a")).remote?.etag).toBe("e2");
  });
});
