import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getTeams, resultFor } from "../lib/derive";
import { dixonColesPredict, fitDixonColes } from "../lib/models/dixonColes";
import { eloPredict, fitElo } from "../lib/models/elo";
import { poissonPredict } from "../lib/models/poisson";
import type { Match, Prediction, PredictionHistoryEntry } from "../lib/types";
import { useWorkbook } from "../store/workbook";

const HISTORY_KEY = "predHistory";

function loadHistory(): PredictionHistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveHistory(entries: PredictionHistoryEntry[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, 50)));
}

type PageTab = "predictor" | "gameweek";

export function Predict() {
  const matches = useWorkbook((s) => s.matches);
  const teams = useMemo(() => getTeams(matches), [matches]);

  const [pageTab, setPageTab] = useState<PageTab>("predictor");
  const [home, setHome] = useState<string>(teams[0] ?? "");
  const [away, setAway] = useState<string>(teams[1] ?? "");
  const [gwSelected, setGwSelected] = useState<number | null>(null);
  const [history, setHistory] = useState<PredictionHistoryEntry[]>(loadHistory);
  const [showBacktest, setShowBacktest] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const dcFit = useMemo(() => fitDixonColes(matches), [matches]);
  const eloFit = useMemo(() => fitElo(matches), [matches]);

  const preds: Prediction[] = useMemo(() => {
    if (!home || !away || home === away) return [];
    return [
      poissonPredict(matches, home, away),
      dixonColesPredict(dcFit, matches, home, away),
      eloPredict(eloFit, home, away),
    ];
  }, [matches, home, away, dcFit, eloFit]);

  const agreement = useMemo(() => {
    if (preds.length < 2) return null;
    const [p1, p2, p3] = preds;
    const maxDiff = Math.max(
      Math.abs(p1.pHome - p2.pHome), Math.abs(p1.pHome - p3.pHome),
      Math.abs(p1.pDraw - p2.pDraw), Math.abs(p1.pDraw - p3.pDraw),
      Math.abs(p1.pAway - p2.pAway), Math.abs(p1.pAway - p3.pAway),
    );
    if (maxDiff <= 0.05) return "high";
    if (maxDiff > 0.15) return "low";
    return "medium";
  }, [preds]);

  const backtest = useMemo(() => {
    if (!showBacktest || matches.length < 20) return null;
    return runBacktest(matches, dcFit, eloFit);
  }, [showBacktest, matches, dcFit, eloFit]);

  const allGWs = useMemo(
    () => [...new Set(matches.map((m) => m.Gameweek))].sort((a, b) => a - b),
    [matches]
  );

  const gwFixtures = useMemo(
    () => (gwSelected !== null ? matches.filter((m) => m.Gameweek === gwSelected) : []),
    [matches, gwSelected]
  );

  const gwPredictions = useMemo(
    () =>
      gwFixtures.map((m) => ({
        match: m,
        poisson: poissonPredict(matches, m.Home, m.Away),
        dc: dixonColesPredict(dcFit, matches, m.Home, m.Away),
        elo: eloPredict(eloFit, m.Home, m.Away),
      })),
    [gwFixtures, matches, dcFit, eloFit]
  );

  const savePrediction = () => {
    if (!home || !away || home === away || preds.length === 0) return;
    const entry: PredictionHistoryEntry = {
      id: String(Date.now()),
      timestamp: Date.now(),
      home,
      away,
      predictions: preds.map((p) => ({
        modelName: p.modelName,
        pHome: p.pHome,
        pDraw: p.pDraw,
        pAway: p.pAway,
        topScoreline: p.topScorelines[0]?.score ?? null,
      })),
    };
    const next = [entry, ...history];
    setHistory(next);
    saveHistory(next);
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
  };

  return (
    <div>
      <div className="beta-banner">
        <b>Beta</b> — predictions based on a partial single season (~30 matches per team). Directional only, not authoritative.
      </div>

      <div className="tabs">
        <button className={`tab ${pageTab === "predictor" ? "active" : ""}`} onClick={() => setPageTab("predictor")}>Match Predictor</button>
        <button className={`tab ${pageTab === "gameweek" ? "active" : ""}`} onClick={() => setPageTab("gameweek")}>Gameweek</button>
      </div>

      {pageTab === "predictor" && (
        <>
          <div className="card">
            <h2 className="card-title">Pick a fixture</h2>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <label>Home <select value={home} onChange={(e) => setHome(e.target.value)}>
                {teams.map((t) => <option key={t} value={t}>{t}</option>)}
              </select></label>
              <span className="subtle">vs</span>
              <label>Away <select value={away} onChange={(e) => setAway(e.target.value)}>
                {teams.map((t) => <option key={t} value={t}>{t}</option>)}
              </select></label>
              {home !== away && preds.length > 0 && (
                <button className="tab" onClick={savePrediction} style={{ marginLeft: "auto" }}>
                  Save to history
                </button>
              )}
            </div>
            {home !== away && agreement && (
              <div style={{ marginTop: 10 }}>
                <AgreementBadge level={agreement} />
              </div>
            )}
          </div>

          {home === away && <div className="card"><div className="subtle">Pick two different teams.</div></div>}

          {home !== away && preds.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {preds.map((p) => <PredictionCard key={p.modelName} p={p} />)}
            </div>
          )}

          <div className="card">
            <button
              className="tab"
              onClick={() => setShowBacktest((v) => !v)}
              style={{ marginBottom: showBacktest ? 14 : 0 }}
            >
              {showBacktest ? "Hide" : "Show"} backtesting results
            </button>
            {showBacktest && <BacktestPanel backtest={backtest} />}
          </div>

          <div className="card">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button className="tab" onClick={() => setShowHistory((v) => !v)}>
                {showHistory ? "Hide" : "Show"} prediction history ({history.length})
              </button>
              {showHistory && history.length > 0 && (
                <button className="tab" onClick={clearHistory} style={{ color: "#e05252" }}>
                  Clear all
                </button>
              )}
            </div>
            {showHistory && (
              <HistoryPanel history={history} matches={matches} />
            )}
          </div>
        </>
      )}

      {pageTab === "gameweek" && (
        <div className="card">
          <h2 className="card-title">Gameweek predictions</h2>
          <div style={{ marginBottom: 14 }}>
            <label>Gameweek{" "}
              <select value={gwSelected ?? ""} onChange={(e) => setGwSelected(Number(e.target.value) || null)}>
                <option value="">Select…</option>
                {allGWs.map((gw) => <option key={gw} value={gw}>GW{gw}</option>)}
              </select>
            </label>
          </div>
          {gwSelected !== null && gwPredictions.length > 0 && (
            <table className="stat-table">
              <thead>
                <tr>
                  <th className="col-team">Home</th>
                  <th className="col-team">Away</th>
                  <th colSpan={3}>Poisson H / D / A</th>
                  <th colSpan={3}>Dixon–Coles H / D / A</th>
                  <th colSpan={3}>Elo H / D / A</th>
                  <th>Actual</th>
                </tr>
              </thead>
              <tbody>
                {gwPredictions.map(({ match: m, poisson, dc, elo }) => {
                  const pct = (v: number) => (v * 100).toFixed(0) + "%";
                  const actualR = m.HomeGoals > m.AwayGoals ? "H" : m.HomeGoals < m.AwayGoals ? "A" : "D";
                  const hasResult = m.HomeGoals !== undefined && m.AwayGoals !== undefined;
                  return (
                    <tr key={m.MatchNo}>
                      <td className="col-team"><b>{m.Home}</b></td>
                      <td className="col-team">{m.Away}</td>
                      <td style={{ color: "#4db3ff" }}>{pct(poisson.pHome)}</td>
                      <td style={{ color: "#8ea0b2" }}>{pct(poisson.pDraw)}</td>
                      <td style={{ color: "#f5a623" }}>{pct(poisson.pAway)}</td>
                      <td style={{ color: "#4db3ff" }}>{pct(dc.pHome)}</td>
                      <td style={{ color: "#8ea0b2" }}>{pct(dc.pDraw)}</td>
                      <td style={{ color: "#f5a623" }}>{pct(dc.pAway)}</td>
                      <td style={{ color: "#4db3ff" }}>{pct(elo.pHome)}</td>
                      <td style={{ color: "#8ea0b2" }}>{pct(elo.pDraw)}</td>
                      <td style={{ color: "#f5a623" }}>{pct(elo.pAway)}</td>
                      <td>
                        {hasResult ? (
                          <span>{m.HomeGoals}–{m.AwayGoals} <span className={`pill pill-${actualR}`}>{actualR}</span></span>
                        ) : <span className="subtle">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {gwSelected !== null && gwPredictions.length === 0 && (
            <div className="subtle">No matches found for GW{gwSelected}.</div>
          )}
        </div>
      )}
    </div>
  );
}

function AgreementBadge({ level }: { level: "high" | "medium" | "low" }) {
  const configs = {
    high:   { label: "High model agreement", color: "#7cd992", bg: "#1a3d24" },
    medium: { label: "Moderate model agreement", color: "#f5a623", bg: "#3d2e0a" },
    low:    { label: "Models disagree", color: "#e05252", bg: "#3d1a1a" },
  };
  const c = configs[level];
  return (
    <span style={{
      padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600,
      color: c.color, background: c.bg, border: `1px solid ${c.color}`,
    }}>
      {c.label}
    </span>
  );
}

function PredictionCard({ p }: { p: Prediction }) {
  const pct = (v: number) => (v * 100).toFixed(1) + "%";
  const cleanSheetHome = p.supportsScoreline ? Math.exp(-p.lambdaAway) : null;
  const cleanSheetAway = p.supportsScoreline ? Math.exp(-p.lambdaHome) : null;
  const xPtsHome = p.pHome * 3 + p.pDraw;
  const xPtsAway = p.pAway * 3 + p.pDraw;

  return (
    <div className="card">
      <h2 className="card-title">{p.modelName}</h2>

      <div style={{ display: "flex", height: 14, borderRadius: 3, overflow: "hidden", marginBottom: 10 }}>
        <div style={{ width: `${p.pHome * 100}%`, background: "#4db3ff" }} title={`Home ${pct(p.pHome)}`} />
        <div style={{ width: `${p.pDraw * 100}%`, background: "#8ea0b2" }} title={`Draw ${pct(p.pDraw)}`} />
        <div style={{ width: `${p.pAway * 100}%`, background: "#f5a623" }} title={`Away ${pct(p.pAway)}`} />
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <Mini label={p.home} value={pct(p.pHome)} color="#4db3ff" />
        <Mini label="Draw" value={pct(p.pDraw)} color="#8ea0b2" />
        <Mini label={p.away} value={pct(p.pAway)} color="#f5a623" />
      </div>

      {p.supportsScoreline && (
        <>
          <div style={{ marginTop: 10 }}>
            <div className="subtle">Expected goals</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>
              <span style={{ color: "#4db3ff" }}>{p.lambdaHome.toFixed(2)}</span>
              {" — "}
              <span style={{ color: "#f5a623" }}>{p.lambdaAway.toFixed(2)}</span>
            </div>
          </div>

          {p.scorelineGrid && <ScorelineGrid grid={p.scorelineGrid} home={p.home} away={p.away} />}

          <div style={{ marginTop: 10 }}>
            <div className="subtle" style={{ marginBottom: 4 }}>Top scorelines</div>
            <table className="stat-table" style={{ marginTop: 0 }}>
              <tbody>
                {p.topScorelines.map((s, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{s.score[0]}–{s.score[1]}</td>
                    <td>{pct(s.p)}</td>
                    <td className="subtle" style={{ fontSize: 10 }}>
                      {s.score[0] > s.score[1] ? p.home : s.score[0] < s.score[1] ? p.away : "Draw"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 16 }}>
            <div><div className="subtle">BTTS</div><b>{pct(p.pBTTS)}</b></div>
            <div><div className="subtle">Over 2.5</div><b>{pct(p.pOver25)}</b></div>
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 16 }}>
            <div><div className="subtle">Clean sheet {p.home}</div><b>{pct(cleanSheetHome!)}</b></div>
            <div><div className="subtle">Clean sheet {p.away}</div><b>{pct(cleanSheetAway!)}</b></div>
          </div>
        </>
      )}

      <div style={{ marginTop: 10, display: "flex", gap: 16 }}>
        <div><div className="subtle">xPts {p.home}</div><b>{xPtsHome.toFixed(2)}</b></div>
        <div><div className="subtle">xPts {p.away}</div><b>{xPtsAway.toFixed(2)}</b></div>
      </div>

      {!p.supportsScoreline && (
        <div className="subtle" style={{ marginTop: 10, fontSize: 11 }}>
          Elo doesn't model goal totals — H/D/A and xPts only.
        </div>
      )}

      <div className="subtle" style={{ marginTop: 8, fontSize: 11 }}>Beta</div>
    </div>
  );
}

function ScorelineGrid({ grid, home, away }: {
  grid: { score: [number, number]; p: number }[];
  home: string;
  away: string;
}) {
  const cellMap = new Map<string, number>();
  for (const c of grid) cellMap.set(`${c.score[0]}_${c.score[1]}`, c.p);
  const maxP = Math.max(...grid.map((c) => c.p), 0.001);
  const N = 5;

  return (
    <div style={{ marginTop: 12 }}>
      <div className="subtle" style={{ marginBottom: 6 }}>Scoreline grid (hover for %)</div>
      <div style={{ fontSize: 10, color: "#8ea0b2", marginBottom: 4, textAlign: "center" }}>
        ← {away} goals →
      </div>
      <div style={{ display: "flex", alignItems: "center" }}>
        <div style={{ writingMode: "vertical-lr", transform: "rotate(180deg)", fontSize: 10, color: "#8ea0b2", marginRight: 4, whiteSpace: "nowrap" }}>
          ← {home} goals →
        </div>
        <div>
          <div style={{ display: "flex", marginBottom: 2 }}>
            <div style={{ width: 20 }} />
            {Array.from({ length: N + 1 }, (_, j) => (
              <div key={j} style={{ width: 26, textAlign: "center", fontSize: 10, color: "#8ea0b2" }}>{j}</div>
            ))}
          </div>
          {Array.from({ length: N + 1 }, (_, i) => (
            <div key={i} style={{ display: "flex", marginBottom: 2, alignItems: "center" }}>
              <div style={{ width: 20, fontSize: 10, color: "#8ea0b2", textAlign: "right", paddingRight: 4 }}>{i}</div>
              {Array.from({ length: N + 1 }, (_, j) => {
                const p = cellMap.get(`${i}_${j}`) ?? 0;
                const intensity = p / maxP;
                const base = i > j ? "#4db3ff" : i === j ? "#8ea0b2" : "#f5a623";
                return (
                  <div
                    key={j}
                    title={`${i}–${j}: ${(p * 100).toFixed(2)}%`}
                    style={{
                      width: 26, height: 26,
                      background: base,
                      opacity: 0.08 + intensity * 0.92,
                      marginRight: 2,
                      borderRadius: 3,
                      cursor: "default",
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 10, color: "#8ea0b2" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 10, height: 10, background: "#4db3ff", display: "inline-block", borderRadius: 2, opacity: 0.7 }} /> Home win
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 10, height: 10, background: "#8ea0b2", display: "inline-block", borderRadius: 2, opacity: 0.7 }} /> Draw
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 10, height: 10, background: "#f5a623", display: "inline-block", borderRadius: 2, opacity: 0.7 }} /> Away win
        </span>
      </div>
    </div>
  );
}

interface BacktestMetrics {
  brier: number;
  logLoss: number;
  correctPct: number;
  n: number;
}

interface BacktestResult {
  poisson: BacktestMetrics;
  elo: BacktestMetrics;
  dc: BacktestMetrics;
  calibration: {
    bucket: string;
    poisson: number;
    elo: number;
    dc: number;
  }[];
}

function computeMetrics(results: { actual: "H" | "D" | "A"; pH: number; pD: number; pA: number }[]): BacktestMetrics {
  if (results.length === 0) return { brier: 0, logLoss: 0, correctPct: 0, n: 0 };
  let brierSum = 0, logLossSum = 0, correct = 0;
  for (const r of results) {
    const aH = r.actual === "H" ? 1 : 0;
    const aD = r.actual === "D" ? 1 : 0;
    const aA = r.actual === "A" ? 1 : 0;
    brierSum += (r.pH - aH) ** 2 + (r.pD - aD) ** 2 + (r.pA - aA) ** 2;
    const pActual = r.actual === "H" ? r.pH : r.actual === "D" ? r.pD : r.pA;
    logLossSum += -Math.log(Math.max(0.001, pActual));
    const pred = r.pH >= r.pD && r.pH >= r.pA ? "H" : r.pA >= r.pH && r.pA >= r.pD ? "A" : "D";
    if (pred === r.actual) correct++;
  }
  const n = results.length;
  return { brier: brierSum / n, logLoss: logLossSum / n, correctPct: correct / n, n };
}

function getActual(m: Match): "H" | "D" | "A" {
  return m.HomeGoals > m.AwayGoals ? "H" : m.HomeGoals < m.AwayGoals ? "A" : "D";
}

function runBacktest(
  matches: Match[],
  dcFit: ReturnType<typeof fitDixonColes>,
  eloFit: ReturnType<typeof fitElo>
): BacktestResult {
  const sorted = [...matches].sort((a, b) => a.Date.getTime() - b.Date.getTime());
  const WARMUP = 20;

  const poissonResults: { actual: "H" | "D" | "A"; pH: number; pD: number; pA: number }[] = [];
  const eloResults: typeof poissonResults = [];
  const dcResults: typeof poissonResults = [];

  for (let i = WARMUP; i < sorted.length; i++) {
    const trainMatches = sorted.slice(0, i);
    const m = sorted[i];
    const actual = getActual(m);

    const pp = poissonPredict(trainMatches, m.Home, m.Away);
    poissonResults.push({ actual, pH: pp.pHome, pD: pp.pDraw, pA: pp.pAway });

    const ef = fitElo(trainMatches);
    const ep = eloPredict(ef, m.Home, m.Away);
    eloResults.push({ actual, pH: ep.pHome, pD: ep.pDraw, pA: ep.pAway });

    const dp = dixonColesPredict(dcFit, trainMatches, m.Home, m.Away);
    dcResults.push({ actual, pH: dp.pHome, pD: dp.pDraw, pA: dp.pAway });
  }

  // Calibration: bucket predicted pHome probabilities (0-10%, 10-20%, …, 90-100%)
  const bucketLabels = Array.from({ length: 10 }, (_, i) => `${i * 10}–${i * 10 + 10}%`);
  const calibration = bucketLabels.map((bucket, bi) => {
    const lo = bi * 0.1;
    const hi = lo + 0.1;
    function bucketRate(results: typeof poissonResults, field: "pH" | "pD" | "pA", outcome: "H" | "D" | "A") {
      const inBucket = results.filter((r) => r[field] >= lo && r[field] < hi);
      if (inBucket.length === 0) return null;
      return inBucket.filter((r) => r.actual === outcome).length / inBucket.length;
    }
    return {
      bucket,
      poisson: bucketRate(poissonResults, "pH", "H") ?? 0,
      elo: bucketRate(eloResults, "pH", "H") ?? 0,
      dc: bucketRate(dcResults, "pH", "H") ?? 0,
    };
  });

  return {
    poisson: computeMetrics(poissonResults),
    elo: computeMetrics(eloResults),
    dc: computeMetrics(dcResults),
    calibration,
  };
}

function BacktestPanel({ backtest }: { backtest: BacktestResult | null }) {
  if (!backtest) {
    return <div className="subtle" style={{ marginTop: 8 }}>Computing… (sequential holdout, first 20 matches used as warmup)</div>;
  }

  const models: { name: string; m: BacktestMetrics }[] = [
    { name: "Poisson (xG)", m: backtest.poisson },
    { name: "Dixon–Coles", m: backtest.dc },
    { name: "Elo", m: backtest.elo },
  ];

  const calibData = backtest.calibration.map((c, i) => ({
    ...c,
    midpoint: i * 10 + 5,
  }));

  return (
    <div>
      <div className="subtle" style={{ marginBottom: 10, fontSize: 11 }}>
        Sequential holdout: each match predicted using only prior matches. {backtest.poisson.n} matches evaluated.
      </div>
      <table className="stat-table">
        <thead>
          <tr>
            <th>Model</th>
            <th>Correct %</th>
            <th>Brier score ↓</th>
            <th>Log-loss ↓</th>
          </tr>
        </thead>
        <tbody>
          {models.map(({ name, m }) => (
            <tr key={name}>
              <td><b>{name}</b></td>
              <td style={{ color: "#7cd992" }}>{(m.correctPct * 100).toFixed(1)}%</td>
              <td>{m.brier.toFixed(3)}</td>
              <td>{m.logLoss.toFixed(3)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 16 }}>
        <div className="subtle" style={{ marginBottom: 6 }}>Home-win calibration (predicted vs actual rate)</div>
        <div className="chart-wrap">
          <ResponsiveContainer>
            <LineChart data={calibData} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
              <CartesianGrid stroke="#2a3644" />
              <XAxis dataKey="midpoint" stroke="#8ea0b2" tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
              <YAxis stroke="#8ea0b2" tickFormatter={(v) => `${Math.round(v * 100)}%`} domain={[0, 1]} />
              <Tooltip formatter={(v: number) => `${(v * 100).toFixed(1)}%`} />
              <Legend />
              <ReferenceLine stroke="#444" segment={[{ x: 0, y: 0 }, { x: 100, y: 1 }]} strokeDasharray="4 2" />
              <Line dataKey="poisson" name="Poisson" stroke="#4db3ff" dot={false} connectNulls />
              <Line dataKey="dc" name="Dixon–Coles" stroke="#7cd992" dot={false} connectNulls />
              <Line dataKey="elo" name="Elo" stroke="#f5a623" dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function HistoryPanel({ history, matches }: { history: PredictionHistoryEntry[]; matches: Match[] }) {
  if (history.length === 0) {
    return <div className="subtle" style={{ marginTop: 10 }}>No predictions saved yet.</div>;
  }

  function findActual(home: string, away: string): "H" | "D" | "A" | null {
    const m = matches.find((x) => x.Home === home && x.Away === away);
    if (!m) return null;
    return m.HomeGoals > m.AwayGoals ? "H" : m.HomeGoals < m.AwayGoals ? "A" : "D";
  }

  return (
    <div style={{ marginTop: 12 }}>
      {history.map((entry) => {
        const actual = findActual(entry.home, entry.away);
        return (
          <div key={entry.id} className="stat-tile" style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <b>{entry.home} vs {entry.away}</b>
              <span className="subtle" style={{ fontSize: 11 }}>
                {new Date(entry.timestamp).toLocaleDateString()}
              </span>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
              {entry.predictions.map((pred) => {
                const pct = (v: number) => `${(v * 100).toFixed(0)}%`;
                const predictedOutcome = pred.pHome >= pred.pDraw && pred.pHome >= pred.pAway ? "H"
                  : pred.pAway >= pred.pHome && pred.pAway >= pred.pDraw ? "A" : "D";
                const correct = actual ? predictedOutcome === actual : null;
                return (
                  <div key={pred.modelName} style={{ fontSize: 11 }}>
                    <div className="subtle">{pred.modelName}</div>
                    <div>
                      <span style={{ color: "#4db3ff" }}>H {pct(pred.pHome)}</span>{" · "}
                      <span style={{ color: "#8ea0b2" }}>D {pct(pred.pDraw)}</span>{" · "}
                      <span style={{ color: "#f5a623" }}>A {pct(pred.pAway)}</span>
                    </div>
                    {actual && (
                      <div style={{ color: correct ? "#7cd992" : "#e05252", fontWeight: 600 }}>
                        {correct ? "✓" : "✗"} (actual: {actual})
                      </div>
                    )}
                    {!actual && <div className="subtle">Result pending</div>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Mini({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="stat-tile" style={{ padding: 10 }}>
      <div className="label" style={{ fontSize: 10 }}>{label}</div>
      <div className="value" style={{ fontSize: 18, color }}>{value}</div>
    </div>
  );
}
