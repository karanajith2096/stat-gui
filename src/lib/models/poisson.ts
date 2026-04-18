import type { Match, Prediction } from "../types";
import { getTeams } from "../derive";

const factorial = (n: number): number => {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
};

export const poissonPMF = (lambda: number, k: number): number =>
  (Math.exp(-lambda) * Math.pow(lambda, k)) / factorial(k);

function summarize(lambdaH: number, lambdaA: number, modelName: string, homeTeam: string, awayTeam: string): Prediction {
  const N = 8;
  let pH = 0, pD = 0, pA = 0, pBTTS = 0, pOver25 = 0;
  const cells: { score: [number, number]; p: number }[] = [];
  for (let i = 0; i <= N; i++) {
    const pi = poissonPMF(lambdaH, i);
    for (let j = 0; j <= N; j++) {
      const pj = poissonPMF(lambdaA, j);
      const p = pi * pj;
      cells.push({ score: [i, j], p });
      if (i > j) pH += p;
      else if (i < j) pA += p;
      else pD += p;
      if (i > 0 && j > 0) pBTTS += p;
      if (i + j >= 3) pOver25 += p;
    }
  }
  cells.sort((a, b) => b.p - a.p);
  return {
    home: homeTeam,
    away: awayTeam,
    lambdaHome: lambdaH,
    lambdaAway: lambdaA,
    pHome: pH,
    pDraw: pD,
    pAway: pA,
    pBTTS,
    pOver25,
    topScorelines: cells.slice(0, 5),
    scorelineGrid: cells.filter((c) => c.score[0] <= 5 && c.score[1] <= 5),
    supportsScoreline: true,
    modelName,
  };
}

export function poissonPredict(matches: Match[], home: string, away: string): Prediction {
  const teams = getTeams(matches);
  if (!teams.includes(home) || !teams.includes(away)) {
    return summarize(1.2, 1.1, "Poisson (xG)", home, away);
  }

  const homeMatches = matches.filter((m) => m.Home === home);
  const awayMatches = matches.filter((m) => m.Away === away);

  const leagueHomeAvgXG =
    matches.reduce((s, m) => s + m.HomeXG, 0) / Math.max(1, matches.length);
  const leagueAwayAvgXG =
    matches.reduce((s, m) => s + m.AwayXG, 0) / Math.max(1, matches.length);

  const homeAttack =
    homeMatches.length > 0
      ? homeMatches.reduce((s, m) => s + m.HomeXG, 0) / homeMatches.length / Math.max(0.01, leagueHomeAvgXG)
      : 1;
  const homeDefense =
    homeMatches.length > 0
      ? homeMatches.reduce((s, m) => s + m.AwayXG, 0) / homeMatches.length / Math.max(0.01, leagueAwayAvgXG)
      : 1;

  const awayAttack =
    awayMatches.length > 0
      ? awayMatches.reduce((s, m) => s + m.AwayXG, 0) / awayMatches.length / Math.max(0.01, leagueAwayAvgXG)
      : 1;
  const awayDefense =
    awayMatches.length > 0
      ? awayMatches.reduce((s, m) => s + m.HomeXG, 0) / awayMatches.length / Math.max(0.01, leagueHomeAvgXG)
      : 1;

  const lambdaH = leagueHomeAvgXG * homeAttack * awayDefense;
  const lambdaA = leagueAwayAvgXG * awayAttack * homeDefense;
  return summarize(lambdaH, lambdaA, "Poisson (xG)", home, away);
}
