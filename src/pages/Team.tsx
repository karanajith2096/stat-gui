import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
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
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
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
  pointsFor,
  resultFor,
} from "../lib/derive";
import { useWorkbook } from "../store/workbook";
import type { Goal, Match, SetPieceBreakdown, TeamSideStats } from "../lib/types";

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

function Tile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="stat-tile">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
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

  // Normalize radar axes across all teams so no single metric dominates by scale.
  // Each axis is min-max normalized to 0–100. Inverted axes (lower = better) are
  // flipped so a higher bar always means "better for this team".
  const radarData = useMemo(() => {
    const allTeams = getTeams(matches);
    const allStats = new Map(allTeams.map((tn) => [tn, buildTeamStats(tn, matches)]));

    function pg(tn: string, key: keyof TeamSideStats): number {
      const ts = allStats.get(tn);
      if (!ts || ts.games === 0) return 0;
      return (ts.total[key] as number) / ts.games;
    }

    type AxisDef = { axis: string; key: keyof TeamSideStats; invert: boolean };
    const axes: AxisDef[] = [
      { axis: "xG",           key: "xG",           invert: false },
      { axis: "xGA (inv)",    key: "xGA",           invert: true  },
      { axis: "Possession",   key: "possession",    invert: false },
      { axis: "Shots",        key: "shots",         invert: false },
      { axis: "Big Chances",  key: "bigChances",    invert: false },
      { axis: "Set Piece xG", key: "setPiecexG",    invert: false },
      { axis: "Fouls (inv)",  key: "fouls",         invert: true  },
    ];

    return axes.map(({ axis, key, invert }) => {
      const vals = allTeams.map((tn) => pg(tn, key));
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const range = max - min || 1;

      const normalize = (v: number) =>
        invert ? ((max - v) / range) * 100 : ((v - min) / range) * 100;

      const teamRaw = pg(team, key);
      const leagueRaw = leagueAvg[key] as number;

      return {
        axis,
        team: parseFloat(normalize(teamRaw).toFixed(1)),
        league: parseFloat(normalize(leagueRaw).toFixed(1)),
        rawTeam: teamRaw.toFixed(2),
        rawLeague: leagueRaw.toFixed(2),
      };
    });
  }, [team, matches, leagueAvg]);

  const haData = [
    { label: "PPG", home: perGame(stats.home, "points"), away: perGame(stats.away, "points") },
    { label: "xG", home: perGame(stats.home, "xG"), away: perGame(stats.away, "xG") },
    { label: "xGA", home: perGame(stats.home, "xGA"), away: perGame(stats.away, "xGA") },
    { label: "Possession", home: perGame(stats.home, "possession"), away: perGame(stats.away, "possession") },
  ];

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
          <Tile label="Goals" value={`${t.goalsFor} / ${t.goalsAgainst}`} sub={`${perGame(t, "goalsFor").toFixed(2)} per game`} />
          <Tile label="xG / xGA" value={`${t.xG.toFixed(1)} / ${t.xGA.toFixed(1)}`} sub={`${perGame(t, "xG").toFixed(2)} / ${perGame(t, "xGA").toFixed(2)}`} />
          <Tile label="Shots / Target" value={`${t.shots} / ${t.shotsOnTarget}`} sub={`${perGame(t, "shots").toFixed(1)} shots/game`} />
          <Tile label="Big Chances" value={t.bigChances} sub={`${t.bigChancesMissed} missed`} />
          <Tile label="Corners" value={t.corners} sub={`${perGame(t, "corners").toFixed(1)}/game`} />
          <Tile label="Possession" value={perGame(t, "possession").toFixed(1) + "%"} />
          <Tile label="Set Piece Goals" value={t.setPieceGoals} sub={`xG ${t.setPiecexG.toFixed(1)}`} />
          <Tile label="First Half xG" value={t.firstHalfxG.toFixed(1)} sub={`${((t.firstHalfxG / Math.max(0.01, t.xG)) * 100).toFixed(0)}% of total`} />
          <Tile label="Yellow / Red" value={`${t.yellow} / ${t.red}`} />
          <Tile label="Fouls" value={t.fouls} sub={`${perGame(t, "fouls").toFixed(1)}/game`} />
          <Tile label="Offsides" value={t.offsides} />
          <Tile label="Duels Won" value={t.duelsWon} sub={`Ground ${t.groundDuelsWon}`} />
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
              <Legend />
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

      <div className="card">
        <h2 className="card-title">Home vs Away profile</h2>
        <div className="chart-wrap">
          <ResponsiveContainer>
            <BarChart data={haData} margin={{ top: 10, right: 30, bottom: 10, left: 10 }}>
              <CartesianGrid stroke="#2a3644" />
              <XAxis dataKey="label" stroke="#8ea0b2" />
              <YAxis stroke="#8ea0b2" />
              <Tooltip />
              <Legend />
              <Bar dataKey="home" name="Home" fill="#4db3ff" />
              <Bar dataKey="away" name="Away" fill="#7cd992" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

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
  return (
    <>
      <div className="card">
        <h2 className="card-title">Rolling form (PPG) + per-match xG/xGA</h2>
        <div className="chart-wrap">
          <ResponsiveContainer>
            <LineChart data={form} margin={{ top: 10, right: 30, bottom: 10, left: 10 }}>
              <CartesianGrid stroke="#2a3644" />
              <XAxis dataKey="gameweek" stroke="#8ea0b2" />
              <YAxis yAxisId="left" stroke="#8ea0b2" />
              <YAxis yAxisId="right" orientation="right" stroke="#8ea0b2" />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" dataKey="rolling5PPG" name="Rolling 5 PPG" stroke="#f5a623" dot={false} />
              <Line yAxisId="left" dataKey="cumulativePPG" name="Cumulative PPG" stroke="#4db3ff" dot={false} />
              <Line yAxisId="right" dataKey="matchXG" name="Match xG" stroke="#7cd992" strokeDasharray="4 2" dot={false} />
              <Line yAxisId="right" dataKey="matchXGA" name="Match xGA" stroke="#e05252" strokeDasharray="4 2" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Cumulative xG vs cumulative Goals</h2>
        <div className="chart-wrap">
          <ResponsiveContainer>
            <LineChart data={form}>
              <CartesianGrid stroke="#2a3644" />
              <XAxis dataKey="gameweek" stroke="#8ea0b2" />
              <YAxis stroke="#8ea0b2" />
              <Tooltip />
              <Legend />
              <Line dataKey="cumulativeGoals" name="Goals" stroke="#7cd992" dot={false} />
              <Line dataKey="cumulativeXG" name="xG" stroke="#4db3ff" dot={false} />
              <Line dataKey="cumulativeGoalsAgainst" name="Goals Against" stroke="#e05252" dot={false} />
              <Line dataKey="cumulativeXGA" name="xGA" stroke="#f5a623" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
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
              <Legend />
              <Bar dataKey="firstHalfXG" name="1st-half xG" fill="#4db3ff" />
              <Bar dataKey="secondHalfXG" name="2nd-half xG" fill="#7cd992" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Possession vs points earned (per match)</h2>
        <div className="chart-wrap">
          <ResponsiveContainer>
            <ScatterChart margin={{ top: 10, right: 30, bottom: 30, left: 10 }}>
              <CartesianGrid stroke="#2a3644" />
              <XAxis type="number" dataKey="possession" stroke="#8ea0b2" domain={[20, 80]}>
                <Label value="Possession %" position="insideBottom" offset={-20} fill="#8ea0b2" />
              </XAxis>
              <YAxis type="number" dataKey="points" stroke="#8ea0b2" domain={[0, 3]} ticks={[0, 1, 3]}>
                <Label value="Points" angle={-90} position="insideLeft" fill="#8ea0b2" />
              </YAxis>
              <Tooltip />
              <Scatter data={form} fill="#f5a623" />
            </ScatterChart>
          </ResponsiveContainer>
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

  // Goal-minute histogram in 15-min buckets
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
              <Legend />
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
              <Legend />
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
          <Tile label="1st Half" value={breakdown.firstHalf} />
          <Tile label="2nd Half" value={breakdown.secondHalf} />
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
