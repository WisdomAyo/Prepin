import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Route, Routes } from "react-router-dom";
import "./index.css";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { SessionPage } from "./pages/SessionPage";
import { PrepPage } from "./pages/PrepPage";
import { HistoryPage } from "./pages/HistoryPage";
import { MeetingPage } from "./pages/MeetingPage";
import { AssessmentPage } from "./pages/AssessmentPage";
import { ResourcesPage } from "./pages/ResourcesPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

const isElectron = typeof window !== "undefined" && "copilotDesktop" in window;
const Router = isElectron ? HashRouter : BrowserRouter;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/session/:sessionId" element={<SessionPage />} />
            <Route path="/prep" element={<PrepPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/meeting" element={<MeetingPage />} />
            <Route path="/assessment" element={<AssessmentPage />} />
            <Route path="/resources" element={<ResourcesPage />} />
          </Routes>
        </Layout>
      </Router>
    </QueryClientProvider>
  </React.StrictMode>,
);
