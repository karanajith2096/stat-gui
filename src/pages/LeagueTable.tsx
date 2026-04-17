import { useMemo } from "react";
import {
  CartesianGrid,
  Label,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { buildStandings, getTeams, matchesFor, resultFor } from "../lib/derive";
import { useWorkbook } from "../store/workbook";
import { SortableTable, type Column } from "../components/SortableTable";
import { FormPills } from "../components/FormPills";
import type { TableRow } from "../lib/types";
import { Link } from "react-router-dom";

const fmt1 = (n: number) => n.toFixed(1);
const fmt2 = (n: number) => n.toFixed(2);

export function LeagueTable() {
  const matches = useWorkbook((s) => s.matches);
  const standings = useMemo(() => buildStandings(matches), [matches]);

  const columns: Column<TableRow>[] = useMemo(() => [
    { key: "position", header: "#", value: (r) => r.position, align: "left" },
    {
      key: "team", header: "Team", value: (r) => r.team, align: "left",
      render: (r) => <Link to={`/team/${encodeURIComponent(r.team)}`}>{r.team}</Link>,
    },
    { key: "games", header: "GP", value: (r) => r.games },
    { key: "wins", header: "W", value: (r) => r.wins },
    { key: "draws", header: "D", value: (r) => r.draws },
    { key: "losses", header: "L", value: (r) => r.losses },
    { key: "points", header: "Pts", value: (r) => r.points, render: (r) => <b>{r.points}</b> },
    { key: "gf", header: "GF", value: (r) => r.gf },
    { key: "ga", header: "GA", value: (r) => r.ga },
    { key: "gd", header: "GD", value: (r) => r.gd, render: (r) => (r.gd > 0 ? `+${r.gd}` : r.gd) },
    { key: "xG", header: "xG", value: (r) => r.xG, render: (r) => fmt1(r.xG) },
    { key: "xGA", header: "xGA", value: (r) => r.xGA, render: (r) => fmt1(r.xGA) },
    { key: "xGDiff", header: "xG−xGA", value: (r) => r.xGDiff, render: (r) => (r.xGDiff > 0 ? "+" : "") + fmt1(r.xGDiff) },
    { key: "ppg", header: "PPG", value: (r) => r.ppg, render: (r) => fmt2(r.ppg) },
    { key: "xPts", header: "xPts", value: (r) => r.xPts, render: (r) => fmt1(r.xPts) },
    { key: "xRank", header: "xRank", value: (r) => r.xRank },
    { key: "lastFivePoints", header: "Last 5", value: (r) => r.lastFivePoints },
    {
      key: "lastFiveForm", header: "Form",
      sortable: false,
      render: (r) => <FormPills form={r.lastFiveForm} />,
    },
  ], []);

  return (
    <div>
      <div className="card">
        <h2 className="card-title">League Table</h2>
        <SortableTable
          rows={standings}
          columns={columns}
          defaultSort={{ key: "position", dir: "asc" }}
          getRowKey={(r) => r.team}
        />
      </div>

      <XPtsScatter standings={standings} />
      <AttackDefenseQuadrant standings={standings} />
      <FormHeatmap />
    </div>
  );
}

function XPtsScatter({ standings }: { standings: TableRow[] }) {
  const data = standings.map((r) => ({ team: r.team, xPts: r.xPts, pts: r.points, games: r.games }));
  const max = Math.max(...data.map((d) => Math.max(d.xPts, d.pts))) + 2;
  return (
    <div className="card">
      <h2 className="card-title">xPts vs Points — over/under-performers</h2>
      <div className="chart-wrap">
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 10, right: 30, bottom: 40, left: 40 }}>
            <CartesianGrid stroke="#2a3644" />
            <XAxis type="number" dataKey="xPts" domain={[0, max]} stroke="#8ea0b2">
              <Label value="Expected Points (xPts)" position="insideBottom" offset={-20} fill="#8ea0b2" />
            </XAxis>
            <YAxis type="number" dataKey="pts" domain={[0, max]} stroke="#8ea0b2">
              <Label value="Actual Points" angle={-90} position="insideLeft" fill="#8ea0b2" />
            </YAxis>
            <ReferenceLine segment={[{ x: 0, y: 0 }, { x: max, y: max }]} stroke="#6b7785" strokeDasharray="4 4" />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const d = payload[0].payload;
                return (
                  <div style={{ background: "#1c2530", border: "1px solid #2a3644", padding: 8, fontSize: 12 }}>
                    <b>{d.team}</b><br />
                    Points: {d.pts}<br />
                    xPts: {d.xPts.toFixed(2)}<br />
                    Diff: {(d.pts - d.xPts).toFixed(2)}
                  </div>
                );
              }}
            />
            <Scatter data={data} fill="#4db3ff" shape="circle">
              {/* Labels are expensive to render; skip for clarity */}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div className="subtle">Above the diagonal = out-performing xPts; below = under-performing.</div>
    </div>
  );
}

function AttackDefenseQuadrant({ standings }: { standings: TableRow[] }) {
  const data = standings.map((r) => ({
    team: r.team,
    xGPerGame: r.games > 0 ? r.xG / r.games : 0,
    xGAPerGame: r.games > 0 ? r.xGA / r.games : 0,
  }));
  const avgAtk = data.reduce((s, d) => s + d.xGPerGame, 0) / data.length;
  const avgDef = data.reduce((s, d) => s + d.xGAPerGame, 0) / data.length;
  return (
    <div className="card">
      <h2 className="card-title">Attack vs Defense (xG per game)</h2>
      <div className="chart-wrap">
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 10, right: 30, bottom: 40, left: 40 }}>
            <CartesianGrid stroke="#2a3644" />
            <XAxis type="number" dataKey="xGPerGame" stroke="#8ea0b2">
              <Label value="xG per game (attack →)" position="insideBottom" offset={-20} fill="#8ea0b2" />
            </XAxis>
            <YAxis type="number" dataKey="xGAPerGame" stroke="#8ea0b2" reversed>
              <Label value="xGA per game (defense ↑)" angle={-90} position="insideLeft" fill="#8ea0b2" />
            </YAxis>
            <ReferenceLine x={avgAtk} stroke="#6b7785" strokeDasharray="4 4" />
            <ReferenceLine y={avgDef} stroke="#6b7785" strokeDasharray="4 4" />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const d = payload[0].payload;
                return (
                  <div style={{ background: "#1c2530", border: "1px solid #2a3644", padding: 8, fontSize: 12 }}>
                    <b>{d.team}</b><br />
                    xG/game: {d.xGPerGame.toFixed(2)}<br />
                    xGA/game: {d.xGAPerGame.toFixed(2)}
                  </div>
                );
              }}
            />
            <Scatter data={data} fill="#7cd992" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div className="subtle">Top-right is elite (high xG, low xGA); bottom-left is relegation-flavored.</div>
    </div>
  );
}

function FormHeatmap() {
  const matches = useWorkbook((s) => s.matches);
  const teams = useMemo(() => {
    const s = buildStandings(matches);
    return s.map((r) => r.team);
  }, [matches]);
  const maxGW = useMemo(() => matches.reduce((mx, m) => Math.max(mx, m.Gameweek), 0), [matches]);
  const matrix = useMemo(() => {
    return teams.map((team) => {
      const ms = matchesFor(matches, team);
      const byGW = new Map<number, "W" | "D" | "L">();
      ms.forEach((m) => byGW.set(m.Gameweek, resultFor(m, team)));
      return { team, cells: Array.from({ length: maxGW }, (_, i) => byGW.get(i + 1) ?? null) };
    });
  }, [teams, matches, maxGW]);

  return (
    <div className="card">
      <h2 className="card-title">Form heatmap (W / D / L per gameweek)</h2>
      <div className="heatmap">
        <div className="heatmap-row" style={{ gridTemplateColumns: `140px repeat(${maxGW}, 18px)` }}>
          <div className="heatmap-label" />
          {Array.from({ length: maxGW }, (_, i) => (
            <div key={i} className="subtle" style={{ width: 18, textAlign: "center", fontSize: 10 }}>{i + 1}</div>
          ))}
        </div>
        {matrix.map((row) => (
          <div key={row.team} className="heatmap-row" style={{ gridTemplateColumns: `140px repeat(${maxGW}, 18px)` }}>
            <div className="heatmap-label">{row.team}</div>
            {row.cells.map((c, i) => (
              <div key={i} className={`heatmap-cell ${c ?? "none"}`} title={`GW${i + 1}: ${c ?? "–"}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
