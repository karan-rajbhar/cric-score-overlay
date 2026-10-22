import { act, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const firebaseAuth = vi.hoisted(() => ({
  getRedirectResult: vi.fn(),
  onIdTokenChanged: vi.fn(),
  signInWithPopup: vi.fn(),
  signInWithRedirect: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("firebase/auth", () => {
  class GoogleAuthProvider {
    params: Record<string, string> = {};
    setCustomParameters(params: Record<string, string>) {
      this.params = params;
    }
  }
  return { ...firebaseAuth, GoogleAuthProvider };
});

const auth = { name: "auth" };
vi.mock("~/lib/firebase/client", () => ({
  getFirebaseAuth: () => auth,
  toAppUser: (u: { uid: string }) => ({
    id: u.uid,
    email: null,
    phone: null,
    user_metadata: {},
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import {
  AuthProvider,
  inviteOnlyMessage,
  shouldFallbackToRedirect,
  useAuth,
} from "./auth";
import { toAuthError } from "./firebase/auth-types";

const googleUser = {
  uid: "u1",
  getIdToken: () => Promise.resolve("id-token"),
};

let ctx: ReturnType<typeof useAuth>;
function Probe() {
  const value = useAuth();
  useEffect(() => {
    ctx = value;
  });
  return (
    <div>
      <span data-testid="user">{value.user?.id ?? "none"}</span>
      <span data-testid="redirect-error">
        {value.redirectError?.code ?? ""}
      </span>
    </div>
  );
}

function renderProvider() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  firebaseAuth.onIdTokenChanged.mockReturnValue(() => undefined);
  firebaseAuth.signOut.mockResolvedValue(undefined);
  fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

function sessionPosts() {
  return fetchMock.mock.calls.filter(
    ([url, init]) =>
      url === "/api/auth/session" && (init as RequestInit)?.method === "POST",
  );
}

describe("shouldFallbackToRedirect", () => {
  it("falls back only when the browser cannot show the popup", () => {
    expect(shouldFallbackToRedirect({ code: "auth/popup-blocked" })).toBe(true);
    expect(
      shouldFallbackToRedirect({
        code: "auth/operation-not-supported-in-this-environment",
      }),
    ).toBe(true);
    expect(
      shouldFallbackToRedirect({ code: "auth/popup-closed-by-user" }),
    ).toBe(false);
    expect(shouldFallbackToRedirect({ code: "app/invite-only" })).toBe(false);
    expect(shouldFallbackToRedirect(new Error("boom"))).toBe(false);
  });
});

describe("signInWithGoogle", () => {
  it("signs in with a popup, passing the login hint", async () => {
    firebaseAuth.signInWithPopup.mockResolvedValue({ user: googleUser });
    renderProvider();

    let result: Awaited<ReturnType<typeof ctx.signInWithGoogle>> | undefined;
    await act(async () => {
      result = await ctx.signInWithGoogle("a@b.com");
    });

    expect(result).toEqual({ error: null });
    const [, provider] = firebaseAuth.signInWithPopup.mock.calls[0]!;
    expect(provider.params).toEqual({
      prompt: "select_account",
      login_hint: "a@b.com",
    });
    expect(sessionPosts()).toHaveLength(1);
    expect(firebaseAuth.signInWithRedirect).not.toHaveBeenCalled();
    expect(screen.getByTestId("user").textContent).toBe("u1");
  });

  it("falls back to a redirect when the popup is blocked", async () => {
    firebaseAuth.signInWithPopup.mockRejectedValue({
      code: "auth/popup-blocked",
    });
    firebaseAuth.signInWithRedirect.mockResolvedValue(undefined);
    renderProvider();

    let result: Awaited<ReturnType<typeof ctx.signInWithGoogle>> | undefined;
    await act(async () => {
      result = await ctx.signInWithGoogle("a@b.com");
    });

    expect(result).toEqual({ error: null });
    expect(firebaseAuth.signInWithRedirect).toHaveBeenCalledTimes(1);
    const [redirectAuth, provider] =
      firebaseAuth.signInWithRedirect.mock.calls[0]!;
    expect(redirectAuth).toBe(auth);
    expect(provider.params.login_hint).toBe("a@b.com");
    expect(sessionStorage.getItem("cric_google_redirect")).toBe("1");
  });

  it("does not redirect when the user closes the popup", async () => {
    firebaseAuth.signInWithPopup.mockRejectedValue({
      code: "auth/popup-closed-by-user",
    });
    renderProvider();

    let result: Awaited<ReturnType<typeof ctx.signInWithGoogle>> | undefined;
    await act(async () => {
      result = await ctx.signInWithGoogle();
    });

    expect(result?.error?.code).toBe("auth/popup-closed-by-user");
    expect(firebaseAuth.signInWithRedirect).not.toHaveBeenCalled();
  });

  it("reports a failed redirect start and clears the pending marker", async () => {
    firebaseAuth.signInWithPopup.mockRejectedValue({
      code: "auth/popup-blocked",
    });
    firebaseAuth.signInWithRedirect.mockRejectedValue({
      code: "auth/network-request-failed",
    });
    renderProvider();

    let result: Awaited<ReturnType<typeof ctx.signInWithGoogle>> | undefined;
    await act(async () => {
      result = await ctx.signInWithGoogle();
    });

    expect(result?.error?.code).toBe("auth/network-request-failed");
    expect(sessionStorage.getItem("cric_google_redirect")).toBeNull();
  });
});

describe("redirect result on load", () => {
  it("creates the server session for the returning user", async () => {
    sessionStorage.setItem("cric_google_redirect", "1");
    firebaseAuth.getRedirectResult.mockResolvedValue({ user: googleUser });
    renderProvider();

    await waitFor(() =>
      expect(screen.getByTestId("user").textContent).toBe("u1"),
    );
    expect(firebaseAuth.getRedirectResult).toHaveBeenCalledWith(auth);
    expect(sessionPosts()).toHaveLength(1);
    expect(JSON.parse(sessionPosts()[0]![1].body as string)).toEqual({
      idToken: "id-token",
    });
    expect(sessionStorage.getItem("cric_google_redirect")).toBeNull();
  });

  it("signs out uninvited accounts and exposes the invite-only error", async () => {
    sessionStorage.setItem("cric_google_redirect", "1");
    firebaseAuth.getRedirectResult.mockResolvedValue({ user: googleUser });
    fetchMock.mockResolvedValue(new Response(null, { status: 403 }));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    renderProvider();

    await waitFor(() =>
      expect(screen.getByTestId("redirect-error").textContent).toBe(
        "app/invite-only",
      ),
    );
    expect(firebaseAuth.signOut).toHaveBeenCalledWith(auth);
    expect(screen.getByTestId("user").textContent).toBe("none");
  });

  it("skips the redirect check when no redirect is pending", () => {
    renderProvider();
    expect(firebaseAuth.getRedirectResult).not.toHaveBeenCalled();
  });
});

describe("auth bootstrap while offline", () => {
  function setOnline(value: boolean) {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      get: () => value,
    });
  }

  function tokenListener() {
    return firebaseAuth.onIdTokenChanged.mock.calls[0]![1] as (
      u: unknown,
    ) => Promise<void>;
  }

  function emitUser(user: unknown) {
    return act(async () => {
      await tokenListener()(user);
    });
  }

  afterEach(() => {
    setOnline(true);
    document.cookie = "cric_session_hint=; max-age=0";
    delete (auth as { currentUser?: unknown }).currentUser;
  });

  it("keeps the persisted user signed in without calling the server", async () => {
    setOnline(false);
    renderProvider();
    await emitUser(googleUser);

    expect(screen.getByTestId("user").textContent).toBe("u1");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never clears the server session from an offline device", async () => {
    setOnline(false);
    document.cookie = "cric_session_hint=1";
    renderProvider();
    await emitUser(null);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("syncs the server session once back online", async () => {
    setOnline(false);
    (auth as { currentUser?: unknown }).currentUser = googleUser;
    renderProvider();
    await emitUser(googleUser);
    expect(sessionPosts()).toHaveLength(0);

    setOnline(true);
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    await waitFor(() => expect(sessionPosts()).toHaveLength(1));
    expect(screen.getByTestId("user").textContent).toBe("u1");
  });

  it("stays signed in when the sync fails on the network", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    renderProvider();
    await emitUser(googleUser);

    expect(screen.getByTestId("user").textContent).toBe("u1");
    expect(firebaseAuth.signOut).not.toHaveBeenCalled();
  });

  it("renders after a grace period on a slow network when a session exists", async () => {
    vi.useFakeTimers();
    try {
      document.cookie = "cric_session_hint=1";
      fetchMock.mockReturnValue(new Promise(() => undefined));
      renderProvider();
      let done = false;
      void tokenListener()(googleUser).then(() => {
        done = true;
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(4100);
      });
      expect(done).toBe(true);
      expect(screen.getByTestId("user").textContent).toBe("u1");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("invite-only refusal message", () => {
  it("names the Google account that was refused", () => {
    const err = Object.assign(new Error(inviteOnlyMessage("wrong@gmail.com")), {
      code: "app/invite-only",
    });
    const { message, code } = toAuthError(err);
    expect(code).toBe("app/invite-only");
    expect(message).toContain("wrong@gmail.com has no invite");
    expect(message).toContain("the Google account your invite was for");
    expect(message).not.toMatch(/!/);
  });

  it("still reads when the account has no email", () => {
    expect(inviteOnlyMessage(null)).toContain("This Google account has no invite");
  });
});
