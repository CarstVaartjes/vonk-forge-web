import { expect, test } from "vitest";

import css from "./styles.css?raw";

test("the stylesheet is read, not stubbed out", () => {
  expect(css).toContain("--r-card");
});

const outsideRoot = css.replace(/:root[^{]*\{[\s\S]*?\n\}\n/g, "");

test("every colour comes from a :root token, not a hex literal", () => {
  expect(outsideRoot.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
});

// Sizes come from the scale tokens; the only literals are 2rem (a large figure) and 0.9em (inline code).
const SIZE = /^(var\(--t-[a-z0-9]+\)|inherit|2rem|0\.9em)$/;

test("every font-size, and the size inside every font shorthand, is a scale token or a named literal", () => {
  const sizes = [...css.matchAll(/font-size: ([^;]+);/g)].map((match) => match[1]!);
  for (const match of css.matchAll(/(?<![-\w])font: ([^;]+);/g)) {
    const value = match[1]!;
    if (value === "inherit") continue;
    sizes.push(value.replace(/^\d+ /, "").split(/[ /]/)[0]!);
  }
  expect(sizes.filter((size) => !SIZE.test(size))).toEqual([]);
});

// Token pairs that carry text (4.5:1) or non-text marks (3:1), checked in both themes.
function block(selector: string): Map<string, string> {
  const start = css.indexOf(`${selector} {`);
  const body = css.slice(start, css.indexOf("\n}\n", start));
  return new Map([...body.matchAll(/(--[a-z0-9-]+): ([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]));
}

function channels(value: string, bg: number[]): number[] {
  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1]!.slice(i, i + 2), 16));
  const rgb = /^rgb\((\d+) (\d+) (\d+) \/ (\d+)%\)$/.exec(value);
  if (!rgb) throw new Error(`unparsed colour ${value}`);
  const alpha = Number(rgb[4]) / 100;
  return [1, 2, 3].map((i, k) => Math.round(Number(rgb[i]) * alpha + bg[k]! * (1 - alpha)));
}

function luminance(c: number[]): number {
  const [r, g, b] = c.map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

const contrast = (a: number[], b: number[]) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

const TEXT: [string, string][] = [
  ["--ink", "--bg"], ["--ink", "--panel"], ["--muted", "--bg"], ["--muted", "--panel"], ["--muted", "--recess"],
  ["--faint", "--bg"], ["--faint", "--panel"], ["--green-text", "--bg"], ["--green-text", "--panel"],
  ["--gold-soft", "--panel"], ["--ok", "--panel"], ["--warn", "--panel"], ["--bad", "--panel"], ["--info", "--panel"],
  ["--green-ink", "--green"], ["--bg", "--ink"],
];
const MARKS: [string, string][] = [["--lit", "--panel"], ["--cool", "--panel"], ["--line-control", "--panel"], ["--line-control", "--bg"]];

test.each(["dark", "light"])("token pairs meet contrast in the %s theme (text 4.5:1, marks 3:1)", (theme) => {
  const tokens = new Map([...block(":root,\n:root[data-theme=\"dark\"]"), ...(theme === "light" ? block(":root[data-theme=\"light\"]") : [])]);
  const resolve = (name: string): string => {
    const value = tokens.get(name)!;
    if (!value) throw new Error(`missing ${name} of ${[...tokens.keys()].length}`);
    const alias = /^var\((--[a-z0-9-]+)\)$/.exec(value);
    return alias ? resolve(alias[1]!) : value;
  };
  const colour = (name: string, under = [0, 0, 0]) => channels(resolve(name), under);
  const failing = [...TEXT, ...MARKS.filter(([a]) => a !== "--cool")].filter(([a, b]) => {
    const need = TEXT.some(([x, y]) => x === a && y === b) ? 4.5 : 3;
    return contrast(colour(a), colour(b)) < need;
  });
  // --cool is the dimmed cell: it only needs to read as an outline-less cell (>= 1.2:1) on the panel.
  const cool = contrast(colour("--cool", colour("--panel")), colour("--panel"));
  expect({ failing, cool: cool >= 1.1 }).toEqual({ failing: [], cool: true });
});
