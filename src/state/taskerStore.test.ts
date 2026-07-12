import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RemoteEnvelope } from "../storage/jsonHostingStorage";
import { STORAGE_KEY } from "../storage/taskerStorage";
import { createExportPayload } from "../storage/taskerBackup";

const syncMocks = vi.hoisted(() => ({
  scheduleSave: vi.fn(),
  replaceLocal: undefined as ((envelope: RemoteEnvelope) => void) | undefined,
  confirmLocalSave: undefined as ((envelope: RemoteEnvelope) => void) | undefined,
  start: vi.fn(),
  stop: vi.fn(),
  setCredentials: vi.fn(),
  checkForRemoteUpdate: vi.fn()
}));

const creationMocks = vi.hoisted(() => ({ createJsonHostingDocument: vi.fn() }));

vi.mock("../storage/jsonHostingStorage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../storage/jsonHostingStorage")>()),
  createJsonHostingDocument: creationMocks.createJsonHostingDocument
}));

vi.mock("./jsonHostingSync", () => ({
  createJsonHostingSyncController: (options: {
    replaceLocal: (envelope: RemoteEnvelope) => void;
    confirmLocalSave: (envelope: RemoteEnvelope) => void;
  }) => {
    syncMocks.replaceLocal = options.replaceLocal;
    syncMocks.confirmLocalSave = options.confirmLocalSave;
    return {
      start: syncMocks.start,
      stop: syncMocks.stop,
      setCredentials: syncMocks.setCredentials,
      scheduleSave: syncMocks.scheduleSave,
      checkForRemoteUpdate: syncMocks.checkForRemoteUpdate
    };
  }
}));

import { resetTaskerStore, useTaskerStore } from "./taskerStore";

describe("taskerStore configuration and import actions", () => {
  beforeEach(() => {
    localStorage.clear();
    syncMocks.scheduleSave.mockReset();
    syncMocks.start.mockReset();
    syncMocks.stop.mockReset();
    syncMocks.setCredentials.mockReset();
    syncMocks.checkForRemoteUpdate.mockReset();
    creationMocks.createJsonHostingDocument.mockReset();
    resetTaskerStore();
  });

  it("persists locally before it schedules remote synchronization", () => {
    syncMocks.scheduleSave.mockImplementation((state) => {
      expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(state));
    });

    useTaskerStore.getState().configureJsonHosting({ documentId: "abc123", editKey: "secret" });
    useTaskerStore.getState().addCategory({ name: "Dom", color: "#40c057" });

    expect(localStorage.getItem(STORAGE_KEY)).toContain("Dom");
    expect(syncMocks.scheduleSave).toHaveBeenCalledWith(
      expect.objectContaining({ categories: [expect.objectContaining({ name: "Dom" })] })
    );
  });

  it("activates newly created credentials only after document creation succeeds", async () => {
    useTaskerStore.getState().configureJsonHosting({ documentId: "old-document", editKey: "old-key" });
    useTaskerStore.setState({ observedRemoteRevision: 7, observedRemoteUpdatedAt: "2026-07-12T09:00:00.000Z" });
    const originalState = useTaskerStore.getState().state;
    const credentials = { documentId: "new-document", editKey: "new-key" };
    const updatedAt = "2026-07-12T11:00:00.000Z";
    let resolveCreation: (value: { credentials: typeof credentials; envelope: RemoteEnvelope }) => void;
    creationMocks.createJsonHostingDocument.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreation = resolve;
        })
    );
    syncMocks.start.mockReset();
    syncMocks.stop.mockReset();
    syncMocks.setCredentials.mockReset();
    syncMocks.checkForRemoteUpdate.mockReset();

    const creation = useTaskerStore.getState().createJsonHostingDocument();

    expect(useTaskerStore.getState()).toMatchObject({
      jsonHostingCredentials: { documentId: "old-document", editKey: "old-key" },
      state: originalState,
      observedRemoteRevision: 7,
      observedRemoteUpdatedAt: "2026-07-12T09:00:00.000Z",
      jsonHostingStatus: { kind: "syncing" }
    });
    expect(syncMocks.stop).not.toHaveBeenCalled();

    resolveCreation!({
      credentials,
      envelope: { version: 1, revision: 0, updatedAt, state: originalState }
    });
    await creation;

    expect(creationMocks.createJsonHostingDocument).toHaveBeenCalledWith(originalState, expect.any(String));
    expect(useTaskerStore.getState()).toMatchObject({
      jsonHostingCredentials: credentials,
      observedRemoteRevision: 0,
      observedRemoteUpdatedAt: updatedAt
    });
    expect(localStorage.getItem("tasker:jsonhosting:v1")).toBe(JSON.stringify(credentials));
    expect(syncMocks.stop).toHaveBeenCalledOnce();
    expect(syncMocks.setCredentials).toHaveBeenCalledWith(credentials);
    expect(syncMocks.start).toHaveBeenCalledOnce();
    expect(syncMocks.checkForRemoteUpdate).toHaveBeenCalledOnce();
    expect(syncMocks.stop.mock.invocationCallOrder[0]).toBeLessThan(syncMocks.setCredentials.mock.invocationCallOrder[0]);
    expect(syncMocks.setCredentials.mock.invocationCallOrder[0]).toBeLessThan(syncMocks.start.mock.invocationCallOrder[0]);
  });

  it("preserves the existing connection and metadata when document creation fails", async () => {
    const credentials = { documentId: "old-document", editKey: "old-key" };
    useTaskerStore.getState().configureJsonHosting(credentials);
    useTaskerStore.setState({ observedRemoteRevision: 7, observedRemoteUpdatedAt: "2026-07-12T09:00:00.000Z" });
    const originalState = useTaskerStore.getState().state;
    creationMocks.createJsonHostingDocument.mockRejectedValue(new Error("Creation failed"));
    syncMocks.start.mockReset();
    syncMocks.stop.mockReset();
    syncMocks.setCredentials.mockReset();
    syncMocks.checkForRemoteUpdate.mockReset();

    await useTaskerStore.getState().createJsonHostingDocument();

    expect(useTaskerStore.getState()).toMatchObject({
      jsonHostingCredentials: credentials,
      state: originalState,
      observedRemoteRevision: 7,
      observedRemoteUpdatedAt: "2026-07-12T09:00:00.000Z",
      jsonHostingStatus: { kind: "error", message: "Creation failed" }
    });
    expect(localStorage.getItem("tasker:jsonhosting:v1")).toBe(JSON.stringify(credentials));
    expect(syncMocks.stop).not.toHaveBeenCalled();
    expect(syncMocks.setCredentials).not.toHaveBeenCalled();
    expect(syncMocks.start).not.toHaveBeenCalled();
    expect(syncMocks.checkForRemoteUpdate).not.toHaveBeenCalled();
  });

  it("persists a remote state loaded by the coordinator", () => {
    const remoteEnvelope: RemoteEnvelope = {
      version: 1,
      revision: 4,
      updatedAt: "2026-07-12T10:00:00.000Z",
      state: {
        ...useTaskerStore.getState().state,
        categories: [{ id: "category-remote", name: "Zdalne", color: "#228be6" }]
      }
    };

    syncMocks.replaceLocal?.(remoteEnvelope);

    expect(useTaskerStore.getState().state).toEqual(remoteEnvelope.state);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(remoteEnvelope.state));
    expect(useTaskerStore.getState()).toMatchObject({
      observedRemoteRevision: remoteEnvelope.revision,
      observedRemoteUpdatedAt: remoteEnvelope.updatedAt
    });
  });

  it("advances the observed remote metadata after the coordinator confirms a local write", () => {
    syncMocks.confirmLocalSave?.({
      version: 1,
      revision: 5,
      updatedAt: "2026-07-12T10:03:00.000Z",
      state: useTaskerStore.getState().state
    });

    expect(useTaskerStore.getState()).toMatchObject({
      observedRemoteRevision: 5,
      observedRemoteUpdatedAt: "2026-07-12T10:03:00.000Z"
    });
  });

  it("persists configuration changes", () => {
    useTaskerStore.getState().addCategory({ name: " Dom ", color: "#40c057" });
    useTaskerStore.getState().addTaskType({ name: "Termin" });
    useTaskerStore.getState().addPriority({ name: "Pilny", color: "#fa5252" });

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");

    expect(stored.categories[0]).toMatchObject({ name: "Dom", color: "#40c057" });
    expect(stored.taskTypes.some((item: { name: string }) => item.name === "Termin")).toBe(true);
    expect(stored.priorities.some((item: { name: string; color?: string }) => item.name === "Pilny" && item.color === "#fa5252")).toBe(
      true
    );
  });

  it("previews import without overwriting current data", () => {
    useTaskerStore.getState().addCategory({ name: "Dom", color: "#40c057" });
    const current = useTaskerStore.getState().state;
    const preview = useTaskerStore
      .getState()
      .previewImport(JSON.stringify(createExportPayload({ ...current, categories: [] }, "2026-07-07T08:00:00.000Z")));

    expect(preview.summary.categoryCount).toBe(0);
    expect(useTaskerStore.getState().state.categories).toEqual([{ id: expect.any(String), name: "Dom", color: "#40c057" }]);
  });

  it("applies import only from a valid preview", () => {
    useTaskerStore.getState().addCategory({ name: "Dom", color: "#40c057" });
    const importedState = { ...useTaskerStore.getState().state, categories: [{ id: "cat-work", name: "Praca", color: "#228be6" }] };
    const preview = useTaskerStore.getState().previewImport(JSON.stringify(createExportPayload(importedState, "2026-07-07T08:00:00.000Z")));

    useTaskerStore.getState().applyImport(preview);

    expect(useTaskerStore.getState().state.categories).toEqual([{ id: "cat-work", name: "Praca", color: "#228be6" }]);
    expect(localStorage.getItem(STORAGE_KEY)).toContain("Praca");
  });
});

describe("taskerStore calendar state", () => {
  beforeEach(() => {
    localStorage.clear();
    resetTaskerStore();
  });

  it("stores the selected calendar date", () => {
    useTaskerStore.getState().setSelectedCalendarDate("2026-07-20");

    expect(useTaskerStore.getState().selectedCalendarDate).toBe("2026-07-20");
  });

  it("postpones a task to an arbitrary date and persists the change", () => {
    useTaskerStore.getState().addTask(
      {
        title: "Podlac rosliny",
        categoryName: "Dom",
        assigneeName: "Ola",
        schedule: { mode: "oneTime", date: "2026-07-08" },
        active: true
      },
      new Date("2026-07-05T08:00:00.000Z")
    );

    const taskId = useTaskerStore.getState().state.tasks[0].id;
    useTaskerStore
      .getState()
      .postponeTaskToDate(taskId, "2026-07-08", "2026-07-20", new Date("2026-07-08T08:00:00.000Z"));

    expect(useTaskerStore.getState().state.postponements[0]).toMatchObject({
      taskId,
      fromDate: "2026-07-08",
      toDate: "2026-07-20"
    });
    expect(localStorage.getItem(STORAGE_KEY)).toContain("2026-07-20");
  });
});

describe("taskerStore JSONHosting controller integration", () => {
  it("patches consecutive mutations at successive remote revisions", async () => {
    vi.useFakeTimers();
    vi.doUnmock("./jsonHostingSync");
    vi.resetModules();
    localStorage.clear();
    const { resetTaskerStore: resetRealStore, useTaskerStore: useRealStore } = await import("./taskerStore");
    resetRealStore();
    let remote: RemoteEnvelope = {
      version: 1,
      revision: 0,
      updatedAt: "2026-07-12T10:00:00.000Z",
      state: useRealStore.getState().state
    };
    const patchedEnvelopes: RemoteEnvelope[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === "PATCH") {
          remote = JSON.parse(init.body as string) as RemoteEnvelope;
          patchedEnvelopes.push(remote);
          return { ok: true } as Response;
        }
        return { ok: true, json: async () => remote } as Response;
      })
    );

    useRealStore.getState().configureJsonHosting({ documentId: "abc123", editKey: "secret" });
    await vi.advanceTimersByTimeAsync(0);
    useRealStore.getState().addCategory({ name: "Dom", color: "#40c057" });
    await vi.advanceTimersByTimeAsync(750);
    useRealStore.getState().addTaskType({ name: "Termin" });
    await vi.advanceTimersByTimeAsync(750);

    expect(patchedEnvelopes).toHaveLength(2);
    expect(patchedEnvelopes.map((envelope) => envelope.revision)).toEqual([1, 2]);
    expect(useRealStore.getState().state).toEqual(patchedEnvelopes[1].state);

    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
});
