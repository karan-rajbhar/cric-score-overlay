import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NewsTicker } from "./news-ticker";

describe("NewsTicker Component", () => {
  it("renders null when visible is false", () => {
    const { container } = render(
      <NewsTicker visible={false} text="Tournament update" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders ticker text and badge when visible", () => {
    render(
      <NewsTicker
        visible={true}
        badge="HEADLINE"
        text="Grand Finals live from London"
      />,
    );
    expect(screen.getByText("HEADLINE")).toBeInTheDocument();
    expect(screen.getAllByText(/Grand Finals live from London/i)).toHaveLength(
      2,
    );
  });
});
