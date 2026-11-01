import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
vi.mock("~/app/teams/actions", () => ({
  previewMergePlayer: vi.fn(),
  mergePlayerInto: vi.fn(),
}));
vi.mock("~/lib/player-lookup", () => ({ lookUpPlayers: vi.fn() }));

import { mergePlayerInto, previewMergePlayer } from "~/app/teams/actions";
import { lookUpPlayers } from "~/lib/player-lookup";
import { MergePlayerDialog } from "./merge-player-dialog";

const duplicate = { id: "dup", name: "Rahul S" };
const real = { id: "real", name: "Rahul Sharma", username: "rahul", matches: 42 };

function open(props: { onOpenChange?: (open: boolean) => void } = {}) {
  render(
    <MergePlayerDialog
      open
      onOpenChange={props.onOpenChange ?? vi.fn()}
      teamId="t1"
      player={duplicate}
    />,
  );
}

const pickReal = async () => {
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "Rahul" },
  });
  fireEvent.click(await screen.findByRole("button", { name: /Rahul Sharma/ }));
};

describe("MergePlayerDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(lookUpPlayers).mockResolvedValue({
      players: [duplicate, real],
      more: false,
    });
    vi.mocked(previewMergePlayer).mockResolvedValue({
      data: { matches: 3, together: 0 },
      error: null,
    });
    vi.mocked(mergePlayerInto).mockResolvedValue({
      data: { moved: 3, remaining: 0, done: true },
      error: null,
    });
  });

  it("does not offer the duplicate as the real player", async () => {
    open();
    await pickReal();
    expect(previewMergePlayer).toHaveBeenCalledWith("t1", "dup", "real");
  });

  it("says what moves, and merges nothing until the name is typed", async () => {
    open();
    await pickReal();
    expect(await screen.findByText(/3 matches/)).toHaveTextContent(
      "can't be undone",
    );
    const merge = screen.getByRole("button", { name: "Merge" });
    expect(merge).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Type Rahul S to confirm"), {
      target: { value: "wrong name" },
    });
    expect(merge).toBeDisabled();
    expect(mergePlayerInto).not.toHaveBeenCalled();
  });

  it("merges once confirmed, and refreshes the squad", async () => {
    const onOpenChange = vi.fn();
    open({ onOpenChange });
    await pickReal();
    fireEvent.change(await screen.findByLabelText("Type Rahul S to confirm"), {
      target: { value: "rahul s" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Merge" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(mergePlayerInto).toHaveBeenCalledWith("t1", "dup", "real");
    expect(refresh).toHaveBeenCalled();
  });

  it("keeps calling until the last batch", async () => {
    vi.mocked(mergePlayerInto)
      .mockResolvedValueOnce({
        data: { moved: 10, remaining: 2, done: false },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { moved: 2, remaining: 0, done: true },
        error: null,
      });
    open();
    await pickReal();
    fireEvent.change(await screen.findByLabelText("Type Rahul S to confirm"), {
      target: { value: "Rahul S" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Merge" }));
    await waitFor(() => expect(mergePlayerInto).toHaveBeenCalledTimes(2));
  });

  it("stops at an error and can be tried again", async () => {
    vi.mocked(mergePlayerInto).mockResolvedValue({
      data: null,
      error: "Could not merge the players",
    });
    open();
    await pickReal();
    fireEvent.change(await screen.findByLabelText("Type Rahul S to confirm"), {
      target: { value: "Rahul S" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Merge" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not merge the players",
    );
    expect(screen.getByRole("button", { name: "Merge" })).toBeEnabled();
  });

  it("refuses two players who played together", async () => {
    vi.mocked(previewMergePlayer).mockResolvedValue({
      data: { matches: 3, together: 1 },
      error: null,
    });
    open();
    await pickReal();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "different people",
    );
    expect(screen.queryByRole("button", { name: "Merge" })).toBeNull();
  });

  it("says why a player cannot be merged", async () => {
    vi.mocked(previewMergePlayer).mockResolvedValue({
      data: null,
      error: "This player has signed in",
    });
    open();
    await pickReal();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This player has signed in",
    );
  });
});
