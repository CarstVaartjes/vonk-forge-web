// The theme follows the system until the visitor picks one; the pick is remembered.
// public/theme-init.js applies the same rule before first paint.
export type Theme = "dark" | "light";

export const THEME_KEY = "vonk-theme";

function stored(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === "dark" || value === "light" ? value : null;
  } catch {
    return null;
  }
}

function system(): Theme {
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function currentTheme(): Theme {
  return stored() ?? system();
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
}

export function chooseTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Blocked storage: the choice lasts for this visit.
  }
  applyTheme(theme);
}

// While the visitor has not picked, a change of the system setting is followed.
export function followSystem(onChange: (theme: Theme) => void): () => void {
  const query = window.matchMedia("(prefers-color-scheme: light)");
  const listener = () => {
    if (stored() === null) onChange(system());
  };
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}
