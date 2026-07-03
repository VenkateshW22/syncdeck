import React, { useState } from "react";
import { usePersonalNotes } from "../hooks/usePersonalNotes";
import { useNextAction } from "../hooks/useNextAction";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { 
  FileEdit, 
  Eye, 
  Search, 
  Download, 
  Save, 
  Wand2, 
  X,
  FileText,
  FileDown
} from "lucide-react";
import { toast } from "sonner";

interface PersonalNotesPanelProps {
  roomId: string | undefined;
  resources: any[];
}

export function PersonalNotesPanel({ roomId, resources }: PersonalNotesPanelProps) {
  const {
    content,
    setContent,
    lastSaved,
    searchQuery,
    setSearchQuery,
    insertSmartAction,
    exportNotes
  } = usePersonalNotes(roomId);

  const { currentAction, activePoll } = useNextAction(resources);

  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [showSmartActions, setShowSmartActions] = useState(false);

  const handleSmartInsert = (action: string) => {
    switch (action) {
      case "poll":
        if (activePoll) {
          insertSmartAction(`\n### Poll: ${activePoll.question}\n- [ ] ${activePoll.options.join("\n- [ ] ")}`);
          toast.success("Inserted active poll");
        } else {
          toast.error("No active poll to insert");
        }
        break;
      case "resource":
        if (resources.length > 0) {
          const res = resources[0];
          insertSmartAction(`\n### Resource: ${res.title || res.type}\nLink: ${res.url || "Attached file"}`);
          toast.success("Inserted latest resource");
        } else {
          toast.error("No resources shared yet");
        }
        break;
      case "topic":
        insertSmartAction(`\n### Current Topic: \n\n`);
        break;
    }
    setShowSmartActions(false);
  };

  return (
    <div className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-3xl border border-slate-200/50 dark:border-white/10 rounded-[1.5rem] flex flex-col shadow-sm overflow-hidden h-[400px]">
      
      {/* Header */}
      <div className="p-3 border-b border-slate-200/50 dark:border-white/5 flex items-center justify-between gap-2 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-slate-500" />
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Personal Notes</h3>
          {lastSaved && (
            <span className="text-[10px] text-slate-400 flex items-center gap-1 ml-2">
              <Save className="w-3 h-3" />
              Saved {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <div className="relative group">
            <button 
              onClick={() => setShowSmartActions(!showSmartActions)}
              className="p-1.5 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              title="Smart Actions"
            >
              <Wand2 className="w-4 h-4" />
            </button>
            {showSmartActions && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden z-10">
                <div className="px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700">
                  Insert into Notes
                </div>
                <button onClick={() => handleSmartInsert("poll")} className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 cursor-pointer">
                  Current Poll
                </button>
                <button onClick={() => handleSmartInsert("resource")} className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 cursor-pointer">
                  Latest Resource
                </button>
                <button onClick={() => handleSmartInsert("topic")} className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 cursor-pointer">
                  New Topic Header
                </button>
              </div>
            )}
          </div>

          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => setMode("edit")}
              className={`p-1.5 rounded-md text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                mode === "edit" ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              <FileEdit className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setMode("preview")}
              className={`p-1.5 rounded-md text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                mode === "preview" ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="relative group flex items-center">
            <button 
              className="p-1.5 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              title="Export"
            >
              <Download className="w-4 h-4" />
            </button>
            <div className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden z-10 hidden group-hover:block">
              <button onClick={() => exportNotes("pdf")} className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer flex items-center gap-2">
                <FileDown className="w-3.5 h-3.5" /> PDF
              </button>
              <button onClick={() => exportNotes("md")} className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer flex items-center gap-2">
                <FileDown className="w-3.5 h-3.5" /> Markdown
              </button>
              <button onClick={() => exportNotes("txt")} className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer flex items-center gap-2">
                <FileText className="w-3.5 h-3.5" /> Text
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar / Search */}
      <div className="px-3 py-2 border-b border-slate-100 dark:border-white/5 bg-white dark:bg-slate-900 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search notes..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto bg-white dark:bg-slate-900 relative">
        {mode === "edit" ? (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Type your notes here... Markdown is supported! Use Smart Actions to instantly pull in polls or resources."
            className="w-full h-full p-4 resize-none bg-transparent outline-none text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-mono placeholder:text-slate-400 dark:placeholder:text-slate-600"
            spellCheck="false"
          />
        ) : (
          <div className="p-4 prose prose-sm dark:prose-invert max-w-none text-slate-800 dark:text-slate-200">
            {content ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {searchQuery ? content.replace(new RegExp(`(${searchQuery})`, 'gi'), '==$1==') : content}
              </ReactMarkdown>
            ) : (
              <div className="text-center py-12 text-slate-400 dark:text-slate-500 flex flex-col items-center">
                <FileText className="w-8 h-8 mb-2 opacity-50" />
                <p>No notes yet.</p>
                <p className="text-xs mt-1">Switch to edit mode to start typing.</p>
              </div>
            )}
          </div>
        )}
        
        {/* Simple highlight overlay for edit mode search (mock for simplicity, real highlighting in textarea is complex) */}
        {mode === "edit" && searchQuery && content.toLowerCase().includes(searchQuery.toLowerCase()) && (
          <div className="absolute top-2 right-4 text-[10px] bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-500 px-2 py-1 rounded font-medium">
            Matches found
          </div>
        )}
      </div>
    </div>
  );
}
