import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  ReferenceLine,
  ResponsiveContainer,
  Sankey,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { buildScorerLeaderboard } from "../lib/derive";
import { useWorkbook } from "../store/workbook";
import { SortableTable, type Column } from "../components/SortableTable";
import type { ScorerRow } from "../lib/types";

type Tab = "goals" | "assists" | "ga" | "share";

export function Scorers() {
  const matches = useWorkbook((s) => s.matches);
  const goals = useWorkbook((s) => s.goals);
  const scorers = useMemo(() => buildScorerLeaderboard(goals, matches), [goals, matches]);
  const [tab, setTab] = useState<Tab>("goals");
  const [teamFilter, setTeamFilter] = useState<string>("");
  const [posFilter, setPosFilter] = useState<string>("");
  const [natFilter, setNatFilter] = useState<string>("");
  const [drawerPlayer, setDrawerPlayer] = useState<ScorerRow | null>(null);

  const teams = useMemo(() => Array.from(new Set(scorers.map((s) => s.team))).sort(), [scorers]);
  const positions = useMemo(() => Array.from(new Set(scorers.map((s) => s.position).filter(Boolean))).sort(), [scorers]);
  const nats = useMemo(() => Array.from(new Set(scorers.map((s) => s.nationality).filter(Boolean))).sort(), [scorers]);

  const filtered = useMemo(() => {
    return scorers
      .filter((s) => !teamFilter || s.team === teamFilter)
      .filter((s) => !posFilter || s.position === posFilter)
      .filter((s) => !natFilter || s.nationality === natFilter)
      .filter((s) => {
        if (tab === "goals") return s.goals > 0;
        if (tab === "assists") return s.assists > 0;
        if (tab === "ga") return s.goals + s.assists > 0;
        if (tab === "share") return s.goals > 0;
        return true;
      });
  }, [scorers, teamFilter, posFilter, natFilter, tab]);

  const columns: Column<ScorerRow>[] = useMemo(() => [
    { key: "player", header: "Player", value: (r) => r.player, align: "left" },
    { key: "team", header: "Team", value: (r) => r.team, align: "left" },
    { key: "goals", header: "Goals", value: (r) => r.goals, initialSort: "desc", render: (r) => <b>{r.goals}</b> },
    { key: "assists", header: "Assists", value: (r) => r.assists },
    { key: "ga", header: "G+A", value: (r) => r.goals + r.assists },
    { key: "xG", header: "xG", value: (r) => r.xG, render: (r) => r.xG.toFixed(2) },
    { key: "xGOTminusxG", header: "xGOT−xG", value: (r) => r.xGOTminusxG, render: (r) => (r.xGOTminusxG > 0 ? "+" : "") + r.xGOTminusxG.toFixed(2) },
    { key: "teamGoalShare", header: "Team %", value: (r) => r.teamGoalShare, render: (r) => (r.teamGoalShare * 100).toFixed(1) + "%" },
    { key: "penalties", header: "Pens", value: (r) => r.penalties },
  ], []);

  const defaultSort =
    tab === "assists" ? { key: "assists", dir: "desc" as const } :
    tab === "ga" ? { key: "ga", dir: "desc" as const } :
    tab === "share" ? { key: "teamGoalShare", dir: "desc" as const } :
    { key: "goals", dir: "desc" as const };

  return (
    <div>
      <div className="card">
        <h2 className="card-title">Scorer Leaderboards</h2>
        <div className="tabs">
          <button className={`tab ${tab === "goals" ? "active" : ""}`} onClick={() => setTab("goals")}>Goals</button>
          <button className={`tab ${tab === "assists" ? "active" : ""}`} onClick={() => setTab("assists")}>Assists</button>
          <button className={`tab ${tab === "ga" ? "active" : ""}`} onClick={() => setTab("ga")}>G + A</button>
          <button className={`tab ${tab === "share" ? "active" : ""}`} onClick={() => setTab("share")}>Team Goal Share</button>
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
            <option value="">All teams</option>
            {teams.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={posFilter} onChange={(e) => setPosFilter(e.target.value)}>
            <option value="">All positions</option>
            {positions.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={natFilter} onChange={(e) => setNatFilter(e.target.value)}>
            <option value="">All nationalities</option>
            {nats.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <SortableTable
          rows={filtered}
          columns={columns}
          defaultSort={defaultSort}
          getRowKey={(r) => `${r.player}__${r.team}`}
          onRowClick={(r) => setDrawerPlayer(r)}
        />
      </div>

      <XGVsGoalsScatter scorers={scorers} />
      <XGOTBarChart scorers={scorers} />
      <AssistScorerSankey scorers={scorers} />

      {drawerPlayer && <PlayerDrawer player={drawerPlayer} onClose={() => setDrawerPlayer(null)} />}
    </div>
  );
}

function XGVsGoalsScatter({ scorers }: { scorers: ScorerRow[] }) {
  const data = scorers
    .filter((s) => s.goals >= 3)
    .map((s) => ({ player: s.player, team: s.team, xG: s.xG, goals: s.goals }));
  const max = Math.max(...data.map((d) => Math.max(d.goals, d.xG)), 5) + 1;
  return (
    <div className="card">
      <h2 className="card-title">xG vs Goals (players with ≥ 3 goals)</h2>
      <div className="chart-wrap">
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 10, right: 30, bottom: 40, left: 40 }}>
            <CartesianGrid stroke="#2a3644" />
            <XAxis type="number" dataKey="xG" domain={[0, max]} stroke="#8ea0b2">
              <Label value="xG" position="insideBottom" offset={-20} fill="#8ea0b2" />
            </XAxis>
            <YAxis type="number" dataKey="goals" domain={[0, max]} stroke="#8ea0b2">
              <Label value="Goals" angle={-90} position="insideLeft" fill="#8ea0b2" />
            </YAxis>
            <ReferenceLine segment={[{ x: 0, y: 0 }, { x: max, y: max }]} stroke="#6b7785" strokeDasharray="4 4" />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const d = payload[0].payload;
                return (
                  <div style={{ background: "#1c2530", border: "1px solid #2a3644", padding: 8, fontSize: 12 }}>
                    <b>{d.player}</b> ({d.team})<br />
                    Goals: {d.goals} / xG {d.xG.toFixed(2)}<br />
                    Diff: {(d.goals - d.xG).toFixed(2)}
                  </div>
                );
              }}
            />
            <Scatter data={data} fill="#4db3ff" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function XGOTBarChart({ scorers }: { scorers: ScorerRow[] }) {
  const top = [...scorers].filter((s) => s.goals >= 3).sort((a, b) => b.xGOTminusxG - a.xGOTminusxG).slice(0, 10);
  const bottom = [...scorers].filter((s) => s.goals >= 3).sort((a, b) => a.xGOTminusxG - b.xGOTminusxG).slice(0, 10).reverse();
  const data = [...bottom, ...top].map((s) => ({ player: `${s.player}`, val: s.xGOTminusxG, team: s.team }));
  return (
    <div className="card">
      <h2 className="card-title">Shot quality after contact (xGOT − xG)</h2>
      <div className="chart-wrap">
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ top: 10, right: 30, bottom: 10, left: 120 }}>
            <CartesianGrid stroke="#2a3644" horizontal={false} />
            <XAxis type="number" stroke="#8ea0b2" />
            <YAxis type="category" dataKey="player" stroke="#8ea0b2" width={110} tick={{ fontSize: 11 }} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const d = payload[0].payload;
                return (
                  <div style={{ background: "#1c2530", border: "1px solid #2a3644", padding: 8, fontSize: 12 }}>
                    <b>{d.player}</b> ({d.team})<br />
                    xGOT − xG: {d.val.toFixed(2)}
                  </div>
                );
              }}
            />
            <Bar dataKey="val">
              {data.map((d, i) => (
                <Cell key={i} fill={d.val >= 0 ? "#7cd992" : "#e05252"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function AssistScorerSankey({ scorers }: { scorers: ScorerRow[] }) {
  const matches = useWorkbook((s) => s.matches);
  const goalsData = useWorkbook((s) => s.goals);
  void matches;

  const pairs = useMemo(() => {
    const map = new Map<string, number>();
    for (const g of goalsData) {
      if (g.GoalOG !== "G" || !g.Assist) continue;
      const key = `${g.Assist}|||${g.Scorer}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([k, v]) => {
        const [assist, scorer] = k.split("|||");
        return { assist, scorer, value: v };
      })
      .filter((p) => p.value >= 2)
      .sort((a, b) => b.value - a.value)
      .slice(0, 30);
  }, [goalsData]);

  const { nodes, links } = useMemo(() => {
    const assists = Array.from(new Set(pairs.map((p) => p.assist)));
    const scorersList = Array.from(new Set(pairs.map((p) => p.scorer)));
    const nodes = [
      ...assists.map((a) => ({ name: `${a} (A)` })),
      ...scorersList.map((s) => ({ name: `${s} (G)` })),
    ];
    const aIdx = new Map(assists.map((a, i) => [a, i]));
    const sIdx = new Map(scorersList.map((s, i) => [s, assists.length + i]));
    const links = pairs.map((p) => ({
      source: aIdx.get(p.assist)!,
      target: sIdx.get(p.scorer)!,
      value: p.value,
    }));
    return { nodes, links };
  }, [pairs]);

  if (nodes.length === 0) return null;

  return (
    <div className="card">
      <h2 className="card-title">Assist → Scorer partnerships (top pairs with ≥ 2 goals)</h2>
      <div style={{ width: "100%", height: Math.max(300, nodes.length * 14) }}>
        <ResponsiveContainer>
          <Sankey
            data={{ nodes, links }}
            nodeWidth={12}
            nodePadding={6}
            link={{ stroke: "#4db3ff", strokeOpacity: 0.35 }}
            node={{ stroke: "#4db3ff", fill: "#1c2530" }}
            margin={{ top: 10, right: 160, bottom: 10, left: 160 }}
          >
            <Tooltip />
          </Sankey>
        </ResponsiveContainer>
      </div>
      {/* unused hint to avoid "scorers" lint-only-imports */}
      <span style={{ display: "none" }}>{scorers.length}</span>
    </div>
  );
}

function PlayerDrawer({ player, onClose }: { player: ScorerRow; onClose: () => void }) {
  return (
    <div className="drawer">
      <button className="close" onClick={onClose}>×</button>
      <h2 style={{ marginTop: 0 }}>{player.player}</h2>
      <div className="subtle">{player.team} · {player.position || "—"} · {player.nationality || "—"}</div>
      <div className="stat-grid" style={{ marginTop: 16 }}>
        <Tile label="Goals" value={player.goals} />
        <Tile label="Assists" value={player.assists} />
        <Tile label="xG" value={player.xG.toFixed(2)} />
        <Tile label="Team %" value={(player.teamGoalShare * 100).toFixed(1) + "%"} />
        <Tile label="Penalties" value={player.penalties} />
        <Tile label="Tie Breakers" value={player.tieBreakers} />
        <Tile label="Equalizers" value={player.equalizers} />
        <Tile label="When Trailing" value={player.goalsWhenTrailing} />
        <Tile label="Home Goals" value={player.homeGoals} />
        <Tile label="Away Goals" value={player.awayGoals} />
        <Tile label="Match Openers" value={player.matchOpeners} />
        <Tile label="Team Openers" value={player.teamOpeners} />
      </div>
      <h3 style={{ marginTop: 20 }}>Goal log</h3>
      <table className="stat-table">
        <thead>
          <tr>
            <th>GW</th><th>Opp</th><th>H/A</th><th>Min</th><th>Situation</th><th>xG</th><th>▶</th>
          </tr>
        </thead>
        <tbody>
          {player.goalLog.map((g, i) => (
            <tr key={i}>
              <td>{g.gameweek}</td>
              <td>{g.against}</td>
              <td>{g.homeAway}</td>
              <td>{g.minute}{g.addedTime ? `+${g.addedTime}` : ""}</td>
              <td>{g.situation}</td>
              <td>{g.xG?.toFixed(2) ?? "—"}</td>
              <td>{g.video ? <a href={g.video} target="_blank" rel="noreferrer">▶</a> : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="stat-tile">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}
