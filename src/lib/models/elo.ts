import type { Match, Prediction } from "../types";
import { getTeams } from "../derive";

const K_BASE = 20;
const HFA = 65;
const START = 1500;

export interface EloFit {
  ratings: Record<string, number>;
}

export function fitElo(matches: Match[]): EloFit {
  const teams = getTeams(matches);
  const ratings: Record<string, number> = {};
  teams.forEach((t) => (ratings[t] = START));

  const sorted = [...matches].sort((a, b) => a.Date.getTime() - b.Date.getTime());
  for (const m of sorted) {
    const rH = ratings[m.Home] ?? START;
    const rA = ratings[m.Away] ?? START;
    const expH = 1 / (1 + Math.pow(10, (rA - rH - HFA) / 400));
    let actualH: number;
    if (m.HomeGoals > m.AwayGoals) actualH = 1;
    else if (m.HomeGoals < m.AwayGoals) actualH = 0;
    else actualH = 0.5;
    const gd = Math.abs(m.HomeGoals - m.AwayGoals);
    const mult = K_BASE * Math.log(gd + 1 + 0.5);
    ratings[m.Home] = rH + mult * (actualH - expH);
    ratings[m.Away] = rA + mult * ((1 - actualH) - (1 - expH));
  }
  return { ratings };
}

export function eloPredict(fit: EloFit, home: string, away: string): Prediction {
  const rH = fit.ratings[home] ?? START;
  const rA = fit.ratings[away] ?? START;
  const pHraw = 1 / (1 + Math.pow(10, (rA - rH - HFA) / 400));
  // Fixed 26% draw-rate prior; split the remaining mass using pHraw
  const pDraw = 0.26;
  const remaining = 1 - pDraw;
  const pHome = remaining * pHraw;
  const pAway = remaining * (1 - pHraw);
  return {
    home, away,
    lambdaHome: 0, lambdaAway: 0,
    pHome, pDraw, pAway,
    pBTTS: 0, pOver25: 0,
    topScorelines: [],
    supportsScoreline: false,
    modelName: "Elo",
  };
}
