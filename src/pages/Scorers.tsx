import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { buildScorerLeaderboard, getTeams } from "../lib/derive";
import { useWorkbook } from "../store/workbook";
import { SortableTable, type Column } from "../components/SortableTable";
import type { Goal, Match, ScorerRow } from "../lib/types";

const SITUATION_COLORS: Record<string, string> = {
  Regular: "#4db3ff",
  Corner: "#7cd992",
  "Free Kick": "#f5a623",
  Penalty: "#e05252",
  "Other Set-Piece Goals": "#b07fff",
};

function situationBucket(sit: string): string {
  const s = sit.trim();
  if (s === "Regular") return "Regular";
  if (s === "Corner") return "Corner";
  if (/free.?kick/i.test(s)) return "Free Kick";
  if (/penalty/i.test(s)) return "Penalty";
  return "Other Set-Piece Goals";
}

const MINUTE_BUCKETS = ["0–15", "15–30", "30–45", "45–60", "60–75", "75–90", "90+"];
function minuteBucket(t: number): string {
  if (t <= 15) return "0–15";
  if (t <= 30) return "15–30";
  if (t <= 45) return "30–45";
  if (t <= 60) return "45–60";
  if (t <= 75) return "60–75";
  if (t <= 90) return "75–90";
  return "90+";
}

export function Scorers() {
  const matches = useWorkbook((s) => s.matches);
  const goals = useWorkbook((s) => s.goals);
  const scorers = useMemo(() => buildScorerLeaderboard(goals, matches), [goals, matches]);

  const [teamFilter, setTeamFilter] = useState("");
  const [posFilter, setPosFilter] = useState("");
  const [natFilter, setNatFilter] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [drawerPlayer, setDrawerPlayer] = useState<ScorerRow | null>(null);
  const [histPlayer, setHistPlayer] = useState("");
  const [histTeam, setHistTeam] = useState("");

  const teams = useMemo(() => Array.from(new Set(scorers.map((s) => s.team))).sort(), [scorers]);
  const positions = useMemo(() => Array.from(new Set(scorers.map((s) => s.position).filter(Boolean))).sort(), [scorers]);
  const nats = useMemo(() => Array.from(new Set(scorers.map((s) => s.nationality).filter(Boolean))).sort(), [scorers]);

  const filtered = useMemo(() =>
    scorers
      .filter((s) => s.goals > 0)
      .filter((s) => !teamFilter || s.team === teamFilter)
      .filter((s) => !posFilter || s.position === posFilter)
      .filter((s) => !natFilter || s.nationality === natFilter),
    [scorers, teamFilter, posFilter, natFilter]
  );

  const displayed = showAll ? filtered : filtered.slice(0, 10);

  const columns: Column<ScorerRow>[] = useMemo(() => [
    { key: "player", header: "Player", value: (r) => r.player, align: "left" },
    { key: "team", header: "Team", value: (r) => r.team, align: "left" },
    { key: "goals", header: "Goals", value: (r) => r.goals, initialSort: "desc", render: (r) => <b>{r.goals}</b> },
    { key: "assists", header: "Assists", value: (r) => r.assists },
    { key: "teamGoalShare", header: "Team %", value: (r) => r.teamGoalShare, render: (r) => (r.teamGoalShare * 100).toFixed(1) + "%" },
    { key: "penalties", header: "Pens", value: (r) => r.penalties },
    { key: "homeGoals", header: "Home", value: (r) => r.homeGoals },
    { key: "awayGoals", header: "Away", value: (r) => r.awayGoals },
    { key: "firstHalfGoals", header: "1st Half", value: (r) => r.firstHalfGoals },
    { key: "secondHalfGoals", header: "2nd Half", value: (r) => r.secondHalfGoals },
  ], []);

  return (
    <div>
      <div className="card">
        <h2 className="card-title">Scorer Leaderboards</h2>
        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
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
          rows={displayed}
          columns={columns}
          defaultSort={{ key: "goals", dir: "desc" }}
          getRowKey={(r) => `${r.player}__${r.team}`}
          onRowClick={(r) => setDrawerPlayer(r)}
        />
        <div style={{ marginTop: 10, textAlign: "center" }}>
          <button className="tab" onClick={() => setShowAll((v) => !v)}>
            {showAll ? `Show top 10 (${filtered.length} total)` : `Show all ${filtered.length} scorers`}
          </button>
        </div>
      </div>

      <SituationBreakdown scorers={filtered.slice(0, 10)} />
      <ConsistencyHeatmap scorers={filtered.slice(0, 10)} />
      <HomeAwayBar scorers={filtered.slice(0, 10)} />
      <HalfBar scorers={filtered.slice(0, 10)} />
      <GoalMinuteHistogram
        goals={goals}
        players={scorers.map((s) => s.player)}
        teams={getTeams(matches)}
        selectedPlayer={histPlayer}
        selectedTeam={histTeam}
        onPlayerChange={setHistPlayer}
        onTeamChange={setHistTeam}
      />

      {drawerPlayer && <PlayerDrawer player={drawerPlayer} onClose={() => setDrawerPlayer(null)} />}
    </div>
  );
}

function SituationBreakdown({ scorers }: { scorers: ScorerRow[] }) {
  const goals = useWorkbook((s) => s.goals);
  const data = useMemo(() => {
    return scorers.map((s) => {
      const playerGoals = goals.filter((g) => g.Scorer === s.player && g.Team === s.team && g.GoalOG === "G");
      const row: Record<string, unknown> = { player: s.player };
      for (const g of playerGoals) {
        const b = situationBucket(g.Situation);
        row[b] = ((row[b] as number) ?? 0) + 1;
      }
      return row;
    });
  }, [scorers, goals]);

  const buckets = Object.keys(SITUATION_COLORS);

  return (
    <div className="card">
      <h2 className="card-title">Goal breakdown by situation (top 10)</h2>
      <div className="chart-wrap">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 10, right: 20, bottom: 60, left: 10 }}>
            <CartesianGrid stroke="#2a3644" />
            <XAxis dataKey="player" stroke="#8ea0b2" angle={-35} textAnchor="end" tick={{ fontSize: 11 }} interval={0} />
            <YAxis stroke="#8ea0b2" allowDecimals={false} />
            <Tooltip />
            <Legend />
            {buckets.map((b) => (
              <Bar key={b} dataKey={b} stackId="a" fill={SITUATION_COLORS[b]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ConsistencyHeatmap({ scorers }: { scorers: ScorerRow[]; matches?: Match[] }) {
  const maxGW = useMemo(() =>
    Math.max(0, ...scorers.flatMap((s) => s.goalLog.map((g) => g.gameweek))),
    [scorers]
  );
  const gws = useMemo(() => Array.from({ length: maxGW }, (_, i) => i + 1), [maxGW]);

  const grid = useMemo(() =>
    scorers.map((s) => {
      const byGW = new Map<number, number>();
      for (const g of s.goalLog) byGW.set(g.gameweek, (byGW.get(g.gameweek) ?? 0) + 1);
      return { player: s.player, byGW };
    }),
    [scorers]
  );

  if (gws.length === 0) return null;

  return (
    <div className="card">
      <h2 className="card-title">Scoring consistency (top 10 — by gameweek)</h2>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", fontSize: 12, minWidth: 600 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "4px 8px", color: "#8ea0b2", position: "sticky", left: 0, background: "#151e28" }}>Player</th>
              {gws.map((gw) => (
                <th key={gw} style={{ padding: "4px 6px", color: "#8ea0b2", minWidth: 28, textAlign: "center" }}>GW{gw}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map(({ player, byGW }) => (
              <tr key={player}>
                <td style={{ padding: "4px 8px", color: "#cdd6e0", whiteSpace: "nowrap", position: "sticky", left: 0, background: "#151e28" }}>{player}</td>
                {gws.map((gw) => {
                  const n = byGW.get(gw) ?? 0;
                  const bg = n === 0 ? "#1c2530" : n === 1 ? "#1a5276" : n === 2 ? "#2471a3" : "#4db3ff";
                  return (
                    <td key={gw} style={{ background: bg, padding: "4px 6px", textAlign: "center", color: n > 0 ? "#fff" : "transparent", border: "1px solid #151e28" }}>
                      {n > 0 ? n : "·"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HomeAwayBar({ scorers }: { scorers: ScorerRow[] }) {
  const data = scorers.map((s) => ({ player: s.player, Home: s.homeGoals, Away: s.awayGoals }));
  return (
    <div className="card">
      <h2 className="card-title">Home vs Away goals (top 10)</h2>
      <div className="chart-wrap">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 10, right: 20, bottom: 60, left: 10 }}>
            <CartesianGrid stroke="#2a3644" />
            <XAxis dataKey="player" stroke="#8ea0b2" angle={-35} textAnchor="end" tick={{ fontSize: 11 }} interval={0} />
            <YAxis stroke="#8ea0b2" allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Bar dataKey="Home" fill="#4db3ff" />
            <Bar dataKey="Away" fill="#7cd992" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function HalfBar({ scorers }: { scorers: ScorerRow[] }) {
  const data = scorers.map((s) => ({ player: s.player, "1st Half": s.firstHalfGoals, "2nd Half": s.secondHalfGoals }));
  return (
    <div className="card">
      <h2 className="card-title">First half vs Second half goals (top 10)</h2>
      <div className="chart-wrap">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 10, right: 20, bottom: 60, left: 10 }}>
            <CartesianGrid stroke="#2a3644" />
            <XAxis dataKey="player" stroke="#8ea0b2" angle={-35} textAnchor="end" tick={{ fontSize: 11 }} interval={0} />
            <YAxis stroke="#8ea0b2" allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Bar dataKey="1st Half" fill="#4db3ff" />
            <Bar dataKey="2nd Half" fill="#f5a623" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function GoalMinuteHistogram({ goals, players, teams, selectedPlayer, selectedTeam, onPlayerChange, onTeamChange }: {
  goals: Goal[];
  players: string[];
  teams: string[];
  selectedPlayer: string;
  selectedTeam: string;
  onPlayerChange: (v: string) => void;
  onTeamChange: (v: string) => void;
}) {
  const data = useMemo(() => {
    const filtered = goals.filter((g) => {
      if (g.GoalOG !== "G") return false;
      if (selectedPlayer && g.Scorer !== selectedPlayer) return false;
      if (selectedTeam && g.Team !== selectedTeam) return false;
      return true;
    });
    const counts: Record<string, number> = Object.fromEntries(MINUTE_BUCKETS.map((b) => [b, 0]));
    for (const g of filtered) counts[minuteBucket(g.GoalTime)]++;
    return MINUTE_BUCKETS.map((b) => ({ minute: b, Goals: counts[b] }));
  }, [goals, selectedPlayer, selectedTeam]);

  return (
    <div className="card">
      <h2 className="card-title">Goal-minute distribution</h2>
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <select value={selectedPlayer} onChange={(e) => { onPlayerChange(e.target.value); onTeamChange(""); }}>
          <option value="">All players</option>
          {players.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={selectedTeam} onChange={(e) => { onTeamChange(e.target.value); onPlayerChange(""); }}>
          <option value="">All teams</option>
          {teams.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div className="chart-wrap">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
            <CartesianGrid stroke="#2a3644" />
            <XAxis dataKey="minute" stroke="#8ea0b2" />
            <YAxis stroke="#8ea0b2" allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="Goals" fill="#4db3ff">
              {data.map((_, i) => <Cell key={i} fill={i < 3 ? "#4db3ff" : i < 6 ? "#7cd992" : "#f5a623"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
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
        <Tile label="Team %" value={(player.teamGoalShare * 100).toFixed(1) + "%"} />
        <Tile label="Penalties" value={player.penalties} />
        <Tile label="Tie Breakers" value={player.tieBreakers} />
        <Tile label="Equalizers" value={player.equalizers} />
        <Tile label="When Trailing" value={player.goalsWhenTrailing} />
        <Tile label="Home Goals" value={player.homeGoals} />
        <Tile label="Away Goals" value={player.awayGoals} />
        <Tile label="1st Half" value={player.firstHalfGoals} />
        <Tile label="2nd Half" value={player.secondHalfGoals} />
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
