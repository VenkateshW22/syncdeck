import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { useSocket } from "../context/SocketContext";
import { useStore } from "../store";
import { useRoomStore } from "../store/roomStore";
import { toast } from "sonner";
import { api } from "../api/client";
import { useAttendanceSocket } from "./sockets/useAttendanceSocket";
import { useResourceSocket } from "./sockets/useResourceSocket";

export function useHostSessionState(roomId: string | undefined) {
  const navigate = useNavigate();
  const { socket, isConnected, isConnecting } = useSocket();
  const token = useStore((state) => state.token);
  const clearSession = useStore((state) => state.clearSession);

  const resources = useRoomStore((state) => state.resources);
  const participants = useRoomStore((state) => state.participants);
  const mergeResources = useRoomStore((state) => state.mergeResources);
  const mergeParticipants = useRoomStore((state) => state.mergeParticipants);

  const playNotificationTone = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05);
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {
      console.error("Audio error", e);
    }
  }, []);

  useEffect(() => {
    return () => {
      useRoomStore.getState().reset();
    };
  }, []);

  useEffect(() => {
    const storeRoomId = useStore.getState().roomId;
    if (storeRoomId && roomId && storeRoomId !== roomId) {
      toast.error(`You are already in a session for room ${storeRoomId}.`);
      navigate("/");
      return;
    }
    if (!token || !roomId) {
      toast.error("Invalid session or room code. Returning to Terminal.");
      clearSession(roomId);
      navigate("/");
    }
  }, [token, roomId, clearSession, navigate]);

  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;

  const fetchParticipants = useCallback(() => {
    if (!token) return;
    api.participants.list()
      .then((data) => {
        setRetryCount(0); // Reset on success
        if (Array.isArray(data)) {
          mergeParticipants(data);
        } else {
          console.error("fetchParticipants expected an array, got:", data);
        }
      })
      .catch((e: any) => {
        if (e.status === 401 || e.status === 404 || e.status === 403) {
          setRetryCount(prev => {
            const next = prev + 1;
            if (next >= MAX_RETRIES) {
              toast.error("Session expired or room not found.");
              clearSession(roomId);
              navigate("/");
            } else {
               toast.error(`Sync error. Retrying... (${next}/${MAX_RETRIES})`);
            }
            return next;
          });
        } else {
           console.error("Failed to fetch participants:", e);
        }
      });
  }, [token, clearSession, navigate, mergeParticipants, roomId]);

  const fetchResources = useCallback(() => {
    if (!token) return;
    api.resources.list()
      .then((data) => {
        setRetryCount(0);
        if (Array.isArray(data)) {
          mergeResources(data);
        } else {
          console.error("fetchResources expected an array, got:", data);
        }
      })
      .catch((e: any) => {
        if (e.status === 401 || e.status === 404 || e.status === 403) {
          setRetryCount(prev => {
            const next = prev + 1;
            if (next >= MAX_RETRIES) {
              toast.error("Session expired or room not found.");
              clearSession(roomId);
              navigate("/");
            }
            return next;
          });
        } else {
          console.error("Failed to fetch resources:", e);
        }
      });
  }, [token, clearSession, navigate, mergeResources, roomId]);

  useEffect(() => {
    if (token) {
      fetchResources();
      fetchParticipants();
    }
  }, [token, fetchResources, fetchParticipants]);

  useAttendanceSocket({
    onJoin: (status) => {
      if (status === "WAITING") {
        toast.success("A new participant joined and is waiting for approval");
        playNotificationTone();
      } else {
        toast.info("A participant joined");
      }
    },
    onHandRaised: (participantId, isRaised) => {
      const p = useRoomStore.getState().participants.find((x) => x.id === participantId);
      if (p && isRaised && !p.handRaised) {
        toast.info(`${p.displayName || participantId.split("-")[0]} raised their hand!`);
        playNotificationTone();
      }
    }
  });

  useResourceSocket();

  useEffect(() => {
    if (!socket) return;
    const heartbeatInterval = setInterval(() => {
      socket.emit("HEARTBEAT");
    }, 30000);

    const handleReady = () => {
       fetchParticipants();
       fetchResources();
    };

    socket.on("READY", handleReady);

    return () => {
      clearInterval(heartbeatInterval);
      socket.off("READY", handleReady);
    };
  }, [socket, fetchParticipants, fetchResources]);

  const handleApprove = async (id: string) => {
    try {
      await api.participants.updateStatus(id, "ONLINE");
      toast.success("Participant approved");
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    }
  };

  const handleApproveAll = async () => {
    try {
      const data = await api.participants.approveAll();
      toast.success(`Successfully approved ${data?.count || 0} participants`);
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    }
  };

  const handleReject = async (id: string) => {
    try {
      await api.participants.updateStatus(id, "REJECTED");
      toast.success("Participant rejected");
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await api.participants.updateStatus(id, "BANNED");
      toast.success("Participant removed");
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    }
  };

  const handlePromoteToCohost = async (id: string) => {
    try {
      await api.participants.updateRole(id, "COHOST");
      toast.success("Promoted to Co-Host");
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    }
  };

  const handleDemoteFromCohost = async (id: string) => {
    try {
      await api.participants.updateRole(id, "PARTICIPANT");
      toast.success("Demoted from Co-Host");
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    }
  };

  const handleEndSession = async () => {
    const confirmEnd = window.confirm("Are you sure you want to end this session?");
    if (!confirmEnd) return;
    try {
      await api.rooms.close();
      toast.success("Session ended");
      socket?.disconnect();
      clearSession();
      navigate("/");
    } catch (err: any) {
      if (err.status === 400) {
         socket?.disconnect();
         clearSession();
         navigate("/");
      } else {
         toast.error(`Error ending session: ${err.message}`);
      }
    }
  };

  return {
    resources,
    setResources: useRoomStore.getState().setResources,
    participants,
    setParticipants: useRoomStore.getState().setParticipants,
    handleApprove,
    handleApproveAll,
    handleReject,
    handlePromoteToCohost,
    handleDemoteFromCohost,
    handleRemove,
    handleEndSession,
    isConnected,
    isConnecting,
    socket,
    token,
  };
}
