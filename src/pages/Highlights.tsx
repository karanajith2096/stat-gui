import { useMemo, useState } from "react";
import { buildGoalOfTheGW, buildHighlightGoals, getTeams } from "../lib/derive";
import type { HighlightGoal } from "../lib/types";
import { useWorkbook } from "../store/workbook";

const SITUATION_CHIPS = ["All", "Regular", "Penalty", "Corner", "Free Kick", "Fast Break", "Other Set-Piece"] as const;
type SituationFilter = (typeof SITUATION_CHIPS)[number];

const CONTEXT_CHIPS = ["All", "Clutch", "Openers"] as const;
type ContextFilter = (typeof CONTEXT_CHIPS)[number];

function classifySituation(sit: string): SituationFilter {
  const s = sit.trim();
  if (s === "Regular") return "Regular";
  if (s === "Penalty") return "Penalty";
  if (s === "Corner") return "Corner";
  if (s === "Free Kick") return "Free Kick";
  if (s === "Fast Break" || s === "FastBreak" || s === "Fast-Break") return "Fast Break";
  return "Other Set-Piece";
}

function minuteLabel(minute: number, added: number | null): string {
  if (added && added > 0) return `${minute}+${added}'`;
  return `${minute}'`;
}

function GoalRow({ goal, index }: { goal: HighlightGoal; index: number }) {
  const isHome = goal.homeAway === "H";
  const scorerTeam = isHome ? goal.homeTeam : goal.awayTeam;
  const score = `${goal.finalHomeGoals}–${goal.finalAwayGoals}`;
  const sit = classifySituation(goal.situation);

  const badges: string[] = [];
  if (goal.isEqualizer) badges.push("Equalizer");
  if (goal.isTieBreaker) badges.push("Tie-Breaker");
  if (goal.isWhileTrailing) badges.push("While Trailing");
  if (goal.isMatchOpener) badges.push("Match Opener");

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "8px 0",
      borderBottom: "1px solid #1e2b38",
    }}>
      <span style={{ width: 28, textAlign: "right", color: "#4a5a6a", fontSize: 12, flexShrink: 0 }}>
        {index + 1}.
      </span>
      <span style={{ width: 36, color: "#4db3ff", fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
        {minuteLabel(goal.minute, goal.addedTime)}
      </span>
      <span style={{ minWidth: 140, fontWeight: 600, fontSize: 13, color: "#cdd6e0" }}>
        {goal.scorer}
      </span>
      <span style={{ minWidth: 120, fontSize: 12, color: "#8ea0b2" }}>
        {scorerTeam}
      </span>
      <span style={{ minWidth: 60, fontSize: 11, color: "#4a5a6a" }}>
        GW {goal.gameweek}
      </span>
      <span style={{ flex: 1, fontSize: 12, color: "#8ea0b2" }}>
        {goal.homeTeam} vs {goal.awayTeam} ({score})
      </span>
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        <span style={{ background: "#1c2d3f", borderRadius: 4, padding: "1px 6px", fontSize: 10, color: "#7cd992" }}>
          {sit}
        </span>
        {badges.map((b) => (
          <span key={b} style={{ background: "#2d1f3d", borderRadius: 4, padding: "1px 6px", fontSize: 10, color: "#b278f0" }}>
            {b}
          </span>
        ))}
      </div>
      <a
        href={goal.video ?? undefined}
        target="_blank"
        rel="noreferrer"
        style={{
          flexShrink: 0,
          padding: "3px 10px",
          background: goal.video ? "#1a4a8a" : "transparent",
          border: `1px solid ${goal.video ? "#4db3ff" : "#2a3644"}`,
          borderRadius: 4,
          color: goal.video ? "#4db3ff" : "#3a4a5a",
          fontSize: 11,
          textDecoration: "none",
          pointerEvents: goal.video ? "auto" : "none",
          cursor: goal.video ? "pointer" : "default",
        }}
      >
        ▶
      </a>
    </div>
  );
}

function GotWCarousel({ gotw }: { gotw: Map<number, HighlightGoal> }) {
  const gws = Array.from(gotw.keys()).sort((a, b) => a - b);
  const [idx, setIdx] = useState(() => gws.length - 1);

  if (gws.length === 0) return null;
  const gw = gws[idx];
  const goal = gotw.get(gw)!;

  const isHome = goal.homeAway === "H";
  const score = `${goal.finalHomeGoals}–${goal.finalAwayGoals}`;
  const sit = classifySituation(goal.situation);

  const badges: string[] = [];
  if (goal.isEqualizer) badges.push("Equalizer");
  if (goal.isTieBreaker) badges.push("Tie-Breaker");
  if (goal.isWhileTrailing) badges.push("While Trailing");
  if (goal.isMatchOpener) badges.push("Match Opener");

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <h2 className="card-title" style={{ margin: 0 }}>Goal of the Gameweek</h2>
        <select
          value={gw}
          onChange={(e) => setIdx(gws.indexOf(Number(e.target.value)))}
          style={{ background: "#1c2530", border: "1px solid #2a3644", color: "#cdd6e0", borderRadius: 4, padding: "4px 8px", fontSize: 12 }}
        >
          {gws.map((g) => <option key={g} value={g}>GW {g}</option>)}
        </select>
      </div>

      <div style={{
        background: "#131c26",
        border: "1px solid #2a3644",
        borderRadius: 8,
        padding: "20px 24px",
      }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#cdd6e0", marginBottom: 4 }}>
          {goal.scorer}
          <span style={{ fontSize: 14, fontWeight: 400, color: "#8ea0b2", marginLeft: 10 }}>
            {minuteLabel(goal.minute, goal.addedTime)}
          </span>
        </div>
        <div style={{ fontSize: 14, color: "#8ea0b2", marginBottom: 12 }}>
          {isHome ? goal.homeTeam : goal.awayTeam} · {goal.homeTeam} vs {goal.awayTeam} ({score})
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 16 }}>
          <span style={{ background: "#1c2d3f", borderRadius: 4, padding: "2px 8px", fontSize: 12, color: "#7cd992" }}>
            {sit}
          </span>
          {badges.map((b) => (
            <span key={b} style={{ background: "#2d1f3d", borderRadius: 4, padding: "2px 8px", fontSize: 12, color: "#b278f0" }}>
              {b}
            </span>
          ))}
        </div>
        <a
          href={goal.video ?? undefined}
          target="_blank"
          rel="noreferrer"
          style={{
            display: "inline-block",
            padding: "7px 20px",
            background: goal.video ? "#1a4a8a" : "#1c2530",
            border: `1px solid ${goal.video ? "#4db3ff" : "#2a3644"}`,
            borderRadius: 4,
            color: goal.video ? "#4db3ff" : "#4a5a6a",
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
            pointerEvents: goal.video ? "auto" : "none",
          }}
        >
          ▶ Watch Goal
        </a>
      </div>
    </div>
  );
}

export function Highlights() {
  const matches = useWorkbook((s) => s.matches);
  const goals = useWorkbook((s) => s.goals);

  const highlights = useMemo(() => buildHighlightGoals(goals, matches), [goals, matches]);
  const gotw = useMemo(() => buildGoalOfTheGW(highlights), [highlights]);
  const teams = useMemo(() => getTeams(matches), [matches]);

  const [teamFilter, setTeamFilter] = useState("All");
  const [sitFilter, setSitFilter] = useState<SituationFilter>("All");
  const [ctxFilter, setCtxFilter] = useState<ContextFilter>("All");
  const [videoOnly, setVideoOnly] = useState(true);

  const filtered = useMemo(() => {
    return highlights.filter((g) => {
      if (videoOnly && !g.video) return false;
      if (teamFilter !== "All" && g.team !== teamFilter) return false;
      if (sitFilter !== "All" && classifySituation(g.situation) !== sitFilter) return false;
      if (ctxFilter === "Clutch" && !(g.isEqualizer || g.isTieBreaker || g.isWhileTrailing)) return false;
      if (ctxFilter === "Openers" && !g.isMatchOpener) return false;
      return true;
    });
  }, [highlights, teamFilter, sitFilter, ctxFilter, videoOnly]);

  return (
    <div>
      <GotWCarousel gotw={gotw} />

      <div className="card">
        <h2 className="card-title">Goal Gallery</h2>

        {/* Filters */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16, alignItems: "center" }}>
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            style={{ background: "#1c2530", border: "1px solid #2a3644", color: "#cdd6e0", borderRadius: 4, padding: "4px 8px", fontSize: 12 }}
          >
            <option value="All">All Teams</option>
            {teams.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>

          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {SITUATION_CHIPS.map((s) => (
              <button
                key={s}
                onClick={() => setSitFilter(s)}
                style={{
                  background: sitFilter === s ? "#1a4a8a" : "transparent",
                  border: `1px solid ${sitFilter === s ? "#4db3ff" : "#2a3644"}`,
                  color: sitFilter === s ? "#4db3ff" : "#8ea0b2",
                  borderRadius: 4,
                  padding: "3px 10px",
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                {s}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 4 }}>
            {CONTEXT_CHIPS.map((c) => (
              <button
                key={c}
                onClick={() => setCtxFilter(c)}
                style={{
                  background: ctxFilter === c ? "#2d1f3d" : "transparent",
                  border: `1px solid ${ctxFilter === c ? "#b278f0" : "#2a3644"}`,
                  color: ctxFilter === c ? "#b278f0" : "#8ea0b2",
                  borderRadius: 4,
                  padding: "3px 10px",
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                {c}
              </button>
            ))}
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#8ea0b2", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={videoOnly}
              onChange={(e) => setVideoOnly(e.target.checked)}
            />
            With video only
          </label>
        </div>

        <div style={{ fontSize: 12, color: "#4a5a6a", marginBottom: 12 }}>
          {filtered.length} goal{filtered.length !== 1 ? "s" : ""}
        </div>

        {filtered.length === 0 ? (
          <div style={{ color: "#4a5a6a", padding: "40px 0", textAlign: "center" }}>
            No goals match the current filters.
          </div>
        ) : (
          <div>
            {filtered.map((g, i) => (
              <GoalRow key={`${g.matchNo}-${g.goalNo}`} goal={g} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
