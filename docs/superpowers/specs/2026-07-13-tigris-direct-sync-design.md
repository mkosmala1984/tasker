# Tigris Direct Browser Synchronization Design

## Goal

Add Tigris as Tasker's primary optional synchronization provider while retaining the existing JSONHosting provider. Tigris access credentials are supplied by the user, stored only in that browser's local storage, and used to synchronize one private JSON object in an existing Tigris bucket.

## Scope

This design implements direct browser-to-Tigris synchronization. It does not add a Worker, server-side credential storage, user authentication, presigned URLs, or automatic bucket creation.

## Security model

The user enters a bucket name, object key, access-key ID, and secret access key. The application stores these values in browser local storage under a dedicated versioned key. The secret is therefore accessible to JavaScript executing in the Tasker origin; this provider is appropriate only for a dedicated, least-privileged Tasker bucket and non-sensitive data.

The Tigris object remains private. Browser access is enabled by the bucket's CORS policy, not by making the object public. The setup guidance must ask users to allow Tasker's localhost and GitHub Pages origins, the `GET`, `PUT`, and `HEAD` methods, and the `Authorization`, `Content-Type`, `x-amz-content-sha256`, and `x-amz-date` request headers.

## User experience

The Data view presents Tigris first, ahead of the existing JSONHosting controls. It includes an explicit warning about local storage of cloud access keys; inputs for bucket, object key, access-key ID, and masked secret access key; and Connect and Disconnect actions.

The object key defaults to `tasker.json`. Tigris credentials use a separate persisted key from JSONHosting credentials. Saving or selecting one provider preserves the other provider's credentials. A single active provider is selected at a time, so only that provider reads, polls, and writes task data.

JSONHosting stays available as the secondary option with its current document-ID and edit-key controls and behavior.

## Data and request model

Tigris synchronization stores the current `RemoteEnvelope` as the complete body of one object in the configured bucket. The app signs S3-compatible path-style requests against `https://t3.storage.dev` using AWS Signature Version 4 and the user's credentials:

- `GET /<bucket>/<objectKey>` reads the remote envelope.
- `PUT /<bucket>/<objectKey>` overwrites the object with the next remote envelope.

The client sends no credentials in the object body. It must URL-encode object-key path segments correctly and include all SigV4-required headers in the canonical request.

On first connection, the client GETs the configured object. If it exists, the app validates the envelope and uses the existing remote-newer comparison behavior. If it returns `404`, the client creates a revision-0 envelope from the current local state with a signed PUT and marks that envelope as observed. Authentication, CORS, network, malformed-data, and other unsuccessful responses leave local data and configured credentials unchanged, while the UI receives a provider-specific Polish error.

## Synchronization model

The existing optimistic read-before-write model is retained. Before a write, the active provider is read; if it is newer, remote data replaces local data. Otherwise the app writes a next revision, rereads it, and detects an ordinary remote winner. Tigris does not add compare-and-swap behavior, so a simultaneous final write remains last-write-wins.

The shared sync controller becomes provider-neutral and keeps one active set of credentials and one status. Its debounce is increased from 750 ms to 1,000 ms for both providers so Tigris never deliberately writes the same object more often than once per second. Polling remains once per minute.

## Component boundaries

- A Tigris storage module owns types, local-storage persistence, S3 URL construction, SigV4 signing, envelope reads, and envelope writes.
- A shared provider-neutral synchronization controller owns timers, optimistic revision handling, stale-credential protection, and statuses.
- The Zustand store owns both provider configurations, the selected provider, controller lifecycle, local-state replacement, and persistence coordination.
- The Data view renders provider setup and status controls without signing requests or managing synchronization.

## Testing

Unit tests cover deterministic SigV4 request construction using a fixed clock, safe URL encoding, credential validation and persistence, signed GET and PUT behavior, malformed envelopes, and provider-specific failures.

Synchronization/store tests cover Tigris first-connection creation after a `404`, existing-object remote loading, rejected setup without local-state loss, selecting Tigris versus JSONHosting, switching providers while preserving inactive credentials, and one-active-provider write scheduling.

Component tests cover the Tigris warning, default object key, trimmed form submission, masked secret field, and disconnect behavior. Existing JSONHosting behavior remains covered and unchanged apart from shared-controller integration.

## Documentation

The README explains Tigris configuration, its local-storage credential risk, the required bucket CORS policy, private-object behavior, automatic first-object creation, the 1,000 ms write debounce, and the remaining simultaneous-write limitation.
