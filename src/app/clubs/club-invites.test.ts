import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
const state: { client: unknown } = { client: null };
vi.mock("~/lib/firebase/server", () => ({
  createServerClient: async () => state.client,
}));

import type { AppUser } from "~/lib/firebase/auth-types";
import { MemoryDataSource } from "~/lib/firebase/datasource";
import { serverClientFor } from "~/lib/firebase/server-client";
import { acceptInvitations, canSignIn } from "~/lib/firebase/rpc/access";
import { inviteClubMember, revokeClubInvite } from "./actions";

let ds: MemoryDataSource;

function signIn(id: string) {
  state.client = serverClientFor({
    ds,
    db: null,
    getUser: async () =>
      ({ id, email: null, phone: null, user_metadata: {} }) as AppUser,
  });
}

beforeEach(() => {
  ds = new MemoryDataSource({
    users: [
      { id: "owner", full_name: "Owner" },
      { id: "ravi", full_name: "Ravi" },
      { id: "member", full_name: "Member" },
    ],
    users_private: [
      { id: "ravi", email: "ravi@gmail.com" },
      { id: "member", email: "member@gmail.com" },
    ],
    clubs: [{ id: "c1", name: "Riverside CC", owner_id: "owner" }],
    club_memberships: [
      { id: "m1", club_id: "c1", user_id: "member", role: "member", status: "active" },
    ],
  });
});

const google = (id: string, email: string): AppUser => ({
  id,
  email,
  phone: null,
  user_metadata: {},
  provider: "google.com",
});

describe("inviteClubMember", () => {
  it("saves an invite for a new email, who joins on first sign-in", async () => {
    signIn("owner");
    expect(await inviteClubMember("c1", " New@Gmail.com ")).toEqual({
      success: true,
      status: "invited",
      message: "Invite saved. Send them the message below.",
      shareEmail: "new@gmail.com",
    });
    expect(await inviteClubMember("c1", "new@gmail.com")).toMatchObject({
      status: "already_invited",
      shareEmail: "new@gmail.com",
    });
    expect(
      await ds.query("club_invitations", [
        { field: "email", op: "==", value: "new@gmail.com" },
      ]),
    ).toHaveLength(1);

    const user = google("auth-new", "new@gmail.com");
    expect(await canSignIn(ds, user, true)).toBe(true);
    await acceptInvitations(ds, user.email, user.id);
    const [membership] = await ds.query("club_memberships", [
      { field: "user_id", op: "==", value: "auth-new" },
    ]);
    expect(membership).toMatchObject({ club_id: "c1", status: "active" });
  });

  it("adds someone already on CricScore straight away", async () => {
    signIn("owner");
    expect(await inviteClubMember("c1", "ravi@gmail.com")).toEqual({
      success: true,
      status: "added",
      message: "Ravi is now a member of the club.",
      shareEmail: null,
    });
    const [membership] = await ds.query("club_memberships", [
      { field: "user_id", op: "==", value: "ravi" },
    ]);
    expect(membership).toMatchObject({ club_id: "c1", role: "member", status: "active" });
    expect(await inviteClubMember("c1", "member@gmail.com")).toMatchObject({
      status: "already_member",
      message: "Member is already a member.",
    });
  });

  it("is for club admins only", async () => {
    signIn("member");
    expect(await inviteClubMember("c1", "x@gmail.com")).toEqual({
      error: "You are not authorized to invite members to this club",
    });
  });

  it("lets an admin withdraw a pending invite", async () => {
    signIn("owner");
    await inviteClubMember("c1", "new@gmail.com");
    const [invite] = await ds.query("club_invitations", [
      { field: "email", op: "==", value: "new@gmail.com" },
    ]);
    signIn("member");
    expect((await revokeClubInvite("c1", invite!.id)).error).toMatch(/admins/);
    signIn("owner");
    expect(await revokeClubInvite("c1", invite!.id)).toEqual({ error: null });
    expect(await canSignIn(ds, google("x", "new@gmail.com"), true)).toBe(false);
  });
});
