import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmptyState } from "./taskerStorage";
import {
  clearJsonHostingCredentials,
  createJsonHostingDocument,
  getRemoteEnvelope,
  JsonHostingError,
  JSON_HOSTING_CREDENTIALS_KEY,
  loadJsonHostingCredentials,
  patchRemoteEnvelope,
  saveJsonHostingCredentials
} from "./jsonHostingStorage";

describe("jsonHostingStorage", () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("persists and reloads credentials", () => {
    saveJsonHostingCredentials({ documentId: "abc123", editKey: "secret" });

    expect(loadJsonHostingCredentials()).toEqual({ documentId: "abc123", editKey: "secret" });
  });

  it("returns undefined for absent, blank, or malformed credentials", () => {
    expect(loadJsonHostingCredentials()).toBeUndefined();

    localStorage.setItem(JSON_HOSTING_CREDENTIALS_KEY, " ");
    expect(loadJsonHostingCredentials()).toBeUndefined();

    localStorage.setItem(JSON_HOSTING_CREDENTIALS_KEY, JSON.stringify({ documentId: "abc123" }));
    expect(loadJsonHostingCredentials()).toBeUndefined();
  });

  it("returns undefined when stored credentials are invalid JSON", () => {
    localStorage.setItem(JSON_HOSTING_CREDENTIALS_KEY, "{");

    expect(loadJsonHostingCredentials()).toBeUndefined();
  });

  it("clears only the JSONHosting credentials", () => {
    saveJsonHostingCredentials({ documentId: "abc123", editKey: "secret" });
    localStorage.setItem("unrelated", "value");

    clearJsonHostingCredentials();

    expect(localStorage.getItem(JSON_HOSTING_CREDENTIALS_KEY)).toBeNull();
    expect(localStorage.getItem("unrelated")).toBe("value");
  });

  it("loads a valid remote envelope", async () => {
    const state = createEmptyState();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      version: 1, revision: 4, updatedAt: "2026-07-12T10:00:00.000Z", state
    }))));

    await expect(getRemoteEnvelope({ documentId: "abc123", editKey: "secret" }))
      .resolves.toMatchObject({ revision: 4, state });
  });

  it("rejects malformed remote envelopes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      version: 1, revision: -1, updatedAt: "not-a-date", state: {}
    }))));

    await expect(getRemoteEnvelope({ documentId: "abc123", editKey: "secret" }))
      .rejects.toMatchObject({ message: "Nie mozna odczytac danych z JSONHosting." });
  });

  it("uses a JSONHosting error for unsuccessful reads", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 500 })));

    await expect(getRemoteEnvelope({ documentId: "abc123", editKey: "secret" }))
      .rejects.toBeInstanceOf(JsonHostingError);
  });

  it("PATCHes without serializing the edit key", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
    const envelope = {
      version: 1 as const,
      revision: 5,
      updatedAt: "2026-07-12T10:01:00.000Z",
      state: createEmptyState()
    };

    await patchRemoteEnvelope({ documentId: "abc123", editKey: "secret" }, envelope);

    expect(fetch).toHaveBeenCalledWith(
      "https://jsonhosting.com/api/json/abc123",
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({ "X-Edit-Key": "secret" }),
        body: JSON.stringify(envelope)
      })
    );
  });

  it("uses a JSONHosting error for unsuccessful PATCHes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 403 })));
    const envelope = {
      version: 1 as const,
      revision: 5,
      updatedAt: "2026-07-12T10:01:00.000Z",
      state: createEmptyState()
    };

    await expect(patchRemoteEnvelope({ documentId: "abc123", editKey: "secret" }, envelope))
      .rejects.toMatchObject({ message: "Nie mozna zapisac danych w JSONHosting." });
  });

  it("POSTs a new envelope and returns its credentials without serializing the edit key", async () => {
    const state = createEmptyState();
    const updatedAt = "2026-07-12T11:00:00.000Z";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: "created-id", editKey: "created-key"
    })));
    vi.stubGlobal("fetch", fetchMock);

    await expect(createJsonHostingDocument(state, updatedAt)).resolves.toEqual({
      credentials: { documentId: "created-id", editKey: "created-key" },
      envelope: { version: 1, revision: 0, updatedAt, state }
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://jsonhosting.com/api/json",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
        body: JSON.stringify({ version: 1, revision: 0, updatedAt, state })
      })
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty("editKey");
  });

  it("rejects unsuccessful document creation responses as JsonHostingError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 500 })));

    await expect(createJsonHostingDocument(createEmptyState(), "2026-07-12T11:00:00.000Z"))
      .rejects.toBeInstanceOf(JsonHostingError);
  });

  it.each([
    "not-json",
    {},
    { id: "", editKey: "created-key" },
    { id: "created-id", editKey: " " },
    { id: "created-id" },
    { editKey: "created-key" }
  ])("rejects invalid document creation replies as JsonHostingError", async (reply) => {
    const body = reply === "not-json" ? reply : JSON.stringify(reply);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body)));

    await expect(createJsonHostingDocument(createEmptyState(), "2026-07-12T11:00:00.000Z"))
      .rejects.toBeInstanceOf(JsonHostingError);
  });
});
