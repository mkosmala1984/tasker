# JSONHosting Synchronization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional local-first, per-user JSONHosting synchronization for the complete Tasker `AppState`.

**Architecture:** Keep `taskerStorage` as immediate local persistence. Add a focused JSONHosting client for credentials, envelope validation, GET/PATCH calls, then use a store-owned coordinator for debounced writes, GET-before-PATCH optimistic revisions, and one-minute remote polling. The Data view configures and reports synchronization.

**Tech Stack:** React 19, TypeScript 5, Zustand 5, Mantine 9, Vitest, Testing Library, Vite, JSONHosting REST API.

## Global Constraints

- Synchronize every `AppState` collection without changing task-domain behavior or JSON backup/import formats.
- Local storage is primary and must be written before any network operation.
- Persist document ID/edit key only in browser local storage; never include the key in a remote payload or export.
- Remote JSONHosting documents are public; show this beside connection controls.
- Use a 750 ms trailing debounce and a 60,000 ms background version-check interval.
- Automatically replace and locally persist state when the remote revision is newer.
- Never replace local data for malformed remote JSON, connection errors, bad credentials, rate limits, or failed requests.
- JSONHosting has no conditional PATCH API: document the remaining simultaneous-write race and implement remote-wins stale-write detection.
- Final verification: `npm run test:run` and `npm run build`.

---

## File Structure

- Create: `src/storage/jsonHostingStorage.ts` — credentials, remote-envelope validation, and JSONHosting requests.
- Create: `src/storage/jsonHostingStorage.test.ts` — storage/API unit tests.
- Create: `src/state/jsonHostingSync.ts` — timer-owning, testable synchronization coordinator.
- Create: `src/state/jsonHostingSync.test.ts` — debounce, conflict, polling, and cleanup tests.
- Modify: `src/state/taskerStore.ts` — sync fields/actions and local-persistence bridge.
- Modify: `src/state/taskerStore.test.ts` — store integration coverage.
- Modify: `src/components/DataTransferView.tsx` — connection controls, warning, and status.
- Create: `src/components/DataTransferView.test.tsx` — controls/status tests.
- Modify: `src/App.tsx` and `src/App.test.tsx` — lifecycle integration.
- Modify: `README.md` — setup and limitation documentation.

### Task 1: Build the JSONHosting storage contract

**Files:**
- Create: `src/storage/jsonHostingStorage.ts`
- Create: `src/storage/jsonHostingStorage.test.ts`

**Interfaces:**
- Produces `JsonHostingCredentials`, `RemoteEnvelope`, `JsonHostingError`, `loadJsonHostingCredentials`, `saveJsonHostingCredentials`, `clearJsonHostingCredentials`, `getRemoteEnvelope`, and `patchRemoteEnvelope`.
- Consumed by `src/state/jsonHostingSync.ts` and `src/state/taskerStore.ts`.

- [ ] **Step 1: Write the failing storage-contract test**

```ts
it("persists and reloads credentials", () => {
  saveJsonHostingCredentials({ documentId: "abc123", editKey: "secret" });
  expect(loadJsonHostingCredentials()).toEqual({ documentId: "abc123", editKey: "secret" });
});

it("loads a valid remote envelope", async () => {
  const state = createEmptyState();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
    version: 1, revision: 4, updatedAt: "2026-07-12T10:00:00.000Z", state
  }))));
  await expect(getRemoteEnvelope({ documentId: "abc123", editKey: "secret" }))
    .resolves.toMatchObject({ revision: 4, state });
});

it("PATCHes without serializing the edit key", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
  const envelope = { version: 1 as const, revision: 5, updatedAt: "2026-07-12T10:01:00.000Z", state: createEmptyState() };
  await patchRemoteEnvelope({ documentId: "abc123", editKey: "secret" }, envelope);
  expect(fetch).toHaveBeenCalledWith(
    "https://jsonhosting.com/api/json/abc123",
    expect.objectContaining({ method: "PATCH", headers: expect.objectContaining({ "X-Edit-Key": "secret" }), body: JSON.stringify(envelope) })
  );
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm run test:run -- src/storage/jsonHostingStorage.test.ts`

Expected: FAIL because `jsonHostingStorage.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
export const JSON_HOSTING_CREDENTIALS_KEY = "tasker:jsonhosting:v1";
export type JsonHostingCredentials = { documentId: string; editKey: string };
export type RemoteEnvelope = { version: 1; revision: number; updatedAt: string; state: AppState };

export async function getRemoteEnvelope(credentials: JsonHostingCredentials): Promise<RemoteEnvelope> {
  const response = await fetch(`https://jsonhosting.com/api/json/${encodeURIComponent(credentials.documentId)}`);
  if (!response.ok) throw new JsonHostingError("Nie mozna pobrac danych z JSONHosting.");
  return parseRemoteEnvelope(await response.json());
}

export async function patchRemoteEnvelope(credentials: JsonHostingCredentials, envelope: RemoteEnvelope): Promise<void> {
  const response = await fetch(`https://jsonhosting.com/api/json/${encodeURIComponent(credentials.documentId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "X-Edit-Key": credentials.editKey },
    body: JSON.stringify(envelope)
  });
  if (!response.ok) throw new JsonHostingError("Nie mozna zapisac danych w JSONHosting.");
}
```

Use an `isAppState` structural guard equivalent to `taskerStorage.ts`. Require `version === 1`, a non-negative integer revision, a parseable ISO date, and a valid state. Return `undefined` for absent/malformed/blank credentials; clear exactly the credentials key.

- [ ] **Step 4: Run focused tests**

Run: `npm run test:run -- src/storage/jsonHostingStorage.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/storage/jsonHostingStorage.ts src/storage/jsonHostingStorage.test.ts
git commit -m "feat: add JSONHosting storage client"
```

### Task 2: Add a testable optimistic-sync coordinator

**Files:**
- Create: `src/state/jsonHostingSync.ts`
- Create: `src/state/jsonHostingSync.test.ts`

**Interfaces:**
- Consumes Task 1's credentials, envelope, GET, and PATCH functions.
- Produces `JsonHostingSyncController`: `start()`, `stop()`, `setCredentials(credentials)`, `scheduleSave(state)`, and `checkForRemoteUpdate()`.
- Receives callbacks: `getLocalSnapshot(): { state: AppState; observedRevision: number; updatedAt: string }`, `replaceLocal(envelope)`, and `setStatus(status)`.

- [ ] **Step 1: Write failing fake-timer tests**

```ts
it("coalesces mutations into one GET-before-PATCH after 750 ms", async () => {
  vi.useFakeTimers();
  getRemoteEnvelopeMock.mockResolvedValue({ version: 1, revision: 3, updatedAt: "2026-07-12T10:00:00.000Z", state: baseState });
  const controller = createController({ observedRevision: 3 });
  controller.scheduleSave(changedState);
  controller.scheduleSave(laterChangedState);
  await vi.advanceTimersByTimeAsync(750);
  expect(getRemoteEnvelopeMock).toHaveBeenCalledTimes(1);
  expect(patchRemoteEnvelopeMock).toHaveBeenCalledWith(credentials, expect.objectContaining({ revision: 4, state: laterChangedState }));
});

it("loads remote data and skips PATCH when preflight is newer", async () => {
  getRemoteEnvelopeMock.mockResolvedValue({ version: 1, revision: 4, updatedAt: "2026-07-12T10:02:00.000Z", state: remoteState });
  const controller = createController({ observedRevision: 3 });
  controller.scheduleSave(changedState);
  await vi.advanceTimersByTimeAsync(750);
  expect(replaceLocal).toHaveBeenCalledWith(expect.objectContaining({ revision: 4, state: remoteState }));
  expect(patchRemoteEnvelopeMock).not.toHaveBeenCalled();
});

it("polls once per minute and stop clears polling", async () => {
  vi.useFakeTimers();
  const controller = createController({ observedRevision: 1 });
  controller.start();
  await vi.advanceTimersByTimeAsync(60_000);
  expect(getRemoteEnvelopeMock).toHaveBeenCalledTimes(1);
  controller.stop();
  await vi.advanceTimersByTimeAsync(60_000);
  expect(getRemoteEnvelopeMock).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm run test:run -- src/state/jsonHostingSync.test.ts`

Expected: FAIL because `jsonHostingSync.ts` does not exist.

- [ ] **Step 3: Implement controller/status contract**

```ts
export type JsonHostingSyncStatus =
  | { kind: "disconnected" }
  | { kind: "checking" }
  | { kind: "syncing" }
  | { kind: "synced"; at: string }
  | { kind: "remote-loaded"; at: string }
  | { kind: "error"; message: string };

export function isRemoteNewer(remote: RemoteEnvelope, observedRevision: number, updatedAt: string): boolean {
  return remote.revision > observedRevision ||
    (remote.revision === observedRevision && remote.updatedAt > updatedAt);
}
```

Keep one debounce timeout, one polling interval, and one in-flight promise. `checkForRemoteUpdate` does nothing without credentials or while a request is in progress. `scheduleSave` retains only its latest state, waits 750 ms, fetches the remote envelope, replaces local/does not PATCH if `isRemoteNewer` is true, otherwise PATCHes `revision + 1` with a fresh ISO timestamp. All failures set an error status and leave local state untouched. `stop()` clears both timers.

- [ ] **Step 4: Add edge-case tests**

Add deterministic tests for newer/equal/older startup values, rejected GET/PATCH retaining state, credentials clearing pending timers, and a deliberately unresolved GET proving a poll cannot overlap a save/check request.

- [ ] **Step 5: Run focused tests**

Run: `npm run test:run -- src/state/jsonHostingSync.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/state/jsonHostingSync.ts src/state/jsonHostingSync.test.ts
git commit -m "feat: add optimistic JSONHosting synchronization"
```

### Task 3: Integrate synchronization with Zustand

**Files:**
- Modify: `src/state/taskerStore.ts`
- Modify: `src/state/taskerStore.test.ts`

**Interfaces:**
- Consumes Tasks 1-2.
- Produces `jsonHostingCredentials?: JsonHostingCredentials`, `jsonHostingStatus: JsonHostingSyncStatus`, `configureJsonHosting(credentials)`, `disconnectJsonHosting()`, `startJsonHostingSync()`, and `stopJsonHostingSync()`.
- Task 4's UI consumes all six fields/actions.

- [ ] **Step 1: Write failing store tests**

```ts
it("persists locally before it schedules remote synchronization", () => {
  useTaskerStore.getState().configureJsonHosting({ documentId: "abc123", editKey: "secret" });
  useTaskerStore.getState().addCategory({ name: "Dom", color: "#40c057" });
  expect(localStorage.getItem(STORAGE_KEY)).toContain("Dom");
  expect(scheduleSaveMock).toHaveBeenCalledWith(expect.objectContaining({
    categories: [expect.objectContaining({ name: "Dom" })]
  }));
});

it("persists a remote state loaded by the coordinator", () => {
  replaceLocalFromSync(remoteEnvelope);
  expect(useTaskerStore.getState().state).toEqual(remoteEnvelope.state);
  expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(remoteEnvelope.state));
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm run test:run -- src/state/taskerStore.test.ts`

Expected: FAIL because connection actions/sync bridge do not exist.

- [ ] **Step 3: Implement store bridge**

Make the current `persist(nextState)` helper store-aware: first call `saveState(nextState)`, then call `syncController.scheduleSave(nextState)` if credentials exist, and return `{ state: nextState }`. Use it for every existing mutation, including `applyImport`.

Create one controller with a `replaceLocal` callback that calls `saveState(envelope.state)` then `useTaskerStore.setState({ state: envelope.state, observedRemoteRevision: envelope.revision, observedRemoteUpdatedAt: envelope.updatedAt })`. Persist credentials with Task 1 helpers; configuration immediately starts a remote check; disconnect clears credentials, stops timers, and sets `{ kind: "disconnected" }`.

- [ ] **Step 4: Run focused tests**

Run: `npm run test:run -- src/state/taskerStore.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/state/taskerStore.ts src/state/taskerStore.test.ts
git commit -m "feat: connect Tasker state to JSONHosting sync"
```

### Task 4: Add lifecycle and Data-view controls

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/components/DataTransferView.tsx`
- Create: `src/components/DataTransferView.test.tsx`

**Interfaces:**
- `DataTransferView` gains `credentials?`, `status`, `onConfigureJsonHosting(credentials)`, and `onDisconnectJsonHosting()`.
- App starts synchronization on mount and stops it on unmount.

- [ ] **Step 1: Write failing UI tests**

```tsx
it("submits JSONHosting credentials", async () => {
  const user = userEvent.setup();
  const onConfigureJsonHosting = vi.fn();
  render(<DataTransferView {...baseProps} onConfigureJsonHosting={onConfigureJsonHosting} />);
  await user.type(screen.getByLabelText("ID dokumentu JSONHosting"), "abc123");
  await user.type(screen.getByLabelText("Klucz edycji JSONHosting"), "secret");
  await user.click(screen.getByRole("button", { name: "Polacz z JSONHosting" }));
  expect(onConfigureJsonHosting).toHaveBeenCalledWith({ documentId: "abc123", editKey: "secret" });
});

it("shows public-data warning and sync status", () => {
  render(<DataTransferView {...baseProps} status={{ kind: "synced", at: "2026-07-12T10:00:00.000Z" }} />);
  expect(screen.getByText(/publicznie dostepne/i)).toBeInTheDocument();
  expect(screen.getByText(/zsynchronizowano/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm run test:run -- src/components/DataTransferView.test.tsx`

Expected: FAIL because JSONHosting controls do not exist.

- [ ] **Step 3: Implement UI and lifecycle**

Add exact-label document-ID and password edit-key fields; trim input and disable connection until both are non-empty. Add a Mantine warning Alert stating JSONHosting documents are public. Map disconnected/checking/syncing/synced/remote-loaded/error to concise Polish status copy and appropriate alert color.

In `App.tsx`, select lifecycle/actions/status and add:

```ts
useEffect(() => {
  startJsonHostingSync();
  return stopJsonHostingSync;
}, [startJsonHostingSync, stopJsonHostingSync]);
```

Pass the values to `DataTransferView` without changing import/export behavior.

- [ ] **Step 4: Run focused tests**

Run: `npm run test:run -- src/components/DataTransferView.test.tsx src/App.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/App.test.tsx src/components/DataTransferView.tsx src/components/DataTransferView.test.tsx
git commit -m "feat: add JSONHosting connection controls"
```

### Task 5: Document and verify

**Files:**
- Modify: `README.md`
- Modify tests only if deterministic verification exposes a gap.

**Interfaces:**
- Documents the Data-view setup and operational limitations.

- [ ] **Step 1: Write the README section**

Document: local-first behavior; users connect an existing JSONHosting ID/edit key in Data; documents are public; writes debounce 750 ms; revisions are checked at launch and every minute; the API cannot eliminate a simultaneous PATCH last-write-wins race.

- [ ] **Step 2: Run all tests**

Run: `npm run test:run`

Expected: PASS.

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: PASS with no TypeScript errors.

- [ ] **Step 4: Verify offline safety manually**

Run: `npm run dev`

With valid-looking credentials and network disabled, create a category. Confirm it renders immediately and survives refresh while Data shows a non-blocking error. Re-enable networking, make another change, and confirm a later retry can reach synced status.

- [ ] **Step 5: Commit**

```bash
git add README.md src
git commit -m "docs: explain JSONHosting synchronization"
```

## Self-Review

- Task 1 covers credential persistence, strict remote validation, and the exact REST contract.
- Task 2 covers debounce, optimistic versioning, remote-wins stale detection, minute polling, no overlap, and failure safety.
- Task 3 preserves immediate local persistence for every state mutation and integrates remote replacements.
- Task 4 covers configuration, public-data warning, status presentation, and lifecycle cleanup.
- Task 5 covers user documentation plus complete automated, build, and offline verification.
- The plan defines the types/functions before later tasks consume them and contains no unassigned feature scope.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-12-jsonhosting-sync.md`. Two execution options:

**1. Subagent-Driven (recommended)** - Dispatch a fresh subagent per task and review between tasks.

**2. Inline Execution** - Execute tasks in this session using `superpowers:executing-plans` with checkpoints.

Which approach?

