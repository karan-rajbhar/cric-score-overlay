import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageHeader } from "./page";

describe("PageHeader", () => {
  it("a tab's own page has no Back, and Search beside its title", () => {
    render(<PageHeader search title="Clubs" />);
    expect(screen.queryByRole("link", { name: /Back/ })).toBeNull();
    expect(screen.getAllByRole("link", { name: "Search" })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).not.toHaveClass(
      "max-md:hidden",
    );
  });

  it("a page under a tab has Back, and names itself once on phones", () => {
    render(
      <PageHeader
        search
        title="My teams"
        back={{ href: "/more", label: "Back to More" }}
      />,
    );
    expect(screen.getByRole("link", { name: "Back to More" })).toHaveAttribute(
      "href",
      "/more",
    );
    expect(screen.getAllByRole("link", { name: "Search" })).toHaveLength(1);
    const [bar, heading] = screen.getAllByRole("heading", { level: 1 });
    expect(bar).not.toHaveClass("max-md:hidden");
    expect(bar?.closest(".md\\:hidden")).not.toBeNull();
    expect(heading).toHaveClass("max-md:hidden");
  });
});
