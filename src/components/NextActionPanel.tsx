import React from "react";
import { useNextAction } from "../hooks/useNextAction";
import { CheckCircle2, Clock, ArrowRight, Lightbulb, Presentation, FileText, Vote } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface NextActionPanelProps {
  resources: any[];
}

export function NextActionPanel({ resources }: NextActionPanelProps) {
  const { currentAction } = useNextAction(resources);

  const getIcon = (type: string) => {
    switch (type) {
      case "POLL": return <Vote className="w-5 h-5" />;
      case "WHITEBOARD": return <Presentation className="w-5 h-5" />;
      case "NEW_RESOURCE": return <FileText className="w-5 h-5" />;
      case "REVIEW_NOTES": return <Lightbulb className="w-5 h-5" />;
      default: return <CheckCircle2 className="w-5 h-5" />;
    }
  };

  const getStyle = (type: string) => {
    switch (type) {
      case "POLL": 
        return {
          bg: "from-indigo-500/10 to-purple-500/10",
          border: "border-indigo-200/50 dark:border-indigo-500/20",
          text: "text-indigo-700 dark:text-indigo-400"
        };
      case "WHITEBOARD": 
        return {
          bg: "from-emerald-500/10 to-teal-500/10",
          border: "border-emerald-200/50 dark:border-emerald-500/20",
          text: "text-emerald-700 dark:text-emerald-400"
        };
      case "NEW_RESOURCE": 
        return {
          bg: "from-blue-500/10 to-cyan-500/10",
          border: "border-blue-200/50 dark:border-blue-500/20",
          text: "text-blue-700 dark:text-blue-400"
        };
      default: 
        return {
          bg: "from-slate-500/10 to-slate-400/10",
          border: "border-slate-200/50 dark:border-slate-700/50",
          text: "text-slate-700 dark:text-slate-400"
        };
    }
  };

  const styleConfig = getStyle(currentAction.type);

  const handleCtaClick = () => {
    let elementId = "";
    if (currentAction.type === "POLL") {
      elementId = "active-poll-container";
    } else if (currentAction.type === "WHITEBOARD") {
      elementId = "shared-canvas-container";
    } else if (currentAction.type === "NEW_RESOURCE") {
      elementId = currentAction.payload?.id 
        ? `participant-resource-${currentAction.payload.id}` 
        : "resources-container";
    } else if (currentAction.type === "REVIEW_NOTES") {
      elementId = "personal-notes-container";
    }

    const element = elementId ? document.getElementById(elementId) : null;
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      
      // Premium highlight effect (temporary border ring, scaling, shadow pulse)
      element.classList.add("ring-4", "ring-indigo-500", "dark:ring-indigo-400", "scale-[1.01]", "shadow-2xl", "z-10", "transition-all", "duration-300");
      setTimeout(() => {
        element.classList.remove("ring-4", "ring-indigo-500", "dark:ring-indigo-400", "scale-[1.01]", "shadow-2xl", "z-10");
      }, 2000);
    } else {
      window.scrollBy({ top: 300, behavior: 'smooth' });
    }
  };

  return (
    <div className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-3xl border border-slate-200/50 dark:border-white/10 rounded-[1.5rem] p-5 shadow-sm overflow-hidden relative group">
      <div className={`absolute inset-0 bg-gradient-to-br opacity-50 ${styleConfig.bg} ${styleConfig.border} transition-colors duration-500`} />
      
      <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-xl bg-white dark:bg-slate-800 shadow-sm shrink-0 ${styleConfig.text}`}>
            {getIcon(currentAction.type)}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Next Action
              </span>
              {currentAction.estimatedTime && (
                <span className="flex items-center gap-1 text-[10px] font-medium bg-white/50 dark:bg-slate-800/50 px-2 py-0.5 rounded-full text-slate-500 dark:text-slate-400">
                  <Clock className="w-3 h-3" />
                  {currentAction.estimatedTime}
                </span>
              )}
            </div>
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg leading-tight mb-1">
              {currentAction.title}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {currentAction.description}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-stretch sm:items-end gap-2 w-full sm:w-auto mt-2 sm:mt-0 shrink-0">
          <button 
            onClick={handleCtaClick}
            className="flex items-center justify-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-5 py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 transition group-hover:scale-[1.02] cursor-pointer"
          >
            {currentAction.primaryCta}
            <ArrowRight className="w-4 h-4" />
          </button>
          {currentAction.secondarySuggestion && (
            <span className="text-xs text-slate-500 dark:text-slate-400 text-center sm:text-right">
              Tip: {currentAction.secondarySuggestion}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
