import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { rescheduleMatch } from "~/app/matches/reschedule";
import { MatchMoreMenu } from "./match-more-menu";
import { RescheduleMatchDialog } from "./reschedule-match-dialog";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, replace: vi.fn(), push: vi.fn() }),
}));
vi.mock("~/app/matches/mutations", () => ({ deleteMatch: vi.fn() }));
vi.mock("~/app/matches/reschedule", () => ({ rescheduleMatch: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("~/lib/auth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
let canDelete = true;
vi.mock("~/lib/hooks/useMatchQueries", () => ({
  useMatchAdminQuery: () => ({ data: true }),
  useCanDeleteMatchQuery: () => ({ data: canDelete }),
}));

const fixture = {
  id: "m1",
  title: "Lions vs Tigers",
  status: "scheduled",
  scheduled_at: new Date("2026-11-01T10:00").toISOString(),
  venue: "Oval",
  umpire1_name: "Dar",
  umpire2_name: null,
};

async function openMenu() {
  const trigger = screen.getByRole("button", { name: "More match actions" });
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
}

describe("Reschedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    canDelete = true;
  });

  it("is offered to organisers before the start only", async () => {
    const { rerender } = render(<MatchMoreMenu match={fixture} />);
    await openMenu();
    expect(
      await screen.findByRole("menuitem", { name: "Reschedule" }),
    ).toBeInTheDocument();

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });
    rerender(<MatchMoreMenu match={{ ...fixture, status: "live" }} />);
    await openMenu();
    await screen.findByRole("menuitem", { name: "OBS overlay" });
    expect(screen.queryByRole("menuitem", { name: "Reschedule" })).toBeNull();
  });

  it("is not offered to co-scorers", async () => {
    canDelete = false;
    render(<MatchMoreMenu match={fixture} />);
    await openMenu();
    await screen.findByRole("menuitem", { name: "OBS overlay" });
    expect(screen.queryByRole("menuitem", { name: "Reschedule" })).toBeNull();
  });

  it("starts from the match and sends the new time, venue and umpires", async () => {
    vi.mocked(rescheduleMatch).mockResolvedValue({ error: null });
    render(<RescheduleMatchDialog match={fixture} />);
    fireEvent.click(screen.getByRole("button", { name: "Reschedule" }));

    const when = screen.getByLabelText("Date and time");
    expect(when).toHaveValue("2026-11-01T10:00");
    expect(screen.getByLabelText("Venue")).toHaveValue("Oval");
    expect(screen.getByLabelText("Umpire 1")).toHaveValue("Dar");

    fireEvent.change(when, { target: { value: "2026-11-02T14:30" } });
    fireEvent.change(screen.getByLabelText("Venue"), {
      target: { value: "Park ground" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(rescheduleMatch).toHaveBeenCalledWith("m1", {
        scheduledAt: new Date("2026-11-02T14:30").toISOString(),
        venue: "Park ground",
        umpire1Name: "Dar",
        umpire2Name: "",
      }),
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Match rescheduled"),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("shows the server's refusal and keeps the form", async () => {
    vi.mocked(rescheduleMatch).mockResolvedValue({
      error: "Only a match that has not started can be rescheduled",
    });
    render(<RescheduleMatchDialog match={fixture} />);
    fireEvent.click(screen.getByRole("button", { name: "Reschedule" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Only a match that has not started can be rescheduled",
    );
    expect(screen.getByLabelText("Venue")).toHaveValue("Oval");
  });
});
