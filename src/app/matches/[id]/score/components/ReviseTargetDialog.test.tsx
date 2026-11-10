import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ReviseTargetDialog } from "./ReviseTargetDialog";

function open(
  props: {
    currentOvers?: number | null;
    reply?: { error: string | null };
  } = {},
) {
  const onConfirm = vi.fn(async () => props.reply);
  const onOpenChange = vi.fn();
  render(
    <ReviseTargetDialog
      open={true}
      onOpenChange={onOpenChange}
      currentTarget={161}
      currentOvers={props.currentOvers ?? 20}
      maxOvers={20}
      onConfirm={onConfirm}
    />,
  );
  const save = () =>
    fireEvent.click(
      screen.getByRole("button", { name: /save revised target/i }),
    );
  return { onConfirm, onOpenChange, save };
}

describe("ReviseTargetDialog", () => {
  it("shows the chase's revised overs and sends whole numbers", () => {
    const { onConfirm, save } = open({ currentOvers: 12 });
    expect(screen.getByLabelText(/target runs to win/i)).toHaveValue(161);
    expect(screen.getByLabelText(/revised overs/i)).toHaveValue(12);
    fireEvent.change(screen.getByLabelText(/target runs to win/i), {
      target: { value: "98" },
    });
    save();
    expect(onConfirm).toHaveBeenCalledWith({ targetRuns: 98, overs: 12 });
  });

  it("sends no target below 1 run, and no part of an over", () => {
    const { onConfirm, save } = open();
    const target = screen.getByLabelText(/target runs to win/i);
    const overs = screen.getByLabelText(/revised overs/i);
    for (const [runs, over] of [
      ["0", "15"],
      ["-5", "15"],
      ["120", "2.5"],
      ["120", "21"],
    ] as const) {
      fireEvent.change(target, { target: { value: runs } });
      fireEvent.change(overs, { target: { value: over } });
      save();
    }
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("stays open with the server's refusal", async () => {
    const refused = open({
      reply: {
        error: "The revised overs must be more than the overs already bowled",
      },
    });
    refused.save();
    expect(
      await screen.findByText(
        "The revised overs must be more than the overs already bowled",
      ),
    ).toHaveAttribute("role", "alert");
    expect(refused.onOpenChange).not.toHaveBeenCalled();
  });

  it("closes once the target is saved", async () => {
    const saved = open({ reply: { error: null } });
    saved.save();
    await waitFor(() => expect(saved.onOpenChange).toHaveBeenCalledWith(false));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
