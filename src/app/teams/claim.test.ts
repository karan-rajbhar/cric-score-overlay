import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("~/lib/firebase/live-sync", () => ({
  refreshLiveMatchesFor: vi.fn(),
  refreshLiveState: vi.fn(),
}));
const state: { client: unknown } = { client: null };
vi.mock("~/lib/firebase/server", () => ({
  createServerClient: async () => state.client,
}));

import type { AppUser } from "~/lib/firebase/auth-types";
import { MemoryDataSource, type DataSource } from "~/lib/firebase/datasource";
import { derivedFieldsDataSource } from "~/lib/firebase/derived-fields";
import { acceptInvitations, canSignIn } from "~/lib/firebase/rpc/access";
import { ensureOwnProfile } from "~/lib/firebase/rpc/profiles";
import { serverClientFor } from "~/lib/firebase/server-client";
import { searchScorers } from "~/app/matches/mutations";
import { createPlayerQuick, setPlayerClaimEmail } from "./actions";

let ds: MemoryDataSource;

function signIn(id: string) {
  state.client = serverClientFor({
    ds,
    db: null,
    getUser: async () =>
      ({ id, email: null, phone: null, user_metadata: {} }) as AppUser,
  });
}

const google = (id: string, email: string, name: string): AppUser => ({
  id,
  email,
  phone: null,
  user_metadata: { full_name: name },
  provider: "google.com",
});

beforeEach(async () => {
  ds = new MemoryDataSource({
    users: [
      { id: "cap", full_name: "Captain" },
      { id: "plr", full_name: "Squad Player" },
      { id: "asha", full_name: "Asha Rao", username: "asha" },
      { id: "AbCdEfGhIjKlMnOpQrStUvWxYz12", full_name: "Uid User" },
    ],
    users_private: [
      { id: "cap", email: "cap@gmail.com" },
      { id: "plr", email: "plr@gmail.com" },
      { id: "asha", email: "asha@gmail.com" },
    ],
    teams: [{ id: "t1", name: "Lions", created_by: "cap", captain_id: "cap" }],
    team_players: [
      { id: "tp-plr", team_id: "t1", user_id: "plr" },
      { id: "tp-asha", team_id: "t1", user_id: "asha" },
    ],
  });
  // Search keys, as every server write keeps them.
  await derivedFieldsDataSource(ds).update("users", "asha", {
    full_name: "Asha Rao",
  });
});

async function addPlaceholder(name: string) {
  signIn("cap");
  const res = await createPlayerQuick("t1", name);
  expect(res.error).toBeNull();
  return res.data!.user_id;
}

describe("invite to claim", () => {
  it("lets the invited person sign in and take over the profile", async () => {
    const placeholder = await addPlaceholder("Ravi Kumar");
    expect(await ds.getById("users", placeholder)).toMatchObject({
      is_placeholder: true,
    });

    expect(
      await setPlayerClaimEmail("t1", placeholder, " Ravi.K@Gmail.com "),
    ).toEqual({
      error: null,
      maskedEmail: "r…@gmail.com",
      shareEmail: "ravi.k@gmail.com",
    });

    // The session route: the invite lets them in, the profile sync re-maps
    // the placeholder (and its squad entry) onto their new account.
    const ravi = google("auth-ravi", "ravi.k@gmail.com", "Ravi K");
    const session: DataSource = derivedFieldsDataSource(ds);
    expect(await canSignIn(session, ravi, true)).toBe(true);
    expect((await ensureOwnProfile(session, ravi)).action).toBe("remapped");
    await acceptInvitations(session, ravi.email, ravi.id);

    expect(await ds.getById("users", placeholder)).toBeNull();
    expect(await ds.getById("users", "auth-ravi")).toMatchObject({
      full_name: "Ravi Kumar",
      is_placeholder: false,
    });
    expect(await ds.getById("users_private", "auth-ravi")).toMatchObject({
      email: "ravi.k@gmail.com",
    });
    const squad = await ds.query("team_players", [
      { field: "team_id", op: "==", value: "t1" },
    ]);
    expect(squad.map((p) => p.user_id)).toContain("auth-ravi");
    const team = await ds.getById("teams", "t1");
    const roster = (team!.roster as { user_id: string; user: { id: string } }[])
      .map((e) => [e.user_id, e.user?.id]);
    expect(roster).toContainEqual(["auth-ravi", "auth-ravi"]);
    expect(roster.flat()).not.toContain(placeholder);
  });

  it("refuses an email another profile already holds", async () => {
    const placeholder = await addPlaceholder("Ravi Kumar");
    expect(await setPlayerClaimEmail("t1", placeholder, "asha@gmail.com")).toEqual(
      { error: "That email is already on CricScore as Asha Rao" },
    );
  });

  it("refuses players with an account, and people who cannot manage the team", async () => {
    signIn("cap");
    expect(await setPlayerClaimEmail("t1", "asha", "new@gmail.com")).toEqual({
      error: "Asha Rao already has a CricScore account",
    });
    const placeholder = await addPlaceholder("Ravi Kumar");
    signIn("plr");
    expect(
      (await setPlayerClaimEmail("t1", placeholder, "ravi@gmail.com")).error,
    ).toMatch(/can invite its players/);
  });

  it("can change or remove the email before they sign in", async () => {
    const placeholder = await addPlaceholder("Ravi Kumar");
    await setPlayerClaimEmail("t1", placeholder, "ravi@gmail.com");
    await setPlayerClaimEmail("t1", placeholder, "ravi.kumar@gmail.com");
    expect(await canSignIn(ds, google("x", "ravi@gmail.com", "R"), true)).toBe(
      false,
    );
    expect(
      await setPlayerClaimEmail("t1", placeholder, null),
    ).toEqual({ error: null, maskedEmail: null, shareEmail: null });
    const priv = await ds.getById("users_private", placeholder);
    expect(String(priv!.email)).toMatch(/@players\.local$/);
    expect(
      await canSignIn(ds, google("y", "ravi.kumar@gmail.com", "R"), true),
    ).toBe(false);
  });

  it("keeps placeholders out of the scorer search", async () => {
    await addPlaceholder("Asha Placeholder");
    signIn("cap");
    const { data } = await searchScorers("asha");
    expect(data.map((u) => u.full_name)).toEqual(["Asha Rao"]);
    // Picking a result sends its id; an account id that is not a UUID too.
    const { data: byId } = await searchScorers("AbCdEfGhIjKlMnOpQrStUvWxYz12");
    expect(byId.map((u) => u.full_name)).toEqual(["Uid User"]);
    expect(await searchScorers("auth0Ravi9xYzAbCdEfGhIjKlMn")).toEqual({
      data: [],
      error: null,
    });
  });
});
