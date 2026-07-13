# Tigris Direct Browser Synchronization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Tigris as Tasker's primary optional browser-to-bucket synchronization provider while retaining JSONHosting.

**Architecture:** A provider-neutral synchronization controller shares the existing revision, polling, and conflict behavior between JSONHosting and Tigris. A focused Tigris storage adapter persists user-supplied S3 credentials, signs requests with AWS SDK v3, and reads/writes one private object. The store runs only the selected provider; the Data view renders Tigris first and preserves JSONHosting controls.

**Tech Stack:** React 19, TypeScript 5, Zustand 5, Mantine 9, Vitest, AWS SDK v3 S3 client, Tigris S3 endpoint.

## Global Constraints

- Keep JSONHosting configured and functional; selecting Tigris must not delete JSONHosting credentials.
- Persist Tigris credentials only in `localStorage` under `tasker:tigris:v1`; clearly warn that secrets are locally readable by code on this origin.
- Use `https://t3.storage.dev`, a private bucket/object, and S3 CORS; never serialize the secret access key into the object.
- Tigris first connection creates a revision-0 object only for `404`; all other failures leave local Tasker data unchanged.
- Use a 1,000 ms save debounce and a 60,000 ms poll interval.

---

## File structure

- Create `src/storage/remoteSync.ts`: shared envelope, status, provider-neutral timer/revision controller.
- Create `src/storage/tigrisStorage.ts`: Tigris credential storage and S3 GET/PUT adapter.
- Create `src/storage/tigrisStorage.test.ts`: deterministic Tigris persistence/request tests.
- Create `src/state/remoteSync.test.ts`: migrated generic-controller tests and Tigris credential type coverage.
- Modify `src/storage/jsonHostingStorage.ts`: import/re-export shared envelope and use the common remote-storage interface.
- Modify `src/storage/jsonHostingStorage.test.ts`: update imports only; preserve JSONHosting request assertions.
- Modify `src/state/taskerStore.ts`: retain both configurations, select one provider, initialize and route two generic controllers.
- Modify `src/state/taskerStore.test.ts`: provider selection, first-object creation, failure, and persistence tests.
- Modify `src/components/DataTransferView.tsx` and `.test.tsx`: Tigris-first configuration UI and warnings.
- Modify `src/App.tsx` and `src/App.test.tsx`: pass Tigris store state/actions and start/stop the provider-neutral sync lifecycle.
- Modify `README.md`: document setup, CORS, local-secret risk, and limits.
- Modify `package.json` and lockfile: add AWS SDK browser dependencies.

### Task 1: Extract the generic synchronization controller

**Files:**
- Create: `src/state/remoteSync.ts`
- Create: `src/state/remoteSync.test.ts`
- Modify: `src/state/jsonHostingSync.ts`
- Modify: `src/state/jsonHostingSync.test.ts`

**Interfaces:**
- Produces `RemoteEnvelope`, `RemoteSyncStatus`, `RemoteSyncStorage<C>`, and `createRemoteSyncController<C>`.
- Keeps a compatibility `createJsonHostingSyncController` wrapper until Task 3 changes the store.

- [ ] **Step 1: Write failing generic-controller tests**

```ts
const controller = createRemoteSyncController({ credentials, storage, getLocalSnapshot, replaceLocal, confirmLocalSave, setStatus });
controller.scheduleSave(changedState);
await vi.advanceTimersByTimeAsync(1_000);
expect(storage.putRemoteEnvelope).toHaveBeenCalledWith(credentials, expect.objectContaining({ revision: 4 }));
```

Also migrate every existing `jsonHostingSync.test.ts` case to this factory, changing each `750` expectation to `1_000` and retaining stale-request, polling, remote-winner, and error assertions.

- [ ] **Step 2: Verify failure**

Run: `npm run test:run -- src/state/remoteSync.test.ts`

Expected: FAIL because `remoteSync.ts` does not exist.

- [ ] **Step 3: Implement the generic controller**

```ts
export type RemoteSyncStorage<C> = {
  getRemoteEnvelope(credentials: C): Promise<RemoteEnvelope>;
  putRemoteEnvelope(credentials: C, envelope: RemoteEnvelope): Promise<void>;
};
export const SAVE_DEBOUNCE_MS = 1_000;
export const POLL_INTERVAL_MS = 60_000;
```

Move the complete current controller implementation into `createRemoteSyncController<C>`. Replace its JSONHosting credential type with `C`, replace its injected `getRemoteEnvelope`/`patchRemoteEnvelope` functions with `options.storage.getRemoteEnvelope`/`options.storage.putRemoteEnvelope`, and retain its exact generation checks and read-before-write/reread behavior.

- [ ] **Step 4: Verify controller tests**

Run: `npm run test:run -- src/state/remoteSync.test.ts src/state/jsonHostingSync.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/state/remoteSync.ts src/state/remoteSync.test.ts src/state/jsonHostingSync.ts src/state/jsonHostingSync.test.ts
git commit -m "refactor: share remote synchronization controller"
```

### Task 2: Add the Tigris storage adapter

**Files:**
- Modify: `package.json`, `package-lock.json`
- Create: `src/storage/tigrisStorage.ts`
- Create: `src/storage/tigrisStorage.test.ts`
- Modify: `src/storage/jsonHostingStorage.ts`, `src/storage/jsonHostingStorage.test.ts`

**Interfaces:**
- Produces `TigrisCredentials`, `TIGRIS_CREDENTIALS_KEY`, `loadTigrisCredentials`, `saveTigrisCredentials`, `clearTigrisCredentials`, `getTigrisEnvelope`, and `putTigrisEnvelope`.
- `getTigrisEnvelope` maps missing objects to `TigrisNotFoundError`; all other failures map to `TigrisError` with Polish messages.

- [ ] **Step 1: Add failing storage tests**

```ts
saveTigrisCredentials({ bucket: "tasker", objectKey: "tasker.json", accessKeyId: "tid_x", secretAccessKey: "tsec_x" });
expect(loadTigrisCredentials()).toEqual(expect.objectContaining({ bucket: "tasker" }));
await expect(getTigrisEnvelope(credentials)).rejects.toBeInstanceOf(TigrisNotFoundError);
expect(client.send).toHaveBeenCalledWith(expect.objectContaining({ input: { Bucket: "tasker", Key: "tasker.json" } }));
```

Mock the S3 client module. Test malformed credentials, a valid GET response, malformed envelope rejection, `NoSuchKey`/404 mapping, signed PUT body content, and confirm neither the PUT JSON nor logged error contains `secretAccessKey`.

- [ ] **Step 2: Verify failure**

Run: `npm run test:run -- src/storage/tigrisStorage.test.ts`

Expected: FAIL because the Tigris adapter is absent.

- [ ] **Step 3: Install and implement**

```powershell
npm install @aws-sdk/client-s3
```

```ts
const client = new S3Client({ endpoint: "https://t3.storage.dev", region: "auto", credentials: { accessKeyId, secretAccessKey }, forcePathStyle: true });
await client.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey }));
await client.send(new PutObjectCommand({ Bucket: bucket, Key: objectKey, Body: JSON.stringify(envelope), ContentType: "application/json" }));
```

Share envelope parsing with JSONHosting by exporting it from `remoteSync.ts`; do not duplicate validation. Convert the S3 response body with `transformToString()`.

- [ ] **Step 4: Verify storage and existing provider tests**

Run: `npm run test:run -- src/storage/tigrisStorage.test.ts src/storage/jsonHostingStorage.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add package.json package-lock.json src/storage/tigrisStorage.ts src/storage/tigrisStorage.test.ts src/storage/jsonHostingStorage.ts src/storage/jsonHostingStorage.test.ts
git commit -m "feat: add Tigris browser storage adapter"
```

### Task 3: Select and run one provider in the store

**Files:**
- Modify: `src/state/taskerStore.ts`
- Modify: `src/state/taskerStore.test.ts`

**Interfaces:**
- Produces `syncProvider?: "tigris" | "jsonhosting"`, Tigris credentials/status/actions, and provider-neutral `startSync`/`stopSync`.

- [ ] **Step 1: Write failing store tests**

```ts
useTaskerStore.getState().configureTigris(tigrisCredentials);
expect(useTaskerStore.getState()).toMatchObject({ syncProvider: "tigris", tigrisCredentials });
expect(localStorage.getItem("tasker:jsonhosting:v1")).toContain("previous-document");
```

Add tests that a 404 during `configureTigris` performs a revision-0 put of the local state; a non-404 failure preserves the prior active provider and local state; selecting JSONHosting stops Tigris; and mutations call only the selected controller.

- [ ] **Step 2: Verify failure**

Run: `npm run test:run -- src/state/taskerStore.test.ts`

Expected: FAIL because Tigris state/actions do not exist.

- [ ] **Step 3: Implement provider routing**

```ts
type SyncProvider = "tigris" | "jsonhosting";
```

`configureTigris` must first call `getTigrisEnvelope(credentials)`. On success it selects Tigris, persists its credentials, resets observed metadata, starts the Tigris controller, and checks for a remote update. On `TigrisNotFoundError`, it writes `{ version: 1, revision: 0, updatedAt: new Date().toISOString(), state: get().state }`, then performs the same select/persist/start sequence using that envelope's metadata. On any other error it preserves the prior active provider and reports a Tigris error. `disconnectTigris` clears only Tigris credentials, stops and deselects Tigris only when it is active, and retains JSONHosting credentials.

Instantiate one `createRemoteSyncController` per adapter. `persist()` schedules only the controller named by `syncProvider`; switching providers stops the previous controller and resets observed revision/timestamp before checking the new remote.

- [ ] **Step 4: Verify store tests**

Run: `npm run test:run -- src/state/taskerStore.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/state/taskerStore.ts src/state/taskerStore.test.ts
git commit -m "feat: select Tigris or JSONHosting synchronization"
```

### Task 4: Add the Tigris-first Data view

**Files:**
- Modify: `src/components/DataTransferView.tsx`, `src/components/DataTransferView.test.tsx`
- Modify: `src/App.tsx`, `src/App.test.tsx`

**Interfaces:**
- `DataTransferView` receives `tigrisCredentials`, `tigrisStatus`, `onConfigureTigris`, and `onDisconnectTigris` alongside unchanged JSONHosting props.

- [ ] **Step 1: Write failing component and App tests**

```tsx
await user.type(screen.getByLabelText("Bucket Tigris"), "tasker");
await user.type(screen.getByLabelText("Klucz obiektu Tigris"), "shared/tasker.json");
await user.type(screen.getByLabelText("ID klucza dostepu Tigris"), "tid_key");
await user.type(screen.getByLabelText("Tajny klucz dostepu Tigris"), "tsec_secret");
await user.click(screen.getByRole("button", { name: "Polacz z Tigris" }));
expect(onConfigureTigris).toHaveBeenCalledWith({ bucket: "tasker", objectKey: "shared/tasker.json", accessKeyId: "tid_key", secretAccessKey: "tsec_secret" });
```

Assert default `tasker.json`, password masking, local-secret warning, retained JSONHosting controls, disconnect wiring, and App forwarding.

- [ ] **Step 2: Verify failure**

Run: `npm run test:run -- src/components/DataTransferView.test.tsx src/App.test.tsx`

Expected: FAIL because Tigris props and labels are absent.

- [ ] **Step 3: Implement UI and wiring**

Render the Tigris `Alert` and controls before JSONHosting. Trim all fields; disable connect until all four are non-empty. Use Polish copy stating that the secret is stored in this browser and a dedicated least-privileged bucket is required. Replace App's JSONHosting-specific mount effect with `startSync`/`stopSync`.

- [ ] **Step 4: Verify UI tests**

Run: `npm run test:run -- src/components/DataTransferView.test.tsx src/App.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/components/DataTransferView.tsx src/components/DataTransferView.test.tsx src/App.tsx src/App.test.tsx
git commit -m "feat: configure Tigris synchronization in data view"
```

### Task 5: Document setup and run the full verification suite

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add README requirements**

Document the dedicated private bucket, four required values, `tasker.json` default, exact CORS origins/methods/headers, localStorage credential risk, automatic first-object creation, 1-second debounce, one-minute polling, and last-write-wins race. Keep JSONHosting as a separate documented option.

- [ ] **Step 2: Run focused checks**

Run: `npm run test:run -- src/storage/tigrisStorage.test.ts src/state/remoteSync.test.ts src/state/taskerStore.test.ts src/components/DataTransferView.test.tsx src/App.test.tsx`

Expected: PASS.

- [ ] **Step 3: Run full checks**

Run: `npm run test:run; npm run build`

Expected: both commands exit 0.

- [ ] **Step 4: Commit**

```powershell
git add README.md
git commit -m "docs: explain Tigris synchronization setup"
```
