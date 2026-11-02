import { fireEvent, render, screen } from "@testing-library/react";
import { Link2 } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionsSheet } from "./actions-sheet";
import { Disclosure } from "./disclosure";
import { PinnedTitle } from "./pinned-title";
import { PlayerAwardRow } from "./player-award";
import { ScoreLine } from "./score";
import { ScreenBar, TopStrip } from "./screen";
import { ShareMenu } from "./share-menu";
import { StatGrid, StatTile } from "./stat-tile";
import { PinnedTabs, Tabs, TabsContent } from "./tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";

describe("ScoreLine", () => {
  it("gives the match in a line, and leaves it out for screen readers", () => {
    const { container } = render(
      <ScoreLine
        sides={[
          { code: "ROH", score: "83/6 (8.0)" },
          { code: "OMK", score: "68/6 (8.0)", dim: true },
        ]}
      />,
    );
    expect(container.textContent).toBe("ROH83/6 (8.0)·OMK68/6 (8.0)");
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
  });

  it("says who plays before the start", () => {
    const { container } = render(
      <ScoreLine sides={[{ code: "NOR" }, { code: "EAS" }]} />,
    );
    expect(container.textContent).toBe("NORvEAS");
  });
});

describe("PlayerAwardRow", () => {
  it("shows the name and only the figures", () => {
    render(
      <PlayerAwardRow
        href="/players/rohan"
        award={{
          name: "Rohan Desai",
          avatarUrl: null,
          team: "Rohan",
          batting: { runs: 36, balls: 11, fours: 1, sixes: 4, notOut: true },
          bowling: { wickets: 2, runs: 21, overs: "3.0", maidens: 0 },
        }}
      />,
    );
    expect(screen.getByRole("link", { name: "Rohan Desai" })).toHaveAttribute(
      "href",
      "/players/rohan",
    );
    expect(screen.getByText("36* (11)")).toBeInTheDocument();
    expect(screen.getByText("2/21 (3.0)")).toBeInTheDocument();
  });

  it("leaves out what they did not do", () => {
    render(
      <PlayerAwardRow
        award={{
          name: "Nandu",
          avatarUrl: null,
          team: null,
          batting: null,
          bowling: { wickets: 2, runs: 5, overs: "2.0", maidens: 0 },
        }}
      />,
    );
    expect(screen.getByText("2/5 (2.0)")).toBeInTheDocument();
    expect(screen.queryByText(/\*/)).toBeNull();
  });
});

describe("ShareMenu", () => {
  it("holds its items behind one button, and says when it opens", async () => {
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ShareMenu
        items={[{ label: "Share link", icon: Link2, onSelect }]}
        onOpenChange={onOpenChange}
      />,
    );
    expect(screen.queryByText("Share link")).toBeNull();
    fireEvent.pointerDown(screen.getByRole("button", { name: "Share" }), {
      button: 0,
      ctrlKey: false,
    });
    expect(onOpenChange).toHaveBeenCalledWith(true);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Share link" }));
    expect(onSelect).toHaveBeenCalled();
  });
});

describe("PinnedTabs", () => {
  it("sticks under what the page pins, with a full tap target on phones", () => {
    const { container } = render(
      <Tabs defaultValue="a">
        <PinnedTabs
          label="Match sections"
          tabs={[
            { value: "a", label: "Summary" },
            { value: "b", label: "Scorecard" },
          ]}
        />
      </Tabs>,
    );
    expect(container.querySelector(".sticky")).toHaveClass(
      "top-[var(--pinned-top,0px)]",
    );
    expect(screen.getByRole("tab", { name: "Summary" })).toHaveClass(
      "max-md:h-11",
    );
    expect(
      screen.getByRole("tablist", { name: "Match sections" }),
    ).toBeInTheDocument();
  });
});

describe("TopStrip", () => {
  it("stays out of sight until asked for", () => {
    const { container, rerender } = render(
      <TopStrip show={false}>Score</TopStrip>,
    );
    expect(container.firstChild).toHaveClass("-translate-y-full");
    rerender(<TopStrip show>Score</TopStrip>);
    expect(container.firstChild).toHaveClass("translate-y-0");
  });
});

describe("Disclosure lazy", () => {
  it("mounts its content only on first opening, then keeps it", () => {
    const { container } = render(
      <Disclosure title="Head to head" lazy>
        <p>Past meetings</p>
      </Disclosure>,
    );
    expect(screen.queryByText("Past meetings")).toBeNull();
    const details = container.querySelector("details")!;
    details.open = true;
    fireEvent(details, new Event("toggle"));
    expect(screen.getByText("Past meetings")).toBeInTheDocument();
    details.open = false;
    fireEvent(details, new Event("toggle"));
    expect(screen.getByText("Past meetings")).toBeInTheDocument();
  });
});

describe("Pinned tabs on a long screen", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
  });

  const tabs = [
    { value: "a", label: "Summary" },
    { value: "b", label: "Stats" },
  ];
  const screenAt = (scrollY: number) => {
    Object.defineProperty(window, "scrollY", {
      value: scrollY,
      configurable: true,
    });
    const scrollTo = vi.fn();
    vi.spyOn(window, "scrollTo").mockImplementation(scrollTo);
    render(
      <Tabs defaultValue="a">
        <PinnedTabs label="Sections" tabs={tabs} />
        <TabsContent value="a">One</TabsContent>
        <TabsContent value="b">Two</TabsContent>
      </Tabs>,
    );
    return scrollTo;
  };
  const pick = (name: string) => {
    fireEvent.mouseDown(screen.getByRole("tab", { name }), { button: 0 });
    fireEvent.click(screen.getByRole("tab", { name }));
  };

  it("opens a tab at its top when changed from further down", () => {
    const scrollTo = screenAt(900);
    // The tabs began 500px above the top of the screen.
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
      top: -500,
    } as DOMRect);
    pick("Stats");
    expect(scrollTo).toHaveBeenCalledWith({ top: 400 });
  });

  it("leaves the page alone when the tabs are not yet pinned", () => {
    const scrollTo = screenAt(0);
    pick("Stats");
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("does nothing on the first render", () => {
    expect(screenAt(900)).not.toHaveBeenCalled();
  });
});

describe("A detail page's phone header", () => {
  it("has no title in the bar when the header names the screen", () => {
    render(<ScreenBar backHref="/clubs" backLabel="Back to Clubs" />);
    expect(screen.queryByRole("heading")).toBeNull();
    expect(
      screen.getByRole("link", { name: "Back to Clubs" }),
    ).toBeInTheDocument();
  });

  it("keeps the rest behind ⋯, opening with the screen's name", async () => {
    render(
      <ActionsSheet title="Riverside CC" label="Club actions">
        <button type="button">Club settings</button>
      </ActionsSheet>,
    );
    expect(screen.queryByText("Club settings")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Club actions" }));
    expect(
      await screen.findByRole("heading", { name: "Riverside CC" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Club settings")).toBeInTheDocument();
  });

  it("lets a button in the sheet open its own dialog on top", async () => {
    render(
      <ActionsSheet title="Riverside CC" label="Club actions">
        <Dialog>
          <DialogTrigger>Club settings</DialogTrigger>
          <DialogContent>
            <DialogTitle>Edit club</DialogTitle>
            <DialogDescription>The form.</DialogDescription>
          </DialogContent>
        </Dialog>
      </ActionsSheet>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Club actions" }));
    fireEvent.click(await screen.findByText("Club settings"));
    expect(await screen.findByText("The form.")).toBeInTheDocument();
  });

  it("sets figures in one row on phones", () => {
    const { container } = render(
      <StatGrid compact>
        <StatTile compact label="Teams" value={2} hint="1 new" />
      </StatGrid>,
    );
    expect(container.firstChild).toHaveClass("max-md:grid-cols-4");
    expect(screen.getByText("1 new")).toHaveClass("max-md:hidden");
  });

  it("brings the name back in a strip, once scrolled past", () => {
    const { container } = render(<PinnedTitle>Riverside CC</PinnedTitle>);
    expect(screen.getByText("Riverside CC")).toBeInTheDocument();
    expect(container.querySelector(".fixed")).toHaveClass("-translate-y-full");
  });
});
