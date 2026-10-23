import { expect, it } from "vitest";
import { SUMMER_BASH_FONTS } from "./fonts";

it("loads the fonts module under vitest", () => {
  expect(SUMMER_BASH_FONTS.display).toContain("--sb-font-display");
});
