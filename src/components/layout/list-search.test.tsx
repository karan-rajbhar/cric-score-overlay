import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ListSearch } from "./list-search";

describe("ListSearch", () => {
  it("is a plain GET form, so its result is a URL", () => {
    render(
      <ListSearch
        action="/clubs"
        value="lions"
        label="Search clubs"
        placeholder="Search clubs…"
        hidden={{ view: "all" }}
      />,
    );
    const form = screen.getByRole("search") as HTMLFormElement;
    expect(form).toHaveAttribute("action", "/clubs");
    expect(form).toHaveAttribute("method", "GET");
    expect(screen.getByRole("searchbox", { name: "Search clubs" })).toHaveValue(
      "lions",
    );
    expect(new FormData(form).get("view")).toBe("all");
    expect(new FormData(form).get("search")).toBe("lions");
  });

  it("can use a list's own parameter", () => {
    render(
      <ListSearch
        action="/players"
        name="q"
        label="Search players"
        placeholder="Search"
      />,
    );
    expect(screen.getByRole("searchbox")).toHaveAttribute("name", "q");
  });
});
