import { useEffect } from "react";
import { useSocket } from "../../context/SocketContext";

export interface ReactionSocketOptions {
  onReactionReceived?: (reaction: any) => void;
}

export function useReactionSocket(options?: ReactionSocketOptions) {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    const handleReaction = (reaction: any) => {
      if (options?.onReactionReceived) {
        options.onReactionReceived(reaction);
      }
    };

    socket.on("EMOJI_REACTION_RECEIVED", handleReaction);

    return () => {
      socket.off("EMOJI_REACTION_RECEIVED", handleReaction);
    };
  }, [socket, options]);
}
