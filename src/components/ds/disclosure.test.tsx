import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Disclosure } from "./disclosure";

const screenIs = (wide: boolean) =>
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: wide,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));

const details = (container: HTMLElement) =>
  container.querySelector("details") as HTMLDetailsElement;

describe("Disclosure", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("is closed on phones and says what it holds", () => {
    screenIs(false);
    const { container } = render(
      <Disclosure title="Partnerships" aside="Best 46" below="Six stands">
        Each stand
      </Disclosure>,
    );
    expect(details(container).open).toBe(false);
    const summary = container.querySelector("summary");
    expect(summary).toHaveTextContent("Partnerships");
    expect(summary).toHaveTextContent("Best 46");
    expect(summary).toHaveTextContent("Six stands");
    expect(summary).not.toHaveTextContent("Each stand");
    expect(
      screen.getByRole("heading", { name: "Partnerships" }),
    ).toBeInTheDocument();
  });

  it("is open from md up", () => {
    screenIs(true);
    const { container } = render(<Disclosure title="T">Body</Disclosure>);
    expect(details(container).open).toBe(true);
  });

  it("opens on phones when asked to", () => {
    screenIs(false);
    const { container } = render(
      <Disclosure title="T" defaultOpen>
        Body
      </Disclosure>,
    );
    expect(details(container).open).toBe(true);
  });

  it("keeps what the viewer opened through a re-render", () => {
    screenIs(false);
    const ui = (text: string) => <Disclosure title="T">{text}</Disclosure>;
    const { container, rerender } = render(ui("Live"));
    details(container).open = true;
    fireEvent(details(container), new Event("toggle"));
    rerender(ui("Live, one ball later"));
    expect(details(container).open).toBe(true);
  });
});
