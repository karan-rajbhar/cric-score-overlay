import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ViewportVars } from "~/components/viewport-vars";
import { Dialog, DialogContent, DialogTitle } from "./dialog";

function mockPhone(isPhone: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: isPhone && query.includes("max-width"),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

function renderDialog() {
  return render(
    <Dialog open>
      <DialogContent aria-describedby={undefined}>
        <DialogTitle>Invite someone</DialogTitle>
        <input aria-label="Email" />
        <input aria-label="Agree" type="checkbox" />
      </DialogContent>
    </Dialog>,
  );
}

const realMatchMedia = window.matchMedia;
const realScrollIntoView = Element.prototype.scrollIntoView;

describe("dialogs and the on-screen keyboard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Element.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => {
    vi.useRealTimers();
    window.matchMedia = realMatchMedia;
    Element.prototype.scrollIntoView = realScrollIntoView;
  });

  it("works where matchMedia is unavailable (no phone detection)", () => {
    // jsdom and some embedded browsers have no matchMedia.
    window.matchMedia = undefined as unknown as typeof window.matchMedia;
    renderDialog();
    const email = screen.getByLabelText("Email");
    expect(() => act(() => email.focus())).not.toThrow();
    act(() => vi.advanceTimersByTime(300));
    expect(email.scrollIntoView).not.toHaveBeenCalled();
  });

  it("anchors to the visible viewport on phones instead of the screen centre", () => {
    mockPhone(true);
    renderDialog();
    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("max-sm:top-[calc(var(--vv-top,0px)");
    expect(dialog.className).toContain("max-sm:translate-y-0");
    expect(dialog.className).toContain("max-sm:max-h-[calc(var(--vvh,100dvh)");
  });

  it("scrolls a focused text field into view on phones once the keyboard is up", () => {
    mockPhone(true);
    renderDialog();
    const email = screen.getByLabelText("Email");
    act(() => email.focus());
    expect(email.scrollIntoView).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(300));
    expect(email.scrollIntoView).toHaveBeenCalledWith({
      block: "center",
      behavior: "smooth",
    });
  });

  it("does not scroll for checkboxes or on larger screens", () => {
    mockPhone(true);
    const { unmount } = renderDialog();
    const box = screen.getByLabelText("Agree");
    act(() => box.focus());
    act(() => vi.advanceTimersByTime(300));
    expect(box.scrollIntoView).not.toHaveBeenCalled();
    unmount();

    mockPhone(false);
    renderDialog();
    const email = screen.getByLabelText("Email");
    act(() => email.focus());
    act(() => vi.advanceTimersByTime(300));
    expect(email.scrollIntoView).not.toHaveBeenCalled();
  });
});

describe("ViewportVars", () => {
  it("publishes the visible viewport height and offset as CSS variables", () => {
    const listeners: Record<string, () => void> = {};
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: {
        height: 400,
        offsetTop: 120,
        addEventListener: (type: string, fn: () => void) => {
          listeners[type] = fn;
        },
        removeEventListener: vi.fn(),
      },
    });
    const raf = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((cb) => {
        cb(0);
        return 1;
      });
    render(<ViewportVars />);
    const style = document.documentElement.style;
    expect(style.getPropertyValue("--vvh")).toBe("400px");
    expect(style.getPropertyValue("--vv-top")).toBe("120px");

    (window.visualViewport as unknown as { height: number }).height = 300;
    listeners.resize?.();
    expect(style.getPropertyValue("--vvh")).toBe("300px");
    raf.mockRestore();
  });
});
