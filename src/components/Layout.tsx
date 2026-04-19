import { NavLink, useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { useWorkbook } from "../store/workbook";
import { getTeams } from "../lib/derive";

export function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const matches = useWorkbook((s) => s.matches);
  const clear = useWorkbook((s) => s.clear);
  const teams = useMemo(() => getTeams(matches), [matches]);

  return (
    <div className="app">
      <nav className="nav">
        <span className="brand">PL Stats</span>
        <NavLink to="/" end>Table</NavLink>
        <NavLink to="/scorers">Scorers</NavLink>
        <NavLink to="/highlights">Highlights</NavLink>
        <NavLink to="/trends">Trends</NavLink>
        <NavLink to="/progression">Progression</NavLink>
        <NavLink to="/predict">Predict</NavLink>
        <span className="spacer" />
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) navigate(`/team/${encodeURIComponent(e.target.value)}`);
          }}
        >
          <option value="">Select team…</option>
          {teams.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <button className="danger" onClick={() => { if (confirm("Clear loaded data?")) clear(); }}>
          Clear data
        </button>
      </nav>
      <div className="content">{children}</div>
    </div>
  );
}
