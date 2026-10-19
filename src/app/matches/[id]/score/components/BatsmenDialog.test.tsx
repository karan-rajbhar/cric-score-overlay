import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BatsmenDialog } from "./BatsmenDialog";
import type { TeamPlayer } from "~/lib/match-types";

describe("BatsmenDialog", () => {
  const mockPlayers: TeamPlayer[] = [
    {
      id: "tp-1",
      team_id: "team-1",
      user_id: "user-1",
      user: { id: "user-1", full_name: "Virat Kohli" },
    },
    {
      id: "tp-2",
      team_id: "team-1",
      user_id: "user-2",
      user: { id: "user-2", full_name: "Rohit Sharma" },
    },
  ];

  it("renders BatsmenDialog with Striker and Non-Striker fields", () => {
    render(
      <BatsmenDialog
        open={true}
        onOpenChange={vi.fn()}
        battingTeamPlayers={mockPlayers}
        strikerId={null}
        nonStrikerId={null}
        onConfirm={vi.fn()}
        isProcessing={false}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Choose the opening batters" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("role-band-batting")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm openers" })).toBeDisabled();
    expect(screen.getByText("Striker")).toBeInTheDocument();
    expect(screen.getByText("Non-striker")).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /Virat Kohli/ }),
    ).toBeInTheDocument();
  });

  it("adds a new player inline and puts them in the open slot", async () => {
    const onCreatePlayer = vi.fn().mockResolvedValue("user-new");
    const onConfirm = vi.fn();
    const { rerender } = render(
      <BatsmenDialog
        open={true}
        onOpenChange={vi.fn()}
        battingTeamPlayers={mockPlayers}
        battingTeamName="Mumbai"
        strikerId={null}
        nonStrikerId={null}
        onConfirm={onConfirm}
        isProcessing={false}
        onCreatePlayer={onCreatePlayer}
      />,
    );
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "KL Rahul" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Add .KL Rahul. to Mumbai/ }),
    );
    await waitFor(() =>
      expect(onCreatePlayer).toHaveBeenCalledWith("KL Rahul"),
    );
    // The squad reloads with the new player in it.
    rerender(
      <BatsmenDialog
        open={true}
        onOpenChange={vi.fn()}
        battingTeamPlayers={[
          ...mockPlayers,
          {
            id: "tp-new",
            team_id: "team-1",
            user_id: "user-new",
            user: { id: "user-new", full_name: "KL Rahul" },
          },
        ]}
        battingTeamName="Mumbai"
        strikerId={null}
        nonStrikerId={null}
        onConfirm={onConfirm}
        isProcessing={false}
        onCreatePlayer={onCreatePlayer}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: /Rohit Sharma/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Confirm/ }));
    expect(onConfirm).toHaveBeenCalledWith({
      strikerId: "user-new",
      nonStrikerId: "user-2",
    });
  });

  it("fills the striker then the non-striker, changing nothing before Confirm", () => {
    const onConfirm = vi.fn();
    render(
      <BatsmenDialog
        open={true}
        onOpenChange={vi.fn()}
        battingTeamPlayers={mockPlayers}
        strikerId={null}
        nonStrikerId={null}
        onConfirm={onConfirm}
        isProcessing={false}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: /Virat Kohli/ }));
    fireEvent.click(screen.getByRole("radio", { name: /Rohit Sharma/ }));
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /^Confirm/ }));
    expect(onConfirm).toHaveBeenCalledWith({
      strikerId: "user-1",
      nonStrikerId: "user-2",
    });
  });

  describe("after a wicket", () => {
    const players: TeamPlayer[] = [
      ...mockPlayers,
      {
        id: "tp-3",
        team_id: "team-1",
        user_id: "user-3",
        user: { id: "user-3", full_name: "Shubman Gill" },
      },
      {
        id: "tp-4",
        team_id: "team-1",
        user_id: "user-4",
        user: { id: "user-4", full_name: "Shreyas Iyer" },
      },
    ];
    const afterWicket = (onConfirm = vi.fn()) =>
      render(
        <BatsmenDialog
          open={true}
          onOpenChange={vi.fn()}
          battingTeamPlayers={players}
          battingPerformances={[
            {
              id: "bp-2",
              match_id: "m",
              innings_id: "i",
              user_id: "user-2",
              runs_scored: 12,
              balls_faced: 9,
              fours: 2,
              sixes: 0,
              is_out: true,
              dismissal_type: "bowled",
            },
          ]}
          dismissedPlayerIds={new Set(["user-2"])}
          strikerId="user-1"
          nonStrikerId={null}
          onConfirm={onConfirm}
          isProcessing={false}
        />,
      );

    it("picks nobody for the scorer and lists only who can come in", () => {
      const onConfirm = vi.fn();
      afterWicket(onConfirm);
      expect(
        screen.getByRole("heading", { name: "Choose the new batter" }),
      ).toBeInTheDocument();
      // No "Next in": the empty end stays empty until a batter is tapped.
      expect(screen.queryByText("Next in")).toBeNull();
      const confirm = screen.getByRole("button", { name: "Confirm new batter" });
      expect(confirm).toBeDisabled();
      // The batter who is out and the one not out are not in the list.
      expect(screen.queryByRole("radio", { name: /Rohit Sharma/ })).toBeNull();
      expect(screen.queryByRole("radio", { name: /Virat Kohli/ })).toBeNull();
      fireEvent.click(screen.getByRole("radio", { name: /Shubman Gill/ }));
      fireEvent.click(confirm);
      expect(onConfirm).toHaveBeenCalledWith({
        strikerId: "user-1",
        nonStrikerId: "user-3",
      });
    });

    it("keeps the not-out batter: a pick always fills the empty end", () => {
      const onConfirm = vi.fn();
      afterWicket(onConfirm);
      const notOut = screen.getByRole("button", { name: /Striker.*Virat Kohli/ });
      expect(notOut).toBeDisabled();
      expect(notOut).toHaveTextContent("Not out");
      fireEvent.click(screen.getByRole("radio", { name: /Shreyas Iyer/ }));
      fireEvent.click(screen.getByRole("button", { name: /^Confirm/ }));
      expect(onConfirm).toHaveBeenCalledWith({
        strikerId: "user-1",
        nonStrikerId: "user-4",
      });
    });

    it("puts the new batter on strike with Swap ends", () => {
      const onConfirm = vi.fn();
      afterWicket(onConfirm);
      fireEvent.click(screen.getByRole("button", { name: "Swap ends" }));
      fireEvent.click(screen.getByRole("radio", { name: /Shreyas Iyer/ }));
      fireEvent.click(screen.getByRole("button", { name: /^Confirm/ }));
      expect(onConfirm).toHaveBeenCalledWith({
        strikerId: "user-4",
        nonStrikerId: "user-1",
      });
    });
  });

  it("swaps ends when the batter at the other end is picked", () => {
    const onConfirm = vi.fn();
    render(
      <BatsmenDialog
        open={true}
        onOpenChange={vi.fn()}
        battingTeamPlayers={mockPlayers}
        strikerId="user-1"
        nonStrikerId="user-2"
        onConfirm={onConfirm}
        isProcessing={false}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: /Rohit Sharma/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Confirm/ }));
    expect(onConfirm).toHaveBeenCalledWith({
      strikerId: "user-2",
      nonStrikerId: "user-1",
    });
  });

  it("disables Confirm button when striker or non-striker is missing", () => {
    // Nobody is left to suggest, so the empty end stays empty.
    render(
      <BatsmenDialog
        open={true}
        onOpenChange={vi.fn()}
        battingTeamPlayers={mockPlayers}
        dismissedPlayerIds={new Set(["user-2"])}
        strikerId="user-1"
        nonStrikerId={null}
        onConfirm={vi.fn()}
        isProcessing={false}
      />,
    );

    const confirmButton = screen.getByRole("button", { name: /^Confirm/ });
    expect(confirmButton).toBeDisabled();
  });

  it("enables Confirm button when both striker and non-striker are chosen", () => {
    const handleConfirm = vi.fn();

    render(
      <BatsmenDialog
        open={true}
        onOpenChange={vi.fn()}
        battingTeamPlayers={mockPlayers}
        strikerId="user-1"
        nonStrikerId="user-2"
        onConfirm={handleConfirm}
        isProcessing={false}
      />,
    );

    const confirmButton = screen.getByRole("button", { name: /^Confirm/ });
    expect(confirmButton).toBeEnabled();

    fireEvent.click(confirmButton);
    expect(handleConfirm).toHaveBeenCalledTimes(1);
  });

  it("disables Confirm button and filters or disables bowler when bowler or bowling player is selected", () => {
    const bowlingTeamPlayerIds = new Set(["user-bowler-1"]);
    const handleConfirm = vi.fn();

    const { rerender } = render(
      <BatsmenDialog
        open={true}
        onOpenChange={vi.fn()}
        battingTeamPlayers={mockPlayers}
        bowlingTeamPlayerIds={bowlingTeamPlayerIds}
        currentBowlerId="user-1"
        strikerId="user-1"
        nonStrikerId="user-2"
        onConfirm={handleConfirm}
        isProcessing={false}
      />,
    );

    // Confirm is disabled because striker is currentBowlerId
    expect(screen.getByRole("button", { name: /^Confirm/ })).toBeDisabled();

    // If striker is an opposing team player in bowlingTeamPlayerIds
    rerender(
      <BatsmenDialog
        open={true}
        onOpenChange={vi.fn()}
        battingTeamPlayers={mockPlayers}
        bowlingTeamPlayerIds={bowlingTeamPlayerIds}
        currentBowlerId={null}
        strikerId="user-bowler-1"
        nonStrikerId="user-2"
        onConfirm={handleConfirm}
        isProcessing={false}
      />,
    );

    expect(screen.getByRole("button", { name: /^Confirm/ })).toBeDisabled();
  });

  it("filters out opposing team players from selectable batting list when in bowlingTeamPlayerIds", () => {
    const mixedPlayers: TeamPlayer[] = [
      ...mockPlayers,
      {
        id: "tp-3",
        team_id: "team-2",
        user_id: "user-opp-3",
        user: { id: "user-opp-3", full_name: "Opposing Bowler" },
      },
    ];

    render(
      <BatsmenDialog
        open={true}
        onOpenChange={vi.fn()}
        battingTeamPlayers={mixedPlayers}
        bowlingTeamPlayerIds={new Set(["user-opp-3"])}
        currentBowlerId={null}
        strikerId={null}
        nonStrikerId={null}
        onConfirm={vi.fn()}
        isProcessing={false}
      />,
    );

    expect(screen.queryByText("Opposing Bowler")).not.toBeInTheDocument();
  });
});

describe("BatsmenDialog with nobody left to bat", () => {
  it("offers ending the innings (all out) next to adding a player", () => {
    const players: TeamPlayer[] = [
      { id: "t1", team_id: "team-1", user_id: "a", user: { id: "a", full_name: "A" } },
      { id: "t2", team_id: "team-1", user_id: "b", user: { id: "b", full_name: "B" } },
      { id: "t3", team_id: "team-1", user_id: "c", user: { id: "c", full_name: "C" } },
    ];
    const onEndInnings = vi.fn();
    render(
      <BatsmenDialog
        open={true}
        onOpenChange={vi.fn()}
        battingTeamPlayers={players}
        dismissedPlayerIds={new Set(["b", "c"])}
        strikerId="a"
        nonStrikerId={null}
        onConfirm={vi.fn()}
        isProcessing={false}
        onEndInnings={onEndInnings}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Everyone in the squad has batted",
    );
    fireEvent.click(screen.getByRole("button", { name: "End innings (all out)" }));
    expect(onEndInnings).toHaveBeenCalledTimes(1);
  });
});

describe("BatsmenDialog changing one batter", () => {
  it("replaces only the batter whose Change was tapped", () => {
    const players: TeamPlayer[] = ["a", "b", "c"].map((id) => ({
      id: `t-${id}`,
      team_id: "team-1",
      user_id: id,
      user: { id, full_name: id.toUpperCase() },
    }));
    const onConfirm = vi.fn();
    render(
      <BatsmenDialog
        open={true}
        onOpenChange={vi.fn()}
        battingTeamPlayers={players}
        strikerId="a"
        nonStrikerId="b"
        focusEnd="nonStriker"
        onConfirm={onConfirm}
        isProcessing={false}
      />,
    );
    expect(screen.getByText("Change B")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /^C/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Confirm/ }));
    expect(onConfirm).toHaveBeenCalledWith({ strikerId: "a", nonStrikerId: "c" });
  });
});
