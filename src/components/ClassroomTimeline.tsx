import React, { useEffect, useState } from "react";
import { useSocket } from "../context/SocketContext";
import { useStore } from "../store";
import { motion, AnimatePresence } from "motion/react";
import { Clock, Play, FileText, UserPlus, UserMinus, HelpCircle, MessageSquare, Shield, Activity } from "lucide-react";
import { api } from "../api/client";
import { useTimelineSocket } from "../hooks/sockets/useTimelineSocket";

interface AuditLog {
  id: string;
  action: string;
  details: any;
  createdAt: string;
  performedBy?: string;
}

export function ClassroomTimeline({ participants }: { participants: any[] }) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const { socket } = useSocket();
  const token = useStore((state) => state.token);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const data = await api.audit.list();
        setLogs(data);
      } catch (err) {
        console.error("Failed to fetch audit logs", err);
      }
    };
    fetchLogs();
  }, [token]);

  useTimelineSocket({
    onNewLog: (log: any) => {
        setLogs(prev => [log, ...prev]);
    }
  });

  return (
    <div className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-3xl border border-slate-200/50 dark:border-white/5 rounded-2xl p-5 flex flex-col h-[320px] shadow-sm overflow-hidden">
      <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-white/5 pb-2">
        <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-500 animate-pulse" />
          Session Timeline
        </h3>
        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-mono px-2 py-0.5 rounded-full">
          {logs.length} events
        </span>
      </div>
      <div className="flex-1 overflow-y-auto pl-4 pr-1 space-y-4 scrollbar-thin">
        <AnimatePresence initial={false}>
          {logs.map((log) => {
            let participantName = "System";
            if (log.performedBy) {
               const p = participants.find(x => x.id === log.performedBy);
               if (p) participantName = p.displayName;
               else participantName = "Someone";
            }
            
            const eventConfig = getEventConfig(log.action);
            const Icon = eventConfig.icon;
            
            return (
              <motion.div 
                key={log.id} 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="relative pl-7 pb-2 border-l border-slate-200/80 dark:border-slate-800/80 last:border-l-0"
              >
                <div className={`absolute -left-[14px] top-0 p-1 rounded-full border border-white dark:border-slate-900 ${eventConfig.bg}`}>
                  <Icon className={`w-3.5 h-3.5 ${eventConfig.color}`} />
                </div>
                
                <div className="flex justify-between items-center text-[10px] text-slate-400 dark:text-slate-400 mb-0.5 font-mono">
                  <span className="font-medium text-slate-500 dark:text-slate-300">{participantName}</span>
                  <span className="text-slate-400 flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
                <div className="text-sm font-medium text-slate-800 dark:text-slate-200 mt-0.5">
                  {eventConfig.label}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-normal">
                   {formatDetails(log.action, log.details)}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {logs.length === 0 && (
          <div className="text-sm text-slate-400 dark:text-slate-400 text-center py-12 flex flex-col items-center gap-2">
            <Clock className="w-8 h-8 text-slate-300 dark:text-slate-600" />
            <p>Waiting for session activity...</p>
          </div>
        )}
      </div>
    </div>
  );
}

function getEventConfig(action: string) {
    switch (action) {
        case "POLL_CREATED": 
            return { icon: HelpCircle, bg: "bg-orange-50 dark:bg-orange-950/40", color: "text-orange-600 dark:text-orange-400", label: "Poll Started" };
        case "POLL_ENDED":
            return { icon: HelpCircle, bg: "bg-slate-100 dark:bg-slate-800", color: "text-slate-600 dark:text-slate-400", label: "Poll Stopped" };
        case "RESOURCE_UPLOADED": 
            return { icon: FileText, bg: "bg-blue-50 dark:bg-blue-950/40", color: "text-blue-600 dark:text-blue-400", label: "Resource Shared" };
        case "RESOURCE_REMOVED": 
            return { icon: FileText, bg: "bg-red-50 dark:bg-red-950/40", color: "text-red-600 dark:text-red-400", label: "Resource Deleted" };
        case "PARTICIPANT_JOINED": 
            return { icon: UserPlus, bg: "bg-green-50 dark:bg-green-950/40", color: "text-green-600 dark:text-green-400", label: "Participant Joined" };
        case "PARTICIPANT_LEFT": 
            return { icon: UserMinus, bg: "bg-slate-100 dark:bg-slate-800", color: "text-slate-500 dark:text-slate-400", label: "Participant Left" };
        case "ROOM_CREATED": 
            return { icon: Play, bg: "bg-indigo-50 dark:bg-indigo-950/40", color: "text-indigo-600 dark:text-indigo-400", label: "Session Started" };
        case "CHAT_MESSAGE_SENT": 
            return { icon: MessageSquare, bg: "bg-purple-50 dark:bg-purple-950/40", color: "text-purple-600 dark:text-purple-400", label: "Message Shared" };
        case "PARTICIPANT_STATUS_UPDATED": 
            return { icon: Shield, bg: "bg-amber-50 dark:bg-amber-950/40", color: "text-amber-600 dark:text-amber-400", label: "Role/Status Updated" };
        case "PARTICIPANT_HAND_RAISED":
            return { icon: HelpCircle, bg: "bg-yellow-50 dark:bg-yellow-950/40", color: "text-yellow-600 dark:text-yellow-400", label: "Hand Raised" };
        default: 
            return { icon: Activity, bg: "bg-slate-50 dark:bg-slate-800", color: "text-slate-500 dark:text-slate-300", label: action };
    }
}

function formatDetails(action: string, details: any) {
    if (!details) return "";
    switch (action) {
        case "POLL_CREATED": return `created a poll: "${details.question}"`;
        case "POLL_ENDED": return "closed the active poll and compiled responses";
        case "RESOURCE_UPLOADED": return `shared: "${details.title || "unnamed file"}" (${details.resourceType || "resource"})`;
        case "RESOURCE_REMOVED": return `removed a previously shared lecture asset`;
        case "CHAT_MESSAGE_SENT": return `shared an interactive message with the session`;
        case "PARTICIPANT_STATUS_UPDATED": return `status changed to ${details.status}`;
        case "PARTICIPANT_HAND_RAISED": return details.isRaised ? "raised their hand to ask a question" : "lowered their hand";
        default: return "";
    }
}
