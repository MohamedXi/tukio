import '@testing-library/jest-dom/vitest';

// Radix UI components require ResizeObserver — jsdom doesn't provide it.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
