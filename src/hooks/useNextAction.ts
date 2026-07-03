import { useState, useEffect } from "react";
import { useSocket } from "../context/SocketContext";
import { useStore } from "../store";
import { useRoomStore } from "../store/roomStore";
import { usePollSocket } from "./sockets/usePollSocket";
import { useCanvasSocket } from "./sockets/useCanvasSocket";

export type NextActionType = 
  | "POLL" 
  | "QUIZ" 
  | "WHITEBOARD" 
  | "NEW_RESOURCE" 
  | "ANNOUNCEMENT" 
  | "ASSIGNMENT" 
  | "AI_RECOMMENDATION" 
  | "REVIEW_NOTES";

export interface NextAction {
  type: NextActionType;
  title: string;
  description: string;
  estimatedTime?: string;
  primaryCta: string;
  secondarySuggestion?: string;
  payload?: any;
}

export function useNextAction(resources: any[]) {
  const { socket } = useSocket();
  const participantId = useStore((state) => state.participantId);
  const poll = useRoomStore((state) => state.poll);
  
  const [activePoll, setActivePoll] = useState<any>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [whiteboardActive, setWhiteboardActive] = useState(false);
  const [latestResource, setLatestResource] = useState<any>(null);
  
  useEffect(() => {
    if (poll) {
      setActivePoll(poll);
      if (poll.votes && poll.votes[participantId || ""] !== undefined) {
        setHasVoted(true);
      } else {
        setHasVoted(false);
      }
    } else {
      setActivePoll(null);
      setHasVoted(false);
    }
  }, [poll, participantId]);

  // Track new resources
  useEffect(() => {
      if (resources.length > 0) {
          setLatestResource(resources[0]);
      }
  }, [resources]);

  usePollSocket({
    onPollStarted: (pollId, question, options) => {
      setActivePoll({ id: pollId, question, options });
      setHasVoted(false);
    },
    onPollStopped: () => {
      setActivePoll(null);
      setHasVoted(false);
    }
  });

  useCanvasSocket({
    onDraw: () => {
      setWhiteboardActive(true);
    },
    onDrawLine: () => {
      setWhiteboardActive(true);
    }
  });

  // Derived state Priority
  let currentAction: NextAction = {
    type: "REVIEW_NOTES",
    title: "No active tasks.",
    description: "Review today's resources or continue taking notes.",
    primaryCta: "Open Notes",
  };

  if (activePoll && !hasVoted) {
    currentAction = {
      type: "POLL",
      title: "Active Poll",
      description: activePoll.question,
      estimatedTime: "1 min",
      primaryCta: "Vote Now",
      secondarySuggestion: "Review notes before answering",
      payload: activePoll
    };
  } else if (whiteboardActive) {
    currentAction = {
      type: "WHITEBOARD",
      title: "Whiteboard Collaboration",
      description: "The host is drawing on the whiteboard.",
      estimatedTime: "Ongoing",
      primaryCta: "View Board",
    };
  } else if (latestResource) {
    currentAction = {
      type: "NEW_RESOURCE",
      title: "Newly Shared Resource",
      description: latestResource.title || "A new resource has been shared",
      estimatedTime: "2 min",
      primaryCta: "View Resource",
      payload: latestResource
    };
  }

  return {
    currentAction,
    activePoll,
    hasVoted,
    setHasVoted
  };
}
