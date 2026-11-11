import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GreetingBar } from "./app-bar";

describe("GreetingBar (N21, N22)", () => {
  it("is the screen's h1, and draws the avatar from the full name", () => {
    const { container } = render(
      <GreetingBar
        name="John"
        avatarName="John Smith"
        greeting="Good morning"
      />,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Good morning, John" }),
    ).toBeInTheDocument();
    // The same initials as More and the header: "JS", not "JO".
    expect(container).toHaveTextContent("JS");
  });

  it("is the greeting alone when the account has no name", () => {
    render(<GreetingBar name="" greeting="Good evening" />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Good evening" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("there")).not.toBeInTheDocument();
  });
});
