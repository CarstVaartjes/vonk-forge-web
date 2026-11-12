import { expect, test } from "vitest";

import css from "./styles.css?raw";

const outsideRoot = css.replace(/:root \{[\s\S]*?\n\}\n/, "");

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
