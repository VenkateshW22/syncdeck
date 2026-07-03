import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { Clock, Users, Flame, FileText, HelpCircle, Shield, UserCheck, Activity } from "lucide-react";
import { useSocket } from "../context/SocketContext";
import { useRoomStore } from "../store/roomStore";
import { useStore } from "../store";
import { api } from "../api/client";
import { usePollSocket } from "../hooks/sockets/usePollSocket";
import { useTimelineSocket } from "../hooks/sockets/useTimelineSocket";

export function SessionSummary({
  participants,
  resources,
}: {
  participants: any[];
  resources: any[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState("00:00");
  const [activePoll, setActivePoll] = useState<any>(null);
  const [votes, setVotes] = useState<number[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  
  const token = useStore((state) => state.token);
  const { socket } = useSocket();

  // Duration Timer
  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - startTime) / 1000);
      const m = Math.floor(diff / 60)
        .toString()
        .padStart(2, "0");
      const s = (diff % 60).toString().padStart(2, "0");
      setDuration(`${m}:${s}`);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch Audit Logs on Mount and on activity updates
  useEffect(() => {
    if (!token) return;
    const fetchLogs = async () => {
      try {
        const data = await api.audit.list();
        // Keep the top 6 events to maintain a pristine, tight layout in the report
        setAuditLogs(data.slice(0, 6));
      } catch (err) {
        console.error("Failed to fetch audit logs in SessionSummary", err);
      }
    };
    fetchLogs();
  }, [token, resources.length, participants.length]);

  // Listen to Poll socket events & timeline logs
  const poll = useRoomStore((state) => state.poll);

  useEffect(() => {
    if (poll) {
      setActivePoll(poll);
      const newVotes = new Array(poll.options.length).fill(0);
      if (poll.votes) {
        Object.values(poll.votes).forEach((index: any) => {
          newVotes[index] = (newVotes[index] || 0) + 1;
        });
      }
      setVotes(newVotes);
    } else {
      setActivePoll((prev: any) => prev ? { ...prev, isCompleted: true } : null);
    }
  }, [poll]);

  usePollSocket({
    onPollVoteReceived: (pollId, optionIndex) => {
      setVotes((prev) => {
        const newVotes = [...prev];
        newVotes[optionIndex] = (newVotes[optionIndex] || 0) + 1;
        return newVotes;
      });
    },
    onPollStarted: (pollId, question, options) => {
      setActivePoll({ id: pollId, question, options });
      setVotes(new Array(options.length).fill(0));
    },
    onPollStopped: () => {
      setActivePoll((prev: any) => prev ? { ...prev, isCompleted: true } : null);
    }
  });

  useTimelineSocket({
    onNewLog: (log: any) => {
      setAuditLogs((prev) => [log, ...prev].slice(0, 6));
    }
  });

  // Engagement calculations
  const totalParticipants = participants.length > 0 ? participants.filter(p => p.role === "PARTICIPANT").length : 0;
  const activeParticipants = participants.filter(p => p.role === "PARTICIPANT" && p.status === "ONLINE").length;
  const engagementPercentage = totalParticipants > 0 ? Math.round((activeParticipants / totalParticipants) * 100) : 100;

  // D3 live sparkline trend
  useEffect(() => {
    if (!containerRef.current) return;
    const width = 90;
    const height = 36;

    d3.select(containerRef.current).selectAll("*").remove();

    const svg = d3
      .select(containerRef.current)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .append("g");

    const data = Array.from({ length: 20 }, (_, i) => ({
      time: i,
      value: Math.max(10, Math.min(105, 45 + Math.random() * 35 - 15)),
    }));

    data[data.length - 1].value = Math.min(
      100,
      data[data.length - 1].value + resources.length * 6
    );

    const x = d3.scaleLinear().domain([0, 19]).range([0, width]);
    const y = d3
      .scaleLinear()
      .domain([0, 100])
      .range([height - 2, 2]);

    const line = d3
      .line<any>()
      .x((d) => x(d.time))
      .y((d) => y(d.value))
      .curve(d3.curveMonotoneX);

    const area = d3
      .area<any>()
      .x((d) => x(d.time))
      .y0(height)
      .y1((d) => y(d.value))
      .curve(d3.curveMonotoneX);

    const defs = svg.append("defs");
    const gradient = defs
      .append("linearGradient")
      .attr("id", "indigo-glow-summary")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "0%")
      .attr("y2", "100%");
    gradient
      .append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "#4f46e5")
      .attr("stop-opacity", 0.3);
    gradient
      .append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "#4f46e5")
      .attr("stop-opacity", 0);

    svg
      .append("path")
      .datum(data)
      .attr("fill", "url(#indigo-glow-summary)")
      .attr("d", area);

    svg
      .append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", "#4f46e5")
      .attr("stroke-width", 2)
      .attr("stroke-linecap", "round")
      .attr("d", line);
  }, [resources.length]);

  const formatTime = (isoString?: string) => {
    if (!isoString) return "--:--";
    try {
      return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return "--:--";
    }
  };

  const totalVotes = votes.reduce((a, b) => a + b, 0);

  return (
    <div className="w-full space-y-6">
      {/* 1. Key Statistics Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Metric 1: Session Timer */}
        <div className="bg-[#f8fafc] dark:bg-slate-900 border border-[#e2e8f0] dark:border-white/5 p-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-mono text-[#64748b] uppercase tracking-wider">
                Live Duration
              </div>
              <div className="text-lg font-bold font-mono text-[#0f172a] dark:text-slate-100">
                {duration}
              </div>
            </div>
          </div>
        </div>

        {/* Metric 2: Attendance statistics */}
        <div className="bg-[#f8fafc] dark:bg-slate-900 border border-[#e2e8f0] dark:border-white/5 p-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-mono text-[#64748b] uppercase tracking-wider">
                Total Joined
              </div>
              <div className="text-lg font-bold text-[#0f172a] dark:text-slate-100">
                {participants.length} <span className="text-xs font-normal text-[#64748b]">members</span>
              </div>
            </div>
          </div>
        </div>

        {/* Metric 3: Active Focus (Pulse) */}
        <div className="bg-[#f8fafc] dark:bg-slate-900 border border-[#e2e8f0] dark:border-white/5 p-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-mono text-[#64748b] uppercase tracking-wider">
                Engagement Index
              </div>
              <div className="text-lg font-bold text-[#0f172a] dark:text-slate-100">
                {engagementPercentage}% <span className="text-xs font-normal text-[#64748b]">pulse</span>
              </div>
            </div>
          </div>
          <div ref={containerRef} className="opacity-90 flex-shrink-0 overflow-hidden"></div>
        </div>

        {/* Metric 4: Shared Resources count */}
        <div className="bg-[#f8fafc] dark:bg-slate-900 border border-[#e2e8f0] dark:border-white/5 p-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-mono text-[#64748b] uppercase tracking-wider">
                Shared Assets
              </div>
              <div className="text-lg font-bold text-[#0f172a] dark:text-slate-100">
                {resources.length} <span className="text-xs font-normal text-[#64748b]">shared</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Detailed Attendance & Engagement Roster */}
      <div className="bg-[#f8fafc] dark:bg-slate-900/60 border border-[#e2e8f0] dark:border-white/5 p-5 rounded-xl">
        <div className="flex items-center gap-2 mb-4">
          <UserCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#475569] dark:text-slate-300">
            Attendance & Engagement Roster ({participants.length} Active Users)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#e2e8f0] dark:border-white/5 text-[11px] font-mono uppercase text-[#64748b] dark:text-slate-400">
                <th className="pb-2.5 font-semibold">Attendee Name</th>
                <th className="pb-2.5 font-semibold">Role</th>
                <th className="pb-2.5 font-semibold">Joined At</th>
                <th className="pb-2.5 font-semibold">Status</th>
                <th className="pb-2.5 font-semibold">Interaction Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0] dark:divide-white/5 text-xs text-[#334155] dark:text-slate-300">
              {participants.map((p) => {
                const isHost = p.role === "HOST";
                const isCohost = p.role === "COHOST";
                
                const roleLabel = isHost ? "Session Host" : isCohost ? "Co-Host" : "Attendee";
                const roleColor = isHost 
                  ? "bg-purple-100/75 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200/50" 
                  : isCohost 
                    ? "bg-indigo-100/75 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200/50" 
                    : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border border-slate-200/30";

                const statusColor = 
                  p.status === "ONLINE" 
                    ? "bg-emerald-500" 
                    : p.status === "AWAY" 
                      ? "bg-amber-500" 
                      : "bg-slate-400";

                return (
                  <tr key={p.id} className="hover:bg-white/20 dark:hover:bg-slate-800/10">
                    <td className="py-3 font-semibold text-[#0f172a] dark:text-slate-200 flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${statusColor}`} />
                      {p.displayName}
                    </td>
                    <td className="py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${roleColor}`}>
                        {roleLabel}
                      </span>
                    </td>
                    <td className="py-3 font-mono text-[#64748b] dark:text-slate-400">
                      {formatTime(p.joinedAt)}
                    </td>
                    <td className="py-3 capitalize font-medium">
                      {p.status ? p.status.toLowerCase() : "online"}
                    </td>
                    <td className="py-3">
                      {p.handRaised ? (
                        <span className="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded border border-amber-200/40 text-[10px] font-bold">
                          ✋ Hand Raised
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded border border-emerald-200/40 text-[10px] font-medium">
                          ✓ Checked In
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {participants.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[#64748b]">
                    No attendees detected in current roster list.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Bento Grid: Interactive Polls Summary & Shared Assets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left Grid: Poll Results */}
        <div className="bg-[#f8fafc] dark:bg-slate-900/60 border border-[#e2e8f0] dark:border-white/5 p-5 rounded-xl">
          <div className="flex items-center gap-2 mb-4 border-b border-[#e2e8f0] dark:border-white/5 pb-2.5">
            <HelpCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#475569] dark:text-slate-300">
              Interactive Poll Summaries
            </h3>
          </div>

          {activePoll ? (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-start gap-4 mb-1">
                  <h4 className="font-semibold text-sm text-[#0f172a] dark:text-slate-100">
                    {activePoll.question}
                  </h4>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${activePoll.isCompleted ? "bg-slate-100 text-slate-600 border border-slate-200" : "bg-orange-100 text-orange-800 border border-orange-200 animate-pulse"}`}>
                    {activePoll.isCompleted ? "Closed" : "Active"}
                  </span>
                </div>
                <p className="text-[10px] text-[#64748b] font-mono">
                  Total Submissions: {totalVotes} votes
                </p>
              </div>

              <div className="space-y-3 pt-2">
                {activePoll.options.map((opt: string, i: number) => {
                  const optVotes = votes[i] || 0;
                  const percentage = totalVotes > 0 ? Math.round((optVotes / totalVotes) * 100) : 0;
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium text-[#334155] dark:text-slate-300">
                        <span>{opt}</span>
                        <span className="font-mono">{optVotes} ({percentage}%)</span>
                      </div>
                      <div className="w-full bg-[#e2e8f0] dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-indigo-600 h-full rounded-full" 
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-[#64748b] flex flex-col items-center justify-center gap-2">
              <HelpCircle className="w-8 h-8 text-[#cbd5e1] dark:text-slate-700" />
              <p>No interactive quick polls were broadcasted in this session yet.</p>
            </div>
          )}
        </div>

        {/* Right Grid: Shared Learning Assets */}
        <div className="bg-[#f8fafc] dark:bg-slate-900/60 border border-[#e2e8f0] dark:border-white/5 p-5 rounded-xl">
          <div className="flex items-center gap-2 mb-4 border-b border-[#e2e8f0] dark:border-white/5 pb-2.5">
            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#475569] dark:text-slate-300">
              Shared Learning Materials ({resources.length})
            </h3>
          </div>

          <div className="space-y-3 max-h-56 overflow-y-auto">
            {resources.map((r, idx) => {
              const dateStr = formatTime(r.createdAt);
              const isCode = r.resourceType === "CODE";
              const isLink = r.resourceType === "LINK";
              const label = isCode ? "Code Snippet" : isLink ? "Reference Link" : "Notice";
              
              const labelColor = isCode
                ? "bg-blue-50 text-blue-700 border-blue-200/40"
                : isLink
                  ? "bg-teal-50 text-teal-700 border-teal-200/40"
                  : "bg-purple-50 text-purple-700 border-purple-200/40";

              return (
                <div key={r.id || idx} className="bg-white dark:bg-slate-900 border border-[#e2e8f0] dark:border-white/5 p-3 rounded-lg flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-mono font-semibold px-2 py-0.5 rounded border ${labelColor}`}>
                        {label}
                      </span>
                      <h4 className="text-xs font-semibold text-[#0f172a] dark:text-slate-200">
                        {r.title || "Shared Resource"}
                      </h4>
                    </div>
                    {r.description && (
                      <p className="text-[11px] text-[#475569] dark:text-slate-400 line-clamp-1">
                        {r.description}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-[#64748b] shrink-0">
                    {dateStr}
                  </span>
                </div>
              );
            })}

            {resources.length === 0 && (
              <div className="py-12 text-center text-xs text-[#64748b] flex flex-col items-center justify-center gap-2">
                <FileText className="w-8 h-8 text-[#cbd5e1] dark:text-slate-700" />
                <p>No learning assets or references have been distributed.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Activity Log / Session Timeline */}
      <div className="bg-[#f8fafc] dark:bg-slate-900/60 border border-[#e2e8f0] dark:border-white/5 p-5 rounded-xl">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#475569] dark:text-slate-300">
            Recent Activity Log & Session Audit Trail
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {auditLogs.length > 0 ? (
            auditLogs.map((log) => {
              const timeStr = new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
              let performer = "System";
              if (log.performedBy) {
                const userObj = participants.find((x) => x.id === log.performedBy);
                if (userObj) performer = userObj.displayName;
                else performer = "User";
              }

              return (
                <div key={log.id} className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-[#e2e8f0] dark:border-white/5 flex items-start gap-3">
                  <div className="bg-slate-50 dark:bg-slate-800 p-1.5 rounded-md shrink-0 text-slate-500">
                    <Shield className="w-3.5 h-3.5" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-semibold text-slate-500">{performer}</span>
                      <span className="text-[9px] font-mono text-[#64748b]">{timeStr}</span>
                    </div>
                    <p className="text-xs font-medium text-[#334155] dark:text-slate-200">
                      {log.action.replace(/_/g, " ")}
                    </p>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-2 py-8 text-center text-xs text-[#64748b]">
              No active session logs recorded yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
