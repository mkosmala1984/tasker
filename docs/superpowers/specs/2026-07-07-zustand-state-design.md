# Zustand state management design

## Goal

Move Tasker's application state management from the local `useTaskerState` React hook to a Zustand store. The migration should preserve the current local-first behavior, tests, and domain model.

## Architecture

Create a Zustand store in `src/state/taskerStore.ts`. The store owns the same application surface that `useTaskerState` owns today:

- persisted `AppState`
- `storageError` from initial localStorage loading
- `TodayFilters`
- task mutation actions
- a test reset action for deterministic test setup

The domain layer stays unchanged. Store actions call the existing functions from `src/domain/tasks.ts`, `src/domain/todayList.ts`, and `src/domain/dates.ts` instead of duplicating business logic.

## Data Flow

At module initialization, the store loads initial data through `loadState()`. Each task mutation computes the next `AppState`, updates the Zustand store, and persists it through `saveState()`.

The current date remains injectable from `App` through a store action or hook parameter so tests can keep using a fixed date. Derived values such as today's date label and filtered today list are computed with existing domain helpers.

## Components

`App.tsx` reads from Zustand using selectors and passes values/actions to existing child components. Child components do not need to know about Zustand and keep receiving props as they do today.

The old `useTaskerState` hook can be removed if `App.tsx` no longer imports it. If a thin wrapper is useful during implementation, it should not remain as the primary state abstraction unless it simplifies tests without hiding the store.

## Error Handling

Local storage load errors continue to appear through the existing `storageError` alert. Save behavior remains best-effort and matches the current implementation, which does not surface save failures.

## Testing

Keep the existing app behavior tests. Reset the Zustand store in `beforeEach` after clearing `localStorage` so state does not leak between tests. Add a focused store test only if the migration introduces behavior not already covered by the app tests.

## Out of Scope

This change does not add server sync, authentication, data migrations, new task features, or persisted filters.
