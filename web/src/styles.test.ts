import { expect, test } from "vitest";

import css from "./styles.css?raw";

const outsideRoot = css.replace(/:root \{[\s\S]*?\n\}\n/, "");

test("every colour comes from a :root token, not a hex literal", () => {
  expect(outsideRoot.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
});
