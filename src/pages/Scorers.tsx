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

const MINUTE_BUCKETS = ["0–15", "16–30", "31–45", "45+ET", "46–60", "61–75", "76–90", "90+ET"];

const BUCKET_COLORS: Record<string, string> = {
  "0–15":   "#4db3ff",
  "16–30":  "#4db3ff",
  "31–45":  "#4db3ff",
  "45+ET":  "#b278f0",
  "46–60":  "#7cd992",
  "61–75":  "#7cd992",
  "76–90":  "#7cd992",
  "90+ET":  "#f5a623",
};

function minuteBucket(goalTime: number, addedTime: number | null): string {
  const isET = addedTime != null && addedTime > 0;
  if (goalTime === 45 && isET) return "45+ET";
  if (goalTime >= 90 && isET) return "90+ET";
  if (goalTime > 90) return "90+ET";
  if (goalTime <= 15) return "0–15";
  if (goalTime <= 30) return "16–30";
  if (goalTime <= 45) return "31–45";
  if (goalTime <= 60) return "46–60";
  if (goalTime <= 75) return "61–75";
  return "76–90";
}

const PAGE_SIZE = 15;
type SortMode = "goals" | "assists" | "combined";

export function Scorers() {
  const matches = useWorkbook((s) => s.matches);
  const goals = useWorkbook((s) => s.goals);
  const scorers = useMemo(() => buildScorerLeaderboard(goals, matches), [goals, matches]);

  const [teamFilter, setTeamFilter] = useState("");
  const [posFilter, setPosFilter] = useState("");
  const [natFilter, setNatFilter] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("goals");
  const [tableSort, setTableSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "goals", dir: "desc" });
  const [page, setPage] = useState(1);
  const [drawerPlayer, setDrawerPlayer] = useState<ScorerRow | null>(null);
  const [histPlayer, setHistPlayer] = useState("");
  const [histTeam, setHistTeam] = useState("");

  const teams = useMemo(() => Array.from(new Set(scorers.map((s) => s.team))).sort(), [scorers]);
  const positions = useMemo(() => Array.from(new Set(scorers.map((s) => s.position).filter(Boolean))).sort(), [scorers]);
  const nats = useMemo(() => Array.from(new Set(scorers.map((s) => s.nationality).filter(Boolean))).sort(), [scorers]);

  const filtered = useMemo(() => {
    return scorers
      .filter((s) => s.goals > 0 || (sortMode === "assists" && s.assists > 0))
      .filter((s) => !teamFilter || s.team === teamFilter)
      .filter((s) => !posFilter || s.position === posFilter)
      .filter((s) => !natFilter || s.nationality === natFilter);
  }, [scorers, teamFilter, posFilter, natFilter, sortMode]);

  // Reset to page 1 when filters or sort change
  const handleFilterChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    setter(e.target.value);
    setPage(1);
  };
  const handleSortMode = (mode: SortMode) => {
    setSortMode(mode);
    setPage(1);
    const key = mode === "goals" ? "goals" : mode === "assists" ? "assists" : "combined";
    setTableSort({ key, dir: "desc" });
  };

  const columns: Column<ScorerRow>[] = useMemo(() => [
    {
      key: "player", header: "Player", value: (r) => r.player, align: "left",
      render: (r) => (
        <span style={{ color: "#4db3ff", textDecoration: "underline", cursor: "pointer" }}>
          {r.player}
        </span>
      ),
    },
    { key: "team", header: "Team", value: (r) => r.team, align: "left" },
    { key: "goals", header: "Goals", value: (r) => r.goals, render: (r) => <b>{r.goals}</b> },
    { key: "assists", header: "Assists", value: (r) => r.assists },
    { key: "combined", header: "G+A", value: (r) => r.goals + r.assists, render: (r) => r.goals + r.assists },
    { key: "teamGoalShare", header: "G+A %", value: (r) => r.teamGoalShare, render: (r) => (r.teamGoalShare * 100).toFixed(1) + "%", },
    { key: "penalties", header: "Pens", value: (r) => r.penalties },
    { key: "homeGoals", header: "Home", value: (r) => r.homeGoals },
    { key: "awayGoals", header: "Away", value: (r) => r.awayGoals },
    { key: "firstHalfGoals", header: "1st Half", value: (r) => r.firstHalfGoals },
    { key: "secondHalfGoals", header: "2nd Half", value: (r) => r.secondHalfGoals },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], []);

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === tableSort.key);
    if (!col?.value) return filtered;
    const valueOf = col.value;
    return filtered.slice().sort((a, b) => {
      const va = valueOf(a), vb = valueOf(b);
      if (typeof va === "number" && typeof vb === "number")
        return tableSort.dir === "asc" ? va - vb : vb - va;
      return tableSort.dir === "asc"
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va));
    });
  }, [filtered, columns, tableSort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const displayed = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const pageWindow = useMemo(() => {
    const pages: number[] = [];
    const start = Math.max(1, safePage - 2);
    const end = Math.min(totalPages, safePage + 2);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }, [safePage, totalPages]);

  return (
    <div>
      <div className="card">
        <h2 className="card-title">Scorer Leaderboards</h2>

        {/* Sort tabs */}
        <div className="tabs" style={{ borderBottom: "none", marginBottom: 12 }}>
          {(["goals", "assists", "combined"] as SortMode[]).map((m) => (
            <button
              key={m}
              className={`tab ${sortMode === m ? "active" : ""}`}
              onClick={() => handleSortMode(m)}
            >
              {m === "goals" ? "Goals" : m === "assists" ? "Assists" : "Goals + Assists"}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          <select value={teamFilter} onChange={handleFilterChange(setTeamFilter)}>
            <option value="">All teams</option>
            {teams.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={posFilter} onChange={handleFilterChange(setPosFilter)}>
            <option value="">All positions</option>
            {positions.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={natFilter} onChange={handleFilterChange(setNatFilter)}>
            <option value="">All nationalities</option>
            {nats.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        <SortableTable
          rows={displayed}
          columns={columns}
          sort={tableSort}
          onSortChange={(s) => { setTableSort(s); setPage(1); }}
          getRowKey={(r) => `${r.player}__${r.team}`}
          onRowClick={(r) => setDrawerPlayer(r)}
        />

        {/* Pagination */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14, flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontSize: 12, color: "#8ea0b2" }}>
            {filtered.length} players · page {safePage} of {totalPages}
          </span>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <button
              onClick={() => setPage(1)}
              disabled={safePage === 1}
              style={pagerBtn(safePage === 1)}
            >«</button>
            <button
              onClick={() => setPage(safePage - 1)}
              disabled={safePage === 1}
              style={pagerBtn(safePage === 1)}
            >‹</button>
            {pageWindow.map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                style={pagerBtn(false, p === safePage)}
              >{p}</button>
            ))}
            <button
              onClick={() => setPage(safePage + 1)}
              disabled={safePage === totalPages}
              style={pagerBtn(safePage === totalPages)}
            >›</button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={safePage === totalPages}
              style={pagerBtn(safePage === totalPages)}
            >»</button>
          </div>
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
          <BarChart data={data} margin={{ top: 40, right: 20, bottom: 80, left: 10 }}>
            <CartesianGrid stroke="#2a3644" />
            <XAxis dataKey="player" stroke="#8ea0b2" angle={-35} textAnchor="end" tick={{ fontSize: 11 }} interval={0} />
            <YAxis stroke="#8ea0b2" allowDecimals={false} />
            <Tooltip />
            <Legend verticalAlign="top" />
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
          <BarChart data={data} margin={{ top: 40, right: 20, bottom: 80, left: 10 }}>
            <CartesianGrid stroke="#2a3644" />
            <XAxis dataKey="player" stroke="#8ea0b2" angle={-35} textAnchor="end" tick={{ fontSize: 11 }} interval={0} />
            <YAxis stroke="#8ea0b2" allowDecimals={false} />
            <Tooltip />
            <Legend verticalAlign="top" />
            <Bar dataKey="Home" fill="#4db3ff" />
            <Bar dataKey="Away" fill="#7cd992" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function HalfBar({ scorers }: { scorers: ScorerRow[] }) {
  const data = scorers.map((s) => ({
    player: s.player,
    "1st Half": s.firstHalfGoals - s.firstHalfETGoals,
    "1st Half ET": s.firstHalfETGoals,
    "2nd Half": s.secondHalfGoals - s.secondHalfETGoals,
    "2nd Half ET": s.secondHalfETGoals,
  }));
  return (
    <div className="card">
      <h2 className="card-title">First half vs Second half goals (top 10)</h2>
      <div className="chart-wrap">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 40, right: 20, bottom: 80, left: 10 }}>
            <CartesianGrid stroke="#2a3644" />
            <XAxis dataKey="player" stroke="#8ea0b2" angle={-35} textAnchor="end" tick={{ fontSize: 11 }} interval={0} />
            <YAxis stroke="#8ea0b2" allowDecimals={false} />
            <Tooltip />
            <Legend verticalAlign="top" />
            <Bar dataKey="1st Half" stackId="first" fill="#4db3ff" />
            <Bar dataKey="1st Half ET" stackId="first" fill="#1a5e8a" />
            <Bar dataKey="2nd Half" stackId="second" fill="#f5a623" />
            <Bar dataKey="2nd Half ET" stackId="second" fill="#a0620a" />
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
    for (const g of filtered) counts[minuteBucket(g.GoalTime, g.AddedTime)]++;
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
            <Tooltip formatter={(v: number) => [v, "Goals"]} />
            <Bar dataKey="Goals" fill="#4db3ff">
              {data.map((d) => <Cell key={d.minute} fill={BUCKET_COLORS[d.minute]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
        {[
          { color: "#4db3ff", label: "1st half (0–45)" },
          { color: "#b278f0", label: "45+ET (1st half added time)" },
          { color: "#7cd992", label: "2nd half (46–90)" },
          { color: "#f5a623", label: "90+ET (2nd half added time)" },
        ].map(({ color, label }) => (
          <span key={label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#8ea0b2" }}>
            <span style={{ width: 10, height: 10, background: color, display: "inline-block", borderRadius: 2 }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function PlayerDrawer({ player, onClose }: { player: ScorerRow; onClose: () => void }) {
  const [tab, setTab] = useState<"goals" | "assists">("goals");
  const goals = useWorkbook((s) => s.goals);
  const matches = useWorkbook((s) => s.matches);

  const assistLog = useMemo(() => {
    const matchMap = new Map<number, Match>();
    matches.forEach((m) => matchMap.set(m.MatchNo, m));
    return goals
      .filter((g) => g.Assist === player.player && g.Team === player.team && g.GoalOG === "G")
      .map((g) => {
        const m = matchMap.get(g.MatchNo);
        return {
          gameweek: m?.Gameweek ?? 0,
          scorer: g.Scorer,
          against: g.Against,
          homeAway: g.HomeAway,
          minute: g.GoalTime,
          addedTime: g.AddedTime,
          situation: g.Situation,
          video: g.Video,
        };
      })
      .sort((a, b) => a.gameweek - b.gameweek || a.minute - b.minute);
  }, [goals, matches, player]);

  return (
    <div className="drawer">
      <button className="close" onClick={onClose}>×</button>
      <h2 style={{ marginTop: 0 }}>{player.player}</h2>
      <div className="subtle">{player.team} · {player.position || "—"} · {player.nationality || "—"}</div>
      <div className="stat-grid" style={{ marginTop: 16 }}>
        <Tile label="Goals" value={player.goals} />
        <Tile label="Assists" value={player.assists} />
        <Tile label="G+A % of team goals" value={(player.teamGoalShare * 100).toFixed(1) + "%"} />
        <Tile label="Penalties" value={player.penalties} />
        <Tile label="Tie Breakers" value={player.tieBreakers} />
        <Tile label="Equalizers" value={player.equalizers} />
        <Tile label="When Trailing" value={player.goalsWhenTrailing} />
        <Tile label="Home Goals" value={player.homeGoals} />
        <Tile label="Away Goals" value={player.awayGoals} />
        <Tile label="1st Half" value={player.firstHalfGoals} />
        <Tile label="1st Half ET" value={player.firstHalfETGoals} />
        <Tile label="2nd Half" value={player.secondHalfGoals} />
        <Tile label="2nd Half ET" value={player.secondHalfETGoals} />
        <Tile label="Match Openers" value={player.matchOpeners} />
        <Tile label="Team Openers" value={player.teamOpeners} />
      </div>

      <div className="tabs" style={{ marginTop: 20, borderBottom: "1px solid #2a3644" }}>
        <button className={`tab ${tab === "goals" ? "active" : ""}`} onClick={() => setTab("goals")}>
          Goal log ({player.goalLog.length})
        </button>
        <button className={`tab ${tab === "assists" ? "active" : ""}`} onClick={() => setTab("assists")}>
          Assists ({assistLog.length})
        </button>
      </div>

      {tab === "goals" && (
        <table className="stat-table" style={{ marginTop: 12 }}>
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
                <td>
                  {g.video
                    ? <a href={g.video} target="_blank" rel="noreferrer" style={{ color: "#4db3ff" }}>▶</a>
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === "assists" && (
        assistLog.length === 0
          ? <div className="subtle" style={{ marginTop: 16 }}>No assists recorded.</div>
          : (
            <table className="stat-table" style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th>GW</th><th>Scorer</th><th>Opp</th><th>H/A</th><th>Min</th><th>Situation</th><th>▶</th>
                </tr>
              </thead>
              <tbody>
                {assistLog.map((g, i) => (
                  <tr key={i}>
                    <td>{g.gameweek}</td>
                    <td>{g.scorer}</td>
                    <td>{g.against}</td>
                    <td>{g.homeAway}</td>
                    <td>{g.minute}{g.addedTime ? `+${g.addedTime}` : ""}</td>
                    <td>{g.situation}</td>
                    <td>
                      {g.video
                        ? <a href={g.video} target="_blank" rel="noreferrer" style={{ color: "#4db3ff" }}>▶</a>
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
      )}
    </div>
  );
}

function pagerBtn(disabled: boolean, active = false): React.CSSProperties {
  return {
    padding: "3px 9px",
    fontSize: 12,
    borderRadius: 4,
    border: `1px solid ${active ? "#4db3ff" : "#2a3644"}`,
    background: active ? "#1a4a8a" : "transparent",
    color: disabled ? "#2a3644" : active ? "#4db3ff" : "#8ea0b2",
    cursor: disabled ? "default" : "pointer",
  };
}

function Tile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="stat-tile">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}
