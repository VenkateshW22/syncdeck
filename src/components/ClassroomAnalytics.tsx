import React from "react";
import { Users, Activity } from "lucide-react";

export function ClassroomAnalytics({ participants }: { participants: any[] }) {
  const activeParticipants = participants.filter(p => p.role === "PARTICIPANT");
  const onlineCount = activeParticipants.filter(p => p.status === "ONLINE").length;
  const awayCount = activeParticipants.filter(p => p.status === "AWAY").length;
  const offlineCount = activeParticipants.filter(p => p.status === "OFFLINE").length;
  const total = activeParticipants.length;
  
  // Calculate a premium numeric engagement index
  const engagementRate = total > 0 ? Math.round(((onlineCount + awayCount * 0.5) / total) * 100) : 100;

  return (
    <div className="bg-transparent border-b border-slate-100 dark:border-white/5 p-5 flex-shrink-0 flex flex-col gap-4">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-500" />
          Live Attendance
        </h3>
        <p className="text-[10px] text-slate-400 dark:text-slate-400 font-mono">
          {onlineCount} active • {awayCount} idle • {offlineCount} offline
        </p>
      </div>

      {/* Visual Presence Grid / Participant Wall */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-medium text-slate-500 dark:text-slate-300 uppercase tracking-widest font-mono">
          Visual Attendance Wall ({total} participants)
        </span>
        
        {total === 0 ? (
          <div className="h-12 flex items-center justify-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-[11px] text-slate-400">
            Waiting for session participants...
          </div>
        ) : (
          <div className="grid grid-cols-6 gap-1.5 p-2 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-200/40 dark:border-white/5">
            {activeParticipants.map((participant) => {
              const statusColor = 
                participant.status === "ONLINE" 
                  ? "bg-emerald-500 ring-emerald-400/30" 
                  : participant.status === "AWAY" 
                    ? "bg-yellow-500 ring-yellow-400/30" 
                    : "bg-slate-300 dark:bg-slate-700 ring-slate-400/10";
              
              const handPulse = participant.handRaised ? "animate-bounce ring-4 ring-orange-500" : "";
              
              return (
                <div 
                  key={participant.id} 
                  className="group relative flex flex-col items-center justify-center p-1.5 bg-white dark:bg-slate-900 rounded-lg shadow-xs border border-slate-100 dark:border-white/5"
                >
                  <span className={`w-3 h-3 rounded-full ${statusColor} ring-2 ${handPulse} transition-all duration-300`} />
                  
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-2 hidden group-hover:block z-50 bg-slate-900 dark:bg-slate-900 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap shadow-xl border border-slate-800 pointer-events-none">
                    <p className="font-semibold">{participant.displayName}</p>
                    <p className="opacity-80">Status: <span className="font-mono">{participant.status}</span></p>
                    {participant.handRaised && (
                      <p className="text-amber-400 font-bold flex items-center gap-1.5 mt-0.5" aria-label="Hand Raised to Ask a Question">
                        <span className="animate-bounce">✋</span> Hand Raised
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Engagement Heatmap / Trend slider */}
      {total > 0 && (
        <div className="pt-2 border-t border-slate-100 dark:border-white/5">
          <div className="flex justify-between items-center text-xs mb-1.5">
            <span className="text-slate-400 font-mono text-[10px] uppercase tracking-widest">Active Engagement</span>
            <span className="text-slate-900 dark:text-slate-200 font-bold font-mono">{engagementRate}%</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-850 rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-indigo-500 dark:bg-indigo-400 h-1.5 rounded-full transition-all duration-500" 
              style={{ width: `${engagementRate}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
