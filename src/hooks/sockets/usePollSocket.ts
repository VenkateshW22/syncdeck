import { useEffect, useRef } from "react";
import { useSocket } from "../../context/SocketContext";
import { useRoomStore } from "../../store/roomStore";

export interface PollSocketOptions {
  onPollStarted?: (pollId: string, question: string, options: string[]) => void;
  onPollStopped?: (pollId: string) => void;
  onPollVoteReceived?: (pollId: string, optionIndex: number) => void;
}

export function usePollSocket(options?: PollSocketOptions) {
  const { socket } = useSocket();
  const setPoll = useRoomStore((state) => state.setPoll);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (!socket) return;

    const handlePollStarted = ({ pollId, question, options: pollOptions }: { pollId: string; question: string; options: string[] }) => {
      setPoll({ id: pollId, question, options: pollOptions, active: true });
      if (optionsRef.current?.onPollStarted) {
        optionsRef.current.onPollStarted(pollId, question, pollOptions);
      }
    };

    const handlePollStopped = ({ pollId }: { pollId: string }) => {
      setPoll(null);
      if (optionsRef.current?.onPollStopped) {
        optionsRef.current.onPollStopped(pollId);
      }
    };

    const handlePollVoteReceived = ({ pollId, optionIndex }: { pollId: string; optionIndex: number }) => {
      if (optionsRef.current?.onPollVoteReceived) {
        optionsRef.current.onPollVoteReceived(pollId, optionIndex);
      }
    };

    socket.on("POLL_STARTED", handlePollStarted);
    socket.on("POLL_STOPPED", handlePollStopped);
    socket.on("POLL_VOTE_RECEIVED", handlePollVoteReceived);

    return () => {
      socket.off("POLL_STARTED", handlePollStarted);
      socket.off("POLL_STOPPED", handlePollStopped);
      socket.off("POLL_VOTE_RECEIVED", handlePollVoteReceived);
    };
  }, [socket, setPoll]);
}
