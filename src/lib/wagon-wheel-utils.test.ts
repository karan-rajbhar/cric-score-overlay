import { describe, expect, it } from "vitest";
import { getSectorFromAngle, SECTORS } from "./wagon-wheel-utils";

describe("wagon wheel sectors (seen as on TV, from behind the bowler)", () => {
  it("puts straight shots at the bottom, down the picture from the batter", () => {
    expect(getSectorFromAngle(190).id).toBe("long_off");
    expect(getSectorFromAngle(170).id).toBe("long_on");
  });

  it("puts a right-hander's off side on the left, leg side on the right", () => {
    expect(getSectorFromAngle(240).id).toBe("cover");
    expect(getSectorFromAngle(280).id).toBe("point");
    expect(getSectorFromAngle(100).id).toBe("mid_wicket");
    expect(getSectorFromAngle(70).id).toBe("square_leg");
  });

  it("puts fine leg and third man behind the batter, at the top", () => {
    expect(getSectorFromAngle(350).id).toBe("third_man");
    expect(getSectorFromAngle(10).id).toBe("fine_leg");
  });

  it("covers the whole field with 8 sectors and no gaps", () => {
    expect(SECTORS).toHaveLength(8);
    for (let a = 0; a < 360; a += 7.5) {
      expect(getSectorFromAngle(a)).toBeDefined();
    }
    for (const s of SECTORS) {
      expect(s.side).toBe(s.midAngle < 180 ? "leg" : "off");
    }
  });
});
