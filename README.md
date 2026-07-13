# Tasker

Tasker is a local-first React app for recurring tasks. It stores data in the browser under the versioned `localStorage` key `tasker:v1`; it has no backend or login.

## GitHub Pages

Tasker deploys to [mkosmala1984.github.io/tasker](https://mkosmala1984.github.io/tasker/) through GitHub Pages. GitHub Actions runs tests and a Pages-targeted production build for pull requests to `main`, then deploys the built app after changes are pushed to `main`.

Before the first deployment, configure the repository in **Settings → Pages** with **Source: GitHub Actions**.

## Tigris synchronization

Tigris is the primary optional synchronization provider. Create a dedicated, private bucket for Tasker with only the minimum permissions needed to read and write its task object; do not make the object public. Browser access comes from the bucket CORS policy.

In **Data**, enter all four required values:

- the Tigris bucket name;
- the object key (defaults to `tasker.json`);
- the access-key ID; and
- the secret access key.

Configure the bucket with this CORS rule (replace the GitHub Pages origin if you deploy Tasker under another account):

```json
[
  {
    "AllowedOrigins": ["http://localhost:5173", "https://mkosmala1984.github.io"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["Authorization", "Content-Type", "x-amz-content-sha256", "x-amz-date"]
  }
]
```

Tasker stores the four Tigris values in this browser's `localStorage`. In particular, the secret access key can be read by JavaScript running on the Tasker origin, so use a dedicated least-privileged bucket and keep only non-sensitive task data there.

When you connect, Tasker reads the configured object. If it does not exist, Tasker automatically creates it from the current local tasks. Changes are saved after a 1-second debounce and Tasker checks the remote object at launch and once per minute. Simultaneous final writes are still last-write-wins: Tigris does not provide compare-and-swap protection for this flow.

## JSONHosting synchronization

JSONHosting remains available as a separate optional synchronization provider. Tasker remains usable offline: every change is saved locally first. To synchronize the same task data across devices with JSONHosting, open **Data** and connect an existing JSONHosting document by entering its document ID and edit key.

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
npm run build:pages
```
