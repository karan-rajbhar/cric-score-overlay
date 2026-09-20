import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClubLogo } from "./club-logo";

describe("ClubLogo component", () => {
  it("renders uploaded logo image when logoUrl is provided", () => {
    render(
      <ClubLogo
        name="Royal Cricket Club"
        shortName="RCC"
        logoUrl="https://example.com/rcc-logo.png"
      />,
    );

    const img = screen.getByRole("img", { name: "Royal Cricket Club logo" });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://example.com/rcc-logo.png");
  });

  it("renders initials fallback when logoUrl is not provided", () => {
    render(
      <ClubLogo
        name="Royal Cricket Club"
        shortName="RCC"
      />,
    );

    expect(screen.getByText("RCC")).toBeInTheDocument();
    expect(screen.getByLabelText("Royal Cricket Club emblem")).toBeInTheDocument();
  });

  it("derives initials from full name when shortName is missing", () => {
    render(
      <ClubLogo
        name="Super Strikers"
      />,
    );

    expect(screen.getByLabelText("Super Strikers emblem")).toBeInTheDocument();
  });
});
