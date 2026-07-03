import React from "react";
import { toast } from "sonner";

interface SessionControlsProps {
  resourcesLength: number;
  onGeneratePdf: () => void;
}

export function SessionControls({ resourcesLength, onGeneratePdf }: SessionControlsProps) {
  return (
    <div className="flex flex-wrap justify-between items-center gap-4 mb-4" data-html2canvas-ignore="true">
      <h3 className="font-semibold text-slate-800 dark:text-slate-100">
        Shared Resources ({resourcesLength})
      </h3>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={onGeneratePdf}
          className="text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-200 px-3 py-1.5 rounded hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm font-medium cursor-pointer"
        >
          Download Report
        </button>
        <button
          onClick={() => toast.success("Mute all feature triggered")}
          className="text-sm bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800/50 px-3 py-1.5 rounded hover:bg-orange-100 dark:hover:bg-orange-900/50 transition shadow-sm font-medium cursor-pointer"
        >
          Mute All
        </button>
      </div>
    </div>
  );
}
