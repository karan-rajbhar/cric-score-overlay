import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { recentPlayers, rememberPlayer } from "~/lib/recent-players";
import { PlayerPicker, PlayerSearchContext } from "./PlayerPicker";
import type { PickerRow } from "./player-rows";

const rows: PickerRow[] = [
  { id: "a", name: "Anil Kumble", role: "(c)", detail: "2-0-14-1" },
  { id: "b", name: "Bhuvi Kumar", tag: "Bowling" },
  { id: "c", name: "Chahal", disabledReason: "Bowled last over" },
  { id: "d", name: "Deepak Chahar", note: "Quota used" },
];

const many: PickerRow[] = Array.from({ length: 10 }, (_, i) => ({
  id: `p${i}`,
  name: `Player ${i}`,
}));

describe("PlayerPicker", () => {
  it("renders rows in the given order with role, figures, tags and reasons", () => {
    render(
      <PlayerPicker
        label="Choose"
        rows={rows}
        selectedId="a"
        onSelect={vi.fn()}
      />,
    );
    const radios = screen.getAllByRole("radio");
    expect(radios.map((r) => r.getAttribute("data-player-id"))).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
    expect(radios[0]).toHaveTextContent("(c)");
    expect(radios[0]).toHaveTextContent("2-0-14-1");
    expect(radios[0]).toHaveAttribute("aria-checked", "true");
    expect(radios[1]).toHaveTextContent("Bowling");
    expect(radios[2]).toBeDisabled();
    expect(radios[2]).toHaveTextContent("Bowled last over");
    expect(radios[3]).toBeEnabled();
    expect(radios[3]).toHaveTextContent("Quota used");
  });

  it("selects on tap and ignores disabled rows", () => {
    const onSelect = vi.fn();
    render(
      <PlayerPicker
        label="Choose"
        rows={rows}
        selectedId={null}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: /Bhuvi/ }));
    fireEvent.click(screen.getByRole("radio", { name: /Chahal, Bowled/ }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("b");
  });

  it("hides search for short lists and shows it for long ones", () => {
    const { rerender } = render(
      <PlayerPicker
        label="Choose"
        rows={rows}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();

    rerender(
      <PlayerPicker
        label="Choose"
        rows={many}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "player 7" },
    });
    expect(screen.getAllByRole("radio")).toHaveLength(1);
    expect(screen.getByRole("radio", { name: "Player 7" })).toBeInTheDocument();
  });

  it("supports keyboard: Enter in search picks the first match, arrows move, Enter on a row submits", () => {
    const onSelect = vi.fn();
    const onSubmit = vi.fn();
    render(
      <PlayerPicker
        label="Choose"
        rows={many}
        selectedId={null}
        onSelect={onSelect}
        onSubmit={onSubmit}
      />,
    );
    const search = screen.getByRole("searchbox");
    fireEvent.change(search, { target: { value: "player" } });
    fireEvent.keyDown(search, { key: "Enter" });
    expect(onSelect).toHaveBeenLastCalledWith("p0");
    expect(screen.getByRole("radio", { name: "Player 0" })).toHaveFocus();

    fireEvent.keyDown(screen.getByRole("radio", { name: "Player 0" }), {
      key: "ArrowDown",
    });
    const second = screen.getByRole("radio", { name: "Player 1" });
    expect(second).toHaveFocus();
    fireEvent.keyDown(second, { key: "Enter" });
    expect(onSelect).toHaveBeenLastCalledWith("p1");
    expect(onSubmit).toHaveBeenCalledWith("p1");

    fireEvent.keyDown(screen.getByRole("radio", { name: "Player 0" }), {
      key: "ArrowUp",
    });
    expect(search).toHaveFocus();
  });

  it("offers to add a typed name that is not in the squad and selects the new player", async () => {
    const onSelect = vi.fn();
    const onAdd = vi.fn().mockResolvedValue("new-id");
    render(
      <PlayerPicker
        label="Choose"
        rows={rows}
        selectedId={null}
        onSelect={onSelect}
        addPlayer={{ teamName: "Team A", onAdd }}
      />,
    );
    const search = screen.getByRole("searchbox");
    fireEvent.change(search, { target: { value: "  Rahul   Dravid " } });
    expect(screen.getByText(/No player matches/)).toBeInTheDocument();
    // Enter with no match adds.
    fireEvent.keyDown(search, { key: "Enter" });
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith("Rahul Dravid"));
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith("new-id"));
    await waitFor(() => expect(search).toHaveValue(""));
  });

  it("warns about duplicate names before adding another", () => {
    render(
      <PlayerPicker
        label="Choose"
        rows={rows}
        selectedId={null}
        onSelect={vi.fn()}
        addPlayer={{ teamName: "Team A", onAdd: vi.fn() }}
      />,
    );
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "anil kumble" },
    });
    expect(
      screen.getByText(/Anil Kumble is already in Team A/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /Add another .anil kumble. to Team A/,
      }),
    ).toBeEnabled();
  });

  it("keeps the typed name when adding fails", async () => {
    const onAdd = vi.fn().mockResolvedValue(null);
    const onSelect = vi.fn();
    render(
      <PlayerPicker
        label="Choose"
        rows={rows}
        selectedId={null}
        onSelect={onSelect}
        addPlayer={{ teamName: "Team A", onAdd }}
      />,
    );
    const search = screen.getByRole("searchbox");
    fireEvent.change(search, { target: { value: "Zaheer" } });
    fireEvent.click(screen.getByRole("button", { name: /Add .Zaheer./ }));
    await waitFor(() => expect(onAdd).toHaveBeenCalled());
    expect(onSelect).not.toHaveBeenCalled();
    expect(search).toHaveValue("Zaheer");
  });

  it("explains an empty squad", () => {
    render(
      <PlayerPicker
        label="Choose"
        rows={[]}
        selectedId={null}
        onSelect={vi.fn()}
        addPlayer={{ teamName: "Team A", onAdd: vi.fn() }}
      />,
    );
    expect(
      screen.getByText("No players in Team A yet. Type a name to add one."),
    ).toBeInTheDocument();
  });
});

describe("PlayerPicker add while typing", () => {
  it("puts Add <name> right under the search box, above the list", () => {
    render(
      <PlayerPicker
        label="Choose batter"
        rows={[
          { id: "a", name: "Anil Kumble" },
          { id: "b", name: "Bhuvi Kumar" },
        ]}
        selectedId={null}
        onSelect={vi.fn()}
        addPlayer={{ teamName: "Mumbai", onAdd: vi.fn() }}
        noun="batter"
      />,
    );
    const search = screen.getByRole("searchbox", { name: "Search or add a batter" });
    fireEvent.change(search, { target: { value: "An" } });
    const add = screen.getByRole("button", { name: /Add .An. to Mumbai/ });
    const firstRow = screen.getByRole("radio", { name: /Anil Kumble/ });
    // Before the rows in the page: on a phone it stays in view with the
    // keyboard open (the search box and it are pinned at the top).
    expect(
      add.compareDocumentPosition(firstRow) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      search.compareDocumentPosition(add) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("suggests registered players and adds the one picked instead of a new one", async () => {
    const onSelect = vi.fn();
    const onAdd = vi.fn().mockResolvedValue("u-rahul");
    const find = vi.fn().mockResolvedValue({
      players: [
        { id: "u-rahul", name: "Rahul Dravid", username: "rahul", matches: 42 },
      ],
      more: false,
    });
    render(
      <PlayerSearchContext.Provider value={find}>
        <PlayerPicker
          label="Choose"
          rows={rows}
          selectedId={null}
          onSelect={onSelect}
          addPlayer={{ teamName: "Team A", onAdd }}
        />
      </PlayerSearchContext.Provider>,
    );
    const search = screen.getByRole("searchbox");
    fireEvent.change(search, { target: { value: "rahul" } });
    const pick = await screen.findByRole("button", {
      name: /Add Rahul Dravid to Team A/,
    });
    expect(find).toHaveBeenCalledWith("rahul");
    // Told apart from another Rahul by the matches played.
    expect(pick).toHaveTextContent("@rahul · 42 matches");
    expect(
      screen.getByRole("button", { name: /Add .rahul. as a new player to Team A/ }),
    ).toBeInTheDocument();

    // Enter does not guess between them.
    fireEvent.keyDown(search, { key: "Enter" });
    expect(onAdd).not.toHaveBeenCalled();

    fireEvent.click(pick);
    await waitFor(() =>
      expect(onAdd).toHaveBeenCalledWith("Rahul Dravid", "u-rahul"),
    );
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith("u-rahul"));
  });

  it("does not look up registered players while adding is unavailable", () => {
    const find = vi.fn().mockResolvedValue([]);
    render(
      <PlayerSearchContext.Provider value={find}>
        <PlayerPicker
          label="Choose"
          rows={rows}
          selectedId={null}
          onSelect={vi.fn()}
          addPlayer={{
            teamName: "Team A",
            onAdd: vi.fn(),
            disabledReason: "Offline",
          }}
        />
      </PlayerSearchContext.Provider>,
    );
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "rahul" },
    });
    expect(find).not.toHaveBeenCalled();
  });
});

describe("PlayerPicker never suggests a duplicate by accident", () => {
  const none = { players: [], more: false };

  function renderPicker(
    find: (q: string) => Promise<unknown>,
    props: Partial<Parameters<typeof PlayerPicker>[0]> = {},
    onAdd = vi.fn().mockResolvedValue("new-id"),
  ) {
    render(
      <PlayerSearchContext.Provider value={find as never}>
        <PlayerPicker
          label="Choose"
          rows={rows}
          selectedId={null}
          onSelect={vi.fn()}
          addPlayer={{ teamName: "Lions", onAdd }}
          {...props}
        />
      </PlayerSearchContext.Provider>,
    );
    return onAdd;
  }
  const type = (value: string) =>
    fireEvent.change(screen.getByRole("searchbox"), { target: { value } });

  it("adds nobody while the search has not answered", () => {
    const onAdd = renderPicker(() => new Promise(() => {}));
    type("Virat Kohli");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Looking for “Virat Kohli” on CricScore",
    );
    expect(screen.getByRole("button", { name: /Add .Virat Kohli./ })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Enter" });
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("adds a new player on Enter once the search has found nobody", async () => {
    const onAdd = renderPicker(async () => none);
    type("Virat Kohli");
    await screen.findByText("Nobody on CricScore matches “Virat Kohli”.");
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Enter" });
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith("Virat Kohli"));
  });

  it("says a failed search failed, offers another try, and Enter adds nobody", async () => {
    const find = vi
      .fn()
      .mockRejectedValueOnce(new Error("Failed to find Server Action"))
      .mockResolvedValueOnce({
        players: [{ id: "v", name: "Virat Kohli", matches: 12 }],
        more: false,
      });
    const onAdd = renderPicker(find);
    type("Virat");
    await screen.findByText(/Could not check whether “Virat”/);
    expect(screen.queryByText(/No player matches/)).toBeNull();
    expect(screen.queryByText(/Nobody on CricScore/)).toBeNull();
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Enter" });
    expect(onAdd).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("button", { name: /Add Virat Kohli to Lions/ }),
    ).toBeInTheDocument();
  });

  it("still lets the scorer add a new player after a failed search", async () => {
    const onAdd = renderPicker(() => Promise.reject(new Error("offline")));
    type("Virat");
    await screen.findByText(/Could not check/);
    fireEvent.click(screen.getByRole("button", { name: /Add .Virat. to Lions/ }));
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith("Virat"));
  });

  it("finds a squad player by @username, and a username is never a new name", async () => {
    const onAdd = renderPicker(async () => none, {
      rows: [{ id: "r", name: "Rahul Sharma", username: "rahul_sharma" }],
    });
    type("@rahul_sh");
    const row = screen.getByRole("radio", { name: /Rahul Sharma/ });
    expect(row).toHaveTextContent("@rahul_sharma");
    await waitFor(() => expect(screen.queryByText(/Looking for/)).toBeNull());
    expect(screen.queryByRole("button", { name: /Add .@/ })).toBeNull();
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Enter" });
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("says nobody has a username rather than offering to create it", async () => {
    const onAdd = renderPicker(async () => none);
    type("@nobody");
    await screen.findByText("Nobody has the username @nobody.");
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Enter" });
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("shows a squad row the search found, even if its own text does not match", async () => {
    renderPicker(async () => ({
      players: [{ id: "a", name: "Anil Kumble", username: "jumbo" }],
      more: false,
    }));
    type("@jumbo");
    expect(
      await screen.findByRole("radio", { name: /Anil Kumble/ }),
    ).toBeInTheDocument();
    // Listed once: as the row, not again as someone to add.
    expect(screen.queryByRole("button", { name: /Anil Kumble/ })).toBeNull();
  });

  it("finds squad rows with words apart or out of order", () => {
    renderPicker(async () => none, {
      rows: [{ id: "r", name: "Rahul Kumar Sharma" }],
    });
    type("sharma rahul");
    expect(screen.getByRole("radio", { name: /Rahul Kumar Sharma/ })).toBeInTheDocument();
  });

  it("offers someone in the other side's squad instead of hiding them", async () => {
    const onAdd = renderPicker(async () => ({
      players: [{ id: "x", name: "Rohit Sharma", teams: ["Tigers"] }],
      more: false,
    }));
    type("Rohit");
    const pick = await screen.findByRole("button", {
      name: /Add Rohit Sharma to Lions/,
    });
    expect(pick).toHaveTextContent("Plays for Tigers");
    fireEvent.click(pick);
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith("Rohit Sharma", "x"));
  });

  it("says why someone cannot be added, and does not add them", async () => {
    const onAdd = renderPicker(async () => ({
      players: [
        {
          id: "x",
          name: "Rohit Sharma",
          teams: ["Tigers"],
          playedFor: "Tigers",
        },
      ],
      more: false,
    }));
    type("Rohit");
    const row = await screen.findByRole("button", { name: /Rohit Sharma/ });
    expect(row).toBeDisabled();
    expect(row).toHaveTextContent("Played for Tigers");
    fireEvent.click(row);
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("says when more match than it lists", async () => {
    renderPicker(async () => ({
      players: Array.from({ length: 8 }, (_, i) => ({
        id: `r${i}`,
        name: `Rahul ${i}`,
      })),
      more: false,
    }));
    type("Rahul");
    await screen.findByText(/More players match/);
    expect(screen.getAllByRole("button", { name: /Add Rahul \d/ })).toHaveLength(5);
  });

  it("tells two rows of one name apart by username, and no others", () => {
    renderPicker(async () => none, {
      rows: [
        { id: "a", name: "Rahul Sharma", username: "rahul_sharma" },
        { id: "b", name: "Rahul Sharma", username: "rahul_sharma_1" },
        { id: "c", name: "Anil Kumble", username: "jumbo" },
      ],
    });
    expect(screen.getByRole("radio", { name: /rahul_sharma_1/ })).toBeInTheDocument();
    expect(screen.queryByText("@jumbo")).toBeNull();
  });

  it("takes a second tap to add a second person of exactly that name", async () => {
    const onAdd = renderPicker(async () => ({
      players: [{ id: "x", name: "Rohit Sharma", username: "rohit", matches: 42 }],
      more: false,
    }));
    type("Rohit Sharma");
    const addNew = await screen.findByRole("button", {
      name: /Add .Rohit Sharma. as a new player/,
    });
    fireEvent.click(addNew);
    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Rohit Sharma is already on CricScore (@rohit · 42 matches)",
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Yes, add a second .Rohit Sharma./ }),
    );
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith("Rohit Sharma"));
  });

  it("adds a name nobody has with one tap", async () => {
    const onAdd = renderPicker(async () => ({
      players: [{ id: "x", name: "Rohit Sharma" }],
      more: false,
    }));
    type("Rohit Verma");
    const addNew = await screen.findByRole("button", {
      name: /Add .Rohit Verma. as a new player/,
    });
    fireEvent.click(addNew);
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith("Rohit Verma"));
  });

  describe("recently added", () => {
    beforeEach(() => localStorage.clear());

    it("shows once the box is used, and is one tap away", async () => {
      rememberPlayer({ id: "r", name: "Rahul Dravid", username: "rahul" });
      const onAdd = renderPicker(async () => none);
      expect(screen.queryByRole("group", { name: "Recently added" })).toBeNull();
      fireEvent.focus(screen.getByRole("searchbox"));
      fireEvent.click(
        screen.getByRole("button", { name: /Add Rahul Dravid to Lions/ }),
      );
      await waitFor(() =>
        expect(onAdd).toHaveBeenCalledWith("Rahul Dravid", "r"),
      );
    });

    it("leaves out who is listed already", () => {
      rememberPlayer({ id: "a", name: "Anil Kumble" });
      renderPicker(async () => none);
      fireEvent.focus(screen.getByRole("searchbox"));
      expect(screen.queryByRole("group", { name: "Recently added" })).toBeNull();
    });

    it("remembers a player once added", async () => {
      renderPicker(async () => ({
        players: [{ id: "x", name: "Rohit Sharma", username: "rohit" }],
        more: false,
      }));
      type("Rohit");
      fireEvent.click(
        await screen.findByRole("button", { name: /Add Rohit Sharma to Lions/ }),
      );
      await waitFor(() =>
        expect(recentPlayers().map((p) => p.id)).toEqual(["new-id"]),
      );
    });

    it("gives way to what is typed", () => {
      rememberPlayer({ id: "r", name: "Rahul Dravid" });
      renderPicker(async () => none);
      fireEvent.focus(screen.getByRole("searchbox"));
      type("Vi");
      expect(screen.queryByRole("group", { name: "Recently added" })).toBeNull();
    });
  });

  it("shows the list's own reason when it is empty, not that the squad is", () => {
    renderPicker(async () => none, {
      rows: [],
      emptyMessage: "Everyone in the squad has a part in this match.",
    });
    expect(
      screen.getByText("Everyone in the squad has a part in this match."),
    ).toBeInTheDocument();
  });
});
