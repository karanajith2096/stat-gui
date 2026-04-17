import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  buildGWAggregates,
  buildScoredFirstWinRate,
  buildStandings,
} from "../lib/derive";
import { useWorkbook } from "../store/workbook";

export function Trends() {
  const matches = useWorkbook((s) => s.matches);
  const goals = useWorkbook((s) => s.goals);
  const gws = useMemo(() => buildGWAggregates(matches), [matches]);
  const standings = useMemo(() => buildStandings(matches), [matches]);
  const scoredFirst = useMemo(() => buildScoredFirstWinRate(matches, goals), [matches, goals]);

  const goalMix = useMemo(() => {
    // Per GW: share of goals by Situation
    const byGW = new Map<number, Map<string, number>>();
    const matchGW = new Map<number, number>();
    matches.forEach((m) => matchGW.set(m.MatchNo, m.Gameweek));
    const allSituations = new Set<string>();
    for (const g of goals) {
      if (g.GoalOG !== "G") continue;
      const gw = matchGW.get(g.MatchNo);
      if (!gw) continue;
      if (!byGW.has(gw)) byGW.set(gw, new Map());
      const m = byGW.get(gw)!;
      m.set(g.Situation, (m.get(g.Situation) ?? 0) + 1);
      allSituations.add(g.Situation);
    }
    const sorted = Array.from(byGW.keys()).sort((a, b) => a - b);
    const sitList = Array.from(allSituations);
    return {
      situations: sitList,
      data: sorted.map((gw) => {
        const m = byGW.get(gw)!;
        const row: Record<string, number> = { gameweek: gw };
        sitList.forEach((s) => (row[s] = m.get(s) ?? 0));
        return row;
      }),
    };
  }, [goals, matches]);

  // latest completed GW — assume "latest" is max
  const latestGW = gws.length > 0 ? gws[gws.length - 1].gameweek : 0;
  const perfThisGW = useMemo(() => {
    if (latestGW === 0) return [];
    return standings
      .map((row) => {
        // Find the team's match in latestGW
        const m = matches.find(
          (mm) => mm.Gameweek === latestGW && (mm.Home === row.team || mm.Away === row.team)
        );
        if (!m) return null;
        const isHome = m.Home === row.team;
        const pts = isHome ? m.HomePoints : m.AwayPoints;
        const xPts = isHome ? m.HomexPts : m.AwayxPts;
        return { team: row.team, diff: pts - xPts };
      })
      .filter((x): x is { team: string; diff: number } => x !== null);
  }, [standings, matches, latestGW]);

  const over = [...perfThisGW].sort((a, b) => b.diff - a.diff).slice(0, 3);
  const under = [...perfThisGW].sort((a, b) => a.diff - b.diff).slice(0, 3);

  return (
    <div>
      <div className="card">
        <h2 className="card-title">Goals & xG per Gameweek</h2>
        <div className="chart-wrap">
          <ResponsiveContainer>
            <LineChart data={gws}>
              <CartesianGrid stroke="#2a3644" />
              <XAxis dataKey="gameweek" stroke="#8ea0b2" />
              <YAxis stroke="#8ea0b2" />
              <Tooltip />
              <Legend />
              <Line dataKey="totalGoals" name="Goals" stroke="#7cd992" dot={false} />
              <Line dataKey="totalXG" name="xG" stroke="#4db3ff" dot={false} strokeDasharray="4 2" />
              <Line dataKey="avgGoalsPerMatch" name="Avg goals / match" stroke="#f5a623" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Home advantage over time</h2>
        <div className="chart-wrap">
          <ResponsiveContainer>
            <BarChart data={gws} stackOffset="expand">
              <CartesianGrid stroke="#2a3644" />
              <XAxis dataKey="gameweek" stroke="#8ea0b2" />
              <YAxis stroke="#8ea0b2" tickFormatter={(v) => `${Math.round(v * 100)}%`} />
              <Tooltip />
              <Legend />
              <Bar dataKey="homeWins" stackId="a" name="Home W" fill="#4db3ff" />
              <Bar dataKey="draws" stackId="a" name="Draw" fill="#8ea0b2" />
              <Bar dataKey="awayWins" stackId="a" name="Away W" fill="#f5a623" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Goal mix by situation (per gameweek)</h2>
        <div className="chart-wrap">
          <ResponsiveContainer>
            <AreaChart data={goalMix.data} stackOffset="expand">
              <CartesianGrid stroke="#2a3644" />
              <XAxis dataKey="gameweek" stroke="#8ea0b2" />
              <YAxis stroke="#8ea0b2" tickFormatter={(v) => `${Math.round(v * 100)}%`} />
              <Tooltip />
              <Legend />
              {goalMix.situations.map((s, i) => (
                <Area
                  key={s}
                  type="monotone"
                  dataKey={s}
                  stackId="1"
                  stroke={AREA_COLORS[i % AREA_COLORS.length]}
                  fill={AREA_COLORS[i % AREA_COLORS.length]}
                  fillOpacity={0.7}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Discipline & tempo</h2>
        <div className="chart-wrap">
          <ResponsiveContainer>
            <LineChart data={gws}>
              <CartesianGrid stroke="#2a3644" />
              <XAxis dataKey="gameweek" stroke="#8ea0b2" />
              <YAxis stroke="#8ea0b2" />
              <Tooltip />
              <Legend />
              <Line dataKey="avgShots" name="Shots/match" stroke="#4db3ff" dot={false} />
              <Line dataKey="avgShotsOnTarget" name="SoT/match" stroke="#7cd992" dot={false} />
              <Line dataKey="avgBigChances" name="Big Chances/match" stroke="#f5a623" dot={false} />
              <Line dataKey="avgYellow" name="Yellows/match" stroke="#e0c34a" dot={false} strokeDasharray="4 2" />
              <Line dataKey="avgRed" name="Reds/match" stroke="#e05252" dot={false} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Latest GW ({latestGW}) — biggest over/under-performers vs xPts</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <div className="subtle" style={{ marginBottom: 6 }}>Over-performed</div>
            {over.map((o) => (
              <div key={o.team} className="stat-tile" style={{ marginBottom: 6 }}>
                <b>{o.team}</b> <span style={{ color: "#7cd992" }}>+{o.diff.toFixed(2)}</span> pts vs xPts
              </div>
            ))}
          </div>
          <div>
            <div className="subtle" style={{ marginBottom: 6 }}>Under-performed</div>
            {under.map((u) => (
              <div key={u.team} className="stat-tile" style={{ marginBottom: 6 }}>
                <b>{u.team}</b> <span style={{ color: "#e05252" }}>{u.diff.toFixed(2)}</span> pts vs xPts
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">"Scored first" win rate</h2>
        <div className="chart-wrap">
          <ResponsiveContainer>
            <BarChart data={scoredFirst.map((s) => ({ team: s.team, winRate: s.winRate * 100, sample: s.matchesScoredFirst }))} layout="vertical" margin={{ left: 120 }}>
              <CartesianGrid stroke="#2a3644" horizontal={false} />
              <XAxis type="number" stroke="#8ea0b2" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <YAxis type="category" dataKey="team" stroke="#8ea0b2" width={110} tick={{ fontSize: 11 }} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const d = payload[0].payload;
                  return (
                    <div style={{ background: "#1c2530", border: "1px solid #2a3644", padding: 8, fontSize: 12 }}>
                      <b>{d.team}</b><br />Win rate: {d.winRate.toFixed(1)}%<br />Scored first in {d.sample} matches
                    </div>
                  );
                }}
              />
              <Bar dataKey="winRate" fill="#4db3ff" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="subtle">Only counts matches in which the team opened the scoring.</div>
      </div>
    </div>
  );
}

const AREA_COLORS = ["#4db3ff", "#7cd992", "#f5a623", "#e05252", "#b278f0", "#4ad0ce", "#e0c34a", "#ff8fa3"];
