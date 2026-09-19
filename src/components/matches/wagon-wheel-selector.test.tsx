import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  WagonWheelSelector,
  WAGON_WHEEL_SECTORS,
} from "./wagon-wheel-selector";

describe("WagonWheelSelector", () => {
  it("exports all 8 standard cricket scoring sectors", () => {
    expect(WAGON_WHEEL_SECTORS).toHaveLength(8);
    const sectorIds = WAGON_WHEEL_SECTORS.map((s) => s.id);
    expect(sectorIds).toContain("cover");
    expect(sectorIds).toContain("point");
    expect(sectorIds).toContain("third_man");
    expect(sectorIds).toContain("fine_leg");
    expect(sectorIds).toContain("square_leg");
    expect(sectorIds).toContain("mid_wicket");
    expect(sectorIds).toContain("long_on");
    expect(sectorIds).toContain("long_off");
  });

  it("renders an interactive cricket ground SVG with sector buttons", () => {
    render(
      <WagonWheelSelector
        selectedZone={null}
        onSelectZone={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("region", {
        name: /interactive wagon wheel shot direction selector/i,
      }),
    ).toBeInTheDocument();

    // Check that sector buttons exist
    const coverButton = screen.getByRole("button", { name: /cover/i });
    expect(coverButton).toBeInTheDocument();

    const midWicketButton = screen.getByRole("button", { name: /mid wicket/i });
    expect(midWicketButton).toBeInTheDocument();
  });

  it("calls onSelectZone with sector ID when a sector wedge is clicked", () => {
    const onSelect = vi.fn();
    render(
      <WagonWheelSelector
        selectedZone={null}
        onSelectZone={onSelect}
      />,
    );

    const coverButton = screen.getByRole("button", { name: /cover/i });
    fireEvent.click(coverButton);
    expect(onSelect).toHaveBeenCalledWith("cover");
  });

  it("indicates the currently selected sector with aria-pressed and visual state", () => {
    render(
      <WagonWheelSelector
        selectedZone="mid_wicket"
        onSelectZone={vi.fn()}
      />,
    );

    const midWicketButton = screen.getByRole("button", { name: /mid wicket/i });
    expect(midWicketButton).toHaveAttribute("aria-pressed", "true");

    const coverButton = screen.getByRole("button", { name: /cover/i });
    expect(coverButton).toHaveAttribute("aria-pressed", "false");
  });

  it("allows keyboard selection via Enter and Space keys", () => {
    const onSelect = vi.fn();
    render(
      <WagonWheelSelector
        selectedZone={null}
        onSelectZone={onSelect}
      />,
    );

    const pointButton = screen.getByRole("button", { name: /point/i });
    fireEvent.keyDown(pointButton, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("point");

    const longOnButton = screen.getByRole("button", { name: /long on/i });
    fireEvent.keyDown(longOnButton, { key: " " });
    expect(onSelect).toHaveBeenCalledWith("long_on");
  });
});
