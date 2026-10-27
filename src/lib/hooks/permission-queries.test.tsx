import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type * as React from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/**
 * The browser client as it is a moment after load: the page already knows
 * the user (from the session cookie) but Firebase Auth has not restored its
 * current user yet, so a check that relies on it answers for nobody.
 */
const firebaseCurrentUser: string | null = null;
const rpc = vi.fn(async (_name: string, args: Record<string, unknown>) => {
  const uid =
    typeof args.p_user_id === "string" ? args.p_user_id : firebaseCurrentUser;
  return { data: uid === "creator", error: null };
});
vi.mock("~/lib/firebase/client", () => ({
  createClient: () => ({ rpc }),
  getFirebaseDb: vi.fn(),
}));

import {
  useCanDeleteMatchQuery,
  useCanProduceOverlayQuery,
  useMatchAdminQuery,
} from "./useMatchQueries";

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("permission checks right after load", () => {
  it("know the match's creator before Firebase Auth restores its user", async () => {
    const admin = renderHook(() => useMatchAdminQuery("m1", "creator"), { wrapper });
    const del = renderHook(() => useCanDeleteMatchQuery("m1", "creator"), { wrapper });
    const overlay = renderHook(
      () => useCanProduceOverlayQuery("m1", "creator", true),
      { wrapper },
    );
    await waitFor(() => expect(admin.result.current.data).toBe(true));
    await waitFor(() => expect(del.result.current.data).toBe(true));
    await waitFor(() => expect(overlay.result.current.data).toBe(true));
    for (const [, args] of rpc.mock.calls) {
      expect(args).toMatchObject({ p_match_id: "m1", p_user_id: "creator" });
    }
  });

  it("still say no for someone else", async () => {
    const { result } = renderHook(() => useMatchAdminQuery("m1", "viewer"), { wrapper });
    await waitFor(() => expect(result.current.data).toBe(false));
  });
});
