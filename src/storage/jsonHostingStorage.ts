import type { AppState } from "../domain/types";

export const JSON_HOSTING_CREDENTIALS_KEY = "tasker:jsonhosting:v1";

export type JsonHostingCredentials = {
  documentId: string;
  editKey: string;
};

export type RemoteEnvelope = {
  version: 1;
  revision: number;
  updatedAt: string;
  state: AppState;
};

export class JsonHostingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JsonHostingError";
  }
}

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

function isCredentials(value: unknown): value is JsonHostingCredentials {
  return (
    isRecord(value) &&
    typeof value.documentId === "string" &&
    value.documentId.trim().length > 0 &&
    typeof value.editKey === "string" &&
    value.editKey.trim().length > 0
  );
}

function isParseableIsoDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

function parseRemoteEnvelope(value: unknown): RemoteEnvelope {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    typeof value.revision !== "number" ||
    !Number.isInteger(value.revision) ||
    value.revision < 0 ||
    !isParseableIsoDate(value.updatedAt) ||
    !isAppState(value.state)
  ) {
    throw new JsonHostingError("Nie mozna odczytac danych z JSONHosting.");
  }

  return value as RemoteEnvelope;
}

export function loadJsonHostingCredentials(storage: Storage = window.localStorage): JsonHostingCredentials | undefined {
  const raw = storage.getItem(JSON_HOSTING_CREDENTIALS_KEY);
  if (raw === null || raw.trim().length === 0) {
    return undefined;
  }

  try {
    const credentials: unknown = JSON.parse(raw);
    return isCredentials(credentials) ? credentials : undefined;
  } catch {
    return undefined;
  }
}

export function saveJsonHostingCredentials(
  credentials: JsonHostingCredentials,
  storage: Storage = window.localStorage
): void {
  storage.setItem(JSON_HOSTING_CREDENTIALS_KEY, JSON.stringify(credentials));
}

export function clearJsonHostingCredentials(storage: Storage = window.localStorage): void {
  storage.removeItem(JSON_HOSTING_CREDENTIALS_KEY);
}

export async function getRemoteEnvelope(credentials: JsonHostingCredentials): Promise<RemoteEnvelope> {
  const response = await fetch(`https://jsonhosting.com/api/json/${encodeURIComponent(credentials.documentId)}`);
  if (!response.ok) {
    throw new JsonHostingError("Nie mozna pobrac danych z JSONHosting.");
  }

  try {
    return parseRemoteEnvelope(await response.json());
  } catch (error) {
    if (error instanceof JsonHostingError) {
      throw error;
    }
    throw new JsonHostingError("Nie mozna odczytac danych z JSONHosting.");
  }
}

export async function patchRemoteEnvelope(
  credentials: JsonHostingCredentials,
  envelope: RemoteEnvelope
): Promise<void> {
  const response = await fetch(`https://jsonhosting.com/api/json/${encodeURIComponent(credentials.documentId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-Edit-Key": credentials.editKey
    },
    body: JSON.stringify(envelope)
  });
  if (!response.ok) {
    throw new JsonHostingError("Nie mozna zapisac danych w JSONHosting.");
  }
}
