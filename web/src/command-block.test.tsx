import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { CommandBlock } from "./command-block";

test("Copy writes the exact command, announces Copied, and is a real button", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  const command = "vonkctl fleet\nvonkctl fleet activity --json";
  render(<CommandBlock label="Terminal">{command}</CommandBlock>);
  const button = screen.getByRole("button", { name: "Copy terminal command" });
  expect(button.tagName).toBe("BUTTON");
  expect(button).not.toHaveAttribute("tabindex", "-1");
  fireEvent.click(button);
  expect(writeText).toHaveBeenCalledWith(command);
  expect(await screen.findByText("Copied")).toBeInTheDocument();
});
