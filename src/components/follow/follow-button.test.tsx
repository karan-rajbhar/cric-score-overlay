import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { getMyFollows, setFollow } from "~/app/follows/actions";
import { FollowButton } from "./follow-button";

vi.mock("next/navigation", () => ({ usePathname: () => "/teams/t1" }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("~/app/follows/actions", () => ({
  getMyFollows: vi.fn(),
  setFollow: vi.fn(),
}));
let user: { id: string } | null = { id: "u1" };
vi.mock("~/lib/auth", () => ({ useAuth: () => ({ user }) }));
const push = {
  availability: "available",
  enabled: false as boolean | null,
  busy: false,
  enable: vi.fn(async () => ({ ok: true })),
  disable: vi.fn(),
};
vi.mock("~/lib/push/use-push", () => ({ usePush: () => push }));

function renderButton() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <FollowButton kind="team" id="t1" name="Strikers" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  user = { id: "u1" };
  push.availability = "available";
  push.enabled = false;
  vi.mocked(getMyFollows).mockResolvedValue({ data: [], error: null });
});

describe("FollowButton", () => {
  it("sends signed-out visitors to sign in", () => {
    user = null;
    renderButton();
    expect(screen.getByRole("link", { name: "Follow" })).toHaveAttribute(
      "href",
      "/auth/login?redirect=%2Fteams%2Ft1",
    );
  });

  it("follows, then offers notifications once", async () => {
    vi.mocked(setFollow).mockResolvedValue({ data: ["team:t1"], error: null });
    renderButton();
    const button = await screen.findByRole("button", { name: "Follow Strikers" });
    await waitFor(() => expect(button).toBeEnabled());
    expect(button).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(button);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Following Strikers" })).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
    );
    expect(setFollow).toHaveBeenCalledWith("team", "t1", true);
    const [title, options] = vi.mocked(toast.success).mock.calls[0]!;
    expect(title).toBe("Following Strikers");
    expect(options).toMatchObject({
      description: expect.stringContaining("starts, at the innings break and with the result"),
      action: { label: "Turn on" },
    });
  });

  it("explains the iPhone step instead where the app must be installed", async () => {
    push.availability = "needs-install";
    vi.mocked(setFollow).mockResolvedValue({ data: ["team:t1"], error: null });
    renderButton();
    const button = await screen.findByRole("button", { name: "Follow Strikers" });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    const options = vi.mocked(toast.success).mock.calls[0]![1] as { description: string; action?: unknown };
    expect(options.description).toMatch(/Home Screen/);
    expect(options.action).toBeUndefined();
  });

  it("unfollows and reports errors", async () => {
    vi.mocked(getMyFollows).mockResolvedValue({ data: ["team:t1"], error: null });
    vi.mocked(setFollow).mockResolvedValueOnce({ data: null, error: "Not found" });
    renderButton();
    const button = await screen.findByRole("button", { name: "Following Strikers" });
    fireEvent.click(button);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Not found"));
    expect(setFollow).toHaveBeenCalledWith("team", "t1", false);
  });
});
