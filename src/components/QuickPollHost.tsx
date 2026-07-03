import React, { useState, useEffect } from "react";
import { useSocket } from "../context/SocketContext";
import { useRoomStore } from "../store/roomStore";
import { Plus, Play, StopCircle, HelpCircle, BarChart3 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { usePollSocket } from "../hooks/sockets/usePollSocket";

export function QuickPollHost() {
  const { socket } = useSocket();
  const poll = useRoomStore((state) => state.poll);
  
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["Yes", "No"]);
  const [isPollActive, setIsPollActive] = useState(false);
  const [votes, setVotes] = useState<number[]>([]);

  useEffect(() => {
    if (poll) {
       setQuestion(poll.question);
       setOptions(poll.options);
       setIsPollActive(true);
       
       const newVotes = new Array(poll.options.length).fill(0);
       if (poll.votes) {
           Object.values(poll.votes).forEach((index: any) => {
              newVotes[index] = (newVotes[index] || 0) + 1;
           });
       }
       setVotes(newVotes);
    } else {
       setIsPollActive(false);
    }
  }, [poll]);

  usePollSocket({
    onPollVoteReceived: (pollId, optionIndex) => {
      setVotes((prev) => {
        const newVotes = [...prev];
        // Note: original had count=1 in payload, but the hook standardizes it to optionIndex
        newVotes[optionIndex] = (newVotes[optionIndex] || 0) + 1;
        return newVotes;
      });
    }
  });

  const startPoll = () => {
    if (!question || options.length < 2 || !socket) return;
    setIsPollActive(true);
    setVotes(new Array(options.length).fill(0));
    socket.emit("START_POLL", { question, options });
  };

  const stopPoll = () => {
    if (!socket) return;
    setIsPollActive(false);
    socket.emit("STOP_POLL");
  };

  const addOption = () => setOptions([...options, ""]);
  const updateOption = (index: number, val: string) => {
    const newOptions = [...options];
    newOptions[index] = val;
    setOptions(newOptions);
  };

  const chartData = options.map((opt, i) => ({
    name: opt,
    votes: votes[i] || 0,
  }));

  if (isPollActive) {
    return (
      <div className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-3xl border border-slate-200/50 dark:border-white/5 p-5 rounded-2xl mb-4 shadow-sm w-full">
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-white/5">
            <span className="text-xs font-semibold uppercase tracking-wider text-orange-500 flex items-center gap-1.5 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-orange-500" />
              Active Session Poll
            </span>
            <button
              onClick={stopPoll}
              className="text-xs font-medium bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-xl border border-red-200/40 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400 font-mono transition cursor-pointer"
            >
              Stop Poll
            </button>
          </div>
          <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 leading-snug">
            {question}
          </h3>
        </div>
        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
              <YAxis allowDecimals={false} stroke="#94a3b8" fontSize={11} tickLine={false} />
              <Tooltip cursor={{ fill: "rgba(99, 102, 241, 0.05)" }} />
              <Bar dataKey="votes" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-3xl border border-slate-200/50 dark:border-white/5 p-5 rounded-2xl mb-4 shadow-sm w-full">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100 dark:border-white/5">
        <BarChart3 className="w-4 h-4 text-indigo-500" />
        <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Quick Poll Builder
        </h3>
      </div>
      
      <div className="space-y-3.5">
        <input
          type="text"
          placeholder="What concept is being queried?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 dark:text-slate-100 p-2.5 rounded-xl text-xs outline-none focus:border-indigo-500 placeholder-slate-400"
        />
        
        <div className="space-y-2">
          {options.map((opt, i) => (
            <input
              key={i}
              type="text"
              placeholder={`Answer choice option ${i + 1}`}
              value={opt}
              onChange={(e) => updateOption(i, e.target.value)}
              className="w-full border border-slate-200/80 dark:border-slate-800/80 bg-white/50 dark:bg-slate-950/20 dark:text-slate-100 p-2.5 rounded-xl text-xs outline-none focus:border-indigo-500 placeholder-slate-400"
            />
          ))}
        </div>

        <div className="flex justify-between items-center gap-3 pt-2 border-t border-slate-100 dark:border-white/5">
          <button
            onClick={addOption}
            className="flex items-center justify-center gap-1 text-[11px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 py-2 px-3.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Option
          </button>
          
          <button
            onClick={startPoll}
            disabled={!question || options.length < 2}
            className="flex items-center justify-center gap-1 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-600 dark:hover:bg-indigo-500 py-2 px-4 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" /> Broadcast Poll
          </button>
        </div>
      </div>
    </div>
  );
}
