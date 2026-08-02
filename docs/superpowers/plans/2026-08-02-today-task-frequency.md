# Today Task Frequency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a task's schedule frequency in the expanded details panel on the Today screen.

**Architecture:** Keep schedule-to-copy formatting local to `TodayTaskDetailsPanel`, because it is presentation-only and consumes the existing `TaskSchedule`. Add a focused component test that renders real task data and asserts the visible label and value.

**Tech Stack:** React 19, TypeScript, Mantine, Vitest, Testing Library.

## Global Constraints

- Change only the expanded details panel in the Today screen.
- Use `Jednorazowo` for one-time tasks and day counts for recurring tasks.
- Do not change persisted task data.

---

### Task 1: Frequency detail in TodayTaskDetailsPanel

**Files:**
- Create: `src/components/today/TodayTaskDetailsPanel.test.tsx`
- Modify: `src/components/today/TodayTaskDetailsPanel.tsx`

**Interfaces:**
- Consumes: `TodayTask` with `task.schedule: TaskSchedule`.
- Produces: Visible `Częstotliwość` detail value.

- [ ] **Step 1: Write the failing component tests**

```tsx
it("shows one-time frequency", () => {
  renderPanel({ mode: "oneTime", date: "2026-08-02" });
  expect(screen.getByText("Częstotliwość")).toBeInTheDocument();
  expect(screen.getByText("Jednorazowo")).toBeInTheDocument();
});

it("shows an every-N-days frequency", () => {
  renderPanel({ mode: "recurring", startDate: "2026-08-02", recurrence: { type: "everyNDays", intervalDays: 3 } });
  expect(screen.getByText("Co 3 dni")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- src/components/today/TodayTaskDetailsPanel.test.tsx`

Expected: FAIL because the panel does not render `Częstotliwość` or its value.

- [ ] **Step 3: Implement the minimal schedule formatter and detail cell**

```tsx
function getFrequencyLabel(schedule: TaskSchedule): string {
  if (schedule.mode === "oneTime") return "Jednorazowo";
  const intervalDays = schedule.recurrence.type === "daily" ? 1 :
    schedule.recurrence.type === "everyNDays" ? schedule.recurrence.intervalDays :
    schedule.recurrence.type === "weekly" ? 7 :
    schedule.recurrence.type === "monthly" ? 30 : 90;
  return intervalDays === 1 ? "Co 1 dzień" : `Co ${intervalDays} dni`;
}
```

Render it in a `Grid.Col` using the existing `today-task-detail-label` and `today-task-detail-value` classes.

- [ ] **Step 4: Run focused tests to verify they pass**

Run: `npm test -- src/components/today/TodayTaskDetailsPanel.test.tsx`

Expected: PASS.

- [ ] **Step 5: Run the production build**

Run: `npm run build`

Expected: TypeScript type checking and Vite build succeed.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-08-02-today-task-frequency-design.md docs/superpowers/plans/2026-08-02-today-task-frequency.md src/components/today/TodayTaskDetailsPanel.tsx src/components/today/TodayTaskDetailsPanel.test.tsx
git commit -m "feat: show task frequency in today details"
```
