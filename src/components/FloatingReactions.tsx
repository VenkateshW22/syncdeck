import React, { useEffect, useState, useRef } from "react";
import { useSocket } from "../context/SocketContext";
import { motion, AnimatePresence } from "motion/react";
import { useReactionSocket } from "../hooks/sockets/useReactionSocket";

interface Reaction {
  id: string;
  emoji: string;
  senderName: string;
  xPercent: number; // random starting horizontal point
  scale: number;    // slightly randomized size
  duration: number; // slightly randomized float speed
}

export function FloatingReactions() {
  const { socket } = useSocket();
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const timeoutsRef = useRef<Set<NodeJS.Timeout>>(new Set());

  useReactionSocket({
    onReactionReceived: (data: { id: string; emoji: string; senderName: string }) => {
      const newReaction: Reaction = {
        id: data.id,
        emoji: data.emoji,
        senderName: data.senderName,
        // Distribute starting X across the bottom-middle of the screen
        xPercent: 15 + Math.random() * 70, // 15% to 85%
        scale: 0.8 + Math.random() * 0.4,   // 0.8 to 1.2
        duration: 3 + Math.random() * 1.5,  // 3 to 4.5 seconds
      };

      setReactions((prev) => [...prev, newReaction]);

      // Automatically prune reaction after animation is done to avoid bloating state
      const timeout = setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== data.id));
        timeoutsRef.current.delete(timeout);
      }, 5000);
      timeoutsRef.current.add(timeout);
    }
  });

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current.clear();
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden select-none">
      <AnimatePresence>
        {reactions.map((r) => (
          <motion.div
            key={r.id}
            initial={{ 
              opacity: 0, 
              y: "110vh", 
              x: `${r.xPercent}vw`, 
              scale: r.scale,
              rotate: 0 
            }}
            animate={{ 
              opacity: [0, 1, 1, 0],
              y: "-10vh",
              // Elegant sideways drift/wiggle
              x: [
                `${r.xPercent}vw`,
                `${r.xPercent + (Math.random() > 0.5 ? 5 : -5)}vw`,
                `${r.xPercent + (Math.random() > 0.5 ? 10 : -10)}vw`,
                `${r.xPercent + (Math.random() > 0.5 ? -3 : 3)}vw`
              ],
              rotate: [0, -15, 15, -5, 0],
            }}
            exit={{ opacity: 0 }}
            transition={{ 
              duration: r.duration, 
              ease: "easeOut" 
            }}
            className="absolute flex flex-col items-center justify-center"
            style={{ originX: 0.5, originY: 0.5 }}
          >
            {/* The Floating Emoji */}
            <span className="text-4xl filter drop-shadow-md select-none">{r.emoji}</span>
            
            {/* Tiny high-contrast name pill floating beneath the emoji */}
            <span className="mt-1 bg-slate-900/80 dark:bg-slate-950/95 backdrop-blur-md text-white border border-white/10 dark:border-white/5 px-2 py-0.5 rounded-full text-[9px] font-medium tracking-tight whitespace-nowrap shadow-sm">
              {r.senderName}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
