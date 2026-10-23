// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(
  fileURLToPath(new URL("../../../public/sw.js", import.meta.url)),
  "utf8",
);
const ORIGIN = "https://cricscore.altorstudio.com";

interface PushExports {
  notificationFromPush: (
    data: unknown,
    origin: string,
  ) => { title: string; options: Record<string, unknown> } | null;
  notificationUrl: (value: unknown, origin: string) => string;
}

function load(): PushExports {
  const cjs = { exports: {} as PushExports };
  vm.runInNewContext(SOURCE, {
    module: cjs,
    URL,
    self: { location: { href: `${ORIGIN}/sw.js?v=b1` } },
  });
  return cjs.exports;
}

const sw = load();

describe("service worker push messages", () => {
  it("shows the title and body, one notification per match", () => {
    expect(
      sw.notificationFromPush(
        {
          title: "Strikers vs Warriors",
          body: "Innings break. Strikers 156/7 (20 overs).",
          url: "/matches/m1",
          tag: "match-m1",
        },
        ORIGIN,
      ),
    ).toEqual({
      title: "Strikers vs Warriors",
      options: {
        body: "Innings break. Strikers 156/7 (20 overs).",
        icon: "/icon-192.png",
        tag: "match-m1",
        renotify: true,
        data: { url: `${ORIGIN}/matches/m1` },
      },
    });
  });

  it("ignores messages without a title", () => {
    expect(sw.notificationFromPush(null, ORIGIN)).toBeNull();
    expect(sw.notificationFromPush({ body: "x" }, ORIGIN)).toBeNull();
  });

  it("only ever opens pages of this site", () => {
    expect(sw.notificationUrl("/matches/m1?tab=scorecard", ORIGIN)).toBe(
      `${ORIGIN}/matches/m1?tab=scorecard`,
    );
    expect(sw.notificationUrl("https://evil.example/phish", ORIGIN)).toBe(`${ORIGIN}/`);
    expect(sw.notificationUrl("//evil.example/x", ORIGIN)).toBe(`${ORIGIN}/`);
    expect(sw.notificationUrl(undefined, ORIGIN)).toBe(`${ORIGIN}/`);
  });
});
