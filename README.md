# Tasker

Tasker is a local-first React app for recurring tasks. It stores data in the browser under the versioned `localStorage` key `tasker:v1`; it has no backend or login.

## JSONHosting synchronization

Tasker remains usable offline: every change is saved locally first. To optionally synchronize the same task data across devices, open **Data** and connect an existing JSONHosting document by entering its document ID and edit key.

JSONHosting documents are publicly readable, so do not store sensitive information in Tasker data. Local changes are sent after a 750 ms debounce. Tasker checks for remote revisions when it launches and then once per minute.

JSONHosting does not provide compare-and-swap writes. Tasker makes a best-effort check before saving, but it cannot eliminate the last-write-wins race when two clients PATCH the document simultaneously.

## Run locally

```bash
npm install
npm run dev
```

## Verify

```bash
npm run test:run
npm run build
```
