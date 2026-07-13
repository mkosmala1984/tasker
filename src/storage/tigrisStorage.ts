import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { parseRemoteEnvelope, type RemoteEnvelope } from "../state/remoteSync";

export const TIGRIS_CREDENTIALS_KEY = "tasker:tigris:v1";

export type TigrisCredentials = {
  bucket: string;
  objectKey: string;
  accessKeyId: string;
  secretAccessKey: string;
};

export class TigrisError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TigrisError";
  }
}

export class TigrisNotFoundError extends TigrisError {
  constructor() {
    super("Nie znaleziono danych w Tigris.");
    this.name = "TigrisNotFoundError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCredentials(value: unknown): value is TigrisCredentials {
  return (
    isRecord(value) &&
    typeof value.bucket === "string" && value.bucket.trim().length > 0 &&
    typeof value.objectKey === "string" && value.objectKey.trim().length > 0 &&
    typeof value.accessKeyId === "string" && value.accessKeyId.trim().length > 0 &&
    typeof value.secretAccessKey === "string" && value.secretAccessKey.trim().length > 0
  );
}

function createClient(credentials: TigrisCredentials): S3Client {
  return new S3Client({
    endpoint: "https://t3.storage.dev",
    region: "auto",
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey
    },
    forcePathStyle: true
  });
}

function isNotFoundError(error: unknown): boolean {
  return isRecord(error) && (
    error.name === "NoSuchKey" ||
    (isRecord(error.$metadata) && error.$metadata.httpStatusCode === 404)
  );
}

export function loadTigrisCredentials(storage: Storage = window.localStorage): TigrisCredentials | undefined {
  const raw = storage.getItem(TIGRIS_CREDENTIALS_KEY);
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

export function saveTigrisCredentials(credentials: TigrisCredentials, storage: Storage = window.localStorage): void {
  storage.setItem(TIGRIS_CREDENTIALS_KEY, JSON.stringify(credentials));
}

export function clearTigrisCredentials(storage: Storage = window.localStorage): void {
  storage.removeItem(TIGRIS_CREDENTIALS_KEY);
}

export async function getTigrisEnvelope(credentials: TigrisCredentials): Promise<RemoteEnvelope> {
  const response = await (async () => {
    try {
      return await createClient(credentials).send(new GetObjectCommand({
        Bucket: credentials.bucket,
        Key: credentials.objectKey
      }));
    } catch (error) {
      if (isNotFoundError(error)) {
        throw new TigrisNotFoundError();
      }
      throw new TigrisError("Nie mozna pobrac danych z Tigris.");
    }
  })();

  try {
    const body = await response.Body?.transformToString();
    if (body === undefined) {
      throw new Error("Missing response body");
    }
    return parseRemoteEnvelope(JSON.parse(body));
  } catch {
    throw new TigrisError("Nie mozna odczytac danych z Tigris.");
  }
}

export async function putTigrisEnvelope(credentials: TigrisCredentials, envelope: RemoteEnvelope): Promise<void> {
  try {
    await createClient(credentials).send(new PutObjectCommand({
      Bucket: credentials.bucket,
      Key: credentials.objectKey,
      Body: JSON.stringify(envelope),
      ContentType: "application/json"
    }));
  } catch {
    throw new TigrisError("Nie mozna zapisac danych w Tigris.");
  }
}
