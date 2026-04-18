import type { Match, Prediction } from "../types";
import { getTeams } from "../derive";
import { poissonPMF } from "./poisson";

// tau correction for low-score correlation
function tau(i: number, j: number, lambda: number, mu: number, rho: number): number {
  if (i === 0 && j === 0) return 1 - lambda * mu * rho;
  if (i === 0 && j === 1) return 1 + lambda * rho;
  if (i === 1 && j === 0) return 1 + mu * rho;
  if (i === 1 && j === 1) return 1 - rho;
  return 1;
}

interface FitResult {
  teams: string[];
  attack: Record<string, number>;
  defense: Record<string, number>;
  homeAdv: number;
  rho: number;
}

// Closed-form "poor man's" fit: compute attack/defense from xG ratios, estimate
// home advantage and rho from residuals. This avoids shipping fmin while still
// giving a Dixon–Coles-style output distinct from plain Poisson.
export function fitDixonColes(matches: Match[], decay = 0.0065): FitResult {
  const teams = getTeams(matches);
  const now = Math.max(...matches.map((m) => m.Date.getTime()));
  const weight = (m: Match) => Math.exp(-decay * ((now - m.Date.getTime()) / (1000 * 60 * 60 * 24)));

  let totHomeXG = 0, totAwayXG = 0, wSum = 0;
  for (const m of matches) {
    const w = weight(m);
    totHomeXG += w * m.HomeXG;
    totAwayXG += w * m.AwayXG;
    wSum += w;
  }
  const leagueHome = totHomeXG / Math.max(1e-6, wSum);
  const leagueAway = totAwayXG / Math.max(1e-6, wSum);

  const attack: Record<string, number> = {};
  const defense: Record<string, number> = {};
  for (const team of teams) {
    let homeXGFor = 0, homeXGAgainst = 0, awayXGFor = 0, awayXGAgainst = 0;
    let homeW = 0, awayW = 0;
    for (const m of matches) {
      const w = weight(m);
      if (m.Home === team) { homeXGFor += w * m.HomeXG; homeXGAgainst += w * m.AwayXG; homeW += w; }
      if (m.Away === team) { awayXGFor += w * m.AwayXG; awayXGAgainst += w * m.HomeXG; awayW += w; }
    }
    const avgFor = ((homeW > 0 ? homeXGFor / homeW : leagueHome) + (awayW > 0 ? awayXGFor / awayW : leagueAway)) / 2;
    const avgAg = ((homeW > 0 ? homeXGAgainst / homeW : leagueAway) + (awayW > 0 ? awayXGAgainst / awayW : leagueHome)) / 2;
    const leagueMean = (leagueHome + leagueAway) / 2;
    attack[team] = avgFor / Math.max(0.01, leagueMean);
    defense[team] = avgAg / Math.max(0.01, leagueMean);
  }

  // Estimate home advantage as observed home goals vs away goals ratio
  let obsHomeGoals = 0, obsAwayGoals = 0;
  for (const m of matches) {
    obsHomeGoals += m.HomeGoals * weight(m);
    obsAwayGoals += m.AwayGoals * weight(m);
  }
  const homeAdv = obsAwayGoals > 0 ? obsHomeGoals / obsAwayGoals : 1.25;

  // Estimate rho from low-score residuals (heuristic)
  // Positive rho pulls probability toward 0-0/1-1.
  let obs00 = 0, obs11 = 0, total = 0;
  for (const m of matches) {
    const w = weight(m);
    total += w;
    if (m.HomeGoals === 0 && m.AwayGoals === 0) obs00 += w;
    if (m.HomeGoals === 1 && m.AwayGoals === 1) obs11 += w;
  }
  const freq00 = obs00 / Math.max(1e-6, total);
  const freq11 = obs11 / Math.max(1e-6, total);
  const exp00 = poissonPMF(leagueHome, 0) * poissonPMF(leagueAway, 0);
  const exp11 = poissonPMF(leagueHome, 1) * poissonPMF(leagueAway, 1);
  const rhoRaw = (freq00 - exp00) / Math.max(0.05, leagueHome * leagueAway) + (freq11 - exp11) * 0.25;
  const rho = Math.max(-0.2, Math.min(0.2, rhoRaw));

  return { teams, attack, defense, homeAdv, rho };
}

export function dixonColesPredict(fit: FitResult, matches: Match[], home: string, away: string): Prediction {
  const leagueHome = matches.reduce((s, m) => s + m.HomeXG, 0) / Math.max(1, matches.length);
  const leagueAway = matches.reduce((s, m) => s + m.AwayXG, 0) / Math.max(1, matches.length);

  const atkH = fit.attack[home] ?? 1;
  const defA = fit.defense[away] ?? 1;
  const atkA = fit.attack[away] ?? 1;
  const defH = fit.defense[home] ?? 1;

  const lambdaH = leagueHome * atkH * defA * Math.sqrt(fit.homeAdv);
  const lambdaA = leagueAway * atkA * defH / Math.sqrt(fit.homeAdv);
  const rho = fit.rho;

  const N = 8;
  let pH = 0, pD = 0, pA = 0, pBTTS = 0, pOver25 = 0, zSum = 0;
  const cells: { score: [number, number]; p: number }[] = [];
  for (let i = 0; i <= N; i++) {
    const pi = poissonPMF(lambdaH, i);
    for (let j = 0; j <= N; j++) {
      const pj = poissonPMF(lambdaA, j);
      const p = pi * pj * tau(i, j, lambdaH, lambdaA, rho);
      cells.push({ score: [i, j], p });
      zSum += p;
    }
  }
  // Renormalize since tau correction breaks exact sum-to-1.
  cells.forEach((c) => (c.p /= zSum));
  for (const c of cells) {
    const [i, j] = c.score;
    if (i > j) pH += c.p;
    else if (i < j) pA += c.p;
    else pD += c.p;
    if (i > 0 && j > 0) pBTTS += c.p;
    if (i + j >= 3) pOver25 += c.p;
  }
  cells.sort((a, b) => b.p - a.p);
  return {
    home, away,
    lambdaHome: lambdaH, lambdaAway: lambdaA,
    pHome: pH, pDraw: pD, pAway: pA,
    pBTTS, pOver25,
    topScorelines: cells.slice(0, 5),
    scorelineGrid: cells.filter((c) => c.score[0] <= 5 && c.score[1] <= 5),
    supportsScoreline: true,
    modelName: "Dixon–Coles",
  };
}
