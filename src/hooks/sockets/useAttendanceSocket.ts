import { useEffect, useRef } from "react";
import { useSocket } from "../../context/SocketContext";
import { useRoomStore } from "../../store/roomStore";
import { toast } from "sonner";
import { api } from "../../api/client";
import { useStore } from "../../store";
import { Participant } from "../../store/roomStore";

export interface AttendanceSocketOptions {
  onJoin?: (status: string) => void;
  onHandRaised?: (participantId: string, isRaised: boolean) => void;
  onUpdate?: (participantId: string, status?: string, role?: string) => void;
}

export function useAttendanceSocket(options?: AttendanceSocketOptions) {
  const { socket } = useSocket();
  const token = useStore((state) => state.token);
  const mergeParticipants = useRoomStore((state) => state.mergeParticipants);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (!socket || !token) return;

    const fetchParticipants = () => {
      api.participants.list()
        .then((data) => {
          if (Array.isArray(data)) {
            mergeParticipants(data as Participant[]);
          }
        })
        .catch((e: any) => {
          console.error("Failed to fetch participants:", e);
        });
    };

    const handleParticipantJoined = ({ status }: { status: string }) => {
      fetchParticipants();
      if (optionsRef.current?.onJoin) {
        optionsRef.current.onJoin(status);
      } else {
        if (status === "WAITING") {
          toast.success("A new participant joined and is waiting for approval");
        } else {
          toast.info("A participant joined");
        }
      }
    };

    const handleParticipantUpdated = ({ participantId, status, role }: { participantId: string; status?: string; role?: string }) => {
      mergeParticipants([{
         id: participantId,
         userId: participantId,
         ...(status ? { status } : {}),
         ...(role ? { role } : {}),
      } as any]);
      if (optionsRef.current?.onUpdate) {
        optionsRef.current.onUpdate(participantId, status, role);
      }
    };

    const handleParticipantLeft = ({ participantId }: { participantId: string }) => {
      mergeParticipants([{ id: participantId, userId: participantId, status: "OFFLINE" } as any]);
    };

    const handleParticipantHandRaised = ({ participantId, isRaised }: { participantId: string; isRaised: boolean }) => {
      const p = useRoomStore.getState().participants.find((x) => x.id === participantId);
      if (optionsRef.current?.onHandRaised) {
        optionsRef.current.onHandRaised(participantId, isRaised);
      } else if (p && isRaised && !p.handRaised) {
        toast.info(`${p.displayName || participantId.split("-")[0]} raised their hand!`);
      }
      mergeParticipants([{ id: participantId, userId: participantId, handRaised: isRaised } as any]);
    };

    socket.on("PARTICIPANT_JOINED", handleParticipantJoined);
    socket.on("PARTICIPANT_UPDATED", handleParticipantUpdated);
    socket.on("PARTICIPANT_LEFT", handleParticipantLeft);
    socket.on("PARTICIPANT_HAND_RAISED", handleParticipantHandRaised);

    return () => {
      socket.off("PARTICIPANT_JOINED", handleParticipantJoined);
      socket.off("PARTICIPANT_UPDATED", handleParticipantUpdated);
      socket.off("PARTICIPANT_LEFT", handleParticipantLeft);
      socket.off("PARTICIPANT_HAND_RAISED", handleParticipantHandRaised);
    };
  }, [socket, token, mergeParticipants]);
}
