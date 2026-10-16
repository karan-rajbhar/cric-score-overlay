import { afterEach, describe, expect, it } from "vitest";
import type { AppUser } from "../auth-types";
import { MemoryDataSource } from "../datasource";
import { acceptInvitations, canSignIn, inviteEmail } from "./access";

function googleUser(id: string, email: string): AppUser {
  return { id, email, phone: null, user_metadata: {}, provider: "google.com" };
}

const member = { id: "member-1", email: "member@gmail.com" };

describe("canSignIn", () => {
  afterEach(() => {
    delete process.env.ALLOWED_EMAILS;
  });

  it("rejects an email nobody invited", async () => {
    const ds = new MemoryDataSource({ users: [member] });
    expect(
      await canSignIn(ds, googleUser("new", "stranger@gmail.com"), true),
    ).toBe(false);
  });

  it("allows an existing profile by uid or by email", async () => {
    const ds = new MemoryDataSource({ users: [member] });
    expect(await canSignIn(ds, googleUser("member-1", "x@y.z"), false)).toBe(
      true,
    );
    expect(
      await canSignIn(ds, googleUser("other-uid", "Member@Gmail.com"), true),
    ).toBe(true);
  });

  it("allows a pending app invite but not an accepted one", async () => {
    const ds = new MemoryDataSource({
      invitations: [
        { id: "i1", email: "new@gmail.com", status: "pending" },
        { id: "i2", email: "used@gmail.com", status: "accepted" },
      ],
    });
    expect(await canSignIn(ds, googleUser("a", "new@gmail.com"), true)).toBe(
      true,
    );
    expect(await canSignIn(ds, googleUser("b", "used@gmail.com"), true)).toBe(
      false,
    );
  });

  it("allows a pending, unexpired club invite", async () => {
    const ds = new MemoryDataSource({
      club_invitations: [
        { id: "c1", email: "fresh@gmail.com", status: "pending" },
        {
          id: "c2",
          email: "stale@gmail.com",
          status: "pending",
          expires_at: "2020-01-01T00:00:00.000Z",
        },
      ],
    });
    expect(await canSignIn(ds, googleUser("a", "fresh@gmail.com"), true)).toBe(
      true,
    );
    expect(await canSignIn(ds, googleUser("b", "stale@gmail.com"), true)).toBe(
      false,
    );
  });

  it("ignores email matches when the email is unverified", async () => {
    const ds = new MemoryDataSource({
      invitations: [{ id: "i1", email: "new@gmail.com", status: "pending" }],
    });
    expect(await canSignIn(ds, googleUser("a", "new@gmail.com"), false)).toBe(
      false,
    );
  });

  it("allows bootstrap emails from ALLOWED_EMAILS", async () => {
    process.env.ALLOWED_EMAILS = "Owner@Gmail.com, second@gmail.com";
    const ds = new MemoryDataSource();
    expect(await canSignIn(ds, googleUser("a", "owner@gmail.com"), true)).toBe(
      true,
    );
  });
});

describe("inviteEmail", () => {
  it("requires a caller with a profile", async () => {
    const ds = new MemoryDataSource();
    await expect(inviteEmail(ds, "ghost", "a@gmail.com")).rejects.toThrow(
      "Authentication required",
    );
  });

  it("creates one pending invite per email", async () => {
    const ds = new MemoryDataSource({ users: [member] });
    expect(await inviteEmail(ds, "member-1", " New@Gmail.com ")).toEqual({
      status: "invited",
    });
    expect(await inviteEmail(ds, "member-1", "new@gmail.com")).toEqual({
      status: "already_invited",
    });
    const invites = await ds.query("invitations", []);
    expect(invites).toHaveLength(1);
    expect(invites[0]).toMatchObject({
      email: "new@gmail.com",
      invited_by: "member-1",
      status: "pending",
    });
  });

  it("reports people who already have access", async () => {
    const ds = new MemoryDataSource({ users: [member] });
    expect(await inviteEmail(ds, "member-1", "member@gmail.com")).toEqual({
      status: "already_member",
    });
  });

  it("rejects an invalid email", async () => {
    const ds = new MemoryDataSource({ users: [member] });
    await expect(inviteEmail(ds, "member-1", "not-an-email")).rejects.toThrow(
      "valid email",
    );
  });
});

describe("scorer invites", () => {
  const match = {
    id: "m1",
    created_by: "member-1",
    match_admins: [],
    club_id: null,
    tournament_id: null,
  };

  it("only lets the match's scorers invite scorers", async () => {
    const ds = new MemoryDataSource({
      users: [member, { id: "outsider", email: "out@gmail.com" }],
      matches: [match],
    });
    await expect(
      inviteEmail(ds, "outsider", "new@gmail.com", "m1"),
    ).rejects.toThrow("Only this match's scorers");
  });

  it("adds an existing user as scorer straight away", async () => {
    const ds = new MemoryDataSource({
      users: [member, { id: "u2", email: "u2@gmail.com", full_name: "Two" }],
      matches: [match],
    });
    expect(await inviteEmail(ds, "member-1", "U2@gmail.com", "m1")).toEqual({
      status: "added_scorer",
      name: "Two",
    });
    expect(await ds.getById("matches", "m1")).toMatchObject({
      match_admins: ["u2"],
    });
    expect(await inviteEmail(ds, "member-1", "u2@gmail.com", "m1")).toEqual({
      status: "already_scorer",
      name: "Two",
    });
  });

  it("makes a new invitee a scorer when they first sign in", async () => {
    const ds = new MemoryDataSource({
      users: [member],
      matches: [match, { ...match, id: "m2" }],
    });
    expect(await inviteEmail(ds, "member-1", "new@gmail.com", "m1")).toEqual({
      status: "invited",
    });
    // Re-inviting for another match adds it to the same pending invite.
    expect(await inviteEmail(ds, "member-1", "new@gmail.com", "m2")).toEqual({
      status: "already_invited",
    });
    const [invite] = await ds.query("invitations", []);
    expect(invite).toMatchObject({ scorer_match_ids: ["m1", "m2"] });

    await acceptInvitations(ds, "new@gmail.com", "new-uid");
    expect(await ds.getById("matches", "m1")).toMatchObject({
      match_admins: ["new-uid"],
    });
    expect(await ds.getById("matches", "m2")).toMatchObject({
      match_admins: ["new-uid"],
    });
  });
});

describe("acceptInvitations", () => {
  it("marks pending invites as accepted by the new uid", async () => {
    const ds = new MemoryDataSource({
      invitations: [{ id: "i1", email: "new@gmail.com", status: "pending" }],
    });
    await acceptInvitations(ds, "NEW@gmail.com", "uid-9");
    expect(await ds.getById("invitations", "i1")).toMatchObject({
      status: "accepted",
      accepted_by: "uid-9",
    });
  });
});
