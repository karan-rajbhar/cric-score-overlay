import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { PlayerLink } from "./player-link";

const linkProps = vi.fn();
vi.mock("next/link", () => ({
  default: (props: ComponentProps<"a"> & { prefetch?: boolean }) => {
    linkProps(props);
    return <a href={props.href}>{props.children}</a>;
  },
}));

describe("PlayerLink", () => {
  it("links to the player without prefetching their page", () => {
    render(<PlayerLink name="Rohan" href="/players/1" />);
    expect(screen.getByRole("link", { name: "Rohan" })).toHaveAttribute(
      "href",
      "/players/1",
    );
    expect(linkProps).toHaveBeenCalledWith(
      expect.objectContaining({ prefetch: false }),
    );
  });

  it("is plain text without a profile to open", () => {
    render(<PlayerLink name="Guest" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Guest")).toBeInTheDocument();
  });
});
