import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const signOut = vi.fn(async () => {});
vi.mock("~/lib/auth", () => ({ useAuth: () => ({ signOut, user: null }) }));
vi.mock("~/lib/firebase/client", () => ({ createClient: vi.fn() }));
const pending = { count: 0 };
vi.mock("~/lib/offline-queue", () => ({
  getTotalPendingCount: () => pending.count,
}));

import { useSignOut } from "./useAccount";

function SignOutButton() {
  const { signOut: run, dialog } = useSignOut();
  return (
    <>
      <button type="button" onClick={() => void run()}>
        Sign out
      </button>
      {dialog}
    </>
  );
}

describe("useSignOut (N37)", () => {
  beforeEach(() => {
    signOut.mockClear();
  });

  it("signs out at once when nothing is waiting to be sent", async () => {
    pending.count = 0;
    render(<SignOutButton />);
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(signOut).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("asks in the app's dialog, staying signed in by default, when changes are unsent", async () => {
    pending.count = 2;
    render(<SignOutButton />);
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    const ask = await screen.findByRole("dialog", {
      name: "2 scoring changes have not been sent",
    });
    expect(within(ask).getByRole("button", { name: "Stay signed in" })).toHaveFocus();
    expect(signOut).not.toHaveBeenCalled();

    fireEvent.click(within(ask).getByRole("button", { name: "Sign out anyway" }));
    await waitFor(() => expect(signOut).toHaveBeenCalled());
  });

  it("stays signed in when told to", async () => {
    pending.count = 1;
    render(<SignOutButton />);
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    const ask = await screen.findByRole("dialog", {
      name: "1 scoring change has not been sent",
    });
    fireEvent.click(within(ask).getByRole("button", { name: "Stay signed in" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(signOut).not.toHaveBeenCalled();
  });
});
