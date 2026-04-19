import { Navigate, Route, Routes } from "react-router-dom";
import { useWorkbook } from "./store/workbook";
import { CsvUpload } from "./components/CsvUpload";
import { Layout } from "./components/Layout";
import { LeagueTable } from "./pages/LeagueTable";
import { Scorers } from "./pages/Scorers";
import { Team } from "./pages/Team";
import { Trends } from "./pages/Trends";
import { Progression } from "./pages/Progression";
import { Predict } from "./pages/Predict";
import { Highlights } from "./pages/Highlights";

export default function App() {
  const hasData = useWorkbook((s) => s.matches.length > 0 && s.goals.length > 0);
  if (!hasData) {
    return <CsvUpload />;
  }
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<LeagueTable />} />
        <Route path="/scorers" element={<Scorers />} />
        <Route path="/team/:name" element={<Team />} />
        <Route path="/trends" element={<Trends />} />
        <Route path="/progression" element={<Progression />} />
        <Route path="/predict" element={<Predict />} />
        <Route path="/highlights" element={<Highlights />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
