import { isValidState } from "../domain/stateValidation";
import type { AppState } from "../domain/types";

export type RemoteEnvelope = {
  version: 1 | 2;
  revision: number;
  updatedAt: string;
  state: AppState;
  appliedOperationIds?: string[];
};
export type RemoteDocument = { envelope: RemoteEnvelope; etag: string };
export type WriteCondition = { etag: string } | { create: true };
export class RemoteConflictError extends Error {
  constructor() {
    super("Wersja zdalna zmieniła się.");
  }
}
export class RemoteMissingError extends Error {
  constructor(message = "Nie znaleziono danych.") {
    super(message);
  }
}
export class PermanentSyncError extends Error {}
export function parseRemoteEnvelope(value: unknown): RemoteEnvelope {
  const v = value as Partial<RemoteEnvelope> | null;
  if (
    !v ||
    (v.version !== 1 && v.version !== 2) ||
    !Number.isSafeInteger(v.revision) ||
    Number(v.revision) < 0 ||
    typeof v.updatedAt !== "string" ||
    Number.isNaN(Date.parse(v.updatedAt)) ||
    !isValidState(v.state)
  )
    throw new PermanentSyncError("Niepoprawny format danych synchronizacji.");
  if (
    v.version === 2 &&
    (!Array.isArray(v.appliedOperationIds) ||
      !v.appliedOperationIds.every(
        (x) => typeof x === "string" && x.length > 0,
      ) ||
      new Set(v.appliedOperationIds).size !== v.appliedOperationIds.length)
  )
    throw new PermanentSyncError("Niepoprawna lista potwierdzonych operacji.");
  return v as RemoteEnvelope;
}
