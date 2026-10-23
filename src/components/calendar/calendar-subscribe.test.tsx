import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { CalendarSubscribe, calendarLinks } from "./calendar-subscribe";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("calendarLinks", () => {
  it("builds the https, webcal and Google Calendar addresses", () => {
    expect(calendarLinks("https://cricscore.example", "team", "t1")).toEqual({
      https: "https://cricscore.example/api/calendar/team/t1.ics",
      webcal: "webcal://cricscore.example/api/calendar/team/t1.ics",
      google:
        "https://calendar.google.com/calendar/render?cid=webcal%3A%2F%2Fcricscore.example%2Fapi%2Fcalendar%2Fteam%2Ft1.ics",
    });
  });
});

describe("CalendarSubscribe", () => {
  it("offers a subscription, Google Calendar, the link and a download", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<CalendarSubscribe scope="tournament" id="r1" name="Championship" />);
    const trigger = screen.getByRole("button", {
      name: "Add Championship fixtures to your calendar",
    });
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
    const subscribe = await screen.findByRole("menuitem", { name: "Subscribe in calendar app" });
    expect(subscribe).toHaveAttribute(
      "href",
      `webcal://${window.location.host}/api/calendar/tournament/r1.ics`,
    );
    expect(screen.getByRole("menuitem", { name: "Download .ics file" })).toHaveAttribute(
      "href",
      "/api/calendar/tournament/r1.ics",
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Copy calendar link" }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        `${window.location.origin}/api/calendar/tournament/r1.ics`,
      ),
    );
    expect(toast.success).toHaveBeenCalledWith("Calendar link copied");
  });
});
