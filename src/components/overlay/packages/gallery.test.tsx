import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PACKAGE_MANIFEST } from "./manifest";
import { GALLERY_STATES, OverlayGallery } from "./gallery";
import { OVERLAY_ELEMENTS } from "./types";

const builtIn = PACKAGE_MANIFEST.filter((p) => p.kind === "plain").map(
  (p) => p.id,
);
const broadcast = PACKAGE_MANIFEST.filter((p) => p.kind === "broadcast").map(
  (p) => p.id,
);

describe("overlay gallery", () => {
  it.each(builtIn)("draws every element of the %s package", (pkg) => {
    for (const element of OVERLAY_ELEMENTS) {
      const { container, unmount } = render(
        <OverlayGallery packageId={pkg} element={element} />,
      );
      const frame = container.querySelector(
        `[data-gallery-element="${element}"]`,
      );
      expect(frame, element).not.toBeNull();
      expect(
        frame!.querySelector(`[data-package="${pkg}"]`)?.textContent?.trim() ||
          frame!.querySelector("svg"),
        `${pkg} ${element}`,
      ).toBeTruthy();
      unmount();
    }
  });

  it.each(broadcast)(
    "draws every element of the %s broadcast package in every state",
    (pkg) => {
      for (const element of OVERLAY_ELEMENTS) {
        for (const state of GALLERY_STATES) {
          const { container, unmount } = render(
            <OverlayGallery packageId={pkg} element={element} state={state} />,
          );
          expect(
            container.querySelector(`[data-package="${pkg}"]`),
            `${pkg} ${element} ${state}`,
          ).not.toBeNull();
          unmount();
        }
      }
    },
  );

  it("draws the variants, kinds and states it lists", () => {
    const cases: Array<Record<string, string>> = [
      { element: "sting", kind: "hat_trick" },
      { element: "sting", kind: "five_for" },
      { element: "breakStrap", kind: "rain_delay", variant: "card" },
      { element: "message", variant: "single" },
      { element: "batterLowerThird", variant: "figures" },
      { element: "playingXi", variant: "team2" },
      { element: "scoreBug", state: "pre" },
      { element: "scoreBug", state: "break" },
      { element: "scoreBug", state: "result" },
      { element: "playerProfile", variant: "tournament" },
    ];
    for (const c of cases) {
      const { container, unmount } = render(
        <OverlayGallery packageId="standard" element={c.element!} {...c} />,
      );
      expect(
        container.querySelector('[data-package="standard"]')?.textContent,
        JSON.stringify(c),
      ).toBeTruthy();
      unmount();
    }
  });

  it("lists every package and element without one", () => {
    const { container } = render(
      <OverlayGallery packageId="standard" element={null} />,
    );
    expect(container.querySelectorAll("a")).toHaveLength(
      PACKAGE_MANIFEST.length * OVERLAY_ELEMENTS.length,
    );
  });
});
