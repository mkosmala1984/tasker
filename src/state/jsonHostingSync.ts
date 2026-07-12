import type { AppState } from "../domain/types";
import {
  getRemoteEnvelope as getRemoteEnvelopeFromStorage,
  patchRemoteEnvelope as patchRemoteEnvelopeFromStorage,
  type JsonHostingCredentials,
  type RemoteEnvelope
} from "../storage/jsonHostingStorage";

const SAVE_DEBOUNCE_MS = 750;
const POLL_INTERVAL_MS = 60_000;

export type JsonHostingSyncStatus =
  | { kind: "disconnected" }
  | { kind: "checking" }
  | { kind: "syncing" }
  | { kind: "synced"; at: string }
  | { kind: "remote-loaded"; at: string }
  | { kind: "error"; message: string };

export type LocalSnapshot = {
  state: AppState;
  observedRevision: number;
  updatedAt: string;
};

export type JsonHostingSyncController = {
  start(): void;
  stop(): void;
  setCredentials(credentials: JsonHostingCredentials | undefined): void;
  scheduleSave(state: AppState): void;
  checkForRemoteUpdate(): void;
};

export type JsonHostingSyncOptions = {
  credentials?: JsonHostingCredentials;
  getLocalSnapshot(): LocalSnapshot;
  replaceLocal(envelope: RemoteEnvelope): void;
  setStatus(status: JsonHostingSyncStatus): void;
  getRemoteEnvelope?(credentials: JsonHostingCredentials): Promise<RemoteEnvelope>;
  patchRemoteEnvelope?(credentials: JsonHostingCredentials, envelope: RemoteEnvelope): Promise<void>;
};

export function isRemoteNewer(remote: RemoteEnvelope, observedRevision: number, updatedAt: string): boolean {
  return remote.revision > observedRevision || (remote.revision === observedRevision && remote.updatedAt > updatedAt);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Nie mozna zsynchronizowac danych z JSONHosting.";
}

export function createJsonHostingSyncController(options: JsonHostingSyncOptions): JsonHostingSyncController {
  let credentials = options.credentials;
  let debounceTimeout: ReturnType<typeof setTimeout> | undefined;
  let pollingInterval: ReturnType<typeof setInterval> | undefined;
  let inFlight: Promise<void> | undefined;
  let pendingState: AppState | undefined;
  let started = false;

  const getRemoteEnvelope = options.getRemoteEnvelope ?? getRemoteEnvelopeFromStorage;
  const patchRemoteEnvelope = options.patchRemoteEnvelope ?? patchRemoteEnvelopeFromStorage;

  function clearDebounce(): void {
    if (debounceTimeout !== undefined) {
      clearTimeout(debounceTimeout);
      debounceTimeout = undefined;
    }
  }

  function clearPolling(): void {
    if (pollingInterval !== undefined) {
      clearInterval(pollingInterval);
      pollingInterval = undefined;
    }
  }

  function replaceWithRemote(remote: RemoteEnvelope): void {
    pendingState = undefined;
    clearDebounce();
    options.replaceLocal(remote);
    options.setStatus({ kind: "remote-loaded", at: remote.updatedAt });
  }

  function beginRequest(action: () => Promise<void>): void {
    const request = action();
    inFlight = request;
    void request.finally(() => {
      if (inFlight === request) {
        inFlight = undefined;
      }
    });
  }

  function checkForRemoteUpdate(): void {
    if (credentials === undefined || inFlight !== undefined) {
      return;
    }

    const activeCredentials = credentials;
    beginRequest(async () => {
      options.setStatus({ kind: "checking" });
      try {
        const remote = await getRemoteEnvelope(activeCredentials);
        if (credentials !== activeCredentials) {
          return;
        }
        const local = options.getLocalSnapshot();
        if (isRemoteNewer(remote, local.observedRevision, local.updatedAt)) {
          replaceWithRemote(remote);
          return;
        }
        options.setStatus({ kind: "synced", at: remote.updatedAt });
      } catch (error) {
        options.setStatus({ kind: "error", message: errorMessage(error) });
      }
    });
  }

  function scheduleDebounce(): void {
    clearDebounce();
    debounceTimeout = setTimeout(() => {
      debounceTimeout = undefined;
      savePendingState();
    }, SAVE_DEBOUNCE_MS);
  }

  function savePendingState(): void {
    if (pendingState === undefined || credentials === undefined) {
      return;
    }
    if (inFlight !== undefined) {
      scheduleDebounce();
      return;
    }

    const stateToSave = pendingState;
    const activeCredentials = credentials;
    beginRequest(async () => {
      options.setStatus({ kind: "checking" });
      try {
        const remote = await getRemoteEnvelope(activeCredentials);
        if (credentials !== activeCredentials) {
          return;
        }
        const local = options.getLocalSnapshot();
        if (isRemoteNewer(remote, local.observedRevision, local.updatedAt)) {
          replaceWithRemote(remote);
          return;
        }

        const nextEnvelope: RemoteEnvelope = {
          version: 1,
          revision: remote.revision + 1,
          updatedAt: new Date().toISOString(),
          state: stateToSave
        };
        options.setStatus({ kind: "syncing" });
        await patchRemoteEnvelope(activeCredentials, nextEnvelope);
        if (credentials !== activeCredentials) {
          return;
        }
        if (pendingState === stateToSave) {
          pendingState = undefined;
        }
        options.setStatus({ kind: "synced", at: nextEnvelope.updatedAt });
      } catch (error) {
        options.setStatus({ kind: "error", message: errorMessage(error) });
      }
    });
  }

  function start(): void {
    if (started) {
      return;
    }
    started = true;
    if (credentials === undefined) {
      options.setStatus({ kind: "disconnected" });
      return;
    }
    pollingInterval = setInterval(checkForRemoteUpdate, POLL_INTERVAL_MS);
  }

  function stop(): void {
    started = false;
    clearDebounce();
    clearPolling();
  }

  function setCredentials(nextCredentials: JsonHostingCredentials | undefined): void {
    credentials = nextCredentials;
    pendingState = undefined;
    clearDebounce();
    clearPolling();
    if (credentials === undefined) {
      options.setStatus({ kind: "disconnected" });
      return;
    }
    if (started) {
      pollingInterval = setInterval(checkForRemoteUpdate, POLL_INTERVAL_MS);
    }
  }

  function scheduleSave(state: AppState): void {
    if (credentials === undefined) {
      return;
    }
    pendingState = state;
    scheduleDebounce();
  }

  return { start, stop, setCredentials, scheduleSave, checkForRemoteUpdate };
}
