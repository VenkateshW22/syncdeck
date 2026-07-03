import { useState, useEffect } from "react";
import { ThemeToggle } from "../../components/ThemeToggle";
import { ConstellationBg } from "./ConstellationBg";
import { LoginFormCard } from "./LoginFormCard";

export function LandingPage() {
  const [focusedInput, setFocusedInput] = useState<"hostName" | "adminKey" | "studentName" | "roomCode" | null>(null);
  const [isWarping, setIsWarping] = useState(false);
  const [warpProgress, setWarpProgress] = useState(0);
  const [activeTab, setActiveTab] = useState<"host" | "student">("host");

  // Handle successful jump warping animation ticks
  useEffect(() => {
    if (isWarping) {
      let cur = 0;
      const interval = setInterval(() => {
        cur += 0.024;
        if (cur >= 1) {
          cur = 1;
          clearInterval(interval);
        }
        setWarpProgress(cur);
      }, 16);
      return () => clearInterval(interval);
    } else {
      setWarpProgress(0);
    }
  }, [isWarping]);

  // Connections/Cards active dynamic highlight colors
  const activeGlowColor = activeTab === "host" ? "#6366F1" : "#FF4081";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#060814] text-slate-800 dark:text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans transition-colors duration-500">
      
      {/* Absolute high-performance interactive background constellation */}
      <ConstellationBg 
        focusedInput={focusedInput}
        isWarping={isWarping}
        warpProgress={warpProgress}
      />

      {/* Top Header Navigation bar */}
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center p-1.5 shadow-md">
            <img src="/favicon.svg" alt="SyncDeck" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-widest text-slate-800 dark:text-white/90 uppercase font-mono">
              SyncDeck
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
        </div>
      </header>

      {/* Center Glass Login Card Wrapper */}
      <main className="flex-1 flex items-center justify-center relative py-12 z-10 w-full">
        <LoginFormCard 
          isWarping={isWarping}
          setIsWarping={setIsWarping}
          focusedInput={focusedInput}
          setFocusedInput={setFocusedInput}
          activeGlowColor={activeGlowColor}
        />
      </main>

      {/* Footer system details */}
      <footer className="w-full max-w-7xl mx-auto px-6 py-6 text-center flex flex-col sm:flex-row justify-between items-center gap-3 z-10 text-slate-400 dark:text-slate-400">
        <p className="text-[9px] font-mono">
          © {new Date().getFullYear()} SyncDeck Session Synchronization Network.
        </p>
        <p className="text-[9px] font-mono">
          SECURE CONNECTION ESTABLISHED
        </p>
      </footer>
    </div>
  );
}
