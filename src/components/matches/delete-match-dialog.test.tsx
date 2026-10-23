import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { deleteMatch } from "~/app/matches/mutations";
import { DeleteMatchDialog } from "./delete-match-dialog";
import { MatchMoreMenu } from "./match-more-menu";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
}));
vi.mock("~/app/matches/mutations", () => ({ deleteMatch: vi.fn() }));
vi.mock("~/app/matches/reschedule", () => ({ rescheduleMatch: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

let user: { id: string } | null = { id: "u1" };
let isAdmin: boolean | undefined = true;
let canDelete: boolean | undefined = true;
const canDeleteQuery = vi.fn();
vi.mock("~/lib/auth", () => ({ useAuth: () => ({ user }) }));
let canStream: boolean | undefined = false;
const canStreamQuery = vi.fn();
vi.mock("~/lib/hooks/useMatchQueries", () => ({
  useMatchAdminQuery: () => ({ data: isAdmin }),
  useCanProduceOverlayQuery: (...args: unknown[]) => {
    canStreamQuery(...args);
    return { data: args[2] ? canStream : undefined };
  },
  useCanDeleteMatchQuery: (...args: unknown[]) => {
    canDeleteQuery(...args);
    return { data: args[2] ? canDelete : undefined };
  },
}));

const match = {
  id: "m1",
  title: "Strikers vs Warriors",
  tournament_id: null,
  club_id: "c1",
};

function renderDialog(onOpenChange = vi.fn()) {
  render(<DeleteMatchDialog open onOpenChange={onOpenChange} match={match} />);
  return {
    input: screen.getByLabelText("Type the match name to confirm"),
    button: screen.getByRole("button", { name: "Delete match" }),
    onOpenChange,
  };
}

describe("DeleteMatchDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("explains what is deleted and shows the name to type", () => {
    renderDialog();
    expect(
      screen.getByText(/its scorecard and ball-by-ball log/),
    ).toBeInTheDocument();
    expect(screen.getByText(/can't be undone/)).toBeInTheDocument();
    expect(screen.getByText("Strikers vs Warriors")).toBeInTheDocument();
  });

  it("keeps the delete button disabled until the name matches", () => {
    const { input, button } = renderDialog();
    expect(button).toBeDisabled();
    fireEvent.change(input, { target: { value: "Strikers" } });
    expect(button).toBeDisabled();
    fireEvent.change(input, { target: { value: " strikers VS warriors " } });
    expect(button).toBeEnabled();
  });

  it("deletes, toasts and navigates to where the match belonged", async () => {
    vi.mocked(deleteMatch).mockResolvedValue({
      success: true,
      error: null,
      redirectTo: "/clubs/c1",
    });
    const { input, button, onOpenChange } = renderDialog();
    fireEvent.change(input, { target: { value: "Strikers vs Warriors" } });
    fireEvent.click(button);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/clubs/c1"));
    expect(deleteMatch).toHaveBeenCalledWith("m1", "Strikers vs Warriors");
    expect(toast.success).toHaveBeenCalledWith("Match deleted");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows the server's error and stays open", async () => {
    vi.mocked(deleteMatch).mockResolvedValue({
      success: false,
      error: "Only the match creator can delete this match",
    });
    const { input, button, onOpenChange } = renderDialog();
    fireEvent.change(input, { target: { value: "Strikers vs Warriors" } });
    fireEvent.click(button);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Only the match creator can delete this match",
    );
    expect(replace).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});

describe("MatchMoreMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    user = { id: "u1" };
    isAdmin = true;
    canDelete = true;
  });

  it("offers Delete match to users who may delete", async () => {
    render(<MatchMoreMenu match={match} />);
    const trigger = screen.getByRole("button", { name: "More match actions" });
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Delete match" }),
    );
    expect(
      await screen.findByLabelText("Type the match name to confirm"),
    ).toBeInTheDocument();
  });

  it("offers no Delete match to co-scorers and viewers", async () => {
    canDelete = false;
    const { rerender } = render(<MatchMoreMenu match={match} />);
    const trigger = screen.getByRole("button", { name: "More match actions" });
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
    expect(
      await screen.findByRole("menuitem", { name: "Stream this match" }),
    ).toHaveAttribute("href", "/matches/m1/stream");
    // Scorers also get the control room.
    expect(
      screen.getByRole("menuitem", { name: "Overlay control room" }),
    ).toHaveAttribute("href", "/overlay/m1/control");
    expect(
      screen.queryByRole("menuitem", { name: "Delete match" }),
    ).not.toBeInTheDocument();
    // Non-admins are never asked (no reads for viewers).
    isAdmin = false;
    canDelete = true;
    rerender(<MatchMoreMenu match={match} />);
    expect(canDeleteQuery).toHaveBeenLastCalledWith("m1", "u1", false);
  });

  it("gives streamers the control room, asking only once the menu opens", async () => {
    isAdmin = false;
    canDelete = false;
    canStream = true;
    render(<MatchMoreMenu match={match} />);
    expect(canStreamQuery).toHaveBeenLastCalledWith("m1", "u1", false);
    const trigger = screen.getByRole("button", { name: "More match actions" });
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
    expect(
      await screen.findByRole("menuitem", { name: "Overlay control room" }),
    ).toHaveAttribute("href", "/overlay/m1/control");
    expect(canStreamQuery).toHaveBeenLastCalledWith("m1", "u1", true);
    canStream = false;
  });
});
