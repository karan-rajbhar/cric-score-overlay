import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar } from "./avatar";

describe("Avatar", () => {
  it("shows the photo, and the initials when it cannot be loaded", () => {
    const { container } = render(
      <Avatar name="Karan Rajbhar" src="https://example.com/gone.jpg" />,
    );
    const img = container.querySelector("img")!;
    expect(img).toHaveAttribute("src", "https://example.com/gone.jpg");
    fireEvent.error(img);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("KR")).toBeInTheDocument();
  });

  it("shows the initials without a photo", () => {
    render(<Avatar name="Sam Patel" />);
    expect(screen.getByText("SP")).toBeInTheDocument();
  });
});
