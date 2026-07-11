# Visual Theme and Layout Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a role-based visual system for Tasker that improves colors, typography, spacing, sizing, and future theme support without changing task behavior or domain logic.

**Architecture:** Keep visual decisions in CSS custom properties and Mantine theme configuration. Components should consume semantic variables or shared theme values instead of hardcoded green, gray, spacing, and radius values. The first theme is `olive-canvas`; additional themes override the same token contract through a root `data-theme` attribute.

**Tech Stack:** React 19, TypeScript, Mantine 9, CSS custom properties, Vitest, Testing Library, Vite

## Global Constraints

- Preserve existing task behavior, local storage, navigation, and domain logic.
- Use semantic color roles, not component-specific color names such as `task-green`.
- Keep `olive-canvas` as the default theme.
- Maintain keyboard focus visibility and readable contrast for interactive controls.
- Keep the design desktop-first and usable below 720px.
- Final verification must include `npm run test:run` and `npm run build`.

---

## File Structure

- Modify: `src/styles.css`
  - Define color, spacing, typography, radius, shadow, and responsive tokens; add base component utility styles and theme overrides.
- Modify: `src/main.tsx`
  - Configure the Mantine theme and global CSS integration if the current app entry point owns the provider.
- Modify: `src/App.tsx`
  - Replace page-level hardcoded layout values with semantic layout classes or shared Mantine theme values.
- Modify: `src/components/today/TodaySummaryHeader.tsx`
  - Apply the new title, date, and task-count hierarchy.
- Modify: `src/components/today/TodayTaskRow.tsx`
  - Apply compact row sizing, semantic status colors, and action hierarchy.
- Modify: `src/components/today/TodayTaskDetailsPanel.tsx`
  - Use the muted surface and metadata typography tokens.
- Modify: `src/components/today/TodayPostponeMenu.tsx`
  - Align secondary action sizing and focus states with the new system.
- Modify: `src/components/today/TodayCompletedSection.tsx`
  - Apply the lower-priority completed-state treatment.
- Modify: `src/components/today/TodayActiveList.tsx`
  - Apply list spacing and empty-state sizing.
- Modify: `src/App.test.tsx`
  - Add stable theme and accessibility assertions where component behavior depends on semantic styling hooks.
- Create: `src/styles.test.ts`
  - Verify the required theme token contract exists in the loaded document.

### Task 1: Define the semantic token contract

**Files:**
- Modify: `src/styles.css`
- Test: `src/styles.test.ts`

**Interfaces:**
- Produces CSS variables including `--color-bg-app`, `--color-bg-surface`, `--color-text-primary`, `--color-accent`, `--color-success`, `--color-warning`, `--color-danger`, `--space-1` through `--space-9`, and `--radius-sm` through `--radius-lg`.

- [ ] **Step 1: Write the failing token-contract test**

```ts
import { describe, expect, it } from "vitest";

describe("visual token contract", () => {
  it("exposes the semantic theme tokens used by the UI", () => {
    const styles = getComputedStyle(document.documentElement);

    expect(styles.getPropertyValue("--color-bg-app")).toBeTruthy();
    expect(styles.getPropertyValue("--color-bg-surface")).toBeTruthy();
    expect(styles.getPropertyValue("--color-text-primary")).toBeTruthy();
    expect(styles.getPropertyValue("--color-accent")).toBeTruthy();
    expect(styles.getPropertyValue("--color-danger-soft")).toBeTruthy();
    expect(styles.getPropertyValue("--space-4")).toBeTruthy();
    expect(styles.getPropertyValue("--radius-md")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- src/styles.test.ts`
Expected: FAIL because the semantic variables do not yet exist.

- [ ] **Step 3: Add the default token set to `src/styles.css`**

Use these values for `olive-canvas`:

```css
:root,
:root[data-theme="olive-canvas"] {
  --color-bg-app: #f6f4ef;
  --color-bg-surface: #fffdf9;
  --color-bg-muted: #f1ede4;
  --color-bg-elevated: #ffffff;
  --color-border-subtle: #e6dfd2;
  --color-border-default: #d9cfbe;
  --color-border-strong: #c7bba6;
  --color-text-primary: #1f1c17;
  --color-text-secondary: #5e574d;
  --color-text-muted: #8a8175;
  --color-text-on-accent: #f8f7f3;
  --color-accent: #3f7a57;
  --color-accent-hover: #35694a;
  --color-accent-pressed: #2d593f;
  --color-accent-soft: #e3f0e7;
  --color-success: #2f7a4b;
  --color-success-soft: #dff1e5;
  --color-warning: #c9831f;
  --color-warning-soft: #fff1d9;
  --color-danger: #c7543f;
  --color-danger-soft: #fde7e3;
  --color-info: #4d6b8a;
  --color-info-soft: #e6eef6;
  --color-focus-ring: #7faa8e;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-7: 32px;
  --space-8: 40px;
  --space-9: 48px;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --shadow-soft: 0 8px 24px rgb(58 45 24 / 6%);
}
```

- [ ] **Step 4: Add base typography, body, focus, and responsive rules**

Set the body background to `--color-bg-app`, primary text to `--color-text-primary`, font stack to `Inter, Manrope, ui-sans-serif, system-ui, sans-serif`, and focus outlines to `2px solid var(--color-focus-ring)` with a `2px` offset. Add a `@media (max-width: 720px)` rule that reduces page padding to `12px` and preserves readable button hit areas.

- [ ] **Step 5: Run the token test**

Run: `npm run test:run -- src/styles.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit the token foundation**

```bash
git add src/styles.css src/styles.test.ts
git commit -m "feat: add semantic visual theme tokens"
```

### Task 2: Add future theme overrides

**Files:**
- Modify: `src/styles.css`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Consumes the default token contract from Task 1.
- Produces theme overrides for `[data-theme="slate-focus"]`, `[data-theme="terracotta-paper"]`, and `[data-theme="nordic-mist"]`.

- [ ] **Step 1: Add theme override blocks**

Each override must define at least `--color-bg-app`, `--color-bg-surface`, `--color-accent`, `--color-accent-hover`, `--color-accent-soft`, `--color-success`, `--color-warning`, and `--color-danger`. Do not duplicate component rules inside theme blocks.

- [ ] **Step 2: Add a root theme hook in `App.tsx` or the app shell**

Use `data-theme="olive-canvas"` on the highest stable app element. Keep the value static for this task; theme switching is not part of the behavior change. The attribute provides a safe integration point for a future settings control.

- [ ] **Step 3: Test the theme hook**

```ts
it("mounts the default visual theme on the app shell", () => {
  renderApp();
  expect(document.querySelector('[data-theme="olive-canvas"]')).toBeInTheDocument();
});
```

Run: `npm run test:run -- src/App.test.tsx -t "default visual theme"`
Expected: PASS.

- [ ] **Step 4: Commit theme variants**

```bash
git add src/styles.css src/App.tsx src/App.test.tsx
git commit -m "feat: add future visual theme variants"
```

### Task 3: Apply typography and layout hierarchy

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/today/TodaySummaryHeader.tsx`
- Modify: `src/components/today/TodayActiveList.tsx`
- Modify: `src/components/today/TodayCompletedSection.tsx`

**Interfaces:**
- Consumes semantic tokens from Tasks 1-2.
- Preserves existing component props and event handlers.

- [ ] **Step 1: Add explicit layout classes without changing behavior**

Create classes for the page frame, summary header, active list, completed section, and empty state. Use `max-width: 1440px`, `padding: 32px`, `gap: var(--space-6)`, and `border-radius: var(--radius-lg)` for the main surface. Use `20–24px` row spacing only through shared variables.

- [ ] **Step 2: Update the summary hierarchy**

Set the page title to `44–48px` desktop and `36px` mobile, weight `700`; keep the date at `15–16px`; render the count badge with `--color-accent-soft` and `--color-accent`. Keep the existing Polish labels and props unchanged.

- [ ] **Step 3: Update list and completed-section spacing**

Use `gap: var(--space-2)` between task rows, `var(--space-6)` between major sections, and a visually quieter completed section using `--color-bg-muted` and `--color-border-subtle`.

- [ ] **Step 4: Run component tests and build**

Run: `npm run test:run -- src/App.test.tsx`
Expected: PASS with existing behavior unchanged.

Run: `npm run build`
Expected: PASS with no TypeScript or CSS integration errors.

- [ ] **Step 5: Commit hierarchy changes**

```bash
git add src/App.tsx src/components/today/TodaySummaryHeader.tsx src/components/today/TodayActiveList.tsx src/components/today/TodayCompletedSection.tsx
git commit -m "style: improve today layout hierarchy"
```

### Task 4: Apply semantic colors and compact task sizing

**Files:**
- Modify: `src/components/today/TodayTaskRow.tsx`
- Modify: `src/components/today/TodayTaskDetailsPanel.tsx`
- Modify: `src/components/today/TodayPostponeMenu.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Preserves `TodayTaskRow` action callbacks and accessible labels.
- Produces a compact desktop row with a responsive action layout.

- [ ] **Step 1: Add visual regression assertions for action roles**

Extend the existing today view tests to assert that the primary completion action remains present, the postpone action remains separately discoverable, and the expanded panel retains its accessible content. Do not assert implementation-specific Mantine class names.

- [ ] **Step 2: Style task rows using semantic roles**

Use `--color-bg-surface`, `--color-border-subtle`, `var(--radius-md)`, and `padding: var(--space-5) var(--space-6)`. Keep the task title at `22–24px` and the secondary status at `15–16px`. Use `--color-success` only for the completion action.

- [ ] **Step 3: Replace status colors with soft semantic badges**

Use danger tokens for overdue states, warning tokens for cautionary states, and neutral surface/text tokens for non-overdue states. Do not use the accent color for every badge.

- [ ] **Step 4: Style details and postpone controls**

Use `--color-bg-muted` for the inline details panel, `13–14px` metadata labels, and `15–16px` values. Keep postpone as a secondary button with neutral border and background. Ensure the menu and date input retain visible focus styles.

- [ ] **Step 5: Add narrow-screen layout rules**

Below `900px`, allow row actions to wrap. Below `600px`, stack the task title and actions while preserving a minimum `44px` interactive target. Keep details in one or two columns depending on available width.

- [ ] **Step 6: Run focused tests and build**

Run: `npm run test:run -- src/App.test.tsx`
Expected: PASS.

Run: `npm run build`
Expected: PASS.

- [ ] **Step 7: Commit component styling**

```bash
git add src/styles.css src/components/today/TodayTaskRow.tsx src/components/today/TodayTaskDetailsPanel.tsx src/components/today/TodayPostponeMenu.tsx src/App.test.tsx
git commit -m "style: apply semantic colors to today tasks"
```

### Task 5: Final accessibility, responsive, and regression verification

**Files:**
- Modify: `src/styles.css`
- Modify: `src/App.test.tsx` if an assertion exposes a regression

- [ ] **Step 1: Run the complete test suite**

Run: `npm run test:run`
Expected: PASS for all domain and component tests.

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: PASS with a successful Vite bundle and no TypeScript errors.

- [ ] **Step 3: Inspect responsive behavior**

Run: `npm run dev`
Check the Today view at desktop width, approximately `900px`, and approximately `600px`. Confirm that task actions remain usable, no horizontal overflow is introduced, and focus rings remain visible.

- [ ] **Step 4: Review token usage**

Run: `rg "color=|#[0-9A-Fa-f]{3,8}|gap=|radius=" src/components src/App.tsx`
Expected: no new hardcoded visual values in the redesigned Today components unless they are required for a Mantine API value and documented by the shared styles.

- [ ] **Step 5: Commit the verified result**

```bash
git add src/styles.css src/main.tsx src/App.tsx src/components/today src/App.test.tsx src/styles.test.ts
git commit -m "refactor: finalize themeable visual redesign"
```

## Self-Review

- Color palette and future themes are covered by Tasks 1-2.
- Typography, sizing, spacing, and layout hierarchy are covered by Task 3.
- Task-row colors, badges, action hierarchy, details panel, and responsive wrapping are covered by Task 4.
- Keyboard focus and regression verification are covered by Tasks 1, 2, 4, and 5.
- Existing task/domain behavior remains outside the plan's mutation scope.
- No component-specific color token or placeholder task is required.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-11-visual-theme-redesign.md`. Two execution options:

**1. Subagent-Driven (recommended)** - Dispatch a fresh subagent per task and review between tasks.

**2. Inline Execution** - Execute the tasks in this session using `superpowers:executing-plans` with checkpoints.

Which approach?
