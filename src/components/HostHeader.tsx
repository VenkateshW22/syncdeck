import React from "react";
import { ThemeToggle } from "./ThemeToggle";
import { JoinQRCode } from "./JoinQRCode";

interface HostHeaderProps {
  roomId?: string;
  isConnected: boolean;
  isConnecting: boolean;
  onEndSession: () => void;
}

export function HostHeader({
  roomId,
  isConnected,
  isConnecting,
  onEndSession,
}: HostHeaderProps) {
  return (
    <div className="p-4 border-b border-slate-100 dark:border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div className="flex items-center gap-3 w-full sm:w-auto">
        <img
          src="/favicon.svg"
          alt="SyncDeck Logo"
          className="w-8 h-8 rounded shrink-0"
        />
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 overflow-hidden">
          <h2 className="font-semibold text-base sm:text-lg truncate text-slate-800 dark:text-slate-100">
            SyncDeck Room: {roomId}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigator.clipboard.writeText(roomId || "")}
              className="text-[10px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300 font-medium border dark:border-slate-700 cursor-pointer shrink-0"
            >
              Copy
            </button>
            <span className="hidden xl:inline-block text-[10px] text-slate-400 font-normal">
              Press{" "}
              <kbd className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 border dark:border-slate-700 px-1 py-0.5 rounded">
                Cmd K
              </kbd>
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-3 sm:gap-4">
        <span
          className={
            isConnected
              ? "text-green-600 dark:text-green-400 font-mono text-xs sm:text-sm inline-flex items-center gap-1.5"
              : isConnecting
              ? "text-orange-500 dark:text-orange-400 font-mono text-xs sm:text-sm inline-flex items-center gap-1.5"
              : "text-red-500 dark:text-red-400 font-mono text-xs sm:text-sm inline-flex items-center gap-1.5"
          }
        >
          <span
            className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${
              isConnected
                ? "bg-green-500"
                : isConnecting
                ? "bg-orange-500 animate-pulse"
                : "bg-red-500"
            }`}
          ></span>
          <span className="hidden xs:inline">
            {isConnected ? "ONLINE" : isConnecting ? "CONNECTING..." : "OFFLINE"}
          </span>
          <span className="xs:hidden">
            {isConnected ? "ON" : isConnecting ? "..." : "OFF"}
          </span>
        </span>
        <div className="flex items-center gap-2 sm:gap-3">
          <JoinQRCode />
          <ThemeToggle />
          <button
            onClick={onEndSession}
            className="px-3 py-1.5 sm:px-4 sm:py-2 bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 font-semibold rounded-xl hover:bg-red-200 dark:hover:bg-red-900/50 transition cursor-pointer border border-red-200/50 dark:border-red-900/30 text-[10px] sm:text-xs shadow-xs"
          >
            End
          </button>
        </div>
      </div>
    </div>
  );
}
