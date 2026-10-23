import { describe, expect, it, vi } from "vitest";
import {
  BANNER_MAX_PX,
  fitWithin,
  LOGO_MAX_PX,
  outputTypeOf,
  resizeImageFile,
  type DecodedImage,
  type ImageCodec,
} from "./image-resize";

const file = (type: string, bytes = 400_000, name = "crest.png") =>
  new File([new Uint8Array(bytes)], name, { type });

/**
 * A codec over a decoded size, recording what it is asked to encode; the
 * encoder answers with `outType` (a browser without a WebP encoder answers
 * PNG) and `outBytes`.
 */
function fakeCodec(
  size: { width: number; height: number },
  out: { type?: string; bytes?: number; fail?: "decode" | "encode" } = {},
) {
  const close = vi.fn();
  const encode = vi.fn(
    async (_img: DecodedImage, _w: number, _h: number, type: string) =>
      out.fail === "encode"
        ? null
        : new Blob([new Uint8Array(out.bytes ?? 20_000)], {
            type: out.type ?? type,
          }),
  );
  const decode = vi.fn(async () => {
    if (out.fail === "decode") throw new Error("cannot decode");
    return { ...size, source: {} as CanvasImageSource, close };
  });
  return {
    codec: { decode, encode } satisfies ImageCodec,
    decode,
    encode,
    close,
  };
}

describe("fitWithin", () => {
  it("scales the longest side down to the limit, keeping the ratio", () => {
    expect(fitWithin(2048, 1024, 512)).toEqual({ width: 512, height: 256 });
    expect(fitWithin(1000, 3000, 512)).toEqual({ width: 171, height: 512 });
    expect(fitWithin(4000, 1500, 1600)).toEqual({ width: 1600, height: 600 });
    expect(fitWithin(10_000, 2, 512)).toEqual({ width: 512, height: 1 });
  });

  it("leaves an image within the limit alone", () => {
    expect(fitWithin(512, 512, 512)).toBeNull();
    expect(fitWithin(300, 120, 512)).toBeNull();
  });
});

describe("outputTypeOf", () => {
  it("keeps an alpha channel for PNG and WebP and JPEG as JPEG", () => {
    expect(outputTypeOf("image/png")).toBe("image/webp");
    expect(outputTypeOf("image/webp")).toBe("image/webp");
    expect(outputTypeOf("image/jpeg")).toBe("image/jpeg");
  });

  it("leaves SVG, GIF and unknown types alone", () => {
    expect(outputTypeOf("image/svg+xml")).toBeNull();
    expect(outputTypeOf("image/gif")).toBeNull();
    expect(outputTypeOf("image/heic")).toBeNull();
    expect(outputTypeOf("")).toBeNull();
  });
});

describe("resizeImageFile", () => {
  it("scales a large logo to 512 px, transparency kept as WebP", async () => {
    const f = fakeCodec({ width: 3000, height: 1500 });
    const out = await resizeImageFile(file("image/png"), LOGO_MAX_PX, f.codec);
    expect(f.encode).toHaveBeenCalledWith(
      expect.anything(),
      512,
      256,
      "image/webp",
      expect.any(Number),
    );
    expect(out.type).toBe("image/webp");
    expect(out.name).toBe("crest.webp");
    expect(out.size).toBe(20_000);
    expect(f.close).toHaveBeenCalled();
  });

  it("keeps PNG where the browser cannot encode WebP", async () => {
    const f = fakeCodec({ width: 2000, height: 2000 }, { type: "image/png" });
    const out = await resizeImageFile(file("image/png"), LOGO_MAX_PX, f.codec);
    expect(out.type).toBe("image/png");
    expect(out.name).toBe("crest.png");
  });

  it("never turns a transparent image into JPEG", async () => {
    const f = fakeCodec({ width: 2000, height: 2000 }, { type: "image/jpeg" });
    const original = file("image/webp", 400_000, "crest.webp");
    expect(await resizeImageFile(original, LOGO_MAX_PX, f.codec)).toBe(
      original,
    );
  });

  it("keeps a photo as JPEG and scales a banner to 1600 px", async () => {
    const f = fakeCodec({ width: 4000, height: 1500 });
    const out = await resizeImageFile(
      file("image/jpeg", 3_000_000, "banner.jpeg"),
      BANNER_MAX_PX,
      f.codec,
    );
    expect(f.encode).toHaveBeenCalledWith(
      expect.anything(),
      1600,
      600,
      "image/jpeg",
      expect.any(Number),
    );
    expect(out.type).toBe("image/jpeg");
    expect(out.name).toBe("banner.jpg");
  });
});

describe("resizeImageFile passes the original through", () => {
  it("for SVG, without decoding it", async () => {
    const f = fakeCodec({ width: 4000, height: 4000 });
    const svg = file("image/svg+xml", 5_000, "crest.svg");
    expect(await resizeImageFile(svg, LOGO_MAX_PX, f.codec)).toBe(svg);
    expect(f.decode).not.toHaveBeenCalled();
  });

  it("for an image already within the limit", async () => {
    const f = fakeCodec({ width: 480, height: 300 });
    const small = file("image/png");
    expect(await resizeImageFile(small, LOGO_MAX_PX, f.codec)).toBe(small);
    expect(f.encode).not.toHaveBeenCalled();
    expect(f.close).toHaveBeenCalled();
  });

  it("when the image cannot be decoded", async () => {
    const f = fakeCodec({ width: 0, height: 0 }, { fail: "decode" });
    // e.g. HEIC labelled as JPEG by the picker, on a browser without HEIC.
    const original = file("image/jpeg", 2_000_000, "IMG_0001.jpg");
    expect(await resizeImageFile(original, LOGO_MAX_PX, f.codec)).toBe(
      original,
    );
  });

  it("when encoding fails or saves nothing", async () => {
    const original = file("image/png", 30_000);
    const failing = fakeCodec(
      { width: 2000, height: 2000 },
      { fail: "encode" },
    );
    expect(await resizeImageFile(original, LOGO_MAX_PX, failing.codec)).toBe(
      original,
    );
    const bigger = fakeCodec({ width: 2000, height: 2000 }, { bytes: 40_000 });
    expect(await resizeImageFile(original, LOGO_MAX_PX, bigger.codec)).toBe(
      original,
    );
  });
});
