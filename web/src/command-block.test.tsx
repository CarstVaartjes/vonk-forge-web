import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { CommandBlock } from "./command-block";

test("Copy writes the exact command, announces Copied, and is a real button", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  const command = "vonkctl fleet\nvonkctl fleet activity --json";
  render(<CommandBlock label="Terminal">{command}</CommandBlock>);
  const button = screen.getByRole("button", { name: "Copy" });
  expect(button.tagName).toBe("BUTTON");
  expect(button).not.toHaveAttribute("tabindex", "-1");
  fireEvent.click(button);
  expect(writeText).toHaveBeenCalledWith(command);
  expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument();
});

test("the shell prompt is drawn by CSS, so the text stays the bare command, and code can opt out", () => {
  const { container, rerender } = render(<CommandBlock label="Terminal">vonkctl fleet</CommandBlock>);
  expect(container.querySelector("code")).toHaveClass("prompted");
  expect(container.querySelector("code")).toHaveTextContent(/^vonkctl fleet$/);
  rerender(<CommandBlock label="Python" prompt={false}>print(1)</CommandBlock>);
  expect(container.querySelector("code")).not.toHaveClass("prompted");
});
