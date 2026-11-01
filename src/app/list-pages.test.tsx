import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const state = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("~/lib/firebase/server", () => ({
  createServerClient: async () => state.client,
}));

import ClubsPage from "~/app/clubs/page";
import TournamentsPage from "~/app/tournaments/page";
import { MemoryDataSource, type Doc } from "~/lib/firebase/datasource";
import { searchFieldsOf } from "~/lib/firebase/derive.mjs";
import { serverClientFor } from "~/lib/firebase/server-client";

const club = (id: string, name: string, is_public: boolean): Doc => ({
  id,
  name,
  is_public,
  ...searchFieldsOf("clubs", { name }),
});
const tournament = (id: string, name: string): Doc => ({
  id,
  name,
  status: "upcoming",
  start_date: "2026-11-01",
  ...searchFieldsOf("tournaments", { name }),
});

function start(user: { id: string } | null) {
  const ds = new MemoryDataSource({
    clubs: [
      club("c1", "Lions CC", true),
      club("c2", "Tigers CC", true),
      club("c3", "Lions Private", false),
    ],
    club_memberships: [{ id: "m1", club_id: "c2", user_id: "u1" }],
    teams: [],
    tournaments: [tournament("t1", "Summer Cup"), tournament("t2", "Winter Cup")],
  });
  state.client = serverClientFor({
    ds,
    db: null,
    getUser: async () => user as never,
  });
}

const show = async (page: Promise<React.ReactNode>) => render(await page);
const clubsAt = (searchParams: Record<string, string>) =>
  show(ClubsPage({ searchParams: Promise.resolve(searchParams) }));
const heading = (name: string) =>
  screen.getByRole("heading", { level: 1, name });

describe("Clubs list", () => {
  beforeEach(() => start({ id: "u1" }));

  it("opens on a signed-in user's own clubs", async () => {
    await clubsAt({});
    expect(heading("My clubs")).toBeInTheDocument();
    expect(screen.getByText("Tigers CC")).toBeInTheDocument();
    expect(screen.queryByText("Lions CC")).toBeNull();
  });

  it("shows every public club under All clubs, and no private one", async () => {
    await clubsAt({ view: "all" });
    expect(heading("All clubs")).toBeInTheDocument();
    expect(screen.getByText("Lions CC")).toBeInTheDocument();
    expect(screen.getByText("Tigers CC")).toBeInTheDocument();
    expect(screen.queryByText("Lions Private")).toBeNull();
  });

  it("gives a visitor the public clubs and no My clubs", async () => {
    start(null);
    await clubsAt({ view: "mine" });
    expect(heading("All clubs")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "My clubs" })).toBeNull();
  });

  it("searches public clubs from either view, never private ones", async () => {
    await clubsAt({ search: "lions" });
    expect(heading("All clubs")).toBeInTheDocument();
    expect(screen.getByText("Lions CC")).toBeInTheDocument();
    expect(screen.queryByText("Tigers CC")).toBeNull();
    expect(screen.queryByText("Lions Private")).toBeNull();
  });

  it("says when no club matches", async () => {
    await clubsAt({ search: "zzz" });
    expect(screen.getByText("No public club matches “zzz”.")).toBeInTheDocument();
  });

  it("has the switch to Teams and Players", async () => {
    await clubsAt({});
    expect(
      screen.getByRole("navigation", { name: "Clubs, teams and players" }),
    ).toBeInTheDocument();
  });
});

describe("Tournaments list", () => {
  beforeEach(() => start(null));
  const at = (searchParams: Record<string, string>) =>
    show(TournamentsPage({ searchParams: Promise.resolve(searchParams) }));

  it("lists them all without a search", async () => {
    await at({});
    expect(screen.getByText("Summer Cup")).toBeInTheDocument();
    expect(screen.getByText("Winter Cup")).toBeInTheDocument();
  });

  it("narrows to the search", async () => {
    await at({ search: "summer" });
    expect(screen.getByText("Summer Cup")).toBeInTheDocument();
    expect(screen.queryByText("Winter Cup")).toBeNull();
  });

  it("says when none matches, without offering to start from nothing", async () => {
    await at({ search: "zzz" });
    expect(screen.getByText("No tournament matches “zzz”.")).toBeInTheDocument();
    expect(screen.queryByText("No tournaments yet")).toBeNull();
  });
});
