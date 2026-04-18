export interface Match {
  Season: string;
  Gameweek: number;
  MatchNo: number;
  Date: Date;
  Home: string;
  HomeGoals: number;
  AwayGoals: number;
  Away: string;

  HomeXG: number;
  HomexGOT: number;
  "HomeXG-npXG": number;
  HomeSetPiecexG: number;
  HomeFirstHalfxG: number;
  HomeFirstHalfxGOT: number;
  HomeSetPieceGoals: number;
  HomeShots: number;
  HomeSot: number;
  HomeBigChances: number;
  HomeBigChancesMissed: number;
  HomeCorners: number;
  HomeFouls: number;
  HomeDuelsWon: number;
  HomeGroundDuelsWon: number;
  HomeOffsides: number;
  HomeYellow: number;
  HomeRed: number;
  HomePossession: number;
  HomePoints: number;

  AwayXG: number;
  AwayxGOT: number;
  "AwayXG-npXG": number;
  AwaySetPiecexG: number;
  AwayFirstHalfxG: number;
  AwayFirstHalfxGOT: number;
  AwaySetPieceGoals: number;
  AwayShots: number;
  AwaySot: number;
  AwayBigChances: number;
  AwayBigChancesMissed: number;
  AwayCorners: number;
  AwayFouls: number;
  AwayDuelsWon: number;
  AwayGroundDuelsWon: number;
  AwayOffside: number;
  AwayYellow: number;
  AwayRed: number;
  AwayPossession: number;
  AwayPoints: number;

  FotMobLink?: string;
  FbRefLink?: string;

  HomexPts: number;
  AwayxPts: number;
  HomeGW: number;
  AwayGW: number;
  HomeWK: number;
  AwayWk: number;
}

export interface Goal {
  Season: string;
  MatchNo: number;
  GoalNo: number;
  MatchGoalNo: number;
  TeamGoalNo: number;
  HomeAway: "H" | "A";
  GoalTime: number;
  AddedTime: number | null;
  Scorer: string;
  Nationality: string;
  PlayerType: string;
  Pos: string;
  StartSub: string;
  Assist: string | null;
  Team: string;
  Against: string;
  Distance: number | null;
  ShotXG: number | null;
  ShotXGoT: number | null;
  GoalOG: "G" | "OG";
  InsideOutside: "Inside" | "Outside" | string;
  ShotType: string;
  Situation: string;
  Video: string | null;
  xGOTminusxG: number | null;
}

export interface TableRow {
  position: number;
  team: string;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  gf: number;
  ga: number;
  gd: number;
  xG: number;
  xGA: number;
  xGDiff: number;
  ppg: number;
  xPts: number;
  xRank: number;
  lastFiveForm: ("W" | "D" | "L")[];
  lastFivePoints: number;
}

export interface ScorerRow {
  player: string;
  team: string;
  nationality: string;
  position: string;
  goals: number;
  assists: number;
  xG: number;
  xGOT: number;
  xGOTminusxG: number;
  teamGoalShare: number;
  penalties: number;
  tieBreakers: number;
  equalizers: number;
  goalsWhenTrailing: number;
  homeGoals: number;
  awayGoals: number;
  firstHalfGoals: number;
  secondHalfGoals: number;
  matchOpeners: number;
  teamOpeners: number;
  goalLog: GoalLogEntry[];
}

export interface GoalLogEntry {
  matchNo: number;
  gameweek: number;
  date: Date;
  team: string;
  against: string;
  homeAway: "H" | "A";
  minute: number;
  addedTime: number | null;
  distance: number | null;
  xG: number | null;
  situation: string;
  video: string | null;
}

export interface TeamStats {
  team: string;
  games: number;
  home: TeamSideStats;
  away: TeamSideStats;
  total: TeamSideStats;
}

export interface TeamSideStats {
  games: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  xG: number;
  xGA: number;
  xGOT: number;
  xGOTAgainst: number;
  firstHalfxG: number;
  setPiecexG: number;
  setPieceGoals: number;
  nonPenXG: number;
  shots: number;
  shotsOnTarget: number;
  bigChances: number;
  bigChancesMissed: number;
  corners: number;
  possession: number;
  fouls: number;
  yellow: number;
  red: number;
  duelsWon: number;
  groundDuelsWon: number;
  offsides: number;
}

export interface FormPoint {
  gameweek: number;
  matchNo: number;
  date: Date;
  opponent: string;
  isHome: boolean;
  result: "W" | "D" | "L";
  points: number;
  cumulativePoints: number;
  cumulativePPG: number;
  rolling5PPG: number;
  matchXG: number;
  matchXGA: number;
  cumulativeXG: number;
  cumulativeXGA: number;
  cumulativeGoals: number;
  cumulativeGoalsAgainst: number;
  cumulativeXPts: number;
  firstHalfXG: number;
  secondHalfXG: number;
  firstHalfXGA: number;
  secondHalfXGA: number;
  possession: number;
  shots: number;
  shotsOnTarget: number;
}

export interface SetPieceBreakdown {
  total: number;
  percentOfAllGoals: number;
  bySubType: Record<string, number>;
  matchOpeners: number;
  teamOpeners: number;
  home: number;
  away: number;
  firstHalf: number;
  secondHalf: number;
}

export interface Prediction {
  home: string;
  away: string;
  lambdaHome: number;
  lambdaAway: number;
  pHome: number;
  pDraw: number;
  pAway: number;
  pBTTS: number;
  pOver25: number;
  topScorelines: { score: [number, number]; p: number }[];
  supportsScoreline: boolean;
  modelName: string;
}
