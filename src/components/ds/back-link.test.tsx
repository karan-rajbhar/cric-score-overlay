import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { noteVisit, resetVisits } from "~/lib/in-app-history";
import { BackLink } from "./back-link";

describe("BackLink", () => {
  let back: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetVisits();
    back = vi.spyOn(window.history, "back").mockImplementation(() => undefined);
  });

  const click = (init?: MouseEventInit) => {
    render(
      <BackLink href="/clubs/c1" avoid="/matches/m1/score">
        Back
      </BackLink>,
    );
    const link = screen.getByRole("link", { name: "Back" });
    // Followed unless the click was cancelled.
    return { followed: fireEvent.click(link, init), link };
  };

  it("is a real link to the natural parent", () => {
    render(<BackLink href="/clubs/c1">Back</BackLink>);
    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute(
      "href",
      "/clubs/c1",
    );
  });

  it("returns through history when this visit came from inside the app", () => {
    noteVisit("/tournaments/t1");
    noteVisit("/matches/m1");
    const { followed } = click();
    expect(back).toHaveBeenCalledOnce();
    expect(followed).toBe(false);
  });

  it("goes to the parent on a link opened fresh, never out of the app", () => {
    noteVisit("/matches/m1");
    const { followed } = click();
    expect(back).not.toHaveBeenCalled();
    expect(followed).toBe(true);
  });

  it("goes to the parent instead of a page that would send you straight back", () => {
    noteVisit("/matches/m1/score");
    noteVisit("/matches/m1");
    click();
    expect(back).not.toHaveBeenCalled();
  });

  it("leaves a new-tab click alone", () => {
    noteVisit("/tournaments/t1");
    noteVisit("/matches/m1");
    click({ ctrlKey: true });
    expect(back).not.toHaveBeenCalled();
  });
});
