# Background Upload Implementation Plan

> Execute inline using superpowers:executing-plans. Use tests before implementation.

**Goal:** Upload, persist and synchronize the Today board background.
**Architecture:** Optional singleton backgrounds collection in AppState, using existing journal operations and conflict resolution. Store image name and data URL atomically. Existing datasets without backgrounds remain valid.
**Tech Stack:** React, Mantine, Zustand, IndexedDB, Vitest.
**Spec:** docs/background-upload-design.md

## Constraints

PNG, JPEG, WebP; maximum 5 MB. Keep default beach background. Save confirmation follows transaction completion. Include background in export/import and Tigris sync.

## Review Focus

Old datasets without backgrounds; concurrent first uploads; invalid image contents; failed storage writes; reset concurrent with upload.

## Tasks

- [x] Add failing background tests: state validation, old datasets, journal reopen, remote merge conflicts, reset, export/import. Journal reopen is tested through taskerStore.test.ts to cover the public write path as well.
- [x] Add BoardBackgroundImage type and optional singleton backgrounds collection; integrate entities, validation, applyChange and store setBoardBackground(image). Keep image metadata and bytes in one atomic field. Do not copy images into operation reference snapshots.
- [x] Add failing BackgroundSettings UI tests for upload, validation, preview, reset and write failure. Implement src/components/BackgroundSettings.tsx and src/domain/boardBackground.ts. Validate image decoding before persistence.
- [x] Wire background settings and image styles into src/App.tsx and src/styles.css. Render concise image names for background conflicts in DataTransferView.tsx.
- [x] Run targeted tests, complete suite, npm run build:pages and git diff --check. Review final diff and document export/sync behavior in README.md.

## Verification

216 tests passed across 28 files. GitHub Pages build passed. Background transfer, reset and both conflict resolution choices tested with two simulated computers. No live Tigris bucket was modified. Existing Vite warning about JavaScript bundle size remains.

Follow-up fix: use short Blob object URLs instead of putting full encoded images in CSS custom properties, which have browser size limits. Revoke URLs on replacement and unmount. Apply the background to both Today and the Tasks list. Added tests for large images and URL cleanup. Browser visual verification was unavailable.
