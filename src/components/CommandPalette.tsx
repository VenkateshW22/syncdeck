import React, { useEffect, useState, useRef } from "react";
import { useStore } from "../store";
import { useSocket } from "../context/SocketContext";
import { Command, Tv, Hand, Shield, Users, Search, Play, Keyboard } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { socket } = useSocket();
  const role = useStore((state) => state.role);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // support both Meta+K / Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => inputRef.current?.focus(), 80);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!isOpen) return null;

  const actions = [
    { 
       name: "Share Screen and Cast", 
       action: () => socket?.emit("START_SCREEN_SHARE"), 
       role: "HOST",
       icon: Tv,
       desc: "Stream your current desktop to participants"
    },
    { 
       name: "Stop Presenting Screen", 
       action: () => socket?.emit("STOP_SCREEN_SHARE"), 
       role: "HOST",
       icon: Tv,
       desc: "Terminate live screen sharing"
    },
    { 
       name: "Mute All Participants", 
       action: () => {
          socket?.emit("BROADCAST_RESOURCES", { type: "ANNOUNCEMENT", title: "Global Silence", metadata: { message: "The Host has muted participant microphones." } });
       }, 
       role: "HOST",
       icon: Shield,
       desc: "Enforce strict session listening mode"
    },
    { 
       name: "Raise Hand (Ask Question)", 
       action: () => socket?.emit("RAISE_HAND", { isRaised: true }), 
       role: "PARTICIPANT",
       icon: Hand,
       desc: "Signal you wish to speak or participate"
    },
    { 
       name: "Lower Hand", 
       action: () => socket?.emit("RAISE_HAND", { isRaised: false }), 
       role: "PARTICIPANT",
       icon: Hand,
       desc: "Lower your raised hand"
    },
    { 
       name: "Toggle Active Whiteboard", 
       action: () => document.getElementById("clear-whiteboard-btn")?.click(), 
       role: "HOST",
       icon: Play,
       desc: "Clear visual whiteboard assets"
    }
  ];

  const filteredActions = actions.filter((a) => 
     (a.role === role || a.role === "ALL") && 
     (a.name.toLowerCase().includes(query.toLowerCase()) || a.desc.toLowerCase().includes(query.toLowerCase()))
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredActions.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredActions.length) % Math.max(1, filteredActions.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredActions[selectedIndex]) {
        filteredActions[selectedIndex].action();
        setIsOpen(false);
        setQuery("");
      }
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] bg-slate-950/40 backdrop-blur-md flex items-start justify-center pt-[15vh] p-4 transition-all"
      onClick={() => setIsOpen(false)}
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.97, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: -8 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl shadow-2xl rounded-2xl border border-slate-200/50 dark:border-white/10 w-full max-w-xl overflow-hidden flex flex-col relative ring-1 ring-black/5"
        onClick={e => e.stopPropagation()}
      >
        {/* Glow Element */}
        <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />
        
        <div className="p-4 border-b border-slate-100 dark:border-white/5 flex items-center gap-3">
          <Search className="w-5 h-5 text-indigo-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent outline-none text-slate-800 dark:text-slate-100 font-sans text-sm placeholder-slate-400"
            placeholder="Type a command (Cmd / Ctrl + K)..."
            value={query}
            onKeyDown={handleKeyDown}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
          />
          <div className="flex items-center gap-1">
            <kbd className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md text-slate-400 font-mono font-medium tracking-tight">ESC</kbd>
          </div>
        </div>

        <div className="max-h-[350px] overflow-y-auto p-2 scrollbar-none">
          {filteredActions.length === 0 ? (
            <div className="text-xs text-slate-400 dark:text-slate-400 p-8 text-center flex flex-col items-center gap-1.5">
              <span className="text-lg">🔍</span>
              <p className="font-medium">No system actions matched</p>
              <p className="opacity-75">Try searching for keywords like 'share', 'mute' or 'hand'</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredActions.map((action, i) => {
                const ActionIcon = action.icon;
                const isSelected = i === selectedIndex;
                
                return (
                  <button
                    key={i}
                    onMouseEnter={() => setSelectedIndex(i)}
                    className={`w-full text-left px-3.5 py-3 rounded-xl flex items-center justify-between transition-all duration-100 ${
                      isSelected 
                        ? "bg-indigo-600 text-white dark:bg-indigo-500" 
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-slate-800/40"
                    }`}
                    onClick={() => {
                        action.action();
                        setIsOpen(false);
                        setQuery("");
                    }}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className={`p-1.5 rounded-lg shrink-0 ${
                         isSelected 
                           ? "bg-white/20 text-white" 
                           : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                      }`}>
                        <ActionIcon className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-xs truncate leading-tight">
                          {action.name}
                        </span>
                        <span className={`text-[10px] leading-tight mt-0.5 truncate ${
                          isSelected ? "text-indigo-100" : "text-slate-400 dark:text-slate-400"
                        }`}>
                          {action.desc}
                        </span>
                      </div>
                    </div>
                    <span className={`text-[9px] font-mono font-semibold tracking-wider transition ${
                      isSelected ? "opacity-100 text-white" : "opacity-0"
                    }`}>
                      ENTER ↵
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Subtle keyboard shortcuts hint footer */}
        <div className="p-3 bg-slate-50/80 dark:bg-slate-900/30 border-t border-slate-100 dark:border-white/5 px-4 flex items-center justify-between text-[10px] text-slate-400">
           <span className="flex items-center gap-1.5">
              <Keyboard className="w-3.5 h-3.5" />
              Use <kbd className="font-mono">↑↓</kbd> to navigate • <kbd className="font-mono">Enter</kbd> to select
           </span>
           <span className="font-mono font-bold uppercase text-[9px] tracking-wider text-indigo-500">
              SyncDeck Command Engine
           </span>
        </div>
      </motion.div>
    </div>
  );
}
