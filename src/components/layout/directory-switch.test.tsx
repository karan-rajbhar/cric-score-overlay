import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DirectorySwitch, MineAllSwitch } from "./directory-switch";

describe("DirectorySwitch", () => {
  it("links the three lists and marks the current one", () => {
    render(<DirectorySwitch current="/teams" />);
    expect(screen.getByRole("link", { name: "Clubs" })).toHaveAttribute(
      "href",
      "/clubs",
    );
    expect(screen.getByRole("link", { name: "Players" })).toHaveAttribute(
      "href",
      "/players",
    );
    expect(screen.getByRole("link", { name: "Teams" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Clubs" })).not.toHaveAttribute(
      "aria-current",
    );
  });
});

describe("MineAllSwitch", () => {
  it("marks the view shown", () => {
    render(
      <MineAllSwitch
        label="Club list"
        view="all"
        mine={{ label: "My clubs", href: "/clubs" }}
        all={{ label: "All clubs", href: "/clubs?view=all" }}
      />,
    );
    expect(screen.getByRole("link", { name: "All clubs" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
