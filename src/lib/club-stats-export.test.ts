import { describe, expect, it } from "vitest";
import {
  leaderboardFromPlayers,
  type LeaderboardPlayer,
} from "~/lib/leaderboard";
import { emptyAcc } from "~/lib/firebase/stats.mjs";
import {
  clubStatsCsv,
  clubStatsFileName,
  clubStatsRows,
  parseStatsTab,
  tabCsv,
  tabTable,
} from "./club-stats-export";

const player = (
  name: string,
  acc: Partial<ReturnType<typeof emptyAcc>>,
): LeaderboardPlayer => ({
  ...emptyAcc(),
  ...acc,
  name,
  avatar_url: null,
});

const data = leaderboardFromPlayers({
  a: player("Asha", {
    m: 3,
    bi: 3,
    no: 1,
    r: 120,
    b: 80,
    f4: 10,
    f6: 3,
    bp: 90,
    c50: 1,
  }),
  b: player("Bala", {
    m: 3,
    wi: 3,
    wb: 54,
    rc: 60,
    w: 7,
    wp: 140,
    bb: { w: 3, r: 12, b: 24, n: 0 },
  }),
  c: player("Chitra", { m: 2, ct: 2, st: 1 }),
  d: player("=cmd|' /C calc'!A0", { m: 1, bi: 1, r: 4, b: 5, bp: 3 }),
  e: player("Esha", { m: 1, bi: 1, r: 9, b: 9, bp: 90 }),
});

describe("clubStatsRows", () => {
  const rows = clubStatsRows(data);

  it("ranks by total points, level players sharing a rank", () => {
    expect(rows.map((r) => [r.name, r.points.total, r.rank])).toEqual([
      ["Bala", 140, 1],
      ["Asha", 90, 2],
      ["Esha", 90, 2],
      ["Chitra", expect.any(Number), 4],
      ["=cmd|' /C calc'!A0", 3, 5],
    ]);
  });

  it("joins each player's batting, bowling and fielding lines", () => {
    const bala = rows.find((r) => r.name === "Bala")!;
    expect(bala.bowling?.wickets).toBe(7);
    expect(bala.batting).toBeNull();
    const chitra = rows.find((r) => r.name === "Chitra")!;
    expect(chitra.fielding?.catches).toBe(2);
  });
});

describe("clubStatsCsv", () => {
  const csv = clubStatsCsv(clubStatsRows(data));
  const [head, ...lines] = csv.slice(1).trim().split("\r\n");

  it("opens in Excel: byte order mark, CRLF, a header and a row per player", () => {
    expect(csv.charCodeAt(0) === 0xfeff).toBe(true);
    expect(head!.split(",")[0]).toBe("Rank");
    expect(lines).toHaveLength(5);
    expect(
      lines.every((l) => l.split(",").length >= head!.split(",").length),
    ).toBe(true);
  });

  it("carries every figure of a player in order", () => {
    const cols = head!.split(",");
    const asha = lines.find((l) => l.includes("Asha"))!.split(",");
    const at = (c: string) => asha[cols.indexOf(c)];
    expect(at("Runs")).toBe("120");
    expect(at("Sixes")).toBe("3");
    expect(at("Fifties")).toBe("1");
    expect(at("Points")).toBe("90");
    // Not a bowler: empty cells, not zeros or dashes.
    expect(at("Best bowling")).toBe("");
  });

  it("keeps a name a spreadsheet would run as a formula as text", () => {
    expect(csv).toContain("\t=cmd|' /C calc'!A0\"".replace('"', ""));
    expect(csv).not.toMatch(/(^|,)=cmd/m);
  });
});

describe("clubStatsFileName", () => {
  it("names the file after the club and the day", () => {
    expect(
      clubStatsFileName(
        "Unity Cricket Club",
        "csv",
        new Date("2026-10-25T10:00:00Z"),
      ),
    ).toBe("Unity Cricket Club – statistics 2026-10-25.csv");
    expect(
      clubStatsFileName('A/B: "C"', "pdf", new Date("2026-01-02T00:00:00Z")),
    ).toBe("A B C – statistics 2026-01-02.pdf");
  });
});

describe("tabTable", () => {
  it("lists each tab in its own order with competition ranks", () => {
    const batting = tabTable(data, "batting");
    expect(batting.rows.map((r) => [r.entry.name, r.rank])).toEqual([
      ["Asha", 1],
      ["Esha", 2],
      ["=cmd|' /C calc'!A0", 3],
    ]);
    const bowling = tabTable(data, "bowling");
    expect(bowling.rows.map((r) => r.entry.name)).toEqual(["Bala"]);
    expect(tabTable(data, "fielding").rows.map((r) => r.entry.name)).toEqual([
      "Chitra",
    ]);
    const points = tabTable(data, "mvp");
    expect(points.rows.map((r) => [r.entry.name, r.rank])[0]).toEqual([
      "Bala",
      1,
    ]);
  });

  it("gives every tab a column the table is ranked by", () => {
    for (const tab of ["batting", "bowling", "fielding", "mvp"] as const) {
      expect(tabTable(data, tab).columns.some((c) => c.strong)).toBe(true);
    }
  });
});

describe("tabCsv", () => {
  it("is the tab's own table: rank, player, then its figures", () => {
    const [head, first] = tabCsv(tabTable(data, "bowling"))
      .slice(1)
      .trim()
      .split("\r\n");
    expect(head!.split(",").slice(0, 3)).toEqual(["Rank", "Player", "Matches"]);
    expect(head).toContain("Wickets");
    expect(head).not.toContain("Runs,Balls faced");
    const cols = head!.split(",");
    const row = first!.split(",");
    expect(row[0]).toBe("1");
    expect(row[1]).toBe("Bala");
    expect(row[cols.indexOf("Wickets")]).toBe("7");
    expect(row[cols.indexOf("Best bowling")]).toBe("3/12");
  });

  it("keeps the byte order mark and guards formula-looking names", () => {
    const csv = tabCsv(tabTable(data, "batting"));
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).not.toMatch(/(^|,)=cmd/m);
  });
});

describe("parseStatsTab", () => {
  it("accepts the four tabs and nothing else", () => {
    expect(parseStatsTab("batting")).toBe("batting");
    expect(parseStatsTab("mvp")).toBe("mvp");
    expect(parseStatsTab("overview")).toBeNull();
    expect(parseStatsTab("")).toBeNull();
    expect(parseStatsTab(null)).toBeNull();
  });
});

describe("clubStatsFileName with a label", () => {
  it("names the tab", () => {
    expect(
      clubStatsFileName(
        "Unity",
        "csv",
        new Date("2026-10-25T00:00:00Z"),
        "batting",
      ),
    ).toBe("Unity – batting 2026-10-25.csv");
  });
});
