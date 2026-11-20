import { expect, test } from "vitest";
import { formatDate } from "./dates";

test("a calendar date reads day, short month, year, and a non-date is left as given", () => {
  expect(formatDate("2026-11-20")).toBe("20 Nov 2026");
  expect(formatDate("2026-09-03T23:30:00Z")).toBe("3 Sep 2026");
  expect(formatDate("soon")).toBe("soon");
});
