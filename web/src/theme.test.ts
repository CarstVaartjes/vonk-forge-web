import { afterEach, expect, test, vi } from "vitest";

import { chooseTheme, currentTheme, THEME_KEY } from "./theme";
import initScript from "../public/theme-init.js?raw";

function systemPrefers(theme: "dark" | "light") {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: theme === "light" && query.includes("light"), addEventListener: () => undefined, removeEventListener: () => undefined }));
}

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  vi.unstubAllGlobals();
});

test("follows the system until the visitor picks, then remembers the pick", () => {
  systemPrefers("light");
  expect(currentTheme()).toBe("light");
  chooseTheme("dark");
  expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  expect(currentTheme()).toBe("dark");
});

test("the pre-paint script reads the same key and sets the attribute", () => {
  expect(initScript).toContain(`"${THEME_KEY}"`);
  systemPrefers("light");
  localStorage.setItem(THEME_KEY, "dark");
  new Function(initScript)();
  expect(document.documentElement).toHaveAttribute("data-theme", "dark");
});
