import React, { useState } from "react";
import { Check, X, ShieldAlert, BadgeCheck, Users, HelpCircle, Clock, Trash } from "lucide-react";

export function ParticipantList({
  participants,
  onApprove,
  onApproveAll,
  onReject,
  onRemove,
  onPromoteToCohost,
  onDemoteFromCohost,
}: {
  participants: any[];
  onApprove?: (id: string) => void;
  onApproveAll?: () => void;
  onReject?: (id: string) => void;
  onRemove?: (id: string) => void;
  onPromoteToCohost?: (id: string) => void;
  onDemoteFromCohost?: (id: string) => void;
}) {
  const [assignId, setAssignId] = useState("");
  const waitingCount = participants.filter((p) => p.status === "WAITING").length;

  const handleAssignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignId.trim()) return;
    if (onPromoteToCohost) {
      onPromoteToCohost(assignId.trim());
      setAssignId("");
    }
  };

  return (
    <div className="bg-transparent flex flex-col flex-1 min-h-[250px] overflow-hidden">
      <div className="p-4 border-b border-slate-100 dark:border-white/5 font-semibold text-xs uppercase tracking-widest text-slate-400 dark:text-slate-300 flex items-center justify-between shrink-0">
        <span className="flex items-center gap-1.5 font-mono">
          <Users className="w-3.5 h-3.5 text-blue-500" />
          Roster
        </span>
        <span className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-mono text-[10px] px-2 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-900/30">
          {participants.filter((p) => p.status === "ONLINE").length} active
        </span>
      </div>

      {onPromoteToCohost && (
        <form onSubmit={handleAssignSubmit} className="p-3 bg-slate-50/50 dark:bg-slate-950/10 border-b border-slate-100 dark:border-white/5 flex gap-2 shrink-0">
          <input
            type="text"
            placeholder="Assign Co-Host by ID..."
            value={assignId}
            onChange={(e) => setAssignId(e.target.value)}
            className="flex-1 text-[11px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono min-w-0"
          />
          <button
            type="submit"
            className="text-[10px] bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 text-white font-bold px-2 py-1 rounded-lg transition-all cursor-pointer shrink-0"
          >
            Assign
          </button>
        </form>
      )}

      {waitingCount > 0 && onApproveAll && (
        <div className="px-4 py-3 bg-indigo-50/60 dark:bg-indigo-950/20 border-b border-indigo-100/50 dark:border-indigo-900/20 flex items-center justify-between shrink-0 gap-2">
          <div className="flex flex-col">
            <span className="text-[9px] font-mono text-indigo-600 dark:text-indigo-400 uppercase tracking-widest font-extrabold">
              Lobby Queue
            </span>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              {waitingCount} pending {waitingCount === 1 ? "request" : "requests"}
            </span>
          </div>
          <button
            onClick={() => onApproveAll()}
            className="text-[10px] bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 text-white font-bold py-1.5 px-3 rounded-lg transition-all shadow-sm shadow-indigo-600/10 flex items-center gap-1 cursor-pointer"
          >
            <Check className="w-3.5 h-3.5 stroke-[2.5]" /> Approve All
          </button>
        </div>
      )}
      
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        {participants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400 dark:text-slate-400">
            <Users className="w-8 h-8 mb-2 stroke-1 text-slate-300 dark:text-slate-600" />
            <p className="text-xs font-semibold">Session empty</p>
            <p className="text-[10px] opacity-70">Waiting for connections</p>
          </div>
        ) : (
          participants.map((p) => {
            const isHost = p.role === "HOST" || p.role === "COHOST";
            
            return (
              <div 
                key={p.id} 
                className="flex flex-col text-xs p-3 bg-white dark:bg-slate-950/40 hover:bg-slate-50 dark:hover:bg-slate-900 border border-slate-200/40 dark:border-white/5 rounded-xl transition duration-150 relative group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      {/* Avatar initials fallback */}
                      <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-700 dark:text-slate-300 font-sans border border-slate-200 dark:border-slate-700 uppercase">
                        {(p.displayName || "P").substring(0, 2)}
                      </div>
                      <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white dark:border-slate-900 ${p.status === 'ONLINE' ? 'bg-emerald-500' : p.status === 'AWAY' ? 'bg-yellow-500' : 'bg-slate-400'}`} />
                    </div>
                    
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1">
                        {p.displayName || p.id.split("-")[0]}
                        {p.handRaised && (
                          <span 
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-500 text-white animate-pulse border border-amber-400 shadow-sm shadow-amber-500/10 ml-1.5" 
                            title="Participant hand is raised to ask a question"
                            aria-label="Participant Hand Raised"
                          >
                            <span className="animate-bounce">✋</span>
                            <span className="uppercase tracking-wider font-mono text-[8px]">HELP</span>
                          </span>
                        )}
                        {isHost && (
                          <span title="Host Authority">
                            <BadgeCheck className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                          </span>
                        )}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-450 font-mono flex items-center gap-1 capitalize">
                        {p.role.toLowerCase()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-[10px]">
                    <span className="text-slate-400 dark:text-slate-400 font-mono text-[9px]">
                      {p.status === "ONLINE" ? "Active" : p.status === "AWAY" ? "Away" : "Offline"}
                    </span>
                  </div>
                </div>
                
                {/* Details / Smart Attendance Metadata */}
                <div className="mt-2 text-[9px] text-slate-400 dark:text-slate-400 font-mono flex items-center gap-2 border-t border-slate-100 dark:border-white/5 pt-2">
                  <span className="flex items-center gap-0.5">
                    <Clock className="w-2.5 h-2.5" />
                    Joined {p.joinedAt ? new Date(p.joinedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Recently"}
                  </span>
                  {p.rejoins && p.rejoins > 0 && (
                    <span className="text-blue-500">
                      • {p.rejoins} rejoins
                    </span>
                  )}
                </div>

                {/* Approvals Control Queue */}
                {p.status === "WAITING" && onApprove && onReject && (
                  <div className="flex gap-2 mt-3 pt-2 border-t border-slate-100 dark:border-white/5">
                    <button
                      onClick={() => onApprove(p.id)}
                      className="flex-1 text-[10px] bg-indigo-600 dark:bg-indigo-500 text-white dark:text-slate-100 rounded-lg py-1 hover:bg-indigo-700 font-medium flex items-center justify-center gap-1 transition"
                    >
                      <Check className="w-3 h-3" /> Approve
                    </button>
                    <button
                      onClick={() => onReject(p.id)}
                      className="flex-1 text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg py-1 hover:bg-slate-200 dark:hover:bg-slate-700 font-medium flex items-center justify-center gap-1 transition"
                    >
                      <X className="w-3 h-3" /> Reject
                    </button>
                  </div>
                )}
                
                {/* Co-Host Promotion Actions */}
                {p.status === "ONLINE" && p.role === "PARTICIPANT" && onPromoteToCohost && (
                  <div className="mt-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex gap-2">
                    <button
                      onClick={() => onPromoteToCohost(p.id)}
                      className="flex-1 text-[10px] text-blue-600 dark:text-indigo-400 bg-blue-50 hover:bg-blue-100 dark:bg-indigo-950/20 dark:hover:bg-indigo-900/40 rounded-lg py-1 font-medium transition"
                    >
                      Promote
                    </button>
                    {onRemove && (
                      <button
                        onClick={() => onRemove(p.id)}
                        className="flex-1 text-[10px] text-red-600 dark:text-red-400 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-900/40 rounded-lg py-1 font-medium transition flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Trash className="w-3 h-3" /> Remove
                      </button>
                    )}
                  </div>
                )}
                
                {/* Co-Host Demotion Actions */}
                {p.status === "ONLINE" && p.role === "COHOST" && onDemoteFromCohost && (
                  <div className="mt-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex gap-2">
                    <button
                      onClick={() => onDemoteFromCohost(p.id)}
                      className="flex-1 text-[10px] text-rose-600 dark:text-rose-400 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-900/40 rounded-lg py-1 font-medium transition cursor-pointer"
                    >
                      Demote
                    </button>
                    {onRemove && (
                      <button
                        onClick={() => onRemove(p.id)}
                        className="flex-1 text-[10px] text-red-600 dark:text-red-400 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-900/40 rounded-lg py-1 font-medium transition flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Trash className="w-3 h-3" /> Remove
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
