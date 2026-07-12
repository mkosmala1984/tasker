# JSONHosting synchronization design

## Purpose

Add optional, per-browser synchronization of the complete Tasker data set through JSONHosting. Local storage remains the primary source of truth so the application is immediately usable offline. JSONHosting is a remote mirror that lets a user share the same data across browsers or devices.

## Scope

The synchronized state is the existing complete `AppState`: tasks, categories, assignees, task types, priorities, completions, and postponements. Existing JSON file export and import remain unchanged.

Each user supplies a JSONHosting document ID and its edit key. Tasker saves both only in browser local storage. JSONHosting documents are publicly readable, so the UI must state that this integration is unsuitable for confidential task data. The edit key authorizes writes but does not make the document private.

## Storage model

`taskerStorage` continues to save `AppState` under its current local-storage key. A dedicated JSONHosting module owns remote credentials, payload validation, and HTTP requests.

The remote document is an envelope rather than raw `AppState`:

```json
{
  "version": 1,
  "revision": 12,
  "updatedAt": "2026-07-12T10:30:00.000Z",
  "state": {}
}
```

`version` identifies the envelope shape. `revision` is a monotonically increasing optimistic-concurrency number, and `updatedAt` is an ISO timestamp used for display and compatibility with local state. `state` must pass the same structural validation used for local data/imports.

The local connection configuration stores the document ID, edit key, and the most recently observed remote revision. The secret edit key is never included in the remote envelope or export payload.

## Connection and interface

The Data view adds a JSONHosting section with:

- document ID and edit-key inputs;
- save/connect and disconnect controls;
- a warning that document contents are public;
- a concise status: disconnected, checking, synced, syncing, remote update loaded, or error;
- the timestamp of the last successful sync when available.

Saving credentials validates the remote document with a GET request. If the remote envelope is newer than local data, it replaces the local state automatically. Otherwise local data remains active. No remote document is created by this feature: users connect an existing JSONHosting document and provide its ID/key.

## Synchronization flow

1. At startup Tasker loads local state synchronously, so rendering and offline work are never delayed.
2. If credentials are configured, it fetches the remote envelope in the background. A remote payload with a higher revision, or an equal revision and later `updatedAt`, replaces local state and is immediately persisted locally.
3. Every app-state mutation persists locally immediately. It also schedules remote synchronization 750 ms after the last mutation; multiple mutations in that period become one request.
4. Before a PATCH, Tasker fetches the latest remote envelope. If its revision is the last revision this browser observed, Tasker sends the local state in an envelope with `revision + 1` and a new `updatedAt` value, including the edit key in the required request header.
5. If preflight finds a newer remote revision, Tasker automatically loads that remote state, cancels the stale pending write, and records that a remote update was loaded.
6. While configured, Tasker performs the same remote version check every 60 seconds. It avoids overlapping startup checks, polls, and sync preflights. The interval is removed on unmount and when credentials change.

JSONHosting has no atomic compare-and-swap/ETag precondition. Two clients can still fetch the same revision and PATCH at the same time, so this design detects ordinary stale writes but cannot eliminate every simultaneous-write race. The result is last-write-wins only in that narrow race.

## Failure handling

- Bad credentials, unavailable network, rate limiting, non-success HTTP responses, and malformed remote data never overwrite local data.
- These failures show a non-blocking status and leave the next startup, poll, or local mutation able to retry.
- A successful PATCH clears the error, updates the observed revision, and records the successful-sync timestamp.
- If no credentials exist, all behavior is exactly the current local-only application behavior.

## Testing

Unit and component tests will cover:

- credential persistence and validation;
- parsing and rejecting invalid remote envelopes;
- GET and PATCH URL, body, and `X-Edit-Key` request formation;
- startup and interval replacement of local state when remote data is newer;
- no replacement for equal/older remote data;
- debounce/coalescing of state changes;
- optimistic preflight and the stale-write remote-wins path;
- error handling that retains local state and exposes sync status;
- interval cleanup and prevention of overlapping checks.

## Non-goals

- User accounts, server-side authentication, encryption, or private remote documents.
- Data merging at individual task/field granularity.
- Guaranteed conflict-free multi-writer editing, which JSONHosting's API cannot provide.
- Changing JSON backup/import formats or moving the local source of truth off local storage.
