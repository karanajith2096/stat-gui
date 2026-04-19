import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import {
  buildLeagueAverageTeamStats,
  buildSetPieceBreakdown,
  buildStandings,
  buildTeamForm,
  buildTeamStats,
  getTeams,
  goalsAgainstTeam,
  goalsForTeam,
  isSetPieceSituation,
  matchesFor,
  resultFor,
} from "../lib/derive";
import { useWorkbook } from "../store/workbook";
import type { Goal, Match, SetPieceBreakdown, TeamSideStats, TeamStats } from "../lib/types";

type Tab = "overview" | "form" | "matches" | "goals" | "spScored" | "spConceded";

export function Team() {
  const { name } = useParams<{ name: string }>();
  const team = decodeURIComponent(name ?? "");
  const matches = useWorkbook((s) => s.matches);
  const goals = useWorkbook((s) => s.goals);
  const [tab, setTab] = useState<Tab>("overview");

  const stats = useMemo(() => buildTeamStats(team, matches), [team, matches]);
  const leagueAvg = useMemo(() => buildLeagueAverageTeamStats(matches), [matches]);
  const form = useMemo(() => buildTeamForm(team, matches, goals), [team, matches, goals]);
  const standings = useMemo(() => buildStandings(matches), [matches]);
  const row = standings.find((r) => r.team === team);
  const teamMatches = useMemo(() => matchesFor(matches, team), [team, matches]);

  if (!row) {
    return <div className="card">Unknown team: {team}</div>;
  }

  return (
    <div>
      <div className="card">
        <h2 className="card-title" style={{ fontSize: 20 }}>{team}</h2>
        <div className="stat-grid">
          <Tile label="Position" value={`#${row.position}`} />
          <Tile label="Points" value={row.points} sub={`PPG ${row.ppg.toFixed(2)}`} />
          <Tile label="Record" value={`${row.wins}-${row.draws}-${row.losses}`} />
          <Tile label="xPts" value={row.xPts.toFixed(1)} sub={`xRank #${row.xRank}`} />
          <Tile label="xG / xGA" value={`${row.xG.toFixed(1)} / ${row.xGA.toFixed(1)}`} />
          <Tile label="Goal Diff" value={row.gd > 0 ? `+${row.gd}` : row.gd} />
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === "overview" ? "active" : ""}`} onClick={() => setTab("overview")}>Overview</button>
        <button className={`tab ${tab === "form" ? "active" : ""}`} onClick={() => setTab("form")}>Form</button>
        <button className={`tab ${tab === "matches" ? "active" : ""}`} onClick={() => setTab("matches")}>Matches</button>
        <button className={`tab ${tab === "goals" ? "active" : ""}`} onClick={() => setTab("goals")}>Goals For/Against</button>
        <button className={`tab ${tab === "spScored" ? "active" : ""}`} onClick={() => setTab("spScored")}>Set Piece — Scored</button>
        <button className={`tab ${tab === "spConceded" ? "active" : ""}`} onClick={() => setTab("spConceded")}>Set Piece — Conceded</button>
      </div>

      {tab === "overview" && <Overview team={team} stats={stats} leagueAvg={leagueAvg} goals={goals} matches={matches} />}
      {tab === "form" && <FormTab form={form} />}
      {tab === "matches" && <MatchesTab team={team} matches={teamMatches} />}
      {tab === "goals" && <GoalsTab team={team} goals={goals} />}
      {tab === "spScored" && <SetPieceTab side="scored" breakdown={buildSetPieceBreakdown(team, goals, matches, "scored")} />}
      {tab === "spConceded" && <SetPieceTab side="conceded" breakdown={buildSetPieceBreakdown(team, goals, matches, "conceded")} />}
    </div>
  );
}

function Tile({ label, value, sub, rank }: { label: string; value: string | number; sub?: string; rank?: string }) {
  return (
    <div className="stat-tile">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
      {rank && <div className="sub" style={{ color: "#8ea0b2", fontSize: 10 }}>#{rank} / 20</div>}
    </div>
  );
}

function perGame(side: TeamSideStats, key: keyof TeamSideStats): number {
  const g = side.games;
  return g > 0 ? (side[key] as number) / g : 0;
}

function Overview({ team, stats, leagueAvg, goals, matches }: {
  team: string;
  stats: ReturnType<typeof buildTeamStats>;
  leagueAvg: TeamSideStats;
  goals: Goal[];
  matches: Match[];
}) {
  const t = stats.total;
  const g = stats.games;

  const allTeamStats = useMemo(() => {
    const allTeams = getTeams(matches);
    return new Map(allTeams.map((tn) => [tn, buildTeamStats(tn, matches)]));
  }, [matches]);

  const allTeams = useMemo(() => Array.from(allTeamStats.keys()), [allTeamStats]);

  function pgForTeam(tn: string, key: keyof TeamSideStats): number {
    const ts = allTeamStats.get(tn);
    if (!ts || ts.games === 0) return 0;
    return (ts.total[key] as number) / ts.games;
  }

  function rankFor(key: keyof TeamSideStats, lowerBetter = false): number {
    const sorted = [...allTeams].sort((a, b) =>
      lowerBetter
        ? pgForTeam(a, key) - pgForTeam(b, key)
        : pgForTeam(b, key) - pgForTeam(a, key)
    );
    return sorted.indexOf(team) + 1;
  }

  const radarData = useMemo(() => {
    type AxisDef = { axis: string; key: keyof TeamSideStats; invert: boolean };
    const axes: AxisDef[] = [
      { axis: "xG",           key: "xG",           invert: false },
      { axis: "xGA (inv)",    key: "xGA",           invert: true  },
      { axis: "Possession",   key: "possession",    invert: false },
      { axis: "Shots",        key: "shots",         invert: false },
      { axis: "Big Chances",  key: "bigChances",    invert: false },
      { axis: "Set Piece xG", key: "setPiecexG",    invert: false },
      { axis: "1st Half xG",  key: "firstHalfxG",   invert: false },
    ];

    return axes.map(({ axis, key, invert }) => {
      const vals = allTeams.map((tn) => pgForTeam(tn, key));
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const range = max - min || 1;

      const normalize = (v: number) =>
        invert ? ((max - v) / range) * 100 : ((v - min) / range) * 100;

      const teamRaw = pgForTeam(team, key);
      const leagueRaw = leagueAvg[key] as number;

      return {
        axis,
        team: parseFloat(normalize(teamRaw).toFixed(1)),
        league: parseFloat(normalize(leagueRaw).toFixed(1)),
        rawTeam: teamRaw.toFixed(2),
        rawLeague: leagueRaw.toFixed(2),
      };
    });
  }, [team, allTeams, allTeamStats, leagueAvg]);

  const scored = goalsForTeam(team, goals);
  const conceded = goalsAgainstTeam(team, goals);
  const insideFor = scored.filter((x) => x.InsideOutside === "Inside").length;
  const outsideFor = scored.filter((x) => x.InsideOutside === "Outside").length;
  const insideAg = conceded.filter((x) => x.InsideOutside === "Inside").length;
  const outsideAg = conceded.filter((x) => x.InsideOutside === "Outside").length;

  return (
    <>
      <div className="card">
        <h2 className="card-title">Aggregate stats ({g} games)</h2>
        <div className="stat-grid">
          <Tile label="Goals" value={`${t.goalsFor} / ${t.goalsAgainst}`} sub={`${perGame(t, "goalsFor").toFixed(2)} per game`} rank={String(rankFor("goalsFor"))} />
          <Tile label="xG / xGA" value={`${t.xG.toFixed(1)} / ${t.xGA.toFixed(1)}`} sub={`${perGame(t, "xG").toFixed(2)} / ${perGame(t, "xGA").toFixed(2)}`} rank={String(rankFor("xG"))} />
          <Tile label="Shots / Target" value={`${t.shots} / ${t.shotsOnTarget}`} sub={`${perGame(t, "shots").toFixed(1)} shots/game`} rank={String(rankFor("shots"))} />
          <Tile label="Big Chances" value={t.bigChances} sub={`${t.bigChancesMissed} missed`} rank={String(rankFor("bigChances"))} />
          <Tile label="Corners" value={t.corners} sub={`${perGame(t, "corners").toFixed(1)}/game`} rank={String(rankFor("corners"))} />
          <Tile label="Possession" value={perGame(t, "possession").toFixed(1) + "%"} rank={String(rankFor("possession"))} />
          <Tile label="Set Piece Goals" value={t.setPieceGoals} sub={`xG ${t.setPiecexG.toFixed(1)}`} rank={String(rankFor("setPiecexG"))} />
          <Tile label="First Half xG" value={t.firstHalfxG.toFixed(1)} sub={`${((t.firstHalfxG / Math.max(0.01, t.xG)) * 100).toFixed(0)}% of total`} rank={String(rankFor("firstHalfxG"))} />
          <Tile label="Yellow / Red" value={`${t.yellow} / ${t.red}`} rank={String(rankFor("yellow", true))} />
          <Tile label="Fouls" value={t.fouls} sub={`${perGame(t, "fouls").toFixed(1)}/game`} rank={String(rankFor("fouls", true))} />
          <Tile label="Offsides" value={t.offsides} rank={String(rankFor("offsides", true))} />
          <Tile label="Duels Won" value={t.duelsWon} sub={`Ground ${t.groundDuelsWon}`} rank={String(rankFor("duelsWon"))} />
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Profile vs league average</h2>
        <div className="chart-wrap">
          <ResponsiveContainer>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#2a3644" />
              <PolarAngleAxis dataKey="axis" stroke="#8ea0b2" />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} stroke="#2a3644" />
              <Radar name={team} dataKey="team" stroke="#4db3ff" fill="#4db3ff" fillOpacity={0.4} />
              <Radar name="League avg" dataKey="league" stroke="#8ea0b2" fill="#8ea0b2" fillOpacity={0.15} />
              <Legend verticalAlign="top" />
              <Tooltip
                formatter={(value: number, name: string, props) => {
                  const raw = name === team ? props.payload.rawTeam : props.payload.rawLeague;
                  return [`${value.toFixed(0)}/100 (actual: ${raw})`, name];
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <HomeAwayTable stats={stats} />

      <div className="card">
        <h2 className="card-title">Inside vs Outside the box (goals)</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <DonutCard title="Scored" inside={insideFor} outside={outsideFor} />
          <DonutCard title="Conceded" inside={insideAg} outside={outsideAg} />
        </div>
      </div>
    </>
  );
}

const HA_METRICS: { key: string; label: string; lowerBetter: boolean }[] = [
  { key: "ppg",            label: "PPG",               lowerBetter: false },
  { key: "xG",             label: "xG / game",         lowerBetter: false },
  { key: "xGA",            label: "xGA / game",        lowerBetter: true  },
  { key: "possession",     label: "Possession",        lowerBetter: false },
  { key: "shots",          label: "Shots / game",      lowerBetter: false },
  { key: "shotsOnTarget",  label: "SoT / game",        lowerBetter: false },
  { key: "bigChances",     label: "Big Chances / game",lowerBetter: false },
  { key: "setPiecexG",     label: "Set Piece xG / game",lowerBetter: false },
  { key: "corners",        label: "Corners / game",    lowerBetter: false },
  { key: "fouls",          label: "Fouls / game",      lowerBetter: true  },
  { key: "yellow",         label: "Yellows / game",    lowerBetter: true  },
];

const DEFAULT_HA_SHOWN = new Set(["ppg", "xG", "xGA", "possession"]);

function haValue(side: TeamSideStats, games: number, key: string): number {
  if (games === 0) return 0;
  if (key === "ppg") return side.points / games;
  return (side[key as keyof TeamSideStats] as number) / games;
}

function HomeAwayTable({ stats }: { stats: TeamStats }) {
  const [shown, setShown] = useState<Set<string>>(DEFAULT_HA_SHOWN);

  const toggle = (key: string) =>
    setShown((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const rows = HA_METRICS.filter((m) => shown.has(m.key));

  return (
    <div className="card">
      <h2 className="card-title">Home vs Away profile</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {HA_METRICS.map((m) => (
          <button
            key={m.key}
            className={`tab${shown.has(m.key) ? " active" : ""}`}
            style={{ padding: "3px 10px", fontSize: 11 }}
            onClick={() => toggle(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>
      <table className="stat-table">
        <thead>
          <tr>
            <th>Metric</th>
            <th style={{ textAlign: "right" }}>Home ({stats.home.games})</th>
            <th style={{ textAlign: "right" }}>Away ({stats.away.games})</th>
            <th style={{ textAlign: "right" }}>Diff (Away − Home)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ key, label, lowerBetter }) => {
            const hv = haValue(stats.home, stats.home.games, key);
            const av = haValue(stats.away, stats.away.games, key);
            const diff = av - hv;
            const color =
              diff === 0 ? "#8ea0b2"
              : (diff > 0) === !lowerBetter ? "#7cd992"
              : "#e05252";
            return (
              <tr key={key}>
                <td>{label}</td>
                <td style={{ textAlign: "right" }}>{hv.toFixed(2)}</td>
                <td style={{ textAlign: "right" }}>{av.toFixed(2)}</td>
                <td style={{ textAlign: "right", color }}>{diff > 0 ? "+" : ""}{diff.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DonutCard({ title, inside, outside }: { title: string; inside: number; outside: number }) {
  const data = [
    { name: "Inside", value: inside },
    { name: "Outside", value: outside },
  ];
  return (
    <div>
      <div className="subtle" style={{ textAlign: "center" }}>{title}</div>
      <div className="chart-small">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} innerRadius={55} outerRadius={85} dataKey="value" label>
              <Cell fill="#4db3ff" />
              <Cell fill="#7cd992" />
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function FormTab({ form }: { form: ReturnType<typeof buildTeamForm> }) {
  const perMatchData = useMemo(() =>
    form.map((fp) => ({
      gameweek: fp.gameweek,
      opponent: fp.opponent,
      xG: parseFloat(fp.matchXG.toFixed(2)),
      Goals: fp.matchGoals,
      luck: parseFloat((fp.matchGoals - fp.matchXG).toFixed(2)),
    })),
    [form]
  );

  const rollingData = useMemo(() =>
    form.map((fp, i, arr) => {
      const window = arr.slice(Math.max(0, i - 4), i + 1);
      const goals = window.reduce((s, f) => s + f.matchGoals, 0);
      const xG = window.reduce((s, f) => s + f.matchXG, 0);
      const fhXG = window.reduce((s, f) => s + f.firstHalfXG, 0);
      const totXG = window.reduce((s, f) => s + f.matchXG, 0);
      return {
        gameweek: fp.gameweek,
        finishingEff: xG > 0 ? parseFloat((goals / xG).toFixed(2)) : null,
        firstHalfShare: totXG > 0 ? parseFloat(((fhXG / totXG) * 100).toFixed(1)) : null,
      };
    }),
    [form]
  );

  const possessionBuckets = useMemo(() => {
    const buckets = [
      { label: "< 40%", min: 0, max: 40 },
      { label: "40–50%", min: 40, max: 50 },
      { label: "50–60%", min: 50, max: 60 },
      { label: "> 60%", min: 60, max: 101 },
    ];
    return buckets.map(({ label, min, max }) => {
      const inBucket = form.filter((fp) => fp.possession >= min && fp.possession < max);
      return {
        label,
        W: inBucket.filter((fp) => fp.result === "W").length,
        D: inBucket.filter((fp) => fp.result === "D").length,
        L: inBucket.filter((fp) => fp.result === "L").length,
        n: inBucket.length,
      };
    });
  }, [form]);

  const highPoss = form.filter((fp) => fp.possession > 50);
  const lowPoss = form.filter((fp) => fp.possession <= 50);
  const ppgHigh = highPoss.length > 0 ? highPoss.reduce((s, fp) => s + fp.points, 0) / highPoss.length : 0;
  const ppgLow = lowPoss.length > 0 ? lowPoss.reduce((s, fp) => s + fp.points, 0) / lowPoss.length : 0;

  return (
    <>
      <div className="card">
        <h2 className="card-title">Rolling form & per-match xG</h2>
        <div className="chart-wrap">
          <ResponsiveContainer>
            <LineChart data={form} margin={{ top: 30, right: 30, bottom: 10, left: 10 }}>
              <CartesianGrid stroke="#2a3644" />
              <XAxis dataKey="gameweek" stroke="#8ea0b2" />
              <YAxis yAxisId="left" stroke="#8ea0b2" />
              <YAxis yAxisId="right" orientation="right" stroke="#8ea0b2" />
              <Tooltip />
              <Legend verticalAlign="top" />
              <Line yAxisId="left" dataKey="rolling5PPG" name="Rolling 5 PPG" stroke="#f5a623" dot={false} />
              <Line yAxisId="left" dataKey="cumulativePPG" name="Cumulative PPG" stroke="#4db3ff" dot={false} />
              <Line yAxisId="right" dataKey="matchXG" name="Match xG" stroke="#7cd992" strokeDasharray="4 2" dot={false} />
              <Line yAxisId="right" dataKey="matchXGA" name="Match xGA" stroke="#e05252" strokeDasharray="4 2" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">xG vs Goals per match</h2>
        <div className="chart-wrap">
          <ResponsiveContainer>
            <ComposedChart data={perMatchData} margin={{ top: 30, right: 30, bottom: 10, left: 10 }}>
              <CartesianGrid stroke="#2a3644" />
              <XAxis dataKey="gameweek" stroke="#8ea0b2" />
              <YAxis yAxisId="left" stroke="#8ea0b2" />
              <YAxis yAxisId="right" orientation="right" stroke="#8ea0b2" tickFormatter={(v) => (v > 0 ? `+${v}` : v)} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div style={{ background: "#1c2530", border: "1px solid #2a3644", padding: 8, fontSize: 12 }}>
                      <b>GW{d.gameweek} vs {d.opponent}</b><br />
                      xG: {d.xG} · Goals: {d.Goals} · Luck: {d.luck > 0 ? "+" : ""}{d.luck}
                    </div>
                  );
                }}
              />
              <Legend verticalAlign="top" />
              <Bar yAxisId="left" dataKey="xG" name="xG" fill="#4db3ff" opacity={0.7} />
              <Bar yAxisId="left" dataKey="Goals" name="Goals" fill="#7cd992" opacity={0.7} />
              <Line yAxisId="right" dataKey="luck" name="Goals − xG" stroke="#f5a623" dot={false} strokeWidth={2} />
              <ReferenceLine yAxisId="right" y={0} stroke="#6b7785" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Rolling finishing efficiency & 1st-half xG share (5-match window)</h2>
        <div className="chart-wrap">
          <ResponsiveContainer>
            <LineChart data={rollingData} margin={{ top: 30, right: 30, bottom: 10, left: 10 }}>
              <CartesianGrid stroke="#2a3644" />
              <XAxis dataKey="gameweek" stroke="#8ea0b2" />
              <YAxis yAxisId="left" stroke="#8ea0b2" domain={[0, "auto"]} tickFormatter={(v) => v.toFixed(1)} />
              <YAxis yAxisId="right" orientation="right" stroke="#8ea0b2" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                formatter={(value: number, name: string) =>
                  [name === "1st Half xG %" ? `${value?.toFixed(1)}%` : value?.toFixed(2), name]
                }
              />
              <Legend verticalAlign="top" />
              <ReferenceLine yAxisId="left" y={1} stroke="#8ea0b2" strokeDasharray="4 2" label={{ value: "1.0", fill: "#8ea0b2", fontSize: 10 }} />
              <ReferenceLine yAxisId="right" y={50} stroke="#8ea0b2" strokeDasharray="4 2" />
              <Line yAxisId="left" dataKey="finishingEff" name="Goals / xG" stroke="#7cd992" dot={false} connectNulls />
              <Line yAxisId="right" dataKey="firstHalfShare" name="1st Half xG %" stroke="#b278f0" dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="subtle">Goals/xG above 1.0 = overperforming; 1st-half xG % above 50% = early starters.</div>
      </div>

      <div className="card">
        <h2 className="card-title">First-half vs second-half xG (per match)</h2>
        <div className="chart-wrap">
          <ResponsiveContainer>
            <BarChart data={form}>
              <CartesianGrid stroke="#2a3644" />
              <XAxis dataKey="gameweek" stroke="#8ea0b2" />
              <YAxis stroke="#8ea0b2" />
              <Tooltip />
              <Legend verticalAlign="top" />
              <Bar dataKey="firstHalfXG" name="1st-half xG" fill="#4db3ff" />
              <Bar dataKey="secondHalfXG" name="2nd-half xG" fill="#7cd992" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Results by possession range</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "center" }}>
          <div className="chart-wrap" style={{ minHeight: 220 }}>
            <ResponsiveContainer>
              <BarChart data={possessionBuckets}>
                <CartesianGrid stroke="#2a3644" />
                <XAxis dataKey="label" stroke="#8ea0b2" />
                <YAxis stroke="#8ea0b2" allowDecimals={false} />
                <Tooltip />
                <Legend verticalAlign="top" />
                <Bar dataKey="W" stackId="a" fill="#7cd992" name="Win" />
                <Bar dataKey="D" stackId="a" fill="#8ea0b2" name="Draw" />
                <Bar dataKey="L" stackId="a" fill="#e05252" name="Loss" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="stat-tile">
              <div className="label">PPG &gt; 50% poss</div>
              <div className="value">{ppgHigh.toFixed(2)}</div>
              <div className="sub">{highPoss.length} games</div>
            </div>
            <div className="stat-tile">
              <div className="label">PPG ≤ 50% poss</div>
              <div className="value">{ppgLow.toFixed(2)}</div>
              <div className="sub">{lowPoss.length} games</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function MatchesTab({ team, matches }: { team: string; matches: Match[] }) {
  return (
    <div className="card">
      <h2 className="card-title">Matches</h2>
      <table className="stat-table">
        <thead>
          <tr>
            <th>GW</th><th>Date</th><th>H/A</th><th className="col-team">Opp</th>
            <th>Score</th><th>Result</th><th>xG</th><th>xGA</th><th>Poss</th><th>Shots</th><th>SoT</th>
          </tr>
        </thead>
        <tbody>
          {matches.map((m) => {
            const isHome = m.Home === team;
            const opp = isHome ? m.Away : m.Home;
            const gf = isHome ? m.HomeGoals : m.AwayGoals;
            const ga = isHome ? m.AwayGoals : m.HomeGoals;
            const xG = isHome ? m.HomeXG : m.AwayXG;
            const xGA = isHome ? m.AwayXG : m.HomeXG;
            const poss = isHome ? m.HomePossession : m.AwayPossession;
            const shots = isHome ? m.HomeShots : m.AwayShots;
            const sot = isHome ? m.HomeSot : m.AwaySot;
            const r = resultFor(m, team);
            return (
              <tr key={m.MatchNo}>
                <td>{m.Gameweek}</td>
                <td>{m.Date.toISOString().slice(0, 10)}</td>
                <td>{isHome ? "H" : "A"}</td>
                <td className="col-team">
                  <Link to={`/team/${encodeURIComponent(opp)}`}>{opp}</Link>
                </td>
                <td>{gf}–{ga}</td>
                <td><span className={`pill pill-${r}`}>{r}</span></td>
                <td>{xG.toFixed(2)}</td>
                <td>{xGA.toFixed(2)}</td>
                <td>{poss}%</td>
                <td>{shots}</td>
                <td>{sot}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function GoalsTab({ team, goals }: { team: string; goals: Goal[] }) {
  const forGoals = goalsForTeam(team, goals);
  const againstGoals = goalsAgainstTeam(team, goals);
  const situations = Array.from(new Set([...forGoals, ...againstGoals].map((g) => g.Situation)));
  const situationData = situations.map((s) => ({
    situation: s,
    for: forGoals.filter((g) => g.Situation === s).length,
    against: againstGoals.filter((g) => g.Situation === s).length,
  }));

  const buckets = [0, 15, 30, 45, 60, 75, 90];
  const bucketData = buckets.map((b, i) => {
    const lo = b;
    const hi = i === buckets.length - 1 ? 120 : buckets[i + 1];
    const label = `${lo}–${hi === 120 ? "90+" : hi}`;
    return {
      label,
      for: forGoals.filter((g) => g.GoalTime >= lo && g.GoalTime < hi).length,
      against: -againstGoals.filter((g) => g.GoalTime >= lo && g.GoalTime < hi).length,
    };
  });

  return (
    <>
      <div className="card">
        <h2 className="card-title">Goals by Situation (For vs Against)</h2>
        <div className="chart-wrap">
          <ResponsiveContainer>
            <BarChart data={situationData}>
              <CartesianGrid stroke="#2a3644" />
              <XAxis dataKey="situation" stroke="#8ea0b2" />
              <YAxis stroke="#8ea0b2" />
              <Tooltip />
              <Legend verticalAlign="top" />
              <Bar dataKey="for" name="Scored" fill="#7cd992" />
              <Bar dataKey="against" name="Conceded" fill="#e05252" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="card">
        <h2 className="card-title">Goal-minute histogram (15-min buckets)</h2>
        <div className="chart-wrap">
          <ResponsiveContainer>
            <BarChart data={bucketData} stackOffset="sign">
              <CartesianGrid stroke="#2a3644" />
              <XAxis dataKey="label" stroke="#8ea0b2" />
              <YAxis stroke="#8ea0b2" />
              <ReferenceLine y={0} stroke="#6b7785" />
              <Tooltip />
              <Legend verticalAlign="top" />
              <Bar dataKey="for" name="Scored" fill="#7cd992" />
              <Bar dataKey="against" name="Conceded" fill="#e05252" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}

function SetPieceTab({ side, breakdown }: { side: "scored" | "conceded"; breakdown: SetPieceBreakdown }) {
  const subTypes = Object.entries(breakdown.bySubType).map(([k, v]) => ({ subType: k, count: v }));
  return (
    <>
      <div className="card">
        <h2 className="card-title">Set Piece {side === "scored" ? "— Scored" : "— Conceded"}</h2>
        <div className="stat-grid">
          <Tile label="Total" value={breakdown.total} sub={`${(breakdown.percentOfAllGoals * 100).toFixed(1)}% of all goals ${side}`} />
          <Tile label="Match Openers" value={breakdown.matchOpeners} />
          <Tile label="Team Openers" value={breakdown.teamOpeners} />
          <Tile label="Home" value={breakdown.home} />
          <Tile label="Away" value={breakdown.away} />
          <Tile label="1st Half" value={breakdown.firstHalf} sub={breakdown.firstHalfET > 0 ? `${breakdown.firstHalfET} in ET` : undefined} />
          <Tile label="2nd Half" value={breakdown.secondHalf} sub={breakdown.secondHalfET > 0 ? `${breakdown.secondHalfET} in ET` : undefined} />
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">By sub-type</h2>
        <div className="chart-small">
          <ResponsiveContainer>
            <BarChart data={subTypes}>
              <CartesianGrid stroke="#2a3644" />
              <XAxis dataKey="subType" stroke="#8ea0b2" />
              <YAxis stroke="#8ea0b2" allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill={side === "scored" ? "#7cd992" : "#e05252"} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {subTypes.length === 0 && <div className="subtle">No set-piece goals recorded.</div>}
      </div>
    </>
  );
}

// Prevent unused-import lint for isSetPieceSituation (used in other tabs indirectly)
void isSetPieceSituation;
