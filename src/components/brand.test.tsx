import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandMark, BrandWordmark } from "./brand";

describe("Brand Components", () => {
  it("renders BrandMark with cricket ball SVG and applies custom classNames", () => {
    const { container } = render(<BrandMark className="custom-test-class" />);
    const span = container.querySelector("span");
    expect(span).toBeInTheDocument();
    expect(span).toHaveClass("custom-test-class");
    expect(span).toHaveClass("from-emerald-500");

    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("renders BrandWordmark with platform name and green accent dot", () => {
    render(<BrandWordmark />);
    expect(screen.getByText("CricScore")).toBeInTheDocument();

    const dot = screen.getByText("CricScore").nextElementSibling;
    expect(dot).toHaveClass("bg-emerald-500");
  });
});
