import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { DrawerNotifications } from "./push-settings";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const push = {
  availability: "available",
  enabled: false as boolean | null,
  busy: false,
  enable: vi.fn(async () => ({ ok: true })),
  disable: vi.fn(async () => undefined),
};
vi.mock("~/lib/push/use-push", () => ({ usePush: () => push }));

beforeEach(() => {
  vi.clearAllMocks();
  push.availability = "available";
  push.enabled = false;
});

describe("DrawerNotifications", () => {
  it("is hidden where push cannot work", () => {
    push.availability = "unsupported";
    const { container } = render(<DrawerNotifications />);
    expect(container).toBeEmptyDOMElement();
    push.availability = "unconfigured";
    const again = render(<DrawerNotifications />);
    expect(again.container).toBeEmptyDOMElement();
  });

  it("explains, and turns notifications on and off", async () => {
    const { rerender } = render(<DrawerNotifications />);
    expect(
      screen.getByRole("region", { name: "Notifications" }),
    ).toHaveTextContent("starts, at the innings break and with the result");
    fireEvent.click(screen.getByRole("button", { name: "Turn on notifications" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Notifications are on"));
    push.enabled = true;
    rerender(<DrawerNotifications />);
    fireEvent.click(screen.getByRole("button", { name: "Turn off on this device" }));
    await waitFor(() => expect(push.disable).toHaveBeenCalled());
  });

  it("tells iPhone and iPad users to add the app first", () => {
    push.availability = "needs-install";
    render(<DrawerNotifications />);
    expect(screen.getByText(/add CricScore to your Home Screen first/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
