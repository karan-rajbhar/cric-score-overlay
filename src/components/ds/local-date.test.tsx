import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LocalDate } from "./local-date";

// 03:50 UTC is 09:20 in India; the runner's own zone may be either.
const ISO = "2026-11-15T03:50:00Z";
const inRunnerZone = new Date(ISO).toLocaleTimeString("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
});

describe("LocalDate", () => {
  it("renders the app's home zone on the server, never the server's UTC", () => {
    const html = renderToString(<LocalDate value={ISO} format="time" />);
    expect(html).toContain(">09:20<");
    expect(html).toContain(`dateTime="${ISO}"`);
  });

  it("shows the viewer's zone in the browser", () => {
    const { container } = render(<LocalDate value={ISO} format="shortTime" />);
    expect(container).toHaveTextContent(
      `${new Date(ISO).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}, ${inRunnerZone}`,
    );
  });

  it("hydrates the server's HTML without a mismatch, then shows the viewer's zone", async () => {
    const el = document.createElement("div");
    el.innerHTML = renderToString(<LocalDate value={ISO} format="time" />);
    document.body.appendChild(el);
    const onRecoverableError = vi.fn();
    await act(async () => {
      hydrateRoot(el, <LocalDate value={ISO} format="time" />, {
        onRecoverableError,
      });
    });
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(el.textContent).toBe(inRunnerZone);
    el.remove();
  });

  it("renders nothing for a missing date", () => {
    const { container } = render(<LocalDate value={null} format="short" />);
    expect(container).toBeEmptyDOMElement();
  });
});
