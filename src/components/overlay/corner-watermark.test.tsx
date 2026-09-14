import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CornerWatermark } from "./corner-watermark";

describe("CornerWatermark Component", () => {
  it("renders null when visible is false", () => {
    const { container } = render(
      <CornerWatermark visible={false} title="IPL 2026" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders station watermark and rotating sponsor", () => {
    const sponsors = [
      { id: "sp1", name: "Cricket Direct", tagline: "Official Gear" },
    ];

    render(
      <CornerWatermark visible={true} title="IPL 2026" sponsors={sponsors} />,
    );

    expect(screen.getByText("IPL 2026")).toBeInTheDocument();
    expect(screen.getByText("Cricket Direct")).toBeInTheDocument();
    expect(screen.getByText("Official Gear")).toBeInTheDocument();
  });
});
