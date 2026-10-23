import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CANVAS, lowerThirdAnchor, lowerThirdBottom, SAFE, SAFE_WIDTH, scoreBugAnchor } from "./layout";
import { AvatarSlot, CrestSlot } from "./slots";

describe("CrestSlot", () => {
  it("shows the logo, and the monogram when there is none or it fails", () => {
    const { container, rerender } = render(
      <CrestSlot logo="https://x/logo.png" name="Riverside Rangers" code="RIV" imgClassName="logo" />,
    );
    const img = container.querySelector("img.logo")!;
    expect(img).not.toBeNull();
    fireEvent.error(img);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe("RR");
    // A new logo is tried again.
    rerender(<CrestSlot logo="https://x/new.png" name="Riverside Rangers" code="RIV" />);
    expect(container.querySelector("img")).not.toBeNull();
    rerender(<CrestSlot logo={null} name="Hawks" code="HAW" textStyle={{ color: "red" }} />);
    expect(container.textContent).toBe("HAW");
    expect(container.querySelector("[data-crest]")!.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("AvatarSlot", () => {
  it("shows the photo, else initials or the fallback, never a broken image", () => {
    const { container, rerender } = render(<AvatarSlot url="https://x/p.png" name="Ravi Iyer" />);
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe("RI");
    rerender(<AvatarSlot url={null} name="Ravi Iyer" fallback={<i>silhouette</i>} />);
    expect(container.textContent).toBe("silhouette");
    rerender(
      <AvatarSlot url={null} name="Ravi Iyer">
        <b>gloss</b>
      </AvatarSlot>,
    );
    expect(container.textContent).toBe("RIgloss");
  });
});

describe("layout", () => {
  it("keeps everything inside title safe", () => {
    expect(SAFE).toEqual({ x: 96, y: 54 });
    expect(SAFE_WIDTH).toBe(CANVAS.width - 192);
    expect(scoreBugAnchor("top")).toEqual({ top: 54, left: 96, width: SAFE_WIDTH });
    expect(scoreBugAnchor("bottom", 20)).toEqual({ bottom: 74, left: 96, width: SAFE_WIDTH });
    expect(scoreBugAnchor("broadcast")).toEqual(scoreBugAnchor("bottom"));
    expect(scoreBugAnchor("compact")).toEqual({ bottom: 54, left: 96 });
    expect(lowerThirdBottom(140)).toBe(54 + 140 + 22);
    expect(lowerThirdAnchor(100, 10)).toEqual({ left: 96, bottom: 164, maxWidth: SAFE_WIDTH });
  });
});
