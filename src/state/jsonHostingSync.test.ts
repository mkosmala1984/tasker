import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppState } from "../domain/types";
import type { JsonHostingCredentials, RemoteEnvelope } from "../storage/jsonHostingStorage";
import { createEmptyState } from "../storage/taskerStorage";
import {
  createJsonHostingSyncController,
  isRemoteNewer,
  type JsonHostingSyncStatus
} from "./jsonHostingSync";

const credentials: JsonHostingCredentials = { documentId: "document-1", editKey: "edit-key" };
const baseState = createEmptyState();
const changedState: AppState = { ...baseState, categories: [{ id: "category-1", name: "First", color: "#111111" }] };
const laterChangedState: AppState = { ...changedState, categories: [{ id: "category-2", name: "Later", color: "#222222" }] };
const remoteState: AppState = { ...baseState, categories: [{ id: "category-3", name: "Remote", color: "#333333" }] };

function envelope(revision: number, updatedAt = "2026-07-12T10:00:00.000Z", state = baseState): RemoteEnvelope {
  return { version: 1, revision, updatedAt, state };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createController(snapshot = { observedRevision: 3, updatedAt: "2026-07-12T10:00:00.000Z" }) {
  const getRemoteEnvelope = vi.fn<(credentials: JsonHostingCredentials) => Promise<RemoteEnvelope>>();
  const patchRemoteEnvelope = vi.fn<(credentials: JsonHostingCredentials, remote: RemoteEnvelope) => Promise<void>>();
  const replaceLocal = vi.fn();
  const setStatus = vi.fn<(status: JsonHostingSyncStatus) => void>();
  const controller = createJsonHostingSyncController({
    credentials,
    getLocalSnapshot: () => ({ state: baseState, ...snapshot }),
    replaceLocal,
    setStatus,
    getRemoteEnvelope,
    patchRemoteEnvelope
  });

  return { controller, getRemoteEnvelope, patchRemoteEnvelope, replaceLocal, setStatus };
}

describe("jsonHostingSync", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("coalesces mutations into one GET-before-PATCH after 750 ms", async () => {
    vi.useFakeTimers();
    const { controller, getRemoteEnvelope, patchRemoteEnvelope } = createController();
    getRemoteEnvelope.mockResolvedValue(envelope(3));
    patchRemoteEnvelope.mockResolvedValue();

    controller.scheduleSave(changedState);
    controller.scheduleSave(laterChangedState);
    await vi.advanceTimersByTimeAsync(750);

    expect(getRemoteEnvelope).toHaveBeenCalledTimes(2);
    expect(patchRemoteEnvelope).toHaveBeenCalledWith(credentials, expect.objectContaining({ revision: 4, state: laterChangedState }));
  });

  it("loads remote data and skips PATCH when preflight is newer", async () => {
    vi.useFakeTimers();
    const { controller, getRemoteEnvelope, patchRemoteEnvelope, replaceLocal } = createController();
    getRemoteEnvelope.mockResolvedValue(envelope(4, "2026-07-12T10:02:00.000Z", remoteState));

    controller.scheduleSave(changedState);
    await vi.advanceTimersByTimeAsync(750);

    expect(replaceLocal).toHaveBeenCalledWith(expect.objectContaining({ revision: 4, state: remoteState }));
    expect(patchRemoteEnvelope).not.toHaveBeenCalled();
  });

  it("loads the remote winner when it changes after a successful PATCH", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-12T10:01:00.000Z"));
    const { controller, getRemoteEnvelope, patchRemoteEnvelope, replaceLocal, setStatus } = createController();
    const remoteWinner = envelope(4, "2026-07-12T10:03:00.000Z", remoteState);
    getRemoteEnvelope.mockResolvedValueOnce(envelope(3)).mockResolvedValueOnce(remoteWinner);
    patchRemoteEnvelope.mockResolvedValue();

    controller.scheduleSave(changedState);
    await vi.advanceTimersByTimeAsync(750);

    expect(getRemoteEnvelope).toHaveBeenCalledTimes(2);
    expect(replaceLocal).toHaveBeenCalledWith(remoteWinner);
    expect(setStatus).toHaveBeenLastCalledWith({ kind: "remote-loaded", at: remoteWinner.updatedAt });
  });

  it("polls once per minute and stop clears polling", async () => {
    vi.useFakeTimers();
    const { controller, getRemoteEnvelope } = createController({ observedRevision: 1, updatedAt: "2026-07-12T10:00:00.000Z" });
    getRemoteEnvelope.mockResolvedValue(envelope(1));

    controller.start();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(getRemoteEnvelope).toHaveBeenCalledTimes(1);
    controller.stop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(getRemoteEnvelope).toHaveBeenCalledTimes(1);
  });

  it("detects newer revisions and timestamps without treating older or equal envelopes as newer", () => {
    expect(isRemoteNewer(envelope(4), 3, "2026-07-12T10:00:00.000Z")).toBe(true);
    expect(isRemoteNewer(envelope(3, "2026-07-12T10:01:00.000Z"), 3, "2026-07-12T10:00:00.000Z")).toBe(true);
    expect(isRemoteNewer(envelope(3), 3, "2026-07-12T10:00:00.000Z")).toBe(false);
    expect(isRemoteNewer(envelope(2), 3, "2026-07-12T10:00:00.000Z")).toBe(false);
  });

  it("keeps local data intact and reports an error when GET or PATCH fails", async () => {
    vi.useFakeTimers();
    const getFailure = createController();
    getFailure.getRemoteEnvelope.mockRejectedValue(new Error("GET failed"));
    getFailure.controller.scheduleSave(changedState);
    await vi.advanceTimersByTimeAsync(750);
    expect(getFailure.replaceLocal).not.toHaveBeenCalled();
    expect(getFailure.setStatus).toHaveBeenLastCalledWith({ kind: "error", message: "GET failed" });

    const patchFailure = createController();
    patchFailure.getRemoteEnvelope.mockResolvedValue(envelope(3));
    patchFailure.patchRemoteEnvelope.mockRejectedValue(new Error("PATCH failed"));
    patchFailure.controller.scheduleSave(changedState);
    await vi.advanceTimersByTimeAsync(750);
    expect(patchFailure.replaceLocal).not.toHaveBeenCalled();
    expect(patchFailure.setStatus).toHaveBeenLastCalledWith({ kind: "error", message: "PATCH failed" });
  });

  it("clears a pending save when credentials are removed", async () => {
    vi.useFakeTimers();
    const { controller, getRemoteEnvelope, setStatus } = createController();

    controller.scheduleSave(changedState);
    controller.setCredentials(undefined);
    await vi.advanceTimersByTimeAsync(750);

    expect(getRemoteEnvelope).not.toHaveBeenCalled();
    expect(setStatus).toHaveBeenLastCalledWith({ kind: "disconnected" });
  });

  it("does not overlap a poll with an unresolved save preflight", async () => {
    vi.useFakeTimers();
    const pendingGet = deferred<RemoteEnvelope>();
    const { controller, getRemoteEnvelope } = createController();
    getRemoteEnvelope.mockReturnValue(pendingGet.promise);

    controller.start();
    controller.scheduleSave(changedState);
    await vi.advanceTimersByTimeAsync(750);
    await vi.advanceTimersByTimeAsync(60_000);

    expect(getRemoteEnvelope).toHaveBeenCalledTimes(1);
    pendingGet.resolve(envelope(3));
    await Promise.resolve();
    controller.stop();
  });
});
