import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlayerPicker } from "./PlayerPicker";
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
});
