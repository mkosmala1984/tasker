import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import { createOperation } from "../domain/syncOperations";
import { createEmptyState } from "../storage/taskerStorage";
import { SyncJournal } from "../storage/syncJournal";
import {
  RemoteConflictError,
  PermanentSyncError,
  type RemoteDocument,
  type RemoteEnvelope,
  type WriteCondition,
} from "../storage/syncEnvelope";
import { createRemoteSyncController } from "./remoteSync";
function service() {
  let document: RemoteDocument = {
    envelope: {
      version: 2,
      revision: 1,
      updatedAt: new Date().toISOString(),
      state: createEmptyState(),
      appliedOperationIds: [],
    },
    etag: "1",
  };
  return {
    getRemoteEnvelope: vi.fn(async () => structuredClone(document)),
    putRemoteEnvelope: vi.fn(
      async (
        _: object,
        envelope: RemoteEnvelope,
        condition: WriteCondition,
      ) => {
        if (!("etag" in condition) || condition.etag !== document.etag)
          throw new RemoteConflictError();
        document = {
          envelope: structuredClone(envelope),
          etag: String(envelope.revision),
        };
      },
    ),
    get document() {
      return document;
    },
  };
}
async function client(storage: ReturnType<typeof service>) {
  const journal = new SyncJournal(crypto.randomUUID());
  await journal.initialize("remote", createEmptyState());
  const setStatus = vi.fn();
  const controller = createRemoteSyncController({
    credentials: {},
    dataset: "remote",
    journal,
    storage,
    setStatus,
    onChange: vi.fn(),
  });
  return { journal, controller, setStatus };
}
async function edit(journal: SyncJournal, id: string) {
  const base = (await journal.read("remote")).state,
    next = structuredClone(base);
  next.categories.push({ id, name: id, color: "red" });
  await journal.append("remote", createOperation(base, next, id));
}
describe("journal sync", () => {
  it("retries network failures and suspends permission failures until reconfiguration", async () => {
    const storage = service(),
      a = await client(storage);
    storage.getRemoteEnvelope.mockRejectedValue(new Error("offline"));
    vi.useFakeTimers();
    try {
      a.controller.start();
      await a.controller.syncNow();
      await vi.advanceTimersByTimeAsync(1600);
      expect(storage.getRemoteEnvelope.mock.calls.length).toBeGreaterThan(1);
      a.controller.stop();
      storage.getRemoteEnvelope.mockClear();
      storage.getRemoteEnvelope.mockRejectedValue(
        new PermanentSyncError("Brak uprawnień"),
      );
      a.controller.setCredentials({});
      a.controller.start();
      await a.controller.syncNow();
      await vi.advanceTimersByTimeAsync(120000);
      expect(storage.getRemoteEnvelope).toHaveBeenCalledTimes(1);
    } finally {
      a.controller.stop();
      vi.useRealTimers();
    }
  });
  it("ignores a late response from the previous connection", async () => {
    const storage = service(),
      a = await client(storage);
    let resolve!: (document: RemoteDocument) => void;
    storage.getRemoteEnvelope.mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const running = a.controller.syncNow();
    a.controller.setCredentials({}, "other");
    resolve(storage.document);
    await running;
    expect((await a.journal.read("remote")).remote).toBeUndefined();
    a.controller.stop();
  });
  it("stops a cycle after five precondition failures without clearing edits", async () => {
    const storage = service(),
      a = await client(storage);
    await edit(a.journal, "a");
    storage.putRemoteEnvelope.mockRejectedValue(new RemoteConflictError());
    await a.controller.syncNow();
    expect(storage.putRemoteEnvelope).toHaveBeenCalledTimes(5);
    expect((await a.journal.read("remote")).operations).toHaveLength(1);
    expect(a.setStatus).toHaveBeenLastCalledWith({ kind: "pending" });
    a.controller.stop();
  });
  it("retries a rejected stale ETag and preserves both computers edits", async () => {
    const storage = service(),
      a = await client(storage),
      b = await client(storage);
    await Promise.all([edit(a.journal, "a"), edit(b.journal, "b")]);
    await Promise.all([a.controller.syncNow(), b.controller.syncNow()]);
    await a.controller.syncNow();
    expect(
      storage.document.envelope.state.categories.map((x) => x.id).sort(),
    ).toEqual(["a", "b"]);
    expect((await a.journal.read("remote")).operations).toEqual([]);
    expect((await b.journal.read("remote")).operations).toEqual([]);
    expect(storage.putRemoteEnvelope.mock.calls.length).toBeGreaterThanOrEqual(
      3,
    );
    a.controller.stop();
    b.controller.stop();
  });
  it("preserves edits made during GET and PUT", async () => {
    const storage = service(),
      a = await client(storage);
    await edit(a.journal, "a");
    const get = storage.getRemoteEnvelope.getMockImplementation()!;
    storage.getRemoteEnvelope.mockImplementationOnce(async () => {
      await edit(a.journal, "during-get");
      return get();
    });
    const put = storage.putRemoteEnvelope.getMockImplementation()!;
    storage.putRemoteEnvelope.mockImplementationOnce(async (...args) => {
      await edit(a.journal, "during-put");
      await put(...args);
    });
    await a.controller.syncNow();
    expect((await a.journal.read("remote")).state.categories).toHaveLength(3);
    expect((await a.journal.read("remote")).operations).toHaveLength(1);
    await a.controller.syncNow();
    expect(storage.document.envelope.state.categories).toHaveLength(3);
    a.controller.stop();
  });
  it("acknowledges a PUT with a lost response without applying it twice", async () => {
    const storage = service(),
      a = await client(storage);
    await edit(a.journal, "a");
    const put = storage.putRemoteEnvelope.getMockImplementation()!;
    storage.putRemoteEnvelope.mockImplementationOnce(async (...args) => {
      await put(...args);
      throw new Error("offline");
    });
    await a.controller.syncNow();
    expect((await a.journal.read("remote")).operations).toHaveLength(1);
    await a.controller.syncNow();
    expect((await a.journal.read("remote")).operations).toEqual([]);
    expect(storage.document.envelope.state.categories).toHaveLength(1);
    expect(storage.putRemoteEnvelope).toHaveBeenCalledTimes(1);
    a.controller.stop();
  });
});
