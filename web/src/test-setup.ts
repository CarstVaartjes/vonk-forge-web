import "@testing-library/jest-dom/vitest";

// jsdom has no matchMedia; the theme reads the system setting through it (dark unless a test stubs it).
if (typeof window !== "undefined") window.matchMedia ??= ((query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined })) as unknown as typeof window.matchMedia;
