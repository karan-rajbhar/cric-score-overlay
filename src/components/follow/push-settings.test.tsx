import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { NotificationSettings } from "./push-settings";

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

describe("NotificationSettings", () => {
  it("is hidden where push cannot work", () => {
    push.availability = "unsupported";
    const { container } = render(<NotificationSettings />);
    expect(container).toBeEmptyDOMElement();
    push.availability = "unconfigured";
    const again = render(<NotificationSettings />);
    expect(again.container).toBeEmptyDOMElement();
  });

  it("is a switch that shows its state, and explains (N29)", async () => {
    const { rerender } = render(<NotificationSettings />);
    const toggle = screen.getByRole("switch", { name: "Notifications" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(toggle).toHaveAccessibleDescription(
      /Off.*starts, at the innings break and with the result/,
    );
    fireEvent.click(toggle);
    await waitFor(() => expect(push.enable).toHaveBeenCalled());
    // The row says it, not a toast.
    expect(toast.success).not.toHaveBeenCalled();
    push.enabled = true;
    rerender(<NotificationSettings />);
    expect(screen.getByRole("switch", { name: "Notifications" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByText("On for this device")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch", { name: "Notifications" }));
    await waitFor(() => expect(push.disable).toHaveBeenCalled());
  });

  it("tells iPhone and iPad users to add the app first", () => {
    push.availability = "needs-install";
    render(<NotificationSettings />);
    expect(screen.getByText(/add CricScore to your Home Screen first/)).toBeInTheDocument();
    expect(screen.queryByRole("switch")).toBeNull();
  });
});
