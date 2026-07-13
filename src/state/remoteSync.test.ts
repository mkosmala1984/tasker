import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppState } from "../domain/types";
import { createEmptyState } from "../storage/taskerStorage";
import { createRemoteSyncController, type RemoteEnvelope, type RemoteSyncStatus } from "./remoteSync";

type TestCredentials = { token: string };

const credentials: TestCredentials = { token: "token-1" };
const baseState = createEmptyState();
const changedState: AppState = { ...baseState, categories: [{ id: "category-1", name: "First", color: "#111111" }] };

function envelope(revision: number): RemoteEnvelope {
  return { version: 1, revision, updatedAt: "2026-07-12T10:00:00.000Z", state: baseState };
}

describe("remoteSync", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("writes the next revision after the one-second debounce", async () => {
    vi.useFakeTimers();
    const storage = {
      getRemoteEnvelope: vi.fn<(activeCredentials: TestCredentials) => Promise<RemoteEnvelope>>(),
      putRemoteEnvelope: vi.fn<(activeCredentials: TestCredentials, remote: RemoteEnvelope) => Promise<void>>()
    };
    storage.getRemoteEnvelope.mockResolvedValue(envelope(3));
    storage.putRemoteEnvelope.mockResolvedValue();
    const controller = createRemoteSyncController({
      credentials,
      storage,
      getLocalSnapshot: () => ({ state: baseState, observedRevision: 3, updatedAt: "2026-07-12T10:00:00.000Z" }),
      replaceLocal: vi.fn(),
      confirmLocalSave: vi.fn(),
      setStatus: vi.fn<(status: RemoteSyncStatus) => void>()
    });

    controller.scheduleSave(changedState);
    await vi.advanceTimersByTimeAsync(1_000);

    expect(storage.putRemoteEnvelope).toHaveBeenCalledWith(credentials, expect.objectContaining({ revision: 4 }));
  });
});
