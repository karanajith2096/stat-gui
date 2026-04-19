import { useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { buildPositionByGW, buildProgression, matchesFor, resultFor, type ProgressionMetric } from "../lib/derive";
import type { Match } from "../lib/types";
import { useWorkbook } from "../store/workbook";

type View = "table" | "line" | "bump";

const METRICS: { key: ProgressionMetric; label: string }[] = [
  { key: "points", label: "Points" },
  { key: "goalsScored", label: "Goals Scored" },
  { key: "goalsConceded", label: "Goals Conceded" },
  { key: "xG", label: "xG" },
  { key: "xGA", label: "xGA" },
];

export function Progression() {
  const matches = useWorkbook((s) => s.matches);
  const [metric, setMetric] = useState<ProgressionMetric>("points");
  const [view, setView] = useState<View>("table");
  const [lineHighlighted, setLineHighlighted] = useState<string | null>(null);
  const [bumpHighlighted, setBumpHighlighted] = useState<string | null>(null);

  const prog = useMemo(() => buildProgression(matches, metric), [matches, metric]);
  const bump = useMemo(() => (view === "bump" ? buildPositionByGW(matches) : null), [matches, view]);

  // Build team -> GW -> match lookup for per-cell coloring
  const gwMatchMap = useMemo(() => {
    const map = new Map<string, Map<number, Match>>();
    for (const m of matches) {
      for (const team of [m.Home, m.Away]) {
        if (!map.has(team)) map.set(team, new Map());
        map.get(team)!.set(m.Gameweek, m);
      }
    }
    return map;
  }, [matches]);

  const sortedSeries = useMemo(() => {
    return [...prog.series].sort((a, b) => {
      const av = a.values.at(-1) ?? 0;
      const bv = b.values.at(-1) ?? 0;
      return (bv ?? 0) - (av ?? 0);
    });
  }, [prog.series]);

  const lineData = useMemo(() => {
    return prog.gameweeks.map((gw, i) => {
      const row: Record<string, number | null> = { gameweek: gw };
      for (const s of prog.series) row[s.team] = s.values[i];
      return row;
    });
  }, [prog]);

  const bumpData = useMemo(() => {
    if (!bump) return null;
    return bump.gameweeks.map((gw, i) => {
      const row: Record<string, number | null> = { gameweek: gw };
      for (const s of bump.series) row[s.team] = s.positions[i];
      return row;
    });
  }, [bump]);

  return (
    <div>
      <div className="card">
        <h2 className="card-title">Team Progression</h2>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div className="tabs" style={{ borderBottom: "none", margin: 0 }}>
            {METRICS.map((m) => (
              <button
                key={m.key}
                className={`tab ${metric === m.key ? "active" : ""}`}
                onClick={() => setMetric(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="spacer" style={{ flex: 1 }} />
          <div className="toggle-group">
            <button className={view === "table" ? "active" : ""} onClick={() => setView("table")}>Table</button>
            <button className={view === "line" ? "active" : ""} onClick={() => setView("line")}>Line</button>
            <button className={view === "bump" ? "active" : ""} onClick={() => setView("bump")}>Bump (position)</button>
          </div>
        </div>
      </div>

      {view === "table" && (
        <div className="card" style={{ overflowX: "auto" }}>
          <table className="stat-table progression-table">
            <thead>
              <tr>
                <th className="col-team">Team / GW</th>
                {prog.gameweeks.map((gw) => <th key={gw}>{gw}</th>)}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {sortedSeries.map((s) => (
                <tr key={s.team}>
                  <td className="col-team">{s.team}</td>
                  {s.values.map((v, i) => {
                    const gw = prog.gameweeks[i];
                    const match = gwMatchMap.get(s.team)?.get(gw);
                    const bg = match ? gwCellColor(match, s.team, metric) : "transparent";
                    return (
                      <td key={i} style={{ background: bg, textAlign: "center" }}>
                        {v === null ? "" : fmtVal(v, metric)}
                      </td>
                    );
                  })}
                  <td><b>{fmtVal(s.values.at(-1) ?? 0, metric)}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === "line" && (
        <div className="card">
          <div className="chart-wrap" style={{ height: 520 }}>
            <ResponsiveContainer>
              <LineChart data={lineData}>
                <CartesianGrid stroke="#2a3644" />
                <XAxis dataKey="gameweek" stroke="#8ea0b2" />
                <YAxis stroke="#8ea0b2" />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const items = lineHighlighted
                      ? payload.filter((p) => p.dataKey === lineHighlighted)
                      : payload;
                    return (
                      <div style={{ background: "#1c2530", border: "1px solid #2a3644", padding: 8, fontSize: 12 }}>
                        <div style={{ marginBottom: 4, color: "#8ea0b2" }}>GW {label}</div>
                        {items.map((p) => (
                          <div key={String(p.dataKey)} style={{ color: p.stroke as string }}>
                            {p.dataKey}: {p.value ?? "—"}
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                {prog.series.map((s, i) => (
                  <Line
                    key={s.team}
                    dataKey={s.team}
                    stroke={TEAM_COLORS[i % TEAM_COLORS.length]}
                    dot={false}
                    strokeWidth={lineHighlighted === s.team ? 2.5 : 1.5}
                    strokeOpacity={lineHighlighted === null || lineHighlighted === s.team ? 1 : 0.08}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
            {prog.series.map((s, i) => (
              <button
                key={s.team}
                onClick={() => setLineHighlighted(lineHighlighted === s.team ? null : s.team)}
                style={{
                  background: lineHighlighted === s.team ? TEAM_COLORS[i % TEAM_COLORS.length] : "transparent",
                  border: `1px solid ${TEAM_COLORS[i % TEAM_COLORS.length]}`,
                  color: lineHighlighted === s.team ? "#0d1117" : TEAM_COLORS[i % TEAM_COLORS.length],
                  borderRadius: 4,
                  padding: "2px 8px",
                  fontSize: 11,
                  cursor: "pointer",
                  opacity: lineHighlighted !== null && lineHighlighted !== s.team ? 0.35 : 1,
                }}
              >
                {s.team}
              </button>
            ))}
          </div>
          <div className="subtle" style={{ marginTop: 8 }}>Click a team to highlight. Click again to clear.</div>
        </div>
      )}

      {view === "bump" && bump && bumpData && (
        <div className="card">
          <h2 className="card-title">League position by gameweek</h2>
          <div className="chart-wrap" style={{ height: 520 }}>
            <ResponsiveContainer>
              <LineChart data={bumpData}>
                <CartesianGrid stroke="#2a3644" />
                <XAxis dataKey="gameweek" stroke="#8ea0b2" />
                <YAxis stroke="#8ea0b2" reversed domain={[1, bump.series.length]} ticks={Array.from({ length: bump.series.length }, (_, i) => i + 1)} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const items = bumpHighlighted
                      ? payload.filter((p) => p.dataKey === bumpHighlighted)
                      : payload.slice().sort((a, b) => (a.value as number) - (b.value as number));
                    return (
                      <div style={{ background: "#1c2530", border: "1px solid #2a3644", padding: 8, fontSize: 12, maxHeight: 220, overflowY: "auto" }}>
                        <div style={{ marginBottom: 4, color: "#8ea0b2" }}>GW {label}</div>
                        {items.map((p) => (
                          <div key={String(p.dataKey)} style={{ color: p.stroke as string }}>
                            #{p.value} {p.dataKey}
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                {bump.series.map((s, i) => (
                  <Line
                    key={s.team}
                    dataKey={s.team}
                    stroke={TEAM_COLORS[i % TEAM_COLORS.length]}
                    dot={false}
                    strokeWidth={bumpHighlighted === s.team ? 2.5 : 1.5}
                    strokeOpacity={bumpHighlighted === null || bumpHighlighted === s.team ? 1 : 0.08}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
            {bump.series.map((s, i) => (
              <button
                key={s.team}
                onClick={() => setBumpHighlighted(bumpHighlighted === s.team ? null : s.team)}
                style={{
                  background: bumpHighlighted === s.team ? TEAM_COLORS[i % TEAM_COLORS.length] : "transparent",
                  border: `1px solid ${TEAM_COLORS[i % TEAM_COLORS.length]}`,
                  color: bumpHighlighted === s.team ? "#0d1117" : TEAM_COLORS[i % TEAM_COLORS.length],
                  borderRadius: 4,
                  padding: "2px 8px",
                  fontSize: 11,
                  cursor: "pointer",
                  opacity: bumpHighlighted !== null && bumpHighlighted !== s.team ? 0.35 : 1,
                }}
              >
                {s.team}
              </button>
            ))}
          </div>
          <div className="subtle" style={{ marginTop: 8 }}>Click a team to highlight. Click again to clear.</div>
        </div>
      )}
    </div>
  );
}

function fmtVal(v: number, metric: ProgressionMetric): string {
  if (metric === "xG" || metric === "xGA") return v.toFixed(1);
  return String(Math.round(v));
}

function gwCellColor(match: Match, team: string, metric: ProgressionMetric): string {
  const isHome = match.Home === team;
  const result = resultFor(match, team);

  if (metric === "points") {
    return result === "W" ? "#1a3d24" : result === "D" ? "#2d3748" : "#3d1a1a";
  }
  if (metric === "goalsScored") {
    const gf = isHome ? match.HomeGoals : match.AwayGoals;
    return gf >= 3 ? "#1a3d24" : gf >= 1 ? "#2d3748" : "#3d1a1a";
  }
  if (metric === "goalsConceded") {
    const ga = isHome ? match.AwayGoals : match.HomeGoals;
    return ga === 0 ? "#1a3d24" : ga <= 2 ? "#2d3748" : "#3d1a1a";
  }
  if (metric === "xG") {
    const xg = isHome ? match.HomeXG : match.AwayXG;
    return xg >= 2 ? "#1a3d24" : xg >= 1 ? "#2d3748" : "#3d1a1a";
  }
  if (metric === "xGA") {
    const xga = isHome ? match.AwayXG : match.HomeXG;
    return xga < 1 ? "#1a3d24" : xga <= 2 ? "#2d3748" : "#3d1a1a";
  }
  return "transparent";
}

const TEAM_COLORS = [
  "#4db3ff", "#7cd992", "#f5a623", "#e05252", "#b278f0", "#4ad0ce", "#e0c34a", "#ff8fa3",
  "#5a6bff", "#73c2fb", "#a2d86e", "#ff7f50", "#c06bff", "#40e0d0", "#ff6384", "#ffb347",
  "#5dd39e", "#ff7fa9", "#3bb273", "#ffc857",
];
