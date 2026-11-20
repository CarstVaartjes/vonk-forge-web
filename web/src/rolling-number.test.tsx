import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { RollingNumber } from "./rolling-number";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

function stubMotion(reduced: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: reduced && query.includes("reduce"), media: query }));
  vi.stubGlobal("requestAnimationFrame", (callback: () => void) => { callback(); return 0; });
}

describe("rolling number", () => {
  test("paints the true value, grouped, as plain text on first render and never rolls from zero", () => {
    stubMotion(false);
    const { container } = render(<RollingNumber value={1234} />);
    expect(container.textContent).toBe("1,234");
    expect(container.querySelector(".rolling-strip")).toBeNull();
    expect(container.querySelector("[aria-hidden]")).toBeNull();
  });

  test("renders a single digit and zero", () => {
    expect(render(<RollingNumber value={0} />).container.textContent).toBe("0");
    expect(render(<RollingNumber value={7} />).container.textContent).toBe("7");
  });

  test("rolls only when the value changes, in whole-em steps, then returns to plain text", () => {
    vi.useFakeTimers();
    stubMotion(false);
    const { container, rerender } = render(<RollingNumber value={61} />);
    rerender(<RollingNumber value={72} />);
    const strips = [...container.querySelectorAll<HTMLElement>(".rolling-strip")];
    expect(strips.map((strip) => strip.style.getPropertyValue("--digit"))).toEqual(["7", "2"]);
    expect(container.querySelector(".visually-hidden")).toHaveTextContent("72");
    act(() => { vi.advanceTimersByTime(1300); });
    expect(container.textContent).toBe("72");
    expect(container.querySelector(".rolling-strip")).toBeNull();
  });

  test("under reduced motion a change is plain text at once", () => {
    stubMotion(true);
    const { container, rerender } = render(<RollingNumber value={61} />);
    rerender(<RollingNumber value={72} />);
    expect(container.textContent).toBe("72");
    expect(container.querySelector(".rolling-strip")).toBeNull();
  });
});
