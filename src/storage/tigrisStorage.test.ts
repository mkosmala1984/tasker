import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmptyState } from "./taskerStorage";

const send = vi.fn();

vi.mock("@aws-sdk/client-s3", () => ({
  GetObjectCommand: class GetObjectCommand {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  },
  PutObjectCommand: class PutObjectCommand {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  },
  S3Client: class S3Client {
    send = send;
  }
}));

import {
  clearTigrisCredentials,
  getTigrisEnvelope,
  loadTigrisCredentials,
  putTigrisEnvelope,
  saveTigrisCredentials,
  TIGRIS_CREDENTIALS_KEY,
  TigrisError,
  TigrisNotFoundError,
  type TigrisCredentials
} from "./tigrisStorage";

const credentials: TigrisCredentials = {
  bucket: "tasker",
  objectKey: "tasker.json",
  accessKeyId: "tid_x",
  secretAccessKey: "tsec_x"
};

const envelope = {
  version: 1 as const,
  revision: 4,
  updatedAt: "2026-07-12T10:00:00.000Z",
  state: createEmptyState()
};

describe("tigrisStorage", () => {
  afterEach(() => {
    localStorage.clear();
    send.mockReset();
    vi.restoreAllMocks();
  });

  it("persists and reloads credentials", () => {
    saveTigrisCredentials(credentials);

    expect(loadTigrisCredentials()).toEqual(credentials);
  });

  it("returns undefined for absent or malformed credentials", () => {
    expect(loadTigrisCredentials()).toBeUndefined();

    localStorage.setItem(TIGRIS_CREDENTIALS_KEY, "{");
    expect(loadTigrisCredentials()).toBeUndefined();

    localStorage.setItem(TIGRIS_CREDENTIALS_KEY, JSON.stringify({ ...credentials, bucket: " " }));
    expect(loadTigrisCredentials()).toBeUndefined();
  });

  it("clears only Tigris credentials", () => {
    saveTigrisCredentials(credentials);
    localStorage.setItem("unrelated", "value");

    clearTigrisCredentials();

    expect(localStorage.getItem(TIGRIS_CREDENTIALS_KEY)).toBeNull();
    expect(localStorage.getItem("unrelated")).toBe("value");
  });

  it("loads and validates a Tigris envelope", async () => {
    send.mockResolvedValue({ Body: { transformToString: vi.fn().mockResolvedValue(JSON.stringify(envelope)) } });

    await expect(getTigrisEnvelope(credentials)).resolves.toEqual(envelope);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      input: { Bucket: "tasker", Key: "tasker.json" }
    }));
  });

  it("rejects malformed envelopes", async () => {
    send.mockResolvedValue({ Body: { transformToString: vi.fn().mockResolvedValue(JSON.stringify({ version: 1 })) } });

    await expect(getTigrisEnvelope(credentials)).rejects.toMatchObject({
      message: "Nie mozna odczytac danych z Tigris."
    });
  });

  it.each([{ name: "NoSuchKey" }, { $metadata: { httpStatusCode: 404 } }])(
    "maps missing objects to TigrisNotFoundError",
    async (missingObjectError) => {
      send.mockRejectedValue(missingObjectError);

      await expect(getTigrisEnvelope(credentials)).rejects.toBeInstanceOf(TigrisNotFoundError);
    }
  );

  it("maps other GET failures to a Polish TigrisError without logging the secret", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    send.mockRejectedValue(new Error(`request failed for ${credentials.secretAccessKey}`));

    await expect(getTigrisEnvelope(credentials)).rejects.toEqual(
      expect.objectContaining({ message: "Nie mozna pobrac danych z Tigris." })
    );
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("puts only the signed envelope JSON", async () => {
    send.mockResolvedValue({});

    await expect(putTigrisEnvelope(credentials, envelope)).resolves.toBeUndefined();

    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      input: expect.objectContaining({
        Bucket: "tasker",
        Key: "tasker.json",
        Body: JSON.stringify(envelope),
        ContentType: "application/json"
      })
    }));
    const command = send.mock.calls[0][0] as { input: { Body: string } };
    expect(command.input.Body).not.toContain(credentials.secretAccessKey);
  });

  it("maps PUT failures to a Polish TigrisError without logging the secret", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    send.mockRejectedValue(new Error(`request failed for ${credentials.secretAccessKey}`));

    await expect(putTigrisEnvelope(credentials, envelope)).rejects.toBeInstanceOf(TigrisError);
    expect(consoleError).not.toHaveBeenCalled();
  });
});
