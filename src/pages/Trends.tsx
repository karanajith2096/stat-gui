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
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import {
  buildGWAggregates,
  buildTeamStats,
  getTeams,
} from "../lib/derive";
import { useWorkbook } from "../store/workbook";

export function Trends() {
  const matches = useWorkbook((s) => s.matches);
  const goals = useWorkbook((s) => s.goals);
  const gws = useMemo(() => buildGWAggregates(matches), [matches]);

  const goalMix = useMemo(() => {
    const NAMED = new Set(["Regular", "FastBreak", "Fast Break", "Fast-Break", "Penalty", "Corner"]);
    const OTHER_KEY = "Other Set-Piece Goals";

    const classifySituation = (situation: string): string => {
      const s = situation.trim();
      return NAMED.has(s) ? s : OTHER_KEY;
    };

    const byGW = new Map<number, Map<string, number>>();
    const matchGW = new Map<number, number>();
    matches.forEach((m) => matchGW.set(m.MatchNo, m.Gameweek));
    const allSituations = new Set<string>();
    for (const g of goals) {
      const gw = matchGW.get(g.MatchNo);
      if (!gw) continue;
      if (!byGW.has(gw)) byGW.set(gw, new Map());
      const m = byGW.get(gw)!;
      const bucket = classifySituation(g.Situation);
      m.set(bucket, (m.get(bucket) ?? 0) + 1);
      allSituations.add(bucket);
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

  // Season xG vs Goals per team
  const teamXGvsGoals = useMemo(() => {
    const teams = getTeams(matches);
    return teams.map((team) => {
      const ts = buildTeamStats(team, matches);
      return {
        team,
        xG: parseFloat(ts.total.xG.toFixed(1)),
        goals: ts.total.goalsFor,
        diff: parseFloat((ts.total.goalsFor - ts.total.xG).toFixed(1)),
      };
    }).sort((a, b) => b.xG - a.xG);
  }, [matches]);

  const xGGoalsMax = useMemo(
    () => Math.ceil(Math.max(...teamXGvsGoals.map((d) => Math.max(d.xG, d.goals)), 0) / 5) * 5 + 5,
    [teamXGvsGoals]
  );

  // Big chances per team
  const bigChancesData = useMemo(() => {
    const teams = getTeams(matches);
    return teams
      .map((team) => {
        const ts = buildTeamStats(team, matches);
        return {
          team,
          Converted: ts.total.bigChances - ts.total.bigChancesMissed,
          Missed: ts.total.bigChancesMissed,
          total: ts.total.bigChances,
          convRate: ts.total.bigChances > 0
            ? ((ts.total.bigChances - ts.total.bigChancesMissed) / ts.total.bigChances) * 100
            : 0,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [matches]);

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
        <h2 className="card-title">Season xG vs Goals — clinical vs wasteful</h2>
        <div className="chart-wrap">
          <ResponsiveContainer>
            <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
              <CartesianGrid stroke="#2a3644" />
              <XAxis
                type="number"
                dataKey="xG"
                name="xG"
                stroke="#8ea0b2"
                domain={[0, xGGoalsMax]}
                label={{ value: "Expected Goals (xG)", position: "insideBottom", offset: -10, fill: "#8ea0b2", fontSize: 12 }}
              />
              <YAxis
                type="number"
                dataKey="goals"
                name="Goals"
                stroke="#8ea0b2"
                domain={[0, xGGoalsMax]}
                label={{ value: "Goals Scored", angle: -90, position: "insideLeft", offset: 10, fill: "#8ea0b2", fontSize: 12 }}
              />
              <ZAxis range={[60, 60]} />
              <ReferenceLine
                segment={[{ x: 0, y: 0 }, { x: xGGoalsMax, y: xGGoalsMax }]}
                stroke="#8ea0b2"
                strokeDasharray="5 3"
                label={{ value: "xG = Goals", position: "insideTopLeft", fill: "#8ea0b2", fontSize: 11 }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div style={{ background: "#1c2530", border: "1px solid #2a3644", padding: 8, fontSize: 12 }}>
                      <b>{d.team}</b><br />
                      xG: {d.xG} · Goals: {d.goals}<br />
                      <span style={{ color: d.diff >= 0 ? "#7cd992" : "#e05252" }}>
                        {d.diff >= 0 ? "+" : ""}{d.diff} vs xG
                      </span>
                    </div>
                  );
                }}
              />
              <Scatter
                data={teamXGvsGoals}
                shape={(props: any) => {
                  const { cx, cy, payload } = props;
                  const overperforming = payload.goals >= payload.xG;
                  return (
                    <g>
                      <circle cx={cx} cy={cy} r={5} fill={overperforming ? "#7cd992" : "#e05252"} opacity={0.9} />
                      <text x={cx + 8} y={cy + 4} fill="#cdd6e0" fontSize={10}>{payload.team}</text>
                    </g>
                  );
                }}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <div className="subtle">
          <span style={{ color: "#7cd992" }}>●</span> Above diagonal = scoring more than xG (clinical) &nbsp;
          <span style={{ color: "#e05252" }}>●</span> Below = scoring less than xG (wasteful)
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Big chances — created vs converted (season)</h2>
        <div style={{ height: 520 }}>
          <ResponsiveContainer>
            <BarChart data={bigChancesData} layout="vertical" margin={{ top: 10, right: 80, bottom: 10, left: 130 }}>
              <CartesianGrid stroke="#2a3644" horizontal={false} />
              <XAxis type="number" stroke="#8ea0b2" allowDecimals={false} />
              <YAxis type="category" dataKey="team" stroke="#8ea0b2" width={120} tick={{ fontSize: 11 }} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div style={{ background: "#1c2530", border: "1px solid #2a3644", padding: 8, fontSize: 12 }}>
                      <b>{d.team}</b><br />
                      Created: {d.total} big chances<br />
                      Converted: {d.Converted} ({d.convRate.toFixed(0)}%)<br />
                      Missed: {d.Missed}
                    </div>
                  );
                }}
              />
              <Legend verticalAlign="top" />
              <Bar dataKey="Converted" stackId="a" fill="#7cd992" name="Converted" />
              <Bar dataKey="Missed" stackId="a" fill="#e05252" name="Missed" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="subtle">Sorted by total big chances created. Green = converted, red = missed.</div>
      </div>
    </div>
  );
}

const AREA_COLORS = ["#4db3ff", "#7cd992", "#f5a623", "#e05252", "#b278f0", "#4ad0ce", "#e0c34a", "#ff8fa3"];
