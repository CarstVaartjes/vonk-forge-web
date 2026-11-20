// Every page of the site, once. app.tsx must render each one (its page table is keyed by this
// list), and the accessibility scan in e2e/acceptance.spec.ts visits each one, so a new page
// is added here and is covered from the first commit.
export const ROUTES = [
  "/",
  "/architecture",
  "/control",
  "/example-setup",
  "/install",
  "/models",
  "/models/:publisher/:slug",
  "/privacy",
  "/publish",
  "/recipes",
  "/recipes/:publisher/:slug",
] as const;

export type Route = (typeof ROUTES)[number];
export type RouteMatch = { route: Route; params: { publisher: string; slug: string } };

export function matchRoute(pathname: string): RouteMatch | null {
  const parts = pathname.split("/").filter(Boolean);
  for (const route of ROUTES) {
    const pattern = route.split("/").filter(Boolean);
    if (pattern.length !== parts.length) continue;
    const params = { publisher: "", slug: "" };
    const fits = pattern.every((part, index) => {
      const value = parts[index] ?? "";
      if (part === ":publisher") { params.publisher = value; return true; }
      if (part === ":slug") { params.slug = value; return true; }
      return part === value;
    });
    if (fits) return { route, params };
  }
  return null;
}
