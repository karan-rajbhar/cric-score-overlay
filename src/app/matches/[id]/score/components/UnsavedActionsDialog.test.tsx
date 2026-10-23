import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UnsavedActionsDialog } from "./UnsavedActionsDialog";

const items = [
  { id: "q1", description: "Four, Starc to Kohli", error: "Refused: striker_mismatch" },
  { id: "q2", description: "Bowler: Cummins", error: "Not sent: an earlier action was refused" },
];

describe("UnsavedActionsDialog", () => {
  it("lists what was not saved and sends it again", () => {
    const onResend = vi.fn();
    render(
      <UnsavedActionsDialog
        open
        onOpenChange={vi.fn()}
        items={items}
        onResend={onResend}
        onDiscard={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "2 actions not saved" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Four, Starc to Kohli")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Send again" }));
    expect(onResend).toHaveBeenCalled();
  });

  it("discards one at once, but asks before discarding all", () => {
    const onDiscard = vi.fn();
    render(
      <UnsavedActionsDialog
        open
        onOpenChange={vi.fn()}
        items={items}
        onResend={vi.fn()}
        onDiscard={onDiscard}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Discard: Bowler: Cummins" }),
    );
    expect(onDiscard).toHaveBeenCalledWith("q2");
    fireEvent.click(screen.getByRole("button", { name: "Discard all" }));
    expect(onDiscard).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert")).toHaveTextContent("Discard all 2 actions?");
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(onDiscard).toHaveBeenLastCalledWith(null);
  });

  it("cannot send while offline", () => {
    render(
      <UnsavedActionsDialog
        open
        onOpenChange={vi.fn()}
        items={items}
        onResend={vi.fn()}
        onDiscard={vi.fn()}
        offline
      />,
    );
    expect(screen.getByRole("button", { name: "Send again" })).toBeDisabled();
  });
});
