#!/usr/bin/env node
/**
 * Screenshots of an overlay package from the gallery (`/overlay/gallery`,
 * dev only), at 1920x1080, plus a contact sheet.
 *
 *   node scripts/overlay-shots.mjs --package <id> [--port 3021] [--out <dir>]
 *        [--all] [--only scoreBug,sting] [--wait 2500] [--bg day|night]
 *
 * Start the dev server first (`npx next dev --webpack -p <port>`). It
 * shoots every element in its main state, the score bug in every phase and
 * layout, and with `--all` the variants and kinds the gallery lists (straps
 * and cards, each sting, each break). `contact-sheet.png` tiles the main
 * shots. Default output: <tmp>/overlay-shots/<id>.
 *
 * Browser: CHROME_PATH, else an installed Chrome / Chromium / Edge (or one
 * playwright downloaded), driven over the DevTools protocol; else
 * playwright-core when it is installed.
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * @typedef {{ pkg?: string, port: number, out?: string, wait: number,
 *   bg: string, all: boolean, only: string[] | null, help?: boolean }} Args
 * @typedef {{ element: string, state?: string, variant?: string,
 *   kind?: string, layout?: string }} Shot
 * @typedef {{ wait: number, width?: number, height?: number }} ShootOptions
 * @typedef {{ shoot: (url: string, file: string, opts: ShootOptions) => Promise<void>,
 *   close: () => Promise<void> }} Browser
 */

// ---- arguments --------------------------------------------------------------

/** @param {string[]} argv @returns {Args} */
function parseArgs(argv) {
  /** @type {Args} */
  const out = { port: 3021, wait: 2500, bg: "day", all: false, only: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i] ?? "";
    if (a === "--package") out.pkg = next();
    else if (a === "--port") out.port = Number(next());
    else if (a === "--out") out.out = next();
    else if (a === "--wait") out.wait = Number(next());
    else if (a === "--bg") out.bg = next();
    else if (a === "--only") out.only = next().split(",");
    else if (a === "--all") out.all = true;
    else if (a === "--help" || a === "-h") out.help = true;
    else throw new Error(`Unknown argument ${a}`);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (args.help || !args.pkg) {
  console.log(
    "Usage: node scripts/overlay-shots.mjs --package <id> [--port 3021] [--out <dir>] [--all] [--only a,b] [--wait ms] [--bg day|night]",
  );
  process.exit(args.help ? 0 : 1);
}
const pkg = args.pkg;
const only = args.only;
const base = `http://localhost:${args.port}/overlay/gallery`;
const outDir = resolve(args.out ?? join(tmpdir(), "overlay-shots", pkg));
mkdirSync(outDir, { recursive: true });

// ---- what to shoot ------------------------------------------------------------

const PHASES = ["pre", "first", "live", "break", "result"];
const LAYOUTS = ["bottom", "top", "compact"];
const STING_KINDS = [
  "four",
  "six",
  "wicket",
  "fifty",
  "hundred",
  "three_for",
  "five_for",
  "hat_trick",
  "free_hit",
  "milestone",
];
const BREAK_KINDS = ["drinks", "timeout", "rain_delay", "innings_break", "powerplay"];
/** Variants worth a picture of their own (`--all`). */
const EXTRA = [
  { element: "batterLowerThird", variant: "figures" },
  { element: "batterLowerThird", variant: "last_out" },
  { element: "bowlerLowerThird", variant: "figures" },
  { element: "partnership", variant: "card" },
  { element: "partnership", variant: "split" },
  { element: "thisOver", variant: "card" },
  { element: "scorecard", variant: "batting" },
  { element: "playingXi", variant: "team1" },
  { element: "playingXi", variant: "team2" },
  { element: "playerProfile", variant: "tournament" },
  { element: "winPredictor", variant: "strap" },
  { element: "projectedScore", variant: "strap" },
  { element: "message", variant: "single" },
  { element: "message", variant: "baseline" },
  ...STING_KINDS.map((kind) => ({ element: "sting", kind })),
  ...BREAK_KINDS.flatMap((kind) => [
    { element: "breakStrap", kind, ...(kind === "innings_break" ? { state: "break" } : {}) },
    {
      element: "breakStrap",
      kind,
      variant: "card",
      ...(kind === "innings_break" ? { state: "break" } : {}),
    },
  ]),
];

/** The elements, read from the gallery's index (it lists them all). */
async function galleryElements() {
  const html = await fetchWhenUp(base);
  const found = new Set();
  for (const m of html.matchAll(/element=([A-Za-z]+)/g)) found.add(m[1]);
  if (!found.size) throw new Error(`No elements listed at ${base}`);
  return [...found];
}

/** @param {Shot} s */
function shotName(s) {
  return [s.element, s.variant, s.kind, s.state, s.layout].filter(Boolean).join("-");
}

/** @param {Shot} s */
function shotUrl(s) {
  const q = new URLSearchParams({ package: pkg, element: s.element });
  for (const k of /** @type {const} */ (["state", "variant", "kind", "layout"])) {
    const v = s[k];
    if (v) q.set(k, v);
  }
  if (args.bg !== "day") q.set("bg", args.bg);
  return `${base}?${q}`;
}

// ---- the dev server -------------------------------------------------------------

/** @param {number} ms @returns {Promise<void>} */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * GET `url` until the dev server answers 200 (it compiles on first hit).
 * @param {string} url
 */
async function fetchWhenUp(url, seconds = 120) {
  for (let i = 0; i < seconds; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.text();
    } catch {
      // Not up yet.
    }
    await sleep(1000);
  }
  throw new Error(`No answer from ${url}: is the dev server running on port ${args.port}?`);
}

// ---- the browser ------------------------------------------------------------------

/** @param {string} name */
function onPath(name) {
  for (const dir of (process.env.PATH ?? "").split(":")) {
    const p = join(dir, name);
    if (existsSync(p)) return p;
  }
  return null;
}

/** A Chromium-family binary: CHROME_PATH, an installed one, or playwright's. */
function findChrome() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }
  const fixed = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ];
  for (const p of fixed) if (existsSync(p)) return p;
  for (const name of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
    const p = onPath(name);
    if (p) return p;
  }
  const caches = [
    join(homedir(), "Library/Caches/ms-playwright"),
    join(homedir(), ".cache/ms-playwright"),
  ];
  for (const cache of caches) {
    if (!existsSync(cache)) continue;
    const dirs = readdirSync(cache)
      .filter((d) => /^chromium-\d+$/.test(d))
      .sort()
      .reverse();
    for (const d of dirs) {
      for (const rel of [
        "chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium",
        "chrome-mac/Chromium.app/Contents/MacOS/Chromium",
        "chrome-linux/chrome",
        "chrome-linux64/chrome",
      ]) {
        const p = join(cache, d, rel);
        if (existsSync(p)) return p;
      }
    }
  }
  return null;
}

/**
 * A page driven over the DevTools protocol: goto, shoot, close.
 * @param {string} binary
 * @returns {Promise<Browser>}
 */
async function cdpBrowser(binary) {
  const port = 9400 + Math.floor(Math.random() * 400);
  const profile = join(tmpdir(), `overlay-shots-chrome-${port}`);
  const chrome = spawn(
    binary,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      "--window-size=1920,1080",
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  /** @type {{ type: string, webSocketDebuggerUrl: string } | null} */
  let target = null;
  for (let i = 0; i < 100 && !target; i++) {
    try {
      /** @type {Array<{ type: string, webSocketDebuggerUrl: string }>} */
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      target = list.find((t) => t.type === "page") ?? null;
    } catch {
      // Starting.
    }
    if (!target) await sleep(100);
  }
  if (!target) throw new Error("Chrome did not start");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => {
    ws.onopen = r;
    ws.onerror = j;
  });
  /** @typedef {{ id?: number, method?: string, result?: any }} Message */
  let id = 0;
  /** @type {Map<number, (msg: Message) => void>} */
  const pending = new Map();
  /** @type {Array<(msg: Message) => void>} */
  const waiters = [];
  ws.onmessage = (e) => {
    /** @type {Message} */
    const msg = JSON.parse(String(e.data));
    const reply = msg.id ? pending.get(msg.id) : undefined;
    if (msg.id && reply) {
      reply(msg);
      pending.delete(msg.id);
    } else if (msg.method) {
      for (const w of waiters.splice(0)) w(msg);
    }
  };
  /** @param {string} method @param {object} [params] @returns {Promise<Message>} */
  const send = (method, params = {}) =>
    new Promise((r) => {
      id += 1;
      pending.set(id, r);
      ws.send(JSON.stringify({ id, method, params }));
    });
  /** @returns {Promise<void>} */
  const loaded = () =>
    new Promise((r) => {
      /** @param {Message} msg */
      const check = (msg) => {
        if (msg.method === "Page.loadEventFired") r();
        else waiters.push(check);
      };
      waiters.push(check);
    });
  await send("Page.enable");
  /** @param {number} width @param {number} height */
  const size = (width, height) =>
    send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
  await size(1920, 1080);
  return {
    async shoot(url, file, { wait, width = 1920, height = 1080 }) {
      await size(width, height);
      const done = loaded();
      await send("Page.navigate", { url });
      await Promise.race([done, sleep(30_000)]);
      await send("Runtime.evaluate", { expression: "document.fonts.ready", awaitPromise: true });
      await sleep(wait);
      // The dev tools badge is not part of the overlay.
      await send("Runtime.evaluate", {
        expression: "document.querySelectorAll('nextjs-portal').forEach((e) => e.remove())",
      });
      const shot = await send("Page.captureScreenshot", {
        format: "png",
        clip: { x: 0, y: 0, width, height, scale: 1 },
        captureBeyondViewport: true,
      });
      writeFileSync(file, Buffer.from(shot.result?.data ?? "", "base64"));
    },
    async close() {
      ws.close();
      chrome.kill();
    },
  };
}

/** @returns {Promise<Browser>} */
async function playwrightBrowser() {
  // Optional: not a dependency of the app.
  const name = "playwright-core";
  const { chromium } = await import(name);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  return {
    /** @param {string} url @param {string} file @param {ShootOptions} opts */
    async shoot(url, file, { wait, width = 1920, height = 1080 }) {
      await page.setViewportSize({ width, height });
      await page.goto(url, { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(wait);
      await page.evaluate(() =>
        document.querySelectorAll("nextjs-portal").forEach((e) => e.remove()),
      );
      await page.screenshot({ path: file, clip: { x: 0, y: 0, width, height } });
    },
    close: () => browser.close(),
  };
}

async function openBrowser() {
  const binary = findChrome();
  if (binary) return cdpBrowser(binary);
  try {
    return await playwrightBrowser();
  } catch {
    throw new Error(
      "No browser found: install Chrome or Chromium, set CHROME_PATH, or add playwright-core.",
    );
  }
}

// ---- the contact sheet ------------------------------------------------------------

const COLS = 4;
const TILE = { w: 480, h: 270, label: 30, gap: 12 };

/** @param {string[]} files */
function sheetHtml(files) {
  const rows = Math.ceil(files.length / COLS);
  const cells = files
    .map(
      (f) =>
        `<figure><img src="${f}.png" alt=""><figcaption>${f}</figcaption></figure>`,
    )
    .join("");
  const height = rows * (TILE.h + TILE.label + TILE.gap) + 80;
  return {
    height,
    html: `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#0b0d14;color:#e8eaf2;font:600 16px system-ui,sans-serif}
h1{margin:0;padding:24px 24px 8px;font-size:22px}
main{display:grid;grid-template-columns:repeat(${COLS},${TILE.w}px);gap:${TILE.gap}px;padding:12px 24px}
figure{margin:0}img{display:block;width:${TILE.w}px;height:${TILE.h}px;object-fit:cover;border-radius:4px}
figcaption{height:${TILE.label}px;line-height:${TILE.label}px;color:#9aa1b5;font-size:14px}
</style><h1>${pkg}</h1><main>${cells}</main>`,
  };
}

// ---- run ---------------------------------------------------------------------------

const elements = await galleryElements();
/** @type {Shot[]} */
const main = elements.map((element) => ({ element }));
/** @type {Shot[]} */
const bug = PHASES.flatMap((state) =>
  LAYOUTS.map((layout) => ({ element: "scoreBug", state, layout })),
);
/** @type {Shot[]} */
let shots = [...main, ...bug, ...(args.all ? EXTRA : [])];
if (only) shots = shots.filter((s) => only.includes(s.element));

const browser = await openBrowser();
/** @type {string[]} */
const failed = [];
try {
  for (const s of shots) {
    const name = shotName(s);
    const url = shotUrl(s);
    try {
      await fetchWhenUp(url);
      await browser.shoot(url, join(outDir, `${name}.png`), { wait: args.wait });
      console.log(`shot ${name}`);
    } catch (err) {
      failed.push(name);
      console.error(`failed ${name}: ${err instanceof Error ? err.message : err}`);
    }
  }
  // The sheet: every element's main shot, then the score bug's phases.
  const sheetFiles = [
    ...main.map(shotName),
    ...bug.filter((b) => b.layout === "bottom").map(shotName),
  ].filter((f) => !failed.includes(f) && (!only || existsSync(join(outDir, `${f}.png`))));
  const sheet = sheetHtml(sheetFiles);
  const sheetPage = join(outDir, "contact-sheet.html");
  writeFileSync(sheetPage, sheet.html);
  await browser.shoot(pathToFileURL(sheetPage).href, join(outDir, "contact-sheet.png"), {
    wait: 500,
    width: COLS * TILE.w + (COLS - 1) * TILE.gap + 48,
    height: sheet.height,
  });
  console.log(`contact sheet ${join(outDir, "contact-sheet.png")}`);
} finally {
  await browser.close();
}
console.log(`${shots.length - failed.length} shots in ${outDir}`);
if (failed.length) {
  console.error(`${failed.length} failed: ${failed.join(", ")}`);
  process.exit(1);
}
