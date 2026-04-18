import type {
  FormPoint,
  Goal,
  GoalLogEntry,
  Match,
  ScorerRow,
  SetPieceBreakdown,
  TableRow,
  TeamSideStats,
  TeamStats,
} from "./types";

export const getTeams = (matches: Match[]): string[] => {
  const s = new Set<string>();
  matches.forEach((m) => {
    s.add(m.Home);
    s.add(m.Away);
  });
  return Array.from(s).sort();
};

export const resultFor = (m: Match, team: string): "W" | "D" | "L" => {
  const isHome = m.Home === team;
  const gf = isHome ? m.HomeGoals : m.AwayGoals;
  const ga = isHome ? m.AwayGoals : m.HomeGoals;
  if (gf > ga) return "W";
  if (gf < ga) return "L";
  return "D";
};

export const pointsFor = (m: Match, team: string): number => {
  const r = resultFor(m, team);
  return r === "W" ? 3 : r === "D" ? 1 : 0;
};

export const matchesFor = (matches: Match[], team: string): Match[] =>
  matches
    .filter((m) => m.Home === team || m.Away === team)
    .sort((a, b) => a.Date.getTime() - b.Date.getTime());

// --- Standings ---
export function buildStandings(matches: Match[]): TableRow[] {
  const teams = getTeams(matches);
  const rows = teams.map((team) => {
    const ms = matchesFor(matches, team);
    let w = 0, d = 0, l = 0, gf = 0, ga = 0, xG = 0, xGA = 0, xPts = 0, points = 0;
    for (const m of ms) {
      const isHome = m.Home === team;
      const ourGoals = isHome ? m.HomeGoals : m.AwayGoals;
      const oppGoals = isHome ? m.AwayGoals : m.HomeGoals;
      gf += ourGoals;
      ga += oppGoals;
      xG += isHome ? m.HomeXG : m.AwayXG;
      xGA += isHome ? m.AwayXG : m.HomeXG;
      xPts += isHome ? m.HomexPts : m.AwayxPts;
      const r = resultFor(m, team);
      if (r === "W") { w++; points += 3; }
      else if (r === "D") { d++; points += 1; }
      else l++;
    }
    const games = ms.length;
    const lastFive = ms.slice(-5).map((m) => resultFor(m, team));
    const lastFivePoints = lastFive.reduce((s, r) => s + (r === "W" ? 3 : r === "D" ? 1 : 0), 0);
    return {
      position: 0,
      team,
      games,
      wins: w,
      draws: d,
      losses: l,
      points,
      gf,
      ga,
      gd: gf - ga,
      xG,
      xGA,
      xGDiff: xG - xGA,
      ppg: games > 0 ? points / games : 0,
      xPts,
      xRank: 0,
      lastFiveForm: lastFive,
      lastFivePoints,
    } satisfies TableRow;
  });
  rows.sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.team.localeCompare(b.team));
  rows.forEach((r, i) => (r.position = i + 1));
  const byXPts = [...rows].sort((a, b) => b.xPts - a.xPts);
  byXPts.forEach((r, i) => (r.xRank = i + 1));
  return rows;
}

// --- Scorer leaderboard ---
export function buildScorerLeaderboard(goals: Goal[], matches: Match[]): ScorerRow[] {
  const matchMap = new Map<number, Match>();
  matches.forEach((m) => matchMap.set(m.MatchNo, m));

  const teamGoalsTotal = new Map<string, number>();
  for (const g of goals) {
    // Own goals benefit the opposing team, so credit them to Against.
    const creditTo = g.GoalOG === "OG" ? g.Against : g.Team;
    teamGoalsTotal.set(creditTo, (teamGoalsTotal.get(creditTo) ?? 0) + 1);
  }

  // Pre-compute per-match running scores to classify each goal.
  // key: matchNo -> array of goals ordered by MatchGoalNo
  const byMatch = new Map<number, Goal[]>();
  for (const g of goals) {
    if (!byMatch.has(g.MatchNo)) byMatch.set(g.MatchNo, []);
    byMatch.get(g.MatchNo)!.push(g);
  }
  byMatch.forEach((arr) => arr.sort((a, b) => a.MatchGoalNo - b.MatchGoalNo));

  // Build per-goal context flags
  interface GoalCtx {
    isEqualizer: boolean;
    isWhileTrailing: boolean;
    isTieBreakerNonOpener: boolean;
    isMatchOpener: boolean;
    isTeamOpener: boolean;
    scoringTeam: string;
  }
  const ctxByGoalKey = new Map<string, GoalCtx>(); // key matchNo:matchGoalNo
  for (const [matchNo, arr] of byMatch.entries()) {
    const match = matchMap.get(matchNo);
    if (!match) continue;
    const [homeTeam, awayTeam] = [match.Home, match.Away];
    let hScore = 0, aScore = 0;
    for (const g of arr) {
      const scoringTeam = g.HomeAway === "H" ? homeTeam : awayTeam;
      const opposingTeam = g.HomeAway === "H" ? awayTeam : homeTeam;
      const before = g.HomeAway === "H" ? { us: hScore, them: aScore } : { us: aScore, them: hScore };

      // Apply goal. OG counts for the opposing team's score but we keep the scorer's Team
      // as recorded; for score state OG flips — but Team in CSV already marks the team the
      // goal was credited to (the opposition in the case of an OG). Trust `Team` column.
      const creditTeam = g.Team;
      if (creditTeam === homeTeam) hScore++;
      else if (creditTeam === awayTeam) aScore++;

      const afterUs = creditTeam === scoringTeam ? before.us + 1 : before.us;
      const afterThem = creditTeam === scoringTeam ? before.them : before.them + 1;

      const isMatchOpener = g.MatchGoalNo === 1;
      const isTeamOpener = g.TeamGoalNo === 1;
      const isEqualizer = before.us < before.them && afterUs === afterThem;
      const isWhileTrailing = before.us < before.them;
      const isTieBreakerNonOpener =
        before.us === before.them && before.us > 0 && afterUs > afterThem;

      ctxByGoalKey.set(`${matchNo}:${g.MatchGoalNo}`, {
        isEqualizer, isWhileTrailing, isTieBreakerNonOpener, isMatchOpener, isTeamOpener,
        scoringTeam,
      });
      // unused var lints
      void opposingTeam;
    }
  }

  // Aggregate per scorer
  const scorerMap = new Map<string, ScorerRow>();
  for (const g of goals) {
    if (g.GoalOG !== "G") continue;
    const key = `${g.Scorer}__${g.Team}`;
    let row = scorerMap.get(key);
    if (!row) {
      row = {
        player: g.Scorer,
        team: g.Team,
        nationality: g.Nationality,
        position: g.Pos,
        goals: 0,
        assists: 0,
        xG: 0,
        xGOT: 0,
        xGOTminusxG: 0,
        teamGoalShare: 0,
        penalties: 0,
        tieBreakers: 0,
        equalizers: 0,
        goalsWhenTrailing: 0,
        homeGoals: 0,
        awayGoals: 0,
        firstHalfGoals: 0,
        firstHalfETGoals: 0,
        secondHalfGoals: 0,
        secondHalfETGoals: 0,
        matchOpeners: 0,
        teamOpeners: 0,
        goalLog: [],
      };
      scorerMap.set(key, row);
    }
    row.goals++;
    row.xG += g.ShotXG ?? 0;
    row.xGOT += g.ShotXGoT ?? 0;
    row.xGOTminusxG += g.xGOTminusxG ?? 0;
    if (/^Penalty$/i.test(g.Situation)) row.penalties++;
    if (g.HomeAway === "H") row.homeGoals++;
    else row.awayGoals++;
    if (g.GoalTime <= 45) {
      row.firstHalfGoals++;
      if (g.GoalTime === 45 && g.AddedTime != null && g.AddedTime > 0) row.firstHalfETGoals++;
    } else {
      row.secondHalfGoals++;
      if (g.GoalTime === 90 && g.AddedTime != null && g.AddedTime > 0) row.secondHalfETGoals++;
    }

    const ctx = ctxByGoalKey.get(`${g.MatchNo}:${g.MatchGoalNo}`);
    if (ctx) {
      if (ctx.isMatchOpener) row.matchOpeners++;
      if (ctx.isTeamOpener) row.teamOpeners++;
      if (ctx.isEqualizer) row.equalizers++;
      if (ctx.isWhileTrailing) row.goalsWhenTrailing++;
      if (ctx.isTieBreakerNonOpener) row.tieBreakers++;
    }

    const m = matchMap.get(g.MatchNo);
    if (m) {
      row.goalLog.push({
        matchNo: g.MatchNo,
        gameweek: m.Gameweek,
        date: m.Date,
        team: g.Team,
        against: g.Against,
        homeAway: g.HomeAway,
        minute: g.GoalTime,
        addedTime: g.AddedTime,
        distance: g.Distance,
        xG: g.ShotXG,
        situation: g.Situation,
        video: g.Video,
      } satisfies GoalLogEntry);
    }
  }

  // Assists
  for (const g of goals) {
    if (g.GoalOG !== "G") continue;
    if (!g.Assist) continue;
    const key = `${g.Assist}__${g.Team}`;
    let row = scorerMap.get(key);
    if (!row) {
      row = {
        player: g.Assist,
        team: g.Team,
        nationality: "",
        position: "",
        goals: 0,
        assists: 0,
        xG: 0,
        xGOT: 0,
        xGOTminusxG: 0,
        teamGoalShare: 0,
        penalties: 0,
        tieBreakers: 0,
        equalizers: 0,
        goalsWhenTrailing: 0,
        homeGoals: 0,
        awayGoals: 0,
        firstHalfGoals: 0,
        firstHalfETGoals: 0,
        secondHalfGoals: 0,
        secondHalfETGoals: 0,
        matchOpeners: 0,
        teamOpeners: 0,
        goalLog: [],
      };
      scorerMap.set(key, row);
    }
    row.assists++;
  }

  const rows = Array.from(scorerMap.values());
  for (const r of rows) {
    const teamTotal = teamGoalsTotal.get(r.team) ?? 0;
    r.teamGoalShare = teamTotal > 0 ? r.goals / teamTotal : 0;
    r.goalLog.sort((a, b) => a.date.getTime() - b.date.getTime() || a.minute - b.minute);
  }
  rows.sort((a, b) => b.goals - a.goals || b.assists - a.assists || a.player.localeCompare(b.player));
  return rows;
}

// --- Team aggregate stats ---
const emptySide = (): TeamSideStats => ({
  games: 0, points: 0, goalsFor: 0, goalsAgainst: 0,
  xG: 0, xGA: 0, xGOT: 0, xGOTAgainst: 0,
  firstHalfxG: 0, setPiecexG: 0, setPieceGoals: 0, nonPenXG: 0,
  shots: 0, shotsOnTarget: 0, bigChances: 0, bigChancesMissed: 0,
  corners: 0, possession: 0, fouls: 0, yellow: 0, red: 0,
  duelsWon: 0, groundDuelsWon: 0, offsides: 0,
});

export function buildTeamStats(team: string, matches: Match[]): TeamStats {
  const ms = matchesFor(matches, team);
  const home = emptySide();
  const away = emptySide();
  for (const m of ms) {
    const isHome = m.Home === team;
    const side = isHome ? home : away;
    side.games++;
    side.points += pointsFor(m, team);
    side.goalsFor += isHome ? m.HomeGoals : m.AwayGoals;
    side.goalsAgainst += isHome ? m.AwayGoals : m.HomeGoals;
    side.xG += isHome ? m.HomeXG : m.AwayXG;
    side.xGA += isHome ? m.AwayXG : m.HomeXG;
    side.xGOT += isHome ? m.HomexGOT : m.AwayxGOT;
    side.xGOTAgainst += isHome ? m.AwayxGOT : m.HomexGOT;
    side.firstHalfxG += isHome ? m.HomeFirstHalfxG : m.AwayFirstHalfxG;
    side.setPiecexG += isHome ? m.HomeSetPiecexG : m.AwaySetPiecexG;
    side.setPieceGoals += isHome ? m.HomeSetPieceGoals : m.AwaySetPieceGoals;
    side.nonPenXG += isHome ? m["HomeXG-npXG"] : m["AwayXG-npXG"];
    side.shots += isHome ? m.HomeShots : m.AwayShots;
    side.shotsOnTarget += isHome ? m.HomeSot : m.AwaySot;
    side.bigChances += isHome ? m.HomeBigChances : m.AwayBigChances;
    side.bigChancesMissed += isHome ? m.HomeBigChancesMissed : m.AwayBigChancesMissed;
    side.corners += isHome ? m.HomeCorners : m.AwayCorners;
    side.possession += isHome ? m.HomePossession : m.AwayPossession;
    side.fouls += isHome ? m.HomeFouls : m.AwayFouls;
    side.yellow += isHome ? m.HomeYellow : m.AwayYellow;
    side.red += isHome ? m.HomeRed : m.AwayRed;
    side.duelsWon += isHome ? m.HomeDuelsWon : m.AwayDuelsWon;
    side.groundDuelsWon += isHome ? m.HomeGroundDuelsWon : m.AwayGroundDuelsWon;
    side.offsides += isHome ? m.HomeOffsides : m.AwayOffside;
  }
  const total = emptySide();
  (Object.keys(total) as (keyof TeamSideStats)[]).forEach((k) => {
    (total[k] as number) = (home[k] as number) + (away[k] as number);
  });
  return { team, games: home.games + away.games, home, away, total };
}

// --- Team form ---
export function buildTeamForm(team: string, matches: Match[], goals: Goal[]): FormPoint[] {
  const ms = matchesFor(matches, team);
  const fps: FormPoint[] = [];
  let cumPts = 0, cumXG = 0, cumXGA = 0, cumGoals = 0, cumGA = 0, cumXPts = 0;
  const resultsForRolling: number[] = [];
  const goalsByMatch = new Map<number, Goal[]>();
  goals.forEach((g) => {
    if (!goalsByMatch.has(g.MatchNo)) goalsByMatch.set(g.MatchNo, []);
    goalsByMatch.get(g.MatchNo)!.push(g);
  });

  for (let i = 0; i < ms.length; i++) {
    const m = ms[i];
    const isHome = m.Home === team;
    const r = resultFor(m, team);
    const pts = r === "W" ? 3 : r === "D" ? 1 : 0;
    const matchXG = isHome ? m.HomeXG : m.AwayXG;
    const matchXGA = isHome ? m.AwayXG : m.HomeXG;
    const gf = isHome ? m.HomeGoals : m.AwayGoals;
    const ga = isHome ? m.AwayGoals : m.HomeGoals;
    cumPts += pts;
    cumXG += matchXG;
    cumXGA += matchXGA;
    cumGoals += gf;
    cumGA += ga;
    cumXPts += isHome ? m.HomexPts : m.AwayxPts;
    resultsForRolling.push(pts);
    if (resultsForRolling.length > 5) resultsForRolling.shift();
    const rolling5 = resultsForRolling.reduce((s, v) => s + v, 0) / resultsForRolling.length;

    const firstHalfXG = isHome ? m.HomeFirstHalfxG : m.AwayFirstHalfxG;
    const secondHalfXG = matchXG - firstHalfXG;
    const firstHalfXGA = isHome ? m.AwayFirstHalfxG : m.HomeFirstHalfxG;
    const secondHalfXGA = matchXGA - firstHalfXGA;

    fps.push({
      gameweek: m.Gameweek,
      matchNo: m.MatchNo,
      date: m.Date,
      opponent: isHome ? m.Away : m.Home,
      isHome,
      result: r,
      points: pts,
      cumulativePoints: cumPts,
      cumulativePPG: cumPts / (i + 1),
      rolling5PPG: rolling5,
      matchXG,
      matchXGA,
      cumulativeXG: cumXG,
      cumulativeXGA: cumXGA,
      cumulativeGoals: cumGoals,
      cumulativeGoalsAgainst: cumGA,
      cumulativeXPts: cumXPts,
      firstHalfXG,
      secondHalfXG: Math.max(0, secondHalfXG),
      firstHalfXGA,
      secondHalfXGA: Math.max(0, secondHalfXGA),
      possession: isHome ? m.HomePossession : m.AwayPossession,
      shots: isHome ? m.HomeShots : m.AwayShots,
      shotsOnTarget: isHome ? m.HomeSot : m.AwaySot,
      matchGoals: gf,
      matchGoalsAgainst: ga,
    });
  }
  return fps;
}

// --- Set piece breakdown ---
const NON_SET_PIECE_VALUES = new Set(["regular", "fastbreak", "fast break", "fast-break", "penalty"]);

export const isSetPieceSituation = (situation: string) =>
  !NON_SET_PIECE_VALUES.has(situation.trim().toLowerCase());

export function buildSetPieceBreakdown(
  team: string,
  goals: Goal[],
  matches: Match[],
  side: "scored" | "conceded"
): SetPieceBreakdown {
  const matchMap = new Map<number, Match>();
  matches.forEach((m) => matchMap.set(m.MatchNo, m));
  // OGs benefit the opposing team: a corner OG by Team B counts as a
  // "corner goal scored" for Team A (Against) and a "corner goal conceded" for Team B (Team).
  const filter = side === "scored"
    ? (g: Goal) => (g.Team === team && g.GoalOG === "G") || (g.Against === team && g.GoalOG === "OG")
    : (g: Goal) => (g.Against === team && g.GoalOG === "G") || (g.Team === team && g.GoalOG === "OG");

  const allGoals = goals.filter(filter);
  const totalGoalsAll = allGoals.length;
  const setPieceGoals = allGoals.filter((g) => isSetPieceSituation(g.Situation));
  const bySubType: Record<string, number> = {};
  let matchOpeners = 0, teamOpeners = 0, home = 0, away = 0;
  let firstHalf = 0, firstHalfET = 0, secondHalf = 0, secondHalfET = 0;

  for (const g of setPieceGoals) {
    const sub = g.Situation || "Set Piece";
    bySubType[sub] = (bySubType[sub] ?? 0) + 1;
    if (g.MatchGoalNo === 1) matchOpeners++;
    if (g.TeamGoalNo === 1) teamOpeners++;
    // For OGs the benefiting team is the opponent, so H/A is flipped.
    const isHomeGoal = g.GoalOG === "OG" ? g.HomeAway === "A" : g.HomeAway === "H";
    if (isHomeGoal) home++;
    else away++;
    if (g.GoalTime <= 45) {
      firstHalf++;
      if (g.GoalTime === 45 && g.AddedTime != null && g.AddedTime > 0) firstHalfET++;
    } else {
      secondHalf++;
      if (g.GoalTime === 90 && g.AddedTime != null && g.AddedTime > 0) secondHalfET++;
    }
  }

  return {
    total: setPieceGoals.length,
    percentOfAllGoals: totalGoalsAll > 0 ? setPieceGoals.length / totalGoalsAll : 0,
    bySubType,
    matchOpeners,
    teamOpeners,
    home,
    away,
    firstHalf,
    firstHalfET,
    secondHalf,
    secondHalfET,
  };
}

// --- Goals by match lookup, used in several charts ---
export const goalsForTeam = (team: string, goals: Goal[]): Goal[] =>
  goals.filter((g) => (g.Team === team && g.GoalOG === "G") || (g.Against === team && g.GoalOG === "OG"));
export const goalsAgainstTeam = (team: string, goals: Goal[]): Goal[] =>
  goals.filter((g) => (g.Against === team && g.GoalOG === "G") || (g.Team === team && g.GoalOG === "OG"));

// --- Progression: cumulative metric per team across GWs ---
export type ProgressionMetric = "points" | "goalsScored" | "goalsConceded" | "xG" | "xGA";

export interface ProgressionSeries {
  team: string;
  values: (number | null)[]; // indexed by GW-1, null if not played that GW
}

export function buildProgression(matches: Match[], metric: ProgressionMetric): {
  gameweeks: number[];
  series: ProgressionSeries[];
} {
  const maxGW = matches.reduce((mx, m) => Math.max(mx, m.Gameweek), 0);
  const gws = Array.from({ length: maxGW }, (_, i) => i + 1);
  const teams = getTeams(matches);
  const series: ProgressionSeries[] = teams.map((team) => {
    const ms = matchesFor(matches, team);
    const byGW = new Map<number, Match>();
    ms.forEach((m) => byGW.set(m.Gameweek, m));
    const values: (number | null)[] = [];
    let running = 0;
    let everPlayed = false;
    for (const gw of gws) {
      const m = byGW.get(gw);
      if (m) {
        everPlayed = true;
        const isHome = m.Home === team;
        if (metric === "points") running += pointsFor(m, team);
        else if (metric === "goalsScored") running += isHome ? m.HomeGoals : m.AwayGoals;
        else if (metric === "goalsConceded") running += isHome ? m.AwayGoals : m.HomeGoals;
        else if (metric === "xG") running += isHome ? m.HomeXG : m.AwayXG;
        else if (metric === "xGA") running += isHome ? m.AwayXG : m.HomeXG;
        values.push(running);
      } else {
        values.push(everPlayed ? running : null);
      }
    }
    return { team, values };
  });
  return { gameweeks: gws, series };
}

// Bump chart: league position per GW.
export function buildPositionByGW(matches: Match[]): {
  gameweeks: number[];
  series: { team: string; positions: (number | null)[] }[];
} {
  const maxGW = matches.reduce((mx, m) => Math.max(mx, m.Gameweek), 0);
  const gws = Array.from({ length: maxGW }, (_, i) => i + 1);
  const teams = getTeams(matches);
  const out = new Map<string, (number | null)[]>();
  teams.forEach((t) => out.set(t, []));
  for (const gw of gws) {
    const upTo = matches.filter((m) => m.Gameweek <= gw);
    const standings = buildStandings(upTo);
    const posMap = new Map<string, number>();
    standings.forEach((r) => posMap.set(r.team, r.position));
    teams.forEach((t) => out.get(t)!.push(posMap.get(t) ?? null));
  }
  return {
    gameweeks: gws,
    series: teams.map((team) => ({ team, positions: out.get(team)! })),
  };
}

// League-wide per-GW aggregates for Trends page
export interface GWAggregate {
  gameweek: number;
  matchesPlayed: number;
  totalGoals: number;
  totalXG: number;
  avgGoalsPerMatch: number;
  homeWins: number;
  draws: number;
  awayWins: number;
  homeWinRate: number;
  avgShots: number;
  avgShotsOnTarget: number;
  avgBigChances: number;
  avgYellow: number;
  avgRed: number;
}

export function buildGWAggregates(matches: Match[]): GWAggregate[] {
  const byGW = new Map<number, Match[]>();
  matches.forEach((m) => {
    if (!byGW.has(m.Gameweek)) byGW.set(m.Gameweek, []);
    byGW.get(m.Gameweek)!.push(m);
  });
  const out: GWAggregate[] = [];
  const sortedGWs = Array.from(byGW.keys()).sort((a, b) => a - b);
  for (const gw of sortedGWs) {
    const ms = byGW.get(gw)!;
    let goals = 0, xG = 0, hw = 0, dr = 0, aw = 0, shots = 0, sot = 0, bc = 0, y = 0, r = 0;
    for (const m of ms) {
      goals += m.HomeGoals + m.AwayGoals;
      xG += m.HomeXG + m.AwayXG;
      if (m.HomeGoals > m.AwayGoals) hw++;
      else if (m.HomeGoals < m.AwayGoals) aw++;
      else dr++;
      shots += m.HomeShots + m.AwayShots;
      sot += m.HomeSot + m.AwaySot;
      bc += m.HomeBigChances + m.AwayBigChances;
      y += m.HomeYellow + m.AwayYellow;
      r += m.HomeRed + m.AwayRed;
    }
    const n = ms.length;
    out.push({
      gameweek: gw,
      matchesPlayed: n,
      totalGoals: goals,
      totalXG: xG,
      avgGoalsPerMatch: n > 0 ? goals / n : 0,
      homeWins: hw,
      draws: dr,
      awayWins: aw,
      homeWinRate: n > 0 ? hw / n : 0,
      avgShots: n > 0 ? shots / n : 0,
      avgShotsOnTarget: n > 0 ? sot / n : 0,
      avgBigChances: n > 0 ? bc / n : 0,
      avgYellow: n > 0 ? y / n : 0,
      avgRed: n > 0 ? r / n : 0,
    });
  }
  return out;
}

// Scored-first win rate per team
export function buildScoredFirstWinRate(matches: Match[], goals: Goal[]): {
  team: string;
  matchesScoredFirst: number;
  winsWhenScoredFirst: number;
  winRate: number;
}[] {
  const matchMap = new Map<number, Match>();
  matches.forEach((m) => matchMap.set(m.MatchNo, m));
  // first goal per match
  const openerByMatch = new Map<number, Goal>();
  for (const g of goals) {
    if (g.MatchGoalNo !== 1) continue;
    if (!openerByMatch.has(g.MatchNo)) openerByMatch.set(g.MatchNo, g);
  }
  const stats = new Map<string, { scoredFirst: number; wins: number }>();
  for (const [matchNo, g] of openerByMatch.entries()) {
    const m = matchMap.get(matchNo);
    if (!m) continue;
    const scoredFirstTeam = g.Team;
    const rec = stats.get(scoredFirstTeam) ?? { scoredFirst: 0, wins: 0 };
    rec.scoredFirst++;
    const won = resultFor(m, scoredFirstTeam) === "W";
    if (won) rec.wins++;
    stats.set(scoredFirstTeam, rec);
  }
  const out = Array.from(stats.entries()).map(([team, s]) => ({
    team,
    matchesScoredFirst: s.scoredFirst,
    winsWhenScoredFirst: s.wins,
    winRate: s.scoredFirst > 0 ? s.wins / s.scoredFirst : 0,
  }));
  out.sort((a, b) => b.winRate - a.winRate || b.matchesScoredFirst - a.matchesScoredFirst);
  return out;
}

// League-average TeamStats (per-game) used by radar chart
export function buildLeagueAverageTeamStats(matches: Match[]): TeamSideStats {
  const teams = getTeams(matches);
  const agg = emptySide();
  let gamesTotal = 0;
  for (const t of teams) {
    const ts = buildTeamStats(t, matches);
    gamesTotal += ts.games;
    (Object.keys(agg) as (keyof TeamSideStats)[]).forEach((k) => {
      (agg[k] as number) += ts.total[k] as number;
    });
  }
  // normalize to per-game
  const perGame = emptySide();
  (Object.keys(perGame) as (keyof TeamSideStats)[]).forEach((k) => {
    (perGame[k] as number) = gamesTotal > 0 ? (agg[k] as number) / gamesTotal : 0;
  });
  perGame.games = gamesTotal / Math.max(1, teams.length);
  return perGame;
}
