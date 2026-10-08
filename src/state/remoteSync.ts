import { mergeOperations } from "../domain/syncMerge";
import { isValidState } from "../domain/stateValidation";
import { SyncJournal, type JournalRecord } from "../storage/syncJournal";
import {
  PermanentSyncError,
  RemoteConflictError,
  RemoteMissingError,
  type RemoteDocument,
  type RemoteEnvelope,
  type WriteCondition,
} from "../storage/syncEnvelope";
export { parseRemoteEnvelope } from "../storage/syncEnvelope";
export type { RemoteEnvelope } from "../storage/syncEnvelope";
export type RemoteSyncStatus =
  | {
      kind:
        | "disconnected"
        | "checking"
        | "syncing"
        | "local"
        | "pending"
        | "conflict";
    }
  | { kind: "synced"; at: string }
  | { kind: "error"; message: string };
export type RemoteSyncStorage<C> = {
  getRemoteEnvelope: (credentials: C) => Promise<RemoteDocument>;
  putRemoteEnvelope: (
    credentials: C,
    envelope: RemoteEnvelope,
    condition: WriteCondition,
  ) => Promise<void>;
};
export type RemoteSyncController<C> = {
  start: () => void;
  stop: () => void;
  setCredentials: (credentials?: C, dataset?: string) => void;
  scheduleSave: () => void;
  checkForRemoteUpdate: () => void;
  syncNow: () => Promise<void>;
};
type Options<C> = {
  credentials?: C;
  dataset: string;
  journal: Pick<SyncJournal, "read" | "acceptRemote">;
  storage: RemoteSyncStorage<C>;
  setStatus: (status: RemoteSyncStatus) => void;
  onChange: (record: JournalRecord) => void;
};
export function createRemoteSyncController<C>(
  options: Options<C>,
): RemoteSyncController<C> {
  let credentials = options.credentials,
    dataset = options.dataset,
    generation = 0,
    started = false,
    failures = 0;
  let inFlight: Promise<void> | undefined,
    timer: ReturnType<typeof setTimeout> | undefined,
    poll: ReturnType<typeof setInterval> | undefined,
    blockedPermanent = false;
  const clear = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  const schedule = (delay: number) => {
    clear();
    if (started && credentials && !blockedPermanent)
      timer = setTimeout(() => {
        void syncNow();
      }, delay);
  };
  async function run() {
    if (!credentials) return;
    const activeCredentials = credentials,
      activeDataset = dataset,
      activeGeneration = generation;
    const active = () => generation === activeGeneration;
    options.setStatus({ kind: "checking" });
    try {
      for (let attempt = 0; attempt < 5 && active(); attempt++) {
        let document: RemoteDocument | undefined;
        try {
          document = await options.storage.getRemoteEnvelope(activeCredentials);
        } catch (error) {
          if (!(error instanceof RemoteMissingError)) throw error;
        }
        if (!active()) return;
        let record = await options.journal.read(activeDataset);
        if (document)
          record = await options.journal.acceptRemote(activeDataset, document);
        else if (record.remote)
          throw new PermanentSyncError(
            "Zdalny obiekt został usunięty. Dane lokalne zachowano; wybierz nowy obiekt.",
          );
        if (!active()) return;
        options.onChange(record);
        const merged = mergeOperations(record.baseline, record.operations);
        const sending = merged.appliedIds;
        const migrationNeeded = document?.envelope.version === 1;
        if (!sending.length && document && !migrationNeeded) {
          options.setStatus(
            record.conflicts.length
              ? { kind: "conflict" }
              : record.operations.length
                ? { kind: "pending" }
                : { kind: "synced", at: document.envelope.updatedAt },
          );
          failures = 0;
          return;
        }
        const state = merged.state;
        if (!isValidState(state))
          throw new PermanentSyncError(
            "Połączenie zmian utworzyłoby niepoprawne odwołania. Zachowano dziennik i przerwano zapis.",
          );
        const envelope: RemoteEnvelope = {
          version: 2,
          revision: (document?.envelope.revision ?? 0) + 1,
          updatedAt: new Date().toISOString(),
          state,
          appliedOperationIds: [
            ...new Set([
              ...(document?.envelope.appliedOperationIds ?? []),
              ...sending,
            ]),
          ],
        };
        options.setStatus({ kind: "syncing" });
        try {
          await options.storage.putRemoteEnvelope(
            activeCredentials,
            envelope,
            document ? { etag: document.etag } : { create: true },
          );
        } catch (error) {
          if (error instanceof RemoteConflictError) continue;
          throw error;
        }
        if (!active()) return;
        // Read the server version and its acknowledgements. A later writer may already have advanced it.
        const confirmed =
          await options.storage.getRemoteEnvelope(activeCredentials);
        if (!active()) return;
        if (
          confirmed.envelope.revision < envelope.revision ||
          sending.some(
            (id) => !confirmed.envelope.appliedOperationIds?.includes(id),
          )
        )
          throw new Error(
            "Usługa nie potwierdziła wysłanych operacji. Zmiany pozostają w kolejce.",
          );
        record = await options.journal.acceptRemote(
          activeDataset,
          confirmed,
          !document,
        );
        if (!active()) return;
        options.onChange(record);
        failures = 0;
        options.setStatus(
          record.conflicts.length
            ? { kind: "conflict" }
            : record.operations.length
              ? { kind: "pending" }
              : { kind: "synced", at: confirmed.envelope.updatedAt },
        );
        if (record.operations.length && !record.conflicts.length)
          schedule(1000);
        return;
      }
      if (active()) {
        options.setStatus({ kind: "pending" });
        schedule(1000 + Math.random() * 1000);
      }
    } catch (error) {
      if (!active()) return;
      options.setStatus({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Nie mozna zsynchronizowac danych zdalnych.",
      });
      if (error instanceof PermanentSyncError) blockedPermanent = true;
      else
        schedule(
          Math.min(
            60000,
            1000 * 2 ** Math.min(failures++, 6) + Math.random() * 500,
          ),
        );
    }
  }
  function syncNow(): Promise<void> {
    if (inFlight) {
      schedule(1000);
      return inFlight;
    }
    clear();
    const promise = run().finally(() => {
      if (inFlight === promise) inFlight = undefined;
    });
    inFlight = promise;
    return promise;
  }
  const wake = () => {
    if (started && !blockedPermanent) void syncNow();
  };
  return {
    syncNow,
    start() {
      if (started) return;
      started = true;
      poll = setInterval(wake, 60000);
      window.addEventListener("online", wake);
      window.addEventListener("focus", wake);
    },
    stop() {
      started = false;
      generation++;
      clear();
      clearInterval(poll);
      window.removeEventListener("online", wake);
      window.removeEventListener("focus", wake);
    },
    setCredentials(next, nextDataset = dataset) {
      generation++;
      credentials = next;
      dataset = nextDataset;
      blockedPermanent = false;
      failures = 0;
      clear();
    },
    scheduleSave() {
      options.setStatus(credentials ? { kind: "pending" } : { kind: "local" });
      schedule(1000);
    },
    checkForRemoteUpdate: wake,
  };
}
