import { describe, expect, it } from "vitest";
import { createEmptyState, loadState, saveState, STORAGE_KEY } from "./taskerStorage";

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => Array.from(data.keys())[index] ?? null,
    removeItem: (key: string) => {
      data.delete(key);
    },
    setItem: (key: string, value: string) => {
      data.set(key, value);
    }
  };
}

describe("taskerStorage", () => {
  it("returns empty state when storage has no data", () => {
    const result = loadState(memoryStorage());

    expect(result.state).toEqual(createEmptyState());
    expect(result.error).toBeUndefined();
  });

  it("falls back to empty state for invalid JSON", () => {
    const result = loadState(memoryStorage({ [STORAGE_KEY]: "{bad-json" }));

    expect(result.state).toEqual(createEmptyState());
    expect(result.error).toBe("Nie można odczytać lokalnych danych.");
  });

  it("falls back to empty state for unknown version", () => {
    const result = loadState(memoryStorage({ [STORAGE_KEY]: JSON.stringify({ version: 2 }) }));

    expect(result.state).toEqual(createEmptyState());
    expect(result.error).toBe("Nieobsługiwana wersja lokalnych danych.");
  });

  it("loads a valid state", () => {
    const state = createEmptyState();
    const result = loadState(memoryStorage({ [STORAGE_KEY]: JSON.stringify(state) }));

    expect(result.state).toEqual(state);
  });

  it("saves state under a versioned key", () => {
    const storage = memoryStorage();
    const state = createEmptyState();

    saveState(state, storage);

    expect(storage.getItem(STORAGE_KEY)).toBe(JSON.stringify(state));
  });
});
