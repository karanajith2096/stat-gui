import { useState } from "react";
import { parseGoalsCsv, parseMatchesCsv } from "../lib/parseCsv";
import { useWorkbook } from "../store/workbook";

export function CsvUpload() {
  const setData = useWorkbook((s) => s.setData);
  const [matchesFile, setMatchesFile] = useState<File | null>(null);
  const [goalsFile, setGoalsFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<string>("");

  const handleLoad = async () => {
    if (!matchesFile || !goalsFile) return;
    setLoading(true);
    setErrors([]);
    setInfo("");
    try {
      const [{ matches, errors: e1 }, { goals, errors: e2 }] = await Promise.all([
        parseMatchesCsv(matchesFile),
        parseGoalsCsv(goalsFile),
      ]);
      const allErrors = [...e1, ...e2];
      if (allErrors.length > 0) {
        setErrors(allErrors);
        setLoading(false);
        return;
      }
      setData(matches, goals);
      setInfo(`Loaded ${matches.length} matches and ${goals.length} goals.`);
    } catch (e) {
      setErrors([String(e)]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="upload-screen">
      <div>
        <h1>Premier League Stats</h1>
        <p className="subtle">Upload the Matches and Goals sheets exported as CSV from your workbook.</p>
      </div>
      <div className="upload-row">
        <label className={`upload-box ${matchesFile ? "ready" : ""}`}>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setMatchesFile(e.target.files?.[0] ?? null)}
          />
          <div style={{ fontWeight: 600 }}>Matches.csv</div>
          <div className="subtle" style={{ marginTop: 6 }}>
            {matchesFile ? matchesFile.name : "Click to select"}
          </div>
        </label>
        <label className={`upload-box ${goalsFile ? "ready" : ""}`}>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setGoalsFile(e.target.files?.[0] ?? null)}
          />
          <div style={{ fontWeight: 600 }}>Goals.csv</div>
          <div className="subtle" style={{ marginTop: 6 }}>
            {goalsFile ? goalsFile.name : "Click to select"}
          </div>
        </label>
      </div>
      <button
        className="toggle-group"
        style={{ padding: "10px 22px", fontSize: 14, background: "var(--accent)", color: "#0b1419", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 500 }}
        disabled={!matchesFile || !goalsFile || loading}
        onClick={handleLoad}
      >
        {loading ? "Loading…" : "Load data"}
      </button>
      {info && <div style={{ color: "var(--accent-2)" }}>{info}</div>}
      {errors.length > 0 && (
        <div style={{ color: "var(--danger)", maxWidth: 600 }}>
          <b>Errors:</b>
          <ul>{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </div>
      )}
      <div className="subtle" style={{ maxWidth: 560, textAlign: "center" }}>
        In Excel: File → Save As → CSV UTF-8, separately for the <code>Matches</code> and <code>Goals</code>
        sheets. Both files are required.
      </div>
    </div>
  );
}
