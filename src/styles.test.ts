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
