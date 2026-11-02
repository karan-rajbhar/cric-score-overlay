import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ClubContacts } from "./club-contacts";

const club = {
  location: "New York, NY",
  contact_email: "info@metro.example",
  website_url: "metro.example",
};

describe("ClubContacts", () => {
  it("shows everything on tablets and desktop", () => {
    render(<ClubContacts club={club} socialLinks={{}} />);
    expect(screen.getByText("New York, NY")).toBeInTheDocument();
    expect(screen.getByText("info@metro.example")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Website" })).toBeInTheDocument();
  });

  it("splits for a phone: the place in the header", () => {
    render(<ClubContacts club={club} socialLinks={{}} part="place" />);
    expect(screen.getByText("New York, NY")).toBeInTheDocument();
    expect(screen.queryByText("info@metro.example")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("splits for a phone: the rest in the ⋯ sheet", () => {
    render(
      <ClubContacts
        club={club}
        socialLinks={{ instagram: "metro" }}
        part="contact"
      />,
    );
    expect(screen.queryByText("New York, NY")).toBeNull();
    expect(screen.getByText("info@metro.example")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Instagram" })).toHaveAttribute(
      "href",
      "https://instagram.com/metro",
    );
  });
});
