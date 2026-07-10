import "@testing-library/jest-dom/vitest";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false
  })
});

class TestResizeObserver implements ResizeObserver {
  observe() {}

  unobserve() {}

  disconnect() {}
}

Object.defineProperty(window, "ResizeObserver", {
  writable: true,
  value: TestResizeObserver
});

Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
  writable: true,
  value: () => undefined
});

Object.defineProperty(window.HTMLAnchorElement.prototype, "click", {
  writable: true,
  value: () => undefined
});

Object.defineProperty(URL, "createObjectURL", {
  writable: true,
  value: () => "blob:test"
});

Object.defineProperty(URL, "revokeObjectURL", {
  writable: true,
  value: () => undefined
});
