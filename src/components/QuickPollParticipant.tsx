import React, { useState, useEffect } from "react";
import { useSocket } from "../context/SocketContext";
import { useStore } from "../store";
import { useRoomStore } from "../store/roomStore";
import { BarChart3, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { usePollSocket } from "../hooks/sockets/usePollSocket";

export function QuickPollParticipant() {
  const { socket } = useSocket();
  const participantId = useStore((state) => state.participantId);
  const poll = useRoomStore((state) => state.poll);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  useEffect(() => {
    if (poll && poll.votes && participantId && poll.votes[participantId] !== undefined) {
      setSelectedOption(poll.votes[participantId]);
    } else if (!poll) {
      setSelectedOption(null);
    }
  }, [poll, participantId]);

  usePollSocket({
    onPollStarted: () => {
      setSelectedOption(null);
    },
    onPollStopped: () => {
      setSelectedOption(null);
    }
  });

  if (!poll) return null;

  const handleVote = (index: number) => {
    if (selectedOption !== null || !socket) return;
    setSelectedOption(index);
    socket.emit("SUBMIT_POLL_VOTE", { optionIndex: index });
  };

  return (
    <div id="active-poll-container" className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-3xl border border-indigo-200/45 dark:border-indigo-500/20 p-5 rounded-2xl mb-4 shadow-sm w-full relative overflow-hidden transition duration-200">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500" />
      
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100 dark:border-white/5">
        <BarChart3 className="w-4 h-4 text-indigo-500 animate-pulse" />
        <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
          Live Interactive Poll
        </span>
      </div>

      <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 mb-4 leading-snug">
        {poll.question}
      </h3>

      <div className="space-y-2.5">
        {poll.options.map((opt, i) => {
          const isSelected = selectedOption === i;
          const hasVotedAny = selectedOption !== null;
          
          let optionStyle = "bg-white border-slate-200 dark:bg-slate-950/30 dark:border-white/5 dark:text-slate-200 hover:border-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-900";
          if (isSelected) {
            optionStyle = "bg-indigo-50/50 border-indigo-400 text-indigo-900 dark:bg-indigo-950/40 dark:border-indigo-500/50 dark:text-indigo-300 font-medium";
          } else if (hasVotedAny) {
            optionStyle = "bg-slate-50 border-slate-200/60 text-slate-400 dark:bg-slate-900/20 dark:border-white/5 dark:text-slate-400 opacity-60 cursor-not-allowed";
          }

          return (
            <motion.button
              key={i}
              whileTap={{ scale: hasVotedAny ? 1 : 0.98 }}
              onClick={() => handleVote(i)}
              disabled={hasVotedAny}
              className={`w-full text-left px-4 py-3 rounded-xl border text-xs flex items-center justify-between transition cursor-pointer ${optionStyle}`}
            >
              <span>{opt}</span>
              {isSelected && (
                <span className="flex items-center gap-1 font-bold text-indigo-600 dark:text-indigo-400">
                  <Check className="w-3.5 h-3.5" /> Voted
                </span>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
