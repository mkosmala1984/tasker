# JSONHosting Document Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users create a public JSONHosting document from their current Tasker data and immediately synchronize with it.

**Architecture:** Add a storage-layer POST client that constructs and validates the remote envelope/credentials boundary. The Zustand store orchestrates an atomic switch only after successful creation; the Data view invokes that asynchronous action and communicates its public, replacement semantics.

**Tech Stack:** TypeScript, React 19, Zustand, Mantine, Vitest, Testing Library.

## Global Constraints

- POST `https://jsonhosting.com/api/json` with `{ version: 1, revision: 0, updatedAt, state }` and `Content-Type: application/json`.
- Accept only non-blank `id` and `editKey` from a successful response; otherwise throw `JsonHostingError`.
- The edit key is only local credential data: never include it in an envelope or an exported backup.
- Failed creation must leave credentials, controller connection, local state, and observed remote metadata unchanged, while exposing a non-blocking error status.
- Successful creation stops any former controller connection, saves the new credentials, activates the new document, and records revision `0` and the creation timestamp as observed metadata.
- Keep existing local persistence, backup format, polling/conflict behavior, and manual ID/edit-key connection form unchanged.

---

### Task 1: JSONHosting document creation client

**Files:**
- Modify: `src/storage/jsonHostingStorage.ts`
- Modify: `src/storage/jsonHostingStorage.test.ts`

**Interfaces:**
- Consumes: `AppState`.
- Produces: `createJsonHostingDocument(state: AppState, updatedAt: string): Promise<{ credentials: JsonHostingCredentials; envelope: RemoteEnvelope }>`.

- [ ] **Step 1: Write failing storage tests**

Add tests that stub `fetch`, call the new function with `createEmptyState()` and a fixed ISO timestamp, and assert:

```ts
expect(fetch).toHaveBeenCalledWith("https://jsonhosting.com/api/json", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ version: 1, revision: 0, updatedAt, state })
});
expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body))).not.toHaveProperty("editKey");
expect(result).toEqual({
  credentials: { documentId: "created-id", editKey: "created-key" },
  envelope: { version: 1, revision: 0, updatedAt, state }
});
```

Also test an unsuccessful HTTP response and a response without a non-blank `id`/`editKey`, each rejecting with `JsonHostingError`.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm run test:run -- src/storage/jsonHostingStorage.test.ts`

Expected: FAIL because `createJsonHostingDocument` is not exported.

- [ ] **Step 3: Implement the minimal POST client**

Add a narrow response parser and function:

```ts
export async function createJsonHostingDocument(state: AppState, updatedAt: string) {
  const envelope: RemoteEnvelope = { version: 1, revision: 0, updatedAt, state };
  const response = await fetch("https://jsonhosting.com/api/json", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(envelope)
  });
  if (!response.ok) throw new JsonHostingError("Nie mozna utworzyc dokumentu JSONHosting.");
  // validate response.id and response.editKey as non-blank strings before returning credentials + envelope
}
```

- [ ] **Step 4: Run focused tests and verify they pass**

Run: `npm run test:run -- src/storage/jsonHostingStorage.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/storage/jsonHostingStorage.ts src/storage/jsonHostingStorage.test.ts
git commit -m "feat: create JSONHosting documents"
```

### Task 2: Atomic store switch after creation

**Files:**
- Modify: `src/state/taskerStore.ts`
- Modify: `src/state/taskerStore.test.ts`

**Interfaces:**
- Consumes: `createJsonHostingDocument(state, updatedAt)` from Task 1.
- Produces: `createJsonHostingDocument(): Promise<void>` on `TaskerStore`.

- [ ] **Step 1: Write failing store tests**

Mock the creation client and controller methods, arrange an existing credential/metadata, call the action, and assert success saves/activates new credentials, stops then reconfigures/restarts the controller, and sets:

```ts
expect(useTaskerStore.getState()).toMatchObject({
  jsonHostingCredentials: { documentId: "created-id", editKey: "created-key" },
  observedRemoteRevision: 0,
  observedRemoteUpdatedAt: "2026-07-12T12:00:00.000Z"
});
```

Add a rejected-create test asserting every pre-existing credential, state, revision, timestamp, and controller connection remains unchanged while `jsonHostingStatus` is `{ kind: "error", message: ... }`.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm run test:run -- src/state/taskerStore.test.ts`

Expected: FAIL because the action does not exist.

- [ ] **Step 3: Implement the asynchronous action**

Add the action signature and use a fixed creation timestamp for one request. Set `{ kind: "syncing" }` while awaiting. Do not mutate credentials/controller/metadata until the POST resolves. Then stop the old controller, persist/set new credentials, start and check the new controller, and set `observedRemoteRevision`/`observedRemoteUpdatedAt` from the returned envelope. Convert any caught error to an `{ kind: "error" }` status without rethrowing.

- [ ] **Step 4: Run focused tests and verify they pass**

Run: `npm run test:run -- src/state/taskerStore.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/state/taskerStore.ts src/state/taskerStore.test.ts
git commit -m "feat: activate created JSONHosting documents"
```

### Task 3: Data-view creation action

**Files:**
- Modify: `src/components/DataTransferView.tsx`
- Modify: `src/components/DataTransferView.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Consumes: `onCreateJsonHostingDocument(): Promise<void>`, the current credentials, and `JsonHostingSyncStatus`.
- Produces: a visible, disabled-while-pending create button plus unchanged manual-connect UI.

- [ ] **Step 1: Write failing component and integration tests**

Extend props with an async `onCreateJsonHostingDocument` mock. Assert the button copy states that it creates a document from current data, warns it replaces the current connection, calls the action on click, and is disabled until its deferred promise resolves. Render `App` with the store action mocked/stubbed and assert the action is forwarded. Keep the existing manual credential test intact.

- [ ] **Step 2: Run focused tests and verify they fail**

Run: `npm run test:run -- src/components/DataTransferView.test.tsx src/App.test.tsx`

Expected: FAIL because the creation callback/button is absent.

- [ ] **Step 3: Implement the view and App wiring**

Add the prop and local pending state. Render an explicit button such as:

```tsx
<Button type="button" onClick={() => void createJsonHostingDocument()} disabled={creating}>
  Utworz nowy dokument JSONHosting z biezacych danych
</Button>
```

Place nearby Polish copy that the new public document replaces the active JSONHosting connection. In `App`, select `createJsonHostingDocument` from the Zustand store and pass it through. The existing ID/edit-key fields and masked password input remain rendered.

- [ ] **Step 4: Run focused tests and verify they pass**

Run: `npm run test:run -- src/components/DataTransferView.test.tsx src/App.test.tsx`

Expected: PASS.

- [ ] **Step 5: Run full verification and commit**

Run: `npm run test:run; npm run build`

Expected: all tests pass and TypeScript/Vite build succeeds.

```bash
git add src/components/DataTransferView.tsx src/components/DataTransferView.test.tsx src/App.tsx src/App.test.tsx
git commit -m "feat: create JSONHosting documents from data view"
```
