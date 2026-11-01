import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("server-only", () => ({}));
vi.mock("~/lib/firebase/server", () => ({
  createServerClient: async () => state.client,
}));

import { PlayerPicker } from "~/app/matches/[id]/score/components/PlayerPicker";
import { PlayerSearchContext } from "~/app/matches/[id]/score/components/PlayerPicker";
import { MemoryDataSource, type Doc } from "~/lib/firebase/datasource";
import { searchFieldsOf } from "~/lib/firebase/derive.mjs";
import { serverClientFor } from "~/lib/firebase/server-client";
import { lookUpPlayers } from "~/lib/player-lookup";
import { GET } from "./route";

/**
 * The whole search with nothing mocked but the network and Firestore: the
 * picker, `usePlayerSearch`, `lookUpPlayers`, the route, `searchPlayers` and
 * `prefixSearch` over documents keyed the way the server writes them.
 */

const seed = JSON.parse(
  readFileSync(join(process.cwd(), "firebase/seed/data.json"), "utf8"),
) as Record<string, Doc[]>;

const person = (id: string, full_name: string, username: string): Doc => ({
  id,
  full_name,
  username,
  ...searchFieldsOf("users", { full_name, username }),
});

const signedIn = async () => ({ id: "scorer" }) as never;

function start(extra: Doc[], onAdd = vi.fn().mockResolvedValue("new")) {
  const ds = new MemoryDataSource({
    users: [...seed.users!, ...extra],
    player_career_stats: [{ id: "real", total_matches: 42 }],
  });
  state.client = serverClientFor({ ds, db: null, getUser: signedIn });
  vi.stubGlobal("fetch", async (url: string) =>
    GET({
      nextUrl: new URL(url, "https://cricscore.example.com"),
    } as unknown as NextRequest),
  );
  render(
    <PlayerSearchContext.Provider value={lookUpPlayers}>
      <PlayerPicker
        label="Who"
        rows={[]}
        selectedId={null}
        onSelect={vi.fn()}
        addPlayer={{ teamName: "Lions", onAdd }}
      />
    </PlayerSearchContext.Provider>,
  );
  return onAdd;
}

const type = (value: string) =>
  fireEvent.change(screen.getByRole("searchbox"), { target: { value } });

describe("adding a player, from the box to the documents", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("finds them by their name without the middle one, instead of a new player", async () => {
    const onAdd = start([person("real", "Karan Kumar Rajbhar", "karan_r")]);
    type("karan rajbhar");
    const pick = await screen.findByRole("button", {
      name: /Add Karan Kumar Rajbhar to Lions/,
    });
    expect(pick).toHaveTextContent("@karan_r · 42 matches");
    fireEvent.click(pick);
    await waitFor(() =>
      expect(onAdd).toHaveBeenCalledWith("Karan Kumar Rajbhar", "real"),
    );
  });

  it("finds them by @username among many of that name", async () => {
    const others = Array.from({ length: 25 }, (_, i) => {
      const letter = String.fromCharCode(97 + i);
      return person(`k${i}`, `Karan ${letter}${letter}`, `k_${letter}${i}`);
    });
    start([...others, person("real", "Zubin Mehta", "karan")]);
    type("@karan");
    expect(
      await screen.findByRole("button", { name: /Add Zubin Mehta to Lions/ }),
    ).toHaveTextContent("@karan · 42 matches");
  });

  it("offers a new player only after the search found nobody", async () => {
    const onAdd = start([]);
    type("Nobody Here");
    expect(screen.getByRole("button", { name: /Add .Nobody Here./ })).toBeDisabled();
    await screen.findByText("Nobody on CricScore matches “Nobody Here”.");
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Enter" });
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith("Nobody Here"));
  });

  it("tells the scorer when the session has lapsed, not that nobody matches", async () => {
    start([]);
    state.client = serverClientFor({
      ds: new MemoryDataSource({}),
      db: null,
      getUser: async () => null,
    });
    type("Rahul");
    await screen.findByText(/Could not check whether “Rahul”/);
    await act(async () => undefined);
    expect(screen.queryByText(/Nobody on CricScore/)).toBeNull();
  });
});
