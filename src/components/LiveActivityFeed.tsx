import React from "react";
import { useActivityFeed, FeedCategory } from "../hooks/useActivityFeed";
import { motion, AnimatePresence } from "motion/react";
import { 
  Clock, Play, FileText, UserPlus, UserMinus, HelpCircle, 
  MessageSquare, Shield, Activity, Filter, Info
} from "lucide-react";

interface LiveActivityFeedProps {
  participants: any[];
}

export function LiveActivityFeed({ participants }: LiveActivityFeedProps) {
  const { logs, filter, setFilter, totalLogs } = useActivityFeed();

  const categories: FeedCategory[] = [
    "All", "Resources", "Polls", "Chat", "Participants"
  ];

  return (
    <div className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-3xl border border-slate-200/50 dark:border-white/5 rounded-[1.5rem] p-5 flex flex-col h-[400px] shadow-sm overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-slate-100 dark:border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-500 animate-pulse" />
          <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">Live Activity Feed</h3>
          <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-mono px-2 py-0.5 rounded-full ml-1">
            {totalLogs} total
          </span>
        </div>
        
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <Filter className="w-3.5 h-3.5 text-slate-400 mr-1 shrink-0" />
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                filter === c 
                  ? "bg-indigo-500 text-white" 
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pl-5 pr-2 space-y-4 scrollbar-thin">
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
                className="relative pl-8 pb-3 border-l-2 border-slate-200 dark:border-slate-800 last:border-l-transparent last:pb-0"
              >
                <div className={`absolute -left-[17px] top-0 p-1.5 rounded-full border-2 border-white dark:border-slate-900 ${eventConfig.bg}`}>
                  <Icon className={`w-4 h-4 ${eventConfig.color}`} />
                </div>
                
                <div className="bg-slate-50/80 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-100 dark:border-slate-800/50">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-sm text-slate-800 dark:text-slate-200">
                      {eventConfig.label}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1 bg-white/50 dark:bg-slate-900/50 px-1.5 py-0.5 rounded">
                      <Clock className="w-2.5 h-2.5" />
                      {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  
                  <div className="text-xs text-slate-600 dark:text-slate-400 mb-1.5 leading-relaxed">
                    <span className="font-medium text-slate-700 dark:text-slate-300 mr-1">
                      {participantName}
                    </span>
                    {formatDetails(log.action, log.details)}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        
        {logs.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 py-8">
            <Info className="w-8 h-8 mb-3 opacity-50" />
            <p className="text-sm font-medium">No activity yet</p>
            <p className="text-xs mt-1">Events will appear here in real-time.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function getEventConfig(action: string) {
    switch (action) {
        case "POLL_CREATED": 
            return { icon: HelpCircle, bg: "bg-orange-100 dark:bg-orange-900/50", color: "text-orange-600 dark:text-orange-400", label: "Poll Started" };
        case "POLL_ENDED":
            return { icon: HelpCircle, bg: "bg-slate-200 dark:bg-slate-700", color: "text-slate-600 dark:text-slate-300", label: "Poll Stopped" };
        case "RESOURCE_UPLOADED": 
            return { icon: FileText, bg: "bg-blue-100 dark:bg-blue-900/50", color: "text-blue-600 dark:text-blue-400", label: "Resource Shared" };
        case "RESOURCE_REMOVED": 
            return { icon: FileText, bg: "bg-red-100 dark:bg-red-900/50", color: "text-red-600 dark:text-red-400", label: "Resource Deleted" };
        case "PARTICIPANT_JOINED": 
            return { icon: UserPlus, bg: "bg-emerald-100 dark:bg-emerald-900/50", color: "text-emerald-600 dark:text-emerald-400", label: "Participant Joined" };
        case "PARTICIPANT_LEFT": 
            return { icon: UserMinus, bg: "bg-slate-200 dark:bg-slate-700", color: "text-slate-500 dark:text-slate-400", label: "Participant Left" };
        case "ROOM_CREATED": 
            return { icon: Play, bg: "bg-indigo-100 dark:bg-indigo-900/50", color: "text-indigo-600 dark:text-indigo-400", label: "Session Started" };
        case "CHAT_MESSAGE_SENT": 
            return { icon: MessageSquare, bg: "bg-purple-100 dark:bg-purple-900/50", color: "text-purple-600 dark:text-purple-400", label: "Message Sent" };
        case "PARTICIPANT_STATUS_UPDATED": 
            return { icon: Shield, bg: "bg-amber-100 dark:bg-amber-900/50", color: "text-amber-600 dark:text-amber-400", label: "Status Updated" };
        case "PARTICIPANT_HAND_RAISED":
            return { icon: HelpCircle, bg: "bg-yellow-100 dark:bg-yellow-900/50", color: "text-yellow-600 dark:text-yellow-400", label: "Hand Raised" };
        default: 
            return { icon: Activity, bg: "bg-slate-200 dark:bg-slate-700", color: "text-slate-500 dark:text-slate-300", label: action };
    }
}

function formatDetails(action: string, details: any) {
    if (!details) return "";
    switch (action) {
        case "POLL_CREATED": return `created a poll: "${details.question}"`;
        case "POLL_ENDED": return "closed the active poll and compiled responses";
        case "RESOURCE_UPLOADED": return `shared a new asset: "${details.title || "unnamed file"}"`;
        case "RESOURCE_REMOVED": return `removed a shared resource`;
        case "CHAT_MESSAGE_SENT": return `shared a message with the room`;
        case "PARTICIPANT_STATUS_UPDATED": return `status changed to ${details.status}`;
        case "PARTICIPANT_HAND_RAISED": return details.isRaised ? "raised their hand" : "lowered their hand";
        default: return "";
    }
}
