import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BallChip } from "./ball";

describe("BallChip", () => {
  it("says what happened to a screen reader, in words", () => {
    render(
      <>
        <BallChip kind="run" label="1" />
        <BallChip kind="run" label="2" />
        <BallChip kind="dot" label="0" />
        <BallChip kind="wicket" label="W" />
      </>,
    );
    expect(screen.getByText("1 run")).toBeInTheDocument();
    expect(screen.getByText("2 runs")).toBeInTheDocument();
    expect(screen.getByText("dot ball")).toBeInTheDocument();
    expect(screen.getByText("wicket")).toBeInTheDocument();
    expect(screen.queryByText("1 runs")).toBeNull();
  });
});
