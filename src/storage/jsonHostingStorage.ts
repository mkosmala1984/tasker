import type { AppState } from "../domain/types";
import { parseRemoteEnvelope, type RemoteEnvelope } from "../state/remoteSync";

export type { RemoteEnvelope } from "../state/remoteSync";

export const JSON_HOSTING_CREDENTIALS_KEY = "tasker:jsonhosting:v1";

export type JsonHostingCredentials = {
  documentId: string;
  editKey: string;
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

function isCredentials(value: unknown): value is JsonHostingCredentials {
  return (
    isRecord(value) &&
    typeof value.documentId === "string" &&
    value.documentId.trim().length > 0 &&
    typeof value.editKey === "string" &&
    value.editKey.trim().length > 0
  );
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

export async function createJsonHostingDocument(
  state: AppState,
  updatedAt: string
): Promise<{ credentials: JsonHostingCredentials; envelope: RemoteEnvelope }> {
  const envelope: RemoteEnvelope = { version: 1, revision: 0, updatedAt, state };
  const response = await fetch("https://jsonhosting.com/api/json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(envelope)
  });
  if (!response.ok) {
    throw new JsonHostingError("Nie mozna utworzyc dokumentu JSONHosting.");
  }

  try {
    const reply: unknown = await response.json();
    if (!isRecord(reply) || typeof reply.id !== "string" || typeof reply.editKey !== "string") {
      throw new JsonHostingError("Nie mozna utworzyc dokumentu JSONHosting.");
    }

    const credentials = { documentId: reply.id, editKey: reply.editKey };
    if (!isCredentials(credentials)) {
      throw new JsonHostingError("Nie mozna utworzyc dokumentu JSONHosting.");
    }

    return { credentials, envelope };
  } catch (error) {
    if (error instanceof JsonHostingError) {
      throw error;
    }
    throw new JsonHostingError("Nie mozna utworzyc dokumentu JSONHosting.");
  }
}
