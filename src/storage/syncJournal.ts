import type { AppState } from "../domain/types";
import {
  createOperation,
  equal,
  type SyncConflict,
  type SyncOperation,
} from "../domain/syncOperations";
import { mergeOperations } from "../domain/syncMerge";
import { isValidState } from "../domain/stateValidation";
import type { RemoteDocument } from "./syncEnvelope";
import { createEmptyState } from "./taskerStorage";

export type JournalRecord = {
  dataset: string;
  baseline: AppState;
  remote?: RemoteDocument;
  operations: SyncOperation[];
  state: AppState;
  conflicts: SyncConflict[];
  version: number;
  unbound: boolean;
  migrationBackup?: { local: AppState; remote: AppState };
};
export class JournalMissingError extends Error {
  constructor() {
    super("Dziennik nie został otwarty.");
  }
}
function project(record: JournalRecord) {
  const merged = mergeOperations(record.baseline, record.operations);
  record.state = merged.projected;
  record.conflicts = merged.conflicts;
  return record;
}
export class SyncJournal {
  private database?: Promise<IDBDatabase>;
  constructor(private name = "tasker-sync-v2") {}
  private open() {
    return (this.database ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(this.name, 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("datasets", { keyPath: "dataset" });
      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () =>
        reject(new Error("Zamknij starsze karty Taskera, aby otworzyć bazę."));
    }));
  }
  async close() {
    if (this.database) (await this.database).close();
    this.database = undefined;
  }
  async read(dataset: string): Promise<JournalRecord> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("datasets", "readonly");
      const request = tx.objectStore("datasets").get(dataset);
      request.onsuccess = () =>
        request.result
          ? resolve(request.result)
          : reject(new JournalMissingError());
      request.onerror = () => reject(request.error);
    });
  }
  private async transact(
    dataset: string,
    update: (current?: JournalRecord) => JournalRecord,
  ): Promise<JournalRecord> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("datasets", "readwrite"),
        store = tx.objectStore("datasets");
      let result: JournalRecord, failure: unknown;
      const request = store.get(dataset);
      request.onsuccess = () => {
        try {
          result = update(request.result);
          result.version += 1;
          store.put(result);
        } catch (error) {
          failure = error;
          tx.abort();
        }
      };
      tx.oncomplete = () => resolve(result);
      tx.onabort = tx.onerror = () =>
        reject(
          failure ??
            tx.error ??
            new Error("Nie można zapisać lokalnych danych."),
        );
    });
  }
  async initialize(dataset: string, initial: AppState): Promise<JournalRecord> {
    if (!isValidState(initial))
      throw new Error(
        "Niepoprawne dane lokalne; stara kopia pozostaje dostępna.",
      );
    return this.transact(
      dataset,
      (existing) =>
        existing ?? {
          dataset,
          baseline: initial,
          state: initial,
          operations: [],
          conflicts: [],
          version: 0,
          unbound: true,
        },
    );
  }
  async append(
    dataset: string,
    operation: SyncOperation,
    expectedVersion?: number,
  ) {
    return this.transact(dataset, (current) => {
      if (!current) throw new Error("Dziennik nie został otwarty.");
      if (expectedVersion !== undefined && current.version !== expectedVersion)
        throw new Error(
          "Dane zmieniły się. Sprawdź import i potwierdź ponownie.",
        );
      if (
        !current.operations.some((x) => x.id === operation.id) &&
        (operation.changes.length || operation.replacement)
      )
        current.operations.push(operation);
      return project(current);
    });
  }
  async acceptRemote(
    dataset: string,
    document: RemoteDocument,
    created = false,
  ) {
    return this.transact(dataset, (current) => {
      if (!current) throw new Error("Dziennik nie został otwarty.");
      const prev = current.remote?.envelope,
        next = document.envelope;
      if (prev && next.revision < prev.revision)
        throw new Error(
          "Odczytano starszą replikę. Zmiany lokalne pozostają zapisane.",
        );
      if (
        prev &&
        next.revision === prev.revision &&
        (!equal(prev.state, next.state) ||
          !equal(
            prev.appliedOperationIds ?? [],
            next.appliedOperationIds ?? [],
          ))
      )
        throw new Error(
          "Różne dane mają tę samą rewizję. Zatrzymano synchronizację.",
        );
      const acknowledgedOwnWrite = current.operations.some((op) =>
        next.appliedOperationIds?.includes(op.id),
      );
      if (
        !created &&
        !acknowledgedOwnWrite &&
        current.unbound &&
        !equal(current.baseline, next.state) &&
        !equal(current.baseline, createEmptyState())
      ) {
        current.migrationBackup = {
          local: structuredClone(current.baseline),
          remote: structuredClone(next.state),
        };
        current.operations.unshift(
          createOperation(
            current.baseline,
            current.baseline,
            "migration",
            true,
          ),
        );
      }
      current.unbound = false;
      current.remote = document;
      current.baseline = next.state;
      current.operations = current.operations.filter(
        (x) => !next.appliedOperationIds?.includes(x.id),
      );
      return project(current);
    });
  }
  async resolve(
    dataset: string,
    operationId: string,
    field: string,
    id: string,
    choice: "local" | "remote",
  ) {
    return this.transact(dataset, (current) => {
      if (!current) throw new Error("Dziennik nie został otwarty.");
      const conflict = current.conflicts.find(
        (x) =>
          x.operationId === operationId && x.field === field && x.id === id,
      );
      const operation = current.operations.find((x) => x.id === operationId);
      if (!conflict || !operation) return current;
      if (operation.replacement) {
        if (choice === "remote")
          current.operations = current.operations.filter(
            (x) => x.id !== operationId,
          );
        else {
          operation.id = crypto.randomUUID();
          operation.replacement.before = structuredClone(current.baseline);
        }
      } else {
        const change =
          conflict.changeIndex === undefined
            ? operation.changes.find((x) => x.id === id && x.field === field)
            : operation.changes[conflict.changeIndex];
        if (change) {
          if (choice === "remote")
            operation.changes = operation.changes.filter((x) => x !== change);
          else {
            if (change.id !== conflict.id)
              operation.aliases = {
                ...operation.aliases,
                [change.id]: conflict.id,
              };
            Object.assign(change, {
              collection: conflict.collection,
              id: conflict.id,
              field: conflict.field,
              before: conflict.remote,
              after: conflict.local,
            });
          }
        }
        operation.id = crypto.randomUUID();
      }
      return project(current);
    });
  }
}

const SIGNAL = "tasker:journal-version:v2";
export function journalNotifications(refresh: () => void) {
  const channel =
    typeof BroadcastChannel === "undefined"
      ? undefined
      : new BroadcastChannel("tasker-journal-v2");
  if (channel) channel.onmessage = refresh;
  const onStorage = (event: StorageEvent) => {
    if (event.key === SIGNAL) refresh();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener("focus", refresh);
  const timer = window.setInterval(refresh, 15000);
  return {
    notify() {
      channel?.postMessage({ version: 2 });
      try {
        localStorage.setItem(SIGNAL, crypto.randomUUID());
      } catch {
        /* Periodic reads remain available. */
      }
    },
    close() {
      channel?.close();
      clearInterval(timer);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refresh);
    },
  };
}
