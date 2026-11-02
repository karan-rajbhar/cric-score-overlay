import { act, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useScrolledPast } from "./useScrolledPast";

function Probe() {
  const anchor = useRef<HTMLDivElement>(null);
  const pinned = useRef<HTMLDivElement>(null);
  const past = useScrolledPast(anchor, pinned);
  return (
    <>
      <div ref={anchor} />
      <div ref={pinned} style={{ top: "29px" }} />
      <p>{past ? "past" : "here"}</p>
    </>
  );
}

describe("useScrolledPast", () => {
  let callback: IntersectionObserverCallback;
  let options: IntersectionObserverInit | undefined;
  const disconnect = vi.fn();

  beforeEach(() => {
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(cb: IntersectionObserverCallback, o?: IntersectionObserverInit) {
          callback = cb;
          options = o;
        }
        observe() {}
        disconnect = disconnect;
      },
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  const fire = (isIntersecting: boolean, top: number) =>
    act(() =>
      callback(
        [
          { isIntersecting, boundingClientRect: { top } },
        ] as unknown as IntersectionObserverEntry[],
        {} as IntersectionObserver,
      ),
    );

  it("watches below what is pinned, read from its CSS top", () => {
    render(<Probe />);
    expect(options?.rootMargin).toBe("-29px 0px 0px 0px");
  });

  it("turns on once the anchor has gone up past it, and back", () => {
    render(<Probe />);
    expect(screen.getByText("here")).toBeInTheDocument();
    fire(false, -40);
    expect(screen.getByText("past")).toBeInTheDocument();
    fire(true, 100);
    expect(screen.getByText("here")).toBeInTheDocument();
  });

  it("stays off for an anchor still below the screen", () => {
    render(<Probe />);
    fire(false, 2000);
    expect(screen.getByText("here")).toBeInTheDocument();
  });

  it("does without the observer in old browsers", () => {
    vi.unstubAllGlobals();
    vi.stubGlobal("IntersectionObserver", undefined);
    render(<Probe />);
    expect(screen.getByText("here")).toBeInTheDocument();
  });
});
