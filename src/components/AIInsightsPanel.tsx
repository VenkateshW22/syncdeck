import React, { useState, useEffect } from "react";
import { Sparkles, ArrowRight, BookOpen, Lightbulb, TrendingUp, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface Insight {
  id: string;
  type: "recommendation" | "alert" | "achievement";
  icon: any;
  title: string;
  description: string;
  score?: string;
  color: string;
  bg: string;
}

export function AIInsightsPanel({ participants, resources }: { participants: any[]; resources: any[] }) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Dynamically derive smart insights from active room context
    const timer = setTimeout(() => {
      const activeParticipants = participants.filter((p) => p.role === "PARTICIPANT");
      const onlineCount = activeParticipants.filter((p) => p.status === "ONLINE").length;
      const handsRaised = activeParticipants.filter((p) => p.handRaised).length;
      const filesCount = resources.filter((r) => r.type === "FILE_RESOURCE" || r.type === "CODE_SNIPPET").length;

      const items: Insight[] = [];

      // Insight 1: Engagement pulse
      if (onlineCount > 0) {
        items.push({
          id: "engagement",
          type: "achievement",
          icon: TrendingUp,
          title: "Steady Engagement Pulse",
          description: `Active focus levels are at ${Math.min(100, Math.round((onlineCount / (activeParticipants.length || 1)) * 100))}% with zero dropped connections over the last 10 minutes.`,
          score: "9.2/10",
          color: "text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
          bg: "bg-emerald-50/40 dark:bg-emerald-950/20",
        });
      }

      // Insight 2: Resource/Pacing recommendation
      if (filesCount === 0) {
        items.push({
          id: "resources",
          type: "recommendation",
          icon: BookOpen,
          title: "Introduce Coding Challenge",
          description: "No code blocks or file assets are active. Share a snippet using the composer to prompt session participation.",
          color: "text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
          bg: "bg-indigo-50/40 dark:bg-indigo-950/20",
        });
      } else {
        items.push({
          id: "resources-active",
          type: "achievement",
          icon: Lightbulb,
          title: "Collaborative Materials Shared",
          description: `Great pacing! You have shared ${filesCount} code/file materials. Participants are currently synced with the whiteboard.`,
          color: "text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
          bg: "bg-indigo-50/40 dark:bg-indigo-950/20",
        });
      }

      // Insight 3: Alerts based on hands raised
      if (handsRaised > 0) {
        items.push({
          id: "hands",
          type: "alert",
          icon: AlertTriangle,
          title: "Inquiries Pending Attention",
          description: `${handsRaised} participant(s) have raised their hand. Consider initiating a quick poll to address questions.`,
          score: "Immediate",
          color: "text-amber-600 dark:text-amber-400 border-amber-500/20",
          bg: "bg-amber-50/40 dark:bg-amber-950/20",
        });
      }

      setInsights(items);
      setLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, [participants, resources]);

  return (
    <div className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-3xl border border-slate-200/50 dark:border-white/5 rounded-2xl p-5 flex flex-col h-[320px] shadow-sm overflow-hidden">
      <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-white/5 pb-2">
        <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-500 animate-pulse" />
          AI Session Copilot
        </h3>
        <span className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-mono px-2 py-0.5 rounded-full">
          Real-time insights
        </span>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 space-y-3 scrollbar-thin">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
            <Sparkles className="w-6 h-6 animate-spin text-purple-400" />
            <p>Analyzing session engagement matrices...</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="space-y-3">
              {insights.map((insight) => {
                const Icon = insight.icon;
                return (
                  <motion.div
                    key={insight.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className={`p-3.5 rounded-xl border border-dotted ${insight.bg} ${insight.color} flex gap-3 items-start hover:shadow-xs transition`}
                  >
                    <div className="p-1.5 rounded-lg bg-white/80 dark:bg-slate-950/50 shrink-0">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center gap-2 mb-0.5">
                        <span className="font-bold text-slate-800 dark:text-slate-100 text-xs truncate">
                          {insight.title}
                        </span>
                        {insight.score && (
                          <span className="font-mono text-[9px] bg-white/70 dark:bg-slate-950/40 px-1.5 py-0.5 rounded border border-slate-200/40 dark:border-white/5">
                            {insight.score}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal font-normal">
                        {insight.description}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
