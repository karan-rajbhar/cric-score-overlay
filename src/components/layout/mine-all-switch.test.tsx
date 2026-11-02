import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MineAllSwitch } from "./mine-all-switch";

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
