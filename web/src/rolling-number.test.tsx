import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { RollingNumber } from "./rolling-number";


describe("rolling number", () => {
  test("renders the true value in the markup, grouped, as plain text", () => {
    const { container } = render(<RollingNumber value={1234} />);
    expect(container.textContent).toBe("1,234");
    expect(container.querySelectorAll(".rolling-column")).toHaveLength(4);
    expect(container.querySelector("[aria-hidden]")).toBeNull();
  });

  test("renders a single digit and zero", () => {
    expect(render(<RollingNumber value={0} />).container.textContent).toBe("0");
    expect(render(<RollingNumber value={7} />).container.textContent).toBe("7");
  });
});
