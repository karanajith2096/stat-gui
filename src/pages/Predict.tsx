import { useMemo, useState } from "react";
import { getTeams } from "../lib/derive";
import { dixonColesPredict, fitDixonColes } from "../lib/models/dixonColes";
import { eloPredict, fitElo } from "../lib/models/elo";
import { poissonPredict } from "../lib/models/poisson";
import type { Prediction } from "../lib/types";
import { useWorkbook } from "../store/workbook";

export function Predict() {
  const matches = useWorkbook((s) => s.matches);
  const teams = useMemo(() => getTeams(matches), [matches]);
  const [home, setHome] = useState<string>(teams[0] ?? "");
  const [away, setAway] = useState<string>(teams[1] ?? "");

  const dcFit = useMemo(() => fitDixonColes(matches), [matches]);
  const eloFit = useMemo(() => fitElo(matches), [matches]);

  const preds: Prediction[] = useMemo(() => {
    if (!home || !away || home === away) return [];
    return [
      poissonPredict(matches, home, away),
      dixonColesPredict(dcFit, matches, home, away),
      eloPredict(eloFit, home, away),
    ];
  }, [matches, home, away, dcFit, eloFit]);

  return (
    <div>
      <div className="beta-banner">
        <b>Beta</b> — predictions based on a partial single season (~30 matches per team). Directional only, not authoritative.
      </div>

      <div className="card">
        <h2 className="card-title">Match predictor</h2>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <label>Home <select value={home} onChange={(e) => setHome(e.target.value)}>
            {teams.map((t) => <option key={t} value={t}>{t}</option>)}
          </select></label>
          <span className="subtle">vs</span>
          <label>Away <select value={away} onChange={(e) => setAway(e.target.value)}>
            {teams.map((t) => <option key={t} value={t}>{t}</option>)}
          </select></label>
        </div>
      </div>

      {home === away && <div className="card"><div className="subtle">Pick two different teams.</div></div>}

      {home !== away && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          {preds.map((p) => <PredictionCard key={p.modelName} p={p} />)}
        </div>
      )}
    </div>
  );
}

function PredictionCard({ p }: { p: Prediction }) {
  const pct = (v: number) => (v * 100).toFixed(1) + "%";
  return (
    <div className="card">
      <h2 className="card-title">{p.modelName}</h2>
      <div style={{ display: "flex", height: 14, borderRadius: 3, overflow: "hidden", marginBottom: 10 }}>
        <div style={{ width: `${p.pHome * 100}%`, background: "#4db3ff" }} title={`Home ${pct(p.pHome)}`} />
        <div style={{ width: `${p.pDraw * 100}%`, background: "#8ea0b2" }} title={`Draw ${pct(p.pDraw)}`} />
        <div style={{ width: `${p.pAway * 100}%`, background: "#f5a623" }} title={`Away ${pct(p.pAway)}`} />
      </div>
      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <Mini label={p.home} value={pct(p.pHome)} />
        <Mini label="Draw" value={pct(p.pDraw)} />
        <Mini label={p.away} value={pct(p.pAway)} />
      </div>
      {p.supportsScoreline ? (
        <>
          <div style={{ marginTop: 12 }}>
            <div className="subtle">Expected goals</div>
            <div><b>{p.lambdaHome.toFixed(2)}</b> – <b>{p.lambdaAway.toFixed(2)}</b></div>
          </div>
          <div style={{ marginTop: 8 }}>
            <div className="subtle">Top scorelines</div>
            <table className="stat-table" style={{ marginTop: 4 }}>
              <tbody>
                {p.topScorelines.map((s, i) => (
                  <tr key={i}>
                    <td className="col-team">{s.score[0]}–{s.score[1]}</td>
                    <td>{pct(s.p)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 8, display: "flex", gap: 20 }}>
            <div><div className="subtle">BTTS</div>{pct(p.pBTTS)}</div>
            <div><div className="subtle">Over 2.5</div>{pct(p.pOver25)}</div>
          </div>
        </>
      ) : (
        <div className="subtle" style={{ marginTop: 12 }}>Elo doesn't model goal totals — H/D/A only.</div>
      )}
      <div className="subtle" style={{ marginTop: 10, fontSize: 11 }}>Beta</div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-tile" style={{ padding: 10 }}>
      <div className="label" style={{ fontSize: 10 }}>{label}</div>
      <div className="value" style={{ fontSize: 18 }}>{value}</div>
    </div>
  );
}
