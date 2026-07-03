import { BrowserRouter, Routes, Route } from "react-router";
import { Toaster } from "sonner";
import { ThemeProvider } from "./components/ThemeProvider";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { HostDashboard } from "./components/HostDashboard";
import { ParticipantDashboard } from "./components/ParticipantDashboard";
import { CommandPalette } from "./components/CommandPalette";
import { LandingPage } from "./features/LandingPage/LandingPage";

export default function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="app-theme">
      <BrowserRouter>
        <ErrorBoundary>
          <CommandPalette />
          <Toaster position="top-right" richColors />
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/host/:roomId" element={<HostDashboard />} />
            <Route path="/join/:roomId" element={<ParticipantDashboard />} />
          </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    </ThemeProvider>
  );
}
