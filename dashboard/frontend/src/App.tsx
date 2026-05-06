import { Route, Routes } from "react-router-dom";

import Layout from "./components/Layout";
import EventDetail from "./pages/EventDetail";
import FlaggedEvents from "./pages/FlaggedEvents";
import Labels from "./pages/Labels";
import Overview from "./pages/Overview";
import PipelineHealth from "./pages/PipelineHealth";
import RuleMetrics from "./pages/RuleMetrics";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Overview />} />
        <Route path="/flagged" element={<FlaggedEvents />} />
        <Route path="/events/:eventId" element={<EventDetail />} />
        <Route path="/rules" element={<RuleMetrics />} />
        <Route path="/labels" element={<Labels />} />
        <Route path="/pipeline" element={<PipelineHealth />} />
      </Route>
    </Routes>
  );
}
