# JSONHosting Document Creation Design

## Goal

Let a user create a new JSONHosting document from the current Tasker state and immediately use it for synchronization.

## API and storage

The JSONHosting storage client will add a `POST https://jsonhosting.com/api/json` operation. It sends a valid initial remote envelope containing the current complete `AppState`, revision `0`, and a current ISO timestamp. The response must contain non-blank `id` and `editKey`; malformed or unsuccessful responses become a `JsonHostingError`.

The edit key is stored only with the document ID in the existing browser-local credentials record. It is never added to the envelope or exported backup.

## Store flow

The store will expose an action to create a JSONHosting document. While it runs, the synchronization status reports progress. On success, it saves the returned credentials, stops the former controller connection if any, sets the new document as active, and records the created revision/timestamp as observed remote metadata.

Creation failure leaves the current credentials, synchronization connection, local state, and observed metadata unchanged. It only reports a non-blocking error status.

## Data-view flow

The Data view will offer an explicit action to create a new JSONHosting document from the current data. Its copy will state that it replaces any current JSONHosting connection and that the resulting document is public. The existing manual ID/edit-key connection form remains available.

The action disables while creation is pending. On success, the existing connection/status UI shows the generated connection as active; the edit key remains masked.

## Testing

Tests will cover a valid POST request and response parsing, invalid response/failure safety, successful store switch from an existing connection, and UI action/status behavior. Tests will prove the edit key is absent from the POST body and from exports.

## Scope

This change does not alter local-first persistence, backup formats, polling, remote conflict policy, or the existing manual connection workflow.
