import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const path = { value: "/teams/t1" };
vi.mock("next/navigation", () => ({ usePathname: () => path.value }));

import { LightTrail, useLitHref } from "./nav-light";
import { navSectionOf } from "./navigation";

function Lit() {
  return <p>{navSectionOf(useLitHref(path.value))}</p>;
}

describe("the lit tab follows the trail (N24)", () => {
  it("lights a club's team as Clubs while its trail is on screen", () => {
    path.value = "/teams/t1";
    const { rerender, unmount } = render(
      <>
        <LightTrail href="/clubs" />
        <Lit />
      </>,
    );
    expect(screen.getByText("clubs")).toBeInTheDocument();

    // Without the trail, the path decides: More holds Teams.
    rerender(<Lit />);
    expect(screen.getByText("more")).toBeInTheDocument();
    unmount();
  });

  it("ignores a trail published for another page", () => {
    path.value = "/teams/t1";
    render(<LightTrail href="/clubs" />);
    path.value = "/players/p1";
    render(<Lit />);
    expect(screen.getByText("more")).toBeInTheDocument();
  });
});
