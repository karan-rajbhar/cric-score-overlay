import { describe, expect, it } from "vitest";
import { checkSponsorLogo, MAX_SPONSOR_LOGO_BYTES } from "./sponsor-logo";

const bytes = (...b: number[]) => new Uint8Array(b);
const text = (s: string) => new TextEncoder().encode(s);

const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10);
const WEBP = text("RIFF\u0000\u0000\u0000\u0000WEBPVP8 ");
const SVG = `<?xml version="1.0"?>
<!-- made by hand -->
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10">
  <style>.a{fill:url(#g)}</style>
  <defs><linearGradient id="g"/></defs>
  <use xlink:href="#g"/><rect class="a" width="10" height="10"/>
</svg>`;

describe("checkSponsorLogo", () => {
  it("identifies PNG, JPEG, WebP and clean SVG by their bytes", () => {
    expect(checkSponsorLogo(PNG)).toEqual({
      ok: true,
      contentType: "image/png",
      ext: "png",
    });
    expect(checkSponsorLogo(JPEG)).toMatchObject({ contentType: "image/jpeg" });
    expect(checkSponsorLogo(WEBP)).toMatchObject({ contentType: "image/webp" });
    expect(checkSponsorLogo(text(SVG))).toMatchObject({
      ok: true,
      contentType: "image/svg+xml",
      ext: "svg",
    });
  });

  it("enforces the 1 MB limit and refuses empty files", () => {
    const big = new Uint8Array(MAX_SPONSOR_LOGO_BYTES + 1);
    big.set(PNG);
    expect(checkSponsorLogo(big)).toEqual({
      ok: false,
      error: "Logos must be 1 MB or smaller",
    });
    const max = new Uint8Array(MAX_SPONSOR_LOGO_BYTES);
    max.set(PNG);
    expect(checkSponsorLogo(max).ok).toBe(true);
    expect(checkSponsorLogo(new Uint8Array()).ok).toBe(false);
  });

  it("refuses other file types whatever they claim to be", () => {
    for (const other of [
      text("GIF89a......"),
      text("<html><body>hi</body></html>"),
      text("%PDF-1.7"),
      bytes(0xff, 0xfe, 0x00, 0xd8),
    ]) {
      expect(checkSponsorLogo(other)).toMatchObject({ ok: false });
    }
  });

  it.each([
    ["a script element", `<svg><script>alert(1)</script></svg>`],
    ["a namespaced script", `<svg><svg:script>alert(1)</svg:script></svg>`],
    ["an event handler", `<svg onload="alert(1)"></svg>`],
    ["an event handler after a quote", `<svg><rect x="1"onclick="x()"/></svg>`],
    ["a javascript: link", `<svg><a href="javascript:alert(1)"><rect/></a></svg>`],
    ["an entity-encoded link", `<svg><a href="&#106;avascript:x"><rect/></a></svg>`],
    ["foreignObject HTML", `<svg><foreignObject><div/></foreignObject></svg>`],
    ["an animated href", `<svg><set attributeName="href" to="x"/></svg>`],
    ["a DOCTYPE with entities", `<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY x "y">]><svg/>`],
    ["an external image", `<svg><image href="https://evil.example/x.png"/></svg>`],
    ["an external xlink", `<svg><use xlink:href="other.svg#a"/></svg>`],
    ["a CSS url()", `<svg><style>rect{fill:url(https://x.example/a)}</style></svg>`],
    ["a CSS @import", `<svg><style>@import "x.css";</style></svg>`],
  ])("refuses an SVG with %s", (_label, svg) => {
    const out = checkSponsorLogo(text(svg));
    expect(out.ok).toBe(false);
  });

  it("allows inline raster images and fragment references in SVGs", () => {
    const svg = `<svg><image href="data:image/png;base64,iVBORw0KGgo="/><rect fill="url('#g')"/></svg>`;
    expect(checkSponsorLogo(text(svg)).ok).toBe(true);
  });
});
