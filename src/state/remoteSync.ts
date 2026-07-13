import type { AppState } from "../domain/types";

export const SAVE_DEBOUNCE_MS = 1_000;
export const POLL_INTERVAL_MS = 60_000;

export type RemoteEnvelope = {
  version: 1;
  revision: number;
  updatedAt: string;
  state: AppState;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isArrayProperty(value: Record<string, unknown>, key: string): boolean {
  return Array.isArray(value[key]);
}

function isAppState(value: unknown): value is AppState {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isArrayProperty(value, "tasks") &&
    isArrayProperty(value, "categories") &&
    isArrayProperty(value, "assignees") &&
    isArrayProperty(value, "taskTypes") &&
    isArrayProperty(value, "priorities") &&
    isArrayProperty(value, "completions") &&
    isArrayProperty(value, "postponements")
  );
}

function isParseableIsoDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

export function parseRemoteEnvelope(value: unknown): RemoteEnvelope {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    typeof value.revision !== "number" ||
    !Number.isInteger(value.revision) ||
    value.revision < 0 ||
    !isParseableIsoDate(value.updatedAt) ||
    !isAppState(value.state)
  ) {
    throw new Error("Niepoprawna koperta danych zdalnych.");
  }

  return value as RemoteEnvelope;
}

export type RemoteSyncStatus =
  | { kind: "disconnected" }
  | { kind: "checking" }
  | { kind: "syncing" }
  | { kind: "synced"; at: string }
  | { kind: "remote-loaded"; at: string }
  | { kind: "error"; message: string };

export type RemoteSyncStorage<C> = {
  getRemoteEnvelope(credentials: C): Promise<RemoteEnvelope>;
  putRemoteEnvelope(credentials: C, envelope: RemoteEnvelope): Promise<void>;
};

export type RemoteSyncController<C> = {
  start(): void;
  stop(): void;
  setCredentials(credentials: C | undefined): void;
  scheduleSave(state: AppState): void;
  checkForRemoteUpdate(): void;
};

export type RemoteSyncOptions<C> = {
  credentials?: C;
  storage: RemoteSyncStorage<C>;
  getLocalSnapshot(): { state: AppState; observedRevision: number; updatedAt: string };
  replaceLocal(envelope: RemoteEnvelope): void;
  confirmLocalSave(envelope: RemoteEnvelope): void;
  setStatus(status: RemoteSyncStatus): void;
};

export function isRemoteNewer(remote: RemoteEnvelope, observedRevision: number, updatedAt: string): boolean {
  return remote.revision > observedRevision || (remote.revision === observedRevision && remote.updatedAt > updatedAt);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Nie mozna zsynchronizowac danych zdalnych.";
}

export function createRemoteSyncController<C>(options: RemoteSyncOptions<C>): RemoteSyncController<C> {
  let credentials = options.credentials;
  let debounceTimeout: ReturnType<typeof setTimeout> | undefined;
  let pollingInterval: ReturnType<typeof setInterval> | undefined;
  let inFlight: Promise<void> | undefined;
  let pendingState: AppState | undefined;
  let started = false;
  let credentialGeneration = 0;

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

  function areCredentialsCurrent(activeCredentials: C, activeGeneration: number): boolean {
    return credentials === activeCredentials && credentialGeneration === activeGeneration;
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
    const activeGeneration = credentialGeneration;
    beginRequest(async () => {
      options.setStatus({ kind: "checking" });
      try {
        const remote = await options.storage.getRemoteEnvelope(activeCredentials);
        if (!areCredentialsCurrent(activeCredentials, activeGeneration)) {
          return;
        }
        const local = options.getLocalSnapshot();
        if (isRemoteNewer(remote, local.observedRevision, local.updatedAt)) {
          replaceWithRemote(remote);
          return;
        }
        options.setStatus({ kind: "synced", at: remote.updatedAt });
      } catch (error) {
        if (areCredentialsCurrent(activeCredentials, activeGeneration)) {
          options.setStatus({ kind: "error", message: errorMessage(error) });
        }
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
    const activeGeneration = credentialGeneration;
    beginRequest(async () => {
      options.setStatus({ kind: "checking" });
      try {
        const remote = await options.storage.getRemoteEnvelope(activeCredentials);
        if (!areCredentialsCurrent(activeCredentials, activeGeneration)) {
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
        await options.storage.putRemoteEnvelope(activeCredentials, nextEnvelope);
        if (!areCredentialsCurrent(activeCredentials, activeGeneration)) {
          return;
        }

        const storedEnvelope = await options.storage.getRemoteEnvelope(activeCredentials);
        if (!areCredentialsCurrent(activeCredentials, activeGeneration)) {
          return;
        }
        if (isRemoteNewer(storedEnvelope, nextEnvelope.revision, nextEnvelope.updatedAt)) {
          replaceWithRemote(storedEnvelope);
          return;
        }
        if (pendingState === stateToSave) {
          pendingState = undefined;
        }
        options.confirmLocalSave(nextEnvelope);
        options.setStatus({ kind: "synced", at: nextEnvelope.updatedAt });
      } catch (error) {
        if (areCredentialsCurrent(activeCredentials, activeGeneration)) {
          options.setStatus({ kind: "error", message: errorMessage(error) });
        }
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

  function setCredentials(nextCredentials: C | undefined): void {
    credentialGeneration += 1;
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
