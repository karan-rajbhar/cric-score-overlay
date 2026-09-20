import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  recordBall,
  undoLastBall,
  setCurrentBatsmen,
  setCurrentBowler,
  endInnings,
  updateBall,
  startSuperOver,
  updateMatchSettings,
  reassignCurrentOverBowler,
} from "./mutations";
import { createServerClient } from "~/lib/supabase/server";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
vi.mock("~/lib/match-cache", () => ({
  invalidateMatchCache: vi.fn(),
}));

vi.mock("~/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
}));

describe("Scoring Security & Authorization Gate", () => {
  const dummyMatchId = "match-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks unauthenticated users from recording balls", async () => {
    vi.mocked(createServerClient).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValueOnce({ data: { user: null } }),
      },
    } as never);

    const res = await recordBall({
      matchId: dummyMatchId,
      bowlerId: "p1",
      batsmanId: "p2",
      nonStrikerId: "p3",
      event: { runsScored: 1 },
    });

    expect(res.data).toBeNull();
    expect(res.error).toBe("You must be logged in to record scores");
  });

  it("blocks unauthorized users (not creator, not in match_admins) from recording balls", async () => {
    vi.mocked(createServerClient).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValueOnce({
          data: { user: { id: "attacker-id" } },
        }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "matches") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    created_by: "legit-creator-id",
                    match_admins: ["scorer-1-id"],
                    club_id: null,
                    tournament_id: null,
                  },
                }),
              }),
            }),
          };
        }
        return {};
      }),
    } as never);

    const res = await recordBall({
      matchId: dummyMatchId,
      bowlerId: "p1",
      batsmanId: "p2",
      nonStrikerId: "p3",
      event: { runsScored: 1 },
    });

    expect(res.data).toBeNull();
    expect(res.error).toContain("You do not have permission to score this match");
  });

  it("allows designated scorers in match_admins to record balls", async () => {
    const mockRpc = vi.fn().mockResolvedValueOnce({
      data: { match_completed: false },
      error: null,
    });

    vi.mocked(createServerClient).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValueOnce({
          data: { user: { id: "scorer-1-id" } },
        }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "matches") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    created_by: "creator-id",
                    match_admins: ["scorer-1-id"],
                    club_id: null,
                    tournament_id: null,
                  },
                }),
              }),
            }),
          };
        }
        return {};
      }),
      rpc: mockRpc,
    } as never);

    const res = await recordBall({
      matchId: dummyMatchId,
      bowlerId: "p1",
      batsmanId: "p2",
      nonStrikerId: "p3",
      event: { runsScored: 4 },
    });

    expect(res.error).toBeNull();
    expect(mockRpc).toHaveBeenCalledWith("record_ball", expect.objectContaining({
      p_match_id: dummyMatchId,
      p_runs_scored: 4,
    }));
  });

  it("blocks unauthorized users from undoing balls", async () => {
    vi.mocked(createServerClient).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValueOnce({
          data: { user: { id: "attacker-id" } },
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                created_by: "creator-id",
                match_admins: [],
                club_id: null,
              },
            }),
          }),
        }),
      }),
    } as never);

    const res = await undoLastBall(dummyMatchId);
    expect(res.data).toBeNull();
    expect(res.error).toContain("Only match administrators or designated scorers");
  });

  it("blocks unauthorized users from setting current batsmen or bowler", async () => {
    vi.mocked(createServerClient).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValueOnce({
          data: { user: { id: "attacker-id" } },
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { created_by: "creator-id", match_admins: [] },
            }),
          }),
        }),
      }),
    } as never);

    const res = await setCurrentBatsmen(dummyMatchId, "p1", "p2");
    expect(res.error).toContain("Only match administrators or designated scorers");
  });

  it("blocks unauthorized users from updating match settings", async () => {
    vi.mocked(createServerClient).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValueOnce({
          data: { user: { id: "attacker-id" } },
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { created_by: "creator-id", match_admins: [] },
            }),
          }),
        }),
      }),
    } as never);

    const res = await updateMatchSettings(dummyMatchId, { oversPerInnings: 15 });
    expect(res.success).toBe(false);
    expect(res.error).toContain("Only match administrators or designated scorers");
  });

  it("blocks unauthorized users from reassigning the current bowler", async () => {
    vi.mocked(createServerClient).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValueOnce({
          data: { user: { id: "attacker-id" } },
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { created_by: "creator-id", match_admins: [] },
            }),
          }),
        }),
      }),
    } as never);

    const res = await reassignCurrentOverBowler(dummyMatchId, "new-bowler-id");
    expect(res.success).toBe(false);
    expect(res.error).toContain("Only match administrators or designated scorers");
  });

  it("blocks unauthorized users from setting current bowler", async () => {
    vi.mocked(createServerClient).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValueOnce({
          data: { user: { id: "attacker-id" } },
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { created_by: "creator-id", match_admins: [] },
            }),
          }),
        }),
      }),
    } as never);

    const res = await setCurrentBowler(dummyMatchId, "bowler-1");
    expect(res.error).toContain("Only match administrators or designated scorers");
  });

  it("blocks unauthorized users from ending innings", async () => {
    vi.mocked(createServerClient).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValueOnce({
          data: { user: { id: "attacker-id" } },
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { created_by: "creator-id", match_admins: [] },
            }),
          }),
        }),
      }),
    } as never);

    const res = await endInnings(dummyMatchId);
    expect(res.data).toBeNull();
    expect(res.error).toContain("Only match administrators or designated scorers");
  });

  it("blocks unauthorized users from updating a ball", async () => {
    vi.mocked(createServerClient).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValueOnce({
          data: { user: { id: "attacker-id" } },
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { created_by: "creator-id", match_admins: [] },
            }),
          }),
        }),
      }),
    } as never);

    const res = await updateBall({
      matchId: dummyMatchId,
      ballId: "ball-1",
      runsScored: 2,
    });
    expect(res.data).toBeNull();
    expect(res.error).toContain("Only match administrators or designated scorers");
  });

  it("blocks unauthorized users from starting super over", async () => {
    vi.mocked(createServerClient).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValueOnce({
          data: { user: { id: "attacker-id" } },
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { created_by: "creator-id", match_admins: [] },
            }),
          }),
        }),
      }),
    } as never);

    const res = await startSuperOver(dummyMatchId);
    expect(res.data).toBeNull();
    expect(res.error).toContain("Only match administrators or designated scorers");
  });
});
