# Podsumowanie wykonań w widoku „Dzisiaj” Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wyświetlać przy każdym zadaniu w widoku „Dzisiaj” datę ostatniego wykonania i łączną liczbę wykonań.

**Architecture:** Warstwa domenowa oblicza liczbę rekordów ukończenia danego zadania i przekazuje ją jako część `TodayTask`. `TodayTaskRow` renderuje oba elementy podsumowania dla zadań aktywnych i wykonanych dzisiaj. Stan zapisany w przeglądarce nie zmienia się.

**Tech Stack:** TypeScript, React 19, Mantine, Vitest, React Testing Library.

## Global Constraints

- Informacja jest widoczna wyłącznie w widoku „Dzisiaj”.
- Dla braku wykonań użyj tekstu „Jeszcze nie wykonano”.
- Nie zmieniaj formatu `AppState` ani rekordów `Completion`.

---

## File structure

- `src/domain/types.ts` — rozszerza model wiersza „Dzisiaj” o liczbę wykonań.
- `src/domain/todayList.ts` — oblicza liczbę wykonań i przekazuje ją dla obu grup widoku.
- `src/domain/todayList.test.ts` — sprawdza obliczanie podsumowania z historii.
- `src/components/today/TodayTaskRow.tsx` — wyświetla liczbę wykonań obok istniejącej daty ostatniego wykonania.
- `src/components/today/TodayTaskRow.test.tsx` — sprawdza tekst widoczny użytkownikowi dla historii i jej braku.

### Task 1: Udostępnienie liczby wykonań w modelu „Dzisiaj”

**Files:**
- Modify: `src/domain/types.ts:85-94`
- Modify: `src/domain/todayList.ts:4-82`
- Test: `src/domain/todayList.test.ts`

**Consumes:** `AppState.completions: Completion[]`.

**Produces:** `TodayTask.completionCount: number` ustawiane dla elementów aktywnych i wykonanych dzisiaj.

- [ ] **Step 1: Write the failing test**

Dodaj do `src/domain/todayList.test.ts` test z dwoma rekordami `Completion` dla `task-1` oraz jednym dla innego zadania. Sprawdź rzeczywisty wynik `buildTodayTaskGroup`:

```ts
expect(group.active[0]).toMatchObject({
  lastCompletedDate: "2026-07-04",
  completionCount: 2
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/domain/todayList.test.ts`

Expected: FAIL, ponieważ `completionCount` nie istnieje w elemencie listy.

- [ ] **Step 3: Write minimal implementation**

W `TodayTask` dodaj `completionCount: number`. W `todayList.ts` dodaj pomocnik liczący wpisy z pasującym `taskId` i ustawiaj wynik przy tworzeniu elementu aktywnego oraz wykonanego:

```ts
function getCompletionCount(taskId: string, completions: Completion[]): number {
  return completions.filter((completion) => completion.taskId === taskId).length;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/domain/todayList.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/types.ts src/domain/todayList.ts src/domain/todayList.test.ts
git commit -m "feat: expose completion count in today tasks"
```

### Task 2: Wyświetlenie podsumowania wiersza zadania

**Files:**
- Modify: `src/components/today/TodayTaskRow.tsx:15-28`
- Create: `src/components/today/TodayTaskRow.test.tsx`

**Consumes:** `TodayTask.lastCompletedDate?: string` oraz `TodayTask.completionCount: number`.

**Produces:** Tekst „Ostatnio wykonane: <data> · Wykonano: <liczba> razy” lub „Jeszcze nie wykonano · Wykonano: 0 razy”.

- [ ] **Step 1: Write the failing tests**

Utwórz test komponentu renderujący `TodayTaskRow` z minimalnymi pustymi funkcjami akcji. Sprawdź obie wersje widoczne w interfejsie:

```tsx
expect(screen.getByText("Ostatnio wykonane: 2026-07-04 · Wykonano: 2 razy")).toBeInTheDocument();
expect(screen.getByText("Jeszcze nie wykonano · Wykonano: 0 razy")).toBeInTheDocument();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/components/today/TodayTaskRow.test.tsx`

Expected: FAIL, ponieważ komponent nie renderuje liczby wykonań.

- [ ] **Step 3: Write minimal implementation**

Zbuduj tekst metadanych w `TodayTaskRow.tsx` z istniejącego komunikatu o dacie i liczby z `item.completionCount`:

```ts
const completionText = item.lastCompletedDate ? `Ostatnio wykonane: ${item.lastCompletedDate}` : "Jeszcze nie wykonano";
const completionSummary = `${completionText} · Wykonano: ${item.completionCount} razy`;
```

Wyświetl `completionSummary` w istniejącym elemencie `<Text className="today-task-meta">`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- src/components/today/TodayTaskRow.test.tsx src/domain/todayList.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/today/TodayTaskRow.tsx src/components/today/TodayTaskRow.test.tsx
git commit -m "feat: show completion summary in today rows"
```

### Task 3: Pełna weryfikacja

**Files:**
- Verify: `src/domain/todayList.test.ts`
- Verify: `src/components/today/TodayTaskRow.test.tsx`
- Verify: `src/App.test.tsx`

- [ ] **Step 1: Run the full test suite**

Run: `npm run test:run`

Expected: PASS for all test files.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: exit code 0 and a completed Vite build.
