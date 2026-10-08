import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTaskerStore } from "./taskerStore";
import { SyncJournal } from "../storage/syncJournal";
import { createEmptyState, STORAGE_KEY } from "../storage/taskerStorage";
import { createExportPayload } from "../storage/taskerBackup";
const stores: ReturnType<typeof createTaskerStore>[] = [];
async function session(name = crypto.randomUUID()) {
  const store = createTaskerStore(new SyncJournal(name));
  stores.push(store);
  await store.getState().initialize();
  return store;
}
afterEach(() => {
  stores.forEach((s) => s.getState().stopSync());
  stores.length = 0;
  localStorage.clear();
  vi.restoreAllMocks();
});
describe("durable tasker store", () => {
  it("opens its durable state even if the old recovery copy was later damaged", async () => {
    const name = crypto.randomUUID(),
      a = await session(name);
    await a.getState().addCategory({ name: "Dom", color: "#ff0000" });
    localStorage.setItem(STORAGE_KEY, "{");
    const reopened = await session(name);
    expect(reopened.getState().state.categories[0].name).toBe("Dom");
  });
  it("does not confirm or project an edit when its durable transaction fails", async () => {
    const journal = new SyncJournal(crypto.randomUUID()),
      a = createTaskerStore(journal);
    stores.push(a);
    await a.getState().initialize();
    vi.spyOn(journal, "append").mockRejectedValue(
      new DOMException("Brak miejsca", "QuotaExceededError"),
    );
    await expect(
      a.getState().addCategory({ name: "Dom", color: "#ff0000" }),
    ).rejects.toThrow(/miejsca/);
    expect(a.getState().state.categories).toEqual([]);
    expect(a.getState().storageError).toContain("miejsca");
  });
  it("keeps independent additions from two tabs and reloads after restart", async () => {
    const name = crypto.randomUUID(),
      a = await session(name),
      b = await session(name);
    await Promise.all([
      a.getState().addCategory({ name: "A", color: "#ff0000" }),
      b.getState().addCategory({ name: "B", color: "#0000ff" }),
    ]);
    await a.getState().refresh();
    expect(a.getState().state.categories).toHaveLength(2);
    const restored = await session(name);
    expect(restored.getState().state.categories).toHaveLength(2);
    expect(restored.getState().pendingCount).toBe(2);
  });
  it("migrates JSONHosting users without network and removes old credentials after saving", async () => {
    const legacy = createEmptyState();
    legacy.categories.push({ id: "c", name: "Dom", color: "#ff0000" });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));
    localStorage.setItem("tasker:jsonhosting:v1", "secret");
    const fetch = vi.spyOn(globalThis, "fetch");
    const a = await session();
    expect(a.getState().state).toEqual(legacy);
    expect(fetch).not.toHaveBeenCalled();
    expect(localStorage.getItem("tasker:jsonhosting:v1")).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toContain("Dom");
  });
  it("keeps legacy credentials and data when migration fails", async () => {
    localStorage.setItem("tasker:jsonhosting:v1", "secret");
    localStorage.setItem(STORAGE_KEY, "{");
    const a = createTaskerStore(new SyncJournal(crypto.randomUUID()));
    stores.push(a);
    await expect(a.getState().initialize()).rejects.toThrow();
    expect(localStorage.getItem("tasker:jsonhosting:v1")).toBe("secret");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("{");
  });
  it("preserves category and dictionary configuration in the journal", async () => {
    const a = await session();
    await a.getState().addCategory({ name: " Dom ", color: "#40c057" });
    await a.getState().addTaskType({ name: "Termin" });
    await a.getState().addPriority({ name: "Pilny", color: "#fa5252" });
    expect(a.getState().state.categories[0].name).toBe("Dom");
    expect(a.getState().state.taskTypes).toHaveLength(2);
    expect(a.getState().state.priorities).toHaveLength(2);
  });
  it("previews without replacing and applies an explicitly confirmed import", async () => {
    const a = await session();
    await a.getState().addCategory({ name: "Dom", color: "#ff0000" });
    const preview = a
      .getState()
      .previewImport(
        JSON.stringify(
          createExportPayload(createEmptyState(), new Date().toISOString()),
        ),
      );
    expect(a.getState().state.categories).toHaveLength(1);
    await a.getState().applyImport(preview);
    expect(a.getState().state.categories).toHaveLength(0);
  });
  it("rejects an import when another tab edited after the preview", async () => {
    const name = crypto.randomUUID(),
      a = await session(name),
      b = await session(name);
    await a.getState().refresh();
    const preview = a
      .getState()
      .previewImport(
        JSON.stringify(
          createExportPayload(createEmptyState(), new Date().toISOString()),
        ),
      );
    await b.getState().addCategory({ name: "Inna karta", color: "#ff0000" });
    await expect(a.getState().applyImport(preview)).rejects.toThrow(/ponownie/);
    await a.getState().refresh();
    expect(a.getState().state.categories).toHaveLength(1);
  });
});
