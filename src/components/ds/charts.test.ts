import { describe, expect, it } from "vitest";
import { overTicks } from "./charts";

describe("overTicks", () => {
  it("thins the labels by length of innings without a slot width", () => {
    expect(overTicks(20)).toEqual([2, 4, 6, 8, 10, 12, 14, 16, 18, 20]);
    expect(overTicks(10)).toHaveLength(10);
    expect(overTicks(50)).toHaveLength(10);
  });

  it("labels every over when each slot is wide enough", () => {
    expect(overTicks(20, 24)).toHaveLength(20);
    expect(overTicks(20, 24)[0]).toBe(1);
  });

  it("keeps thinning when the slots are narrow", () => {
    expect(overTicks(20, 14)).toHaveLength(10);
  });
});
