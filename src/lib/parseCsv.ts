import Papa from "papaparse";
import type { Goal, Match } from "./types";

const MATCH_REQUIRED = [
  "Season", "Gameweek", "MatchNo", "Date", "Home", "HomeGoals", "AwayGoals", "Away",
  "HomeXG", "AwayXG", "HomePoints", "AwayPoints", "HomexPts", "AwayxPts",
];
const GOAL_REQUIRED = [
  "MatchNo", "GoalNo", "MatchGoalNo", "TeamGoalNo", "Home/Away", "GoalTime",
  "Scorer", "Team", "Against", "Goal/OG", "Situation",
];

const num = (v: unknown): number => {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const numOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};

const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim());
const strOrNull = (v: unknown): string | null => {
  const s = str(v);
  return s === "" ? null : s;
};

const parseDate = (v: unknown): Date => {
  if (v instanceof Date) return v;
  const s = String(v).trim();
  // Try ISO first, then Excel-style "8/15/2025" or "2025-08-15"
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  // Fallback: "D/M/YYYY" or "M/D/YYYY"
  const parts = s.split(/[/\-]/);
  if (parts.length === 3) {
    const [a, b, c] = parts.map((p) => parseInt(p, 10));
    // Heuristic: if first > 12 it's D/M/Y
    if (a > 12) return new Date(c, b - 1, a);
    return new Date(c, a - 1, b);
  }
  return new Date(0);
};

export interface ParseResult {
  matches: Match[];
  goals: Goal[];
  errors: string[];
  warnings: string[];
}

function readText(file: File): Promise<string> {
  return file.text();
}

export async function parseMatchesCsv(file: File): Promise<{ matches: Match[]; errors: string[] }> {
  const text = await readText(file);
  const res = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    dynamicTyping: false,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  const errors: string[] = res.errors.map((e) => `Matches CSV: ${e.message} (row ${e.row})`);
  if (res.data.length === 0) {
    errors.push("Matches CSV has no rows");
    return { matches: [], errors };
  }
  const firstRow = res.data[0];
  for (const col of MATCH_REQUIRED) {
    if (!(col in firstRow)) errors.push(`Matches CSV missing required column: ${col}`);
  }
  const matches: Match[] = res.data
    .filter((r) => str(r["Home"]) !== "" && str(r["Away"]) !== "")
    .map((r) => ({
      Season: str(r["Season"]),
      Gameweek: num(r["Gameweek"]),
      MatchNo: num(r["MatchNo"]),
      Date: parseDate(r["Date"]),
      Home: str(r["Home"]),
      HomeGoals: num(r["HomeGoals"]),
      AwayGoals: num(r["AwayGoals"]),
      Away: str(r["Away"]),
      HomeXG: num(r["HomeXG"]),
      HomexGOT: num(r["HomexGOT"]),
      "HomeXG-npXG": num(r["HomeXG-npXG"]),
      HomeSetPiecexG: num(r["HomeSetPiecexG"]),
      HomeFirstHalfxG: num(r["HomeFirstHalfxG"]),
      HomeFirstHalfxGOT: num(r["HomeFirstHalfxGOT"]),
      HomeSetPieceGoals: num(r["HomeSetPieceGoals"]),
      HomeShots: num(r["HomeShots"]),
      HomeSot: num(r["HomeSot"]),
      HomeBigChances: num(r["HomeBigChances"]),
      HomeBigChancesMissed: num(r["HomeBigChancesMissed"]),
      HomeCorners: num(r["HomeCorners"]),
      HomeFouls: num(r["HomeFouls"]),
      HomeDuelsWon: num(r["HomeDuelsWon"]),
      HomeGroundDuelsWon: num(r["HomeGroundDuelsWon"]),
      HomeOffsides: num(r["HomeOffsides"]),
      HomeYellow: num(r["HomeYellow"]),
      HomeRed: num(r["HomeRed"]),
      HomePossession: num(r["HomePossession"]),
      HomePoints: num(r["HomePoints"]),
      AwayXG: num(r["AwayXG"]),
      AwayxGOT: num(r["AwayxGOT"]),
      "AwayXG-npXG": num(r["AwayXG-npXG"]),
      AwaySetPiecexG: num(r["AwaySetPiecexG"]),
      AwayFirstHalfxG: num(r["AwayFirstHalfxG"]),
      AwayFirstHalfxGOT: num(r["AwayFirstHalfxGOT"]),
      AwaySetPieceGoals: num(r["AwaySetPieceGoals"]),
      AwayShots: num(r["AwayShots"]),
      AwaySot: num(r["AwaySot"]),
      AwayBigChances: num(r["AwayBigChances"]),
      AwayBigChancesMissed: num(r["AwayBigChancesMissed"]),
      AwayCorners: num(r["AwayCorners"]),
      AwayFouls: num(r["AwayFouls"]),
      AwayDuelsWon: num(r["AwayDuelsWon"]),
      AwayGroundDuelsWon: num(r["AwayGroundDuelsWon"]),
      AwayOffside: num(r["AwayOffside"]),
      AwayYellow: num(r["AwayYellow"]),
      AwayRed: num(r["AwayRed"]),
      AwayPossession: num(r["AwayPossession"]),
      AwayPoints: num(r["AwayPoints"]),
      FotMobLink: str(r["FotMobLink"]) || undefined,
      FbRefLink: str(r["FbRefLink"]) || undefined,
      HomexPts: num(r["HomexPts"]),
      AwayxPts: num(r["AwayxPts"]),
      HomeGW: num(r["HomeGW"]),
      AwayGW: num(r["AwayGW"]),
      HomeWK: num(r["HomeWK"]),
      AwayWk: num(r["AwayWk"]),
    }));
  return { matches, errors };
}

export async function parseGoalsCsv(file: File): Promise<{ goals: Goal[]; errors: string[] }> {
  const text = await readText(file);
  const res = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    dynamicTyping: false,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  const errors: string[] = res.errors.map((e) => `Goals CSV: ${e.message} (row ${e.row})`);
  if (res.data.length === 0) {
    errors.push("Goals CSV has no rows");
    return { goals: [], errors };
  }
  const firstRow = res.data[0];
  for (const col of GOAL_REQUIRED) {
    if (!(col in firstRow)) errors.push(`Goals CSV missing required column: ${col}`);
  }

  // "Column 1" holds Season in the sheet
  const seasonKey = "Column 1" in firstRow ? "Column 1" : "Season";

  const goals: Goal[] = res.data
    .filter((r) => str(r["Scorer"]) !== "" && str(r["Team"]) !== "")
    .map((r) => ({
      Season: str(r[seasonKey]),
      MatchNo: num(r["MatchNo"]),
      GoalNo: num(r["GoalNo"]),
      MatchGoalNo: num(r["MatchGoalNo"]),
      TeamGoalNo: num(r["TeamGoalNo"]),
      HomeAway: (str(r["Home/Away"]).toUpperCase() === "H" ? "H" : "A") as "H" | "A",
      GoalTime: num(r["GoalTime"]),
      AddedTime: numOrNull(r["AddedTime"]),
      Scorer: str(r["Scorer"]),
      Nationality: str(r["Nationality"]),
      PlayerType: str(r["PlayerType"]),
      Pos: str(r["Pos"]),
      StartSub: str(r["Start/Sub"]),
      Assist: strOrNull(r["Assist"]),
      Team: str(r["Team"]),
      Against: str(r["Against"]),
      Distance: numOrNull(r["Distance"]),
      ShotXG: numOrNull(r["ShotXG"]),
      ShotXGoT: numOrNull(r["ShotXGoT"]),
      GoalOG: (str(r["Goal/OG"]).toUpperCase() === "OG" ? "OG" : "G") as "G" | "OG",
      InsideOutside: str(r["Inside/Outside"]) || "Unknown",
      ShotType: str(r["ShotType"]),
      Situation: str(r["Situation"]) || "Unknown",
      Video: strOrNull(r["Video"]),
      xGOTminusxG: numOrNull(r["xGOT-xG"]),
    }));
  return { goals, errors };
}
