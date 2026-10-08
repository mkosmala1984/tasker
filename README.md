# Tasker

Tasker is a React application for recurring tasks. It works offline and has no backend or login. Task data, pending operations, remote versions, and conflicts are stored together in the browser's IndexedDB database `tasker-sync-v2`. Each edit is confirmed only after its transaction completes.

## GitHub Pages

Tasker deploys to [mkosmala1984.github.io/tasker](https://mkosmala1984.github.io/tasker/) through GitHub Pages. GitHub Actions runs tests and a Pages production build for pull requests to `main`, then deploys after changes are pushed to `main`. Configure **Settings → Pages → Source: GitHub Actions** before the first deployment.

## Tigris synchronization

Tigris is the only optional synchronization provider. Create a dedicated private bucket with permission to read and write the Tasker object. In **Dane**, enter the bucket, object key (default `tasker.json`), access-key ID, and secret access key. Credentials remain in this browser's localStorage. Use a dedicated key with minimal permissions.

Browser access requires CORS (cross-origin request rules). For example:

```json
[
  {
    "AllowedOrigins": ["http://localhost:5173", "https://mkosmala1984.github.io"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"]
  }
]
```

The wildcard allows the signing and checksum headers sent by the AWS SDK as well as `If-Match` and `If-None-Match`. If you restrict headers, include these conditional headers, Authorization, Content-Type, x-amz-date, x-amz-content-sha256, and the SDK checksum headers used by your requests. Keep origins restricted. ETag must be exposed to JavaScript.

Tasker creates a missing object with `If-None-Match: *`. It updates an existing object only with the ETag from its GET response in `If-Match`. Rejected writes trigger another read and merge. There is no unconditional-write fallback. Changes to different fields merge automatically. Conflicting values remain in the local journal and can be resolved in **Dane**. Dependent changes wait; unrelated operations can synchronize.

Changes are sent after one second. Tasker also checks at startup, on focus, when the network returns, and every minute. Network errors retry with increasing delays up to one minute. Applied operation IDs in remote format v2 prevent duplicate execution after a lost response. The IDs are retained without compaction. A synchronization status confirms this session's operations; other computers refresh on their own next check.

Tabs use one transactional journal with BroadcastChannel notifications, storage notifications, focus refresh, and a 15-second fallback check. The remote conditional write provides correctness without a tab leader or Web Locks. Different computers use separate journals and merge through Tigris.

An import replaces the entire dataset after confirmation. If another tab changes data after the preview, the import is rejected and must be reviewed again. Export contains the projected local state, including unsent edits. Keep exports as backups: clearing browser site data also removes IndexedDB.

When changing the remote object with pending operations, finish synchronization or disconnect first. Disconnect explicitly keeps the visible state in a separate local dataset. The previous remote journal and its queue remain saved and can be reopened by reconnecting to the same bucket/object key. Queues are never transferred to another object.

## Upgrade and migration

Before deploying this version, export data and close every older Tasker session on every computer. Older clients write unconditionally and can overwrite format v2. For an isolated rollout, use a new object key and remove old clients' write permission, or enforce conditional writes at the service level if supported.

The first launch retains `tasker:v1` as a recovery copy and migrates its data transactionally. It removes the obsolete local synchronization credentials only after the journal is saved. No request is made to the removed provider and no remote document is deleted. Export data stored only remotely using the older app before upgrading. If both local and remote copies differ without a known baseline, Tasker saves both copies in its migration record and asks which dataset to keep through a conflict in **Dane**. It does not choose by client timestamps.

Remote format v1 is read and validated, then upgraded through a conditional write. Invalid entities, references, schedules, missing ETag, or permission errors stop synchronization while preserving local data.

Tigris documents [conditional writes and consistency options](https://www.tigrisdata.com/features/). Automated tests simulate a conditional object service, two tabs, and two computers; they do not prove the behavior of a particular live bucket. Before rollout, use a separate test object to verify exposed ETag, rejection of stale If-Match, concurrent creation, CORS, and the consistency guarantees of the selected bucket across your regions. Never run destructive tests against production data.

## Run and verify

```bash
npm install
npm run dev
npm run test:run
npm run build
npm run build:pages
```
