import React, { useEffect, useState, useCallback, useRef } from "react";
import { useSocket } from "../context/SocketContext";
import { useNavigate, useParams } from "react-router";
import { useStore } from "../store";
import { useRoomStore } from "../store/roomStore";
import { toast } from "sonner";
import {
  LogOut,
  Users,
  MessageSquare,
  FileText,
  MousePointerSquareDashed,
  PenTool,
  CheckCircle,
  XCircle,
  ShieldAlert,
  Loader2,
  RefreshCw,
  Video,
  LayoutDashboard
} from "lucide-react";

import { LiveActivityFeed } from "./LiveActivityFeed";
import { ParticipantList } from "./ParticipantList";
import { SidebarChat } from "./SidebarChat";
import { ResourcePanel } from "./ResourcePanel";
import { SessionControls } from "./SessionControls";
import { SharedCanvas } from "./SharedCanvas";
import { NextActionPanel } from "./NextActionPanel";
import { QuickPollParticipant } from "./QuickPollParticipant";
import { PersonalNotesPanel } from "./PersonalNotesPanel";
import { FloatingReactions } from "./FloatingReactions";
import { ScreenShareViewer } from "./ScreenShareViewer";
import { ThemeToggle } from "./ThemeToggle";
import { api } from "../api/client";
import { useAttendanceSocket } from "../hooks/sockets/useAttendanceSocket";
import { useResourceSocket } from "../hooks/sockets/useResourceSocket";
import { motion, AnimatePresence } from "motion/react";
import { ResourceComposer } from "./ResourceComposer";
import { EditableResourceItem } from "./EditableResourceItem";
import { ParticipantResourceItem } from "./ParticipantResourceItem";

export function ParticipantDashboard() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { socket, isConnected, isConnecting } = useSocket();
  const token = useStore((state) => state.token);
  const status = useStore((state) => state.status);
  const updateStatus = useStore((state) => state.updateStatus);
  const participantId = useStore((state) => state.participantId);
  const clearSession = useStore((state) => state.clearSession);

  const resources = useRoomStore((state) => state.resources);
  const participants = useRoomStore((state) => state.participants);
  const mergeResources = useRoomStore((state) => state.mergeResources);
  const mergeParticipants = useRoomStore((state) => state.mergeParticipants);
  const [handRaised, setHandRaised] = useState(false);
  const [duration, setDuration] = useState("00:00");
  const [isRosterOpen, setIsRosterOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  let removeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useAttendanceSocket({
    onUpdate: (updatedId, newStatus, newRole) => {
      if (updatedId === participantId) {
        if (newRole === "COHOST") {
          toast.success("You have been promoted to a Co-Host!");
        }
        if (newStatus === "REJECTED" || newStatus === "BANNED") {
          if (newStatus === "BANNED") {
            toast.error("You have been removed from the session by the host.");
          } else {
            toast.error("Your request to join the session was rejected.");
          }
          removeTimeoutRef.current = setTimeout(() => {
            clearSession(roomId);
            navigate("/");
          }, 2000);
        } else if (newStatus) {
          if (newStatus === "ONLINE" || newStatus === "WAITING") {
            updateStatus(newStatus as any);
          }
          if (newStatus === "ONLINE")
            toast.success("You joined the session!");
        }
      }
    }
  });

  useResourceSocket({
    onResourceAdded: () => {
      toast.info("New broadcast received from the host!");
      playNotificationTone();
    }
  });

  const playNotificationTone = React.useCallback(() => {
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

  const toggleHand = () => {
    if (!socket) return;
    const nextState = !handRaised;
    setHandRaised(nextState);
    socket.emit("RAISE_HAND", { isRaised: nextState });
    if (nextState) toast.success("Hand raised!");
    else toast.info("Hand lowered.");
  };

  const fetchParticipants = React.useCallback(() => {
    if (!token) return;
    api.participants.list()
      .then((data) => {
        if (Array.isArray(data)) {
          mergeParticipants(data);
        } else {
          console.error("fetchParticipants expected an array, got:", data);
        }
      })
      .catch((e: any) => {
        // Only clear session for hard 401 (token invalid/expired).
        // 403 = not approved yet (transient), 404 = room not found (transient on server restart).
        // Do NOT call clearSession for 403/404 — the socket will handle reconnect/drop.
        if (e.status === 401) {
          toast.error("Session expired. Returning to Terminal.");
          clearSession(roomId);
          navigate(`/?code=${roomId || ""}`);
        } else {
          console.warn("Failed to fetch participants (will retry):", e?.status, e?.message);
        }
      });
  }, [token, roomId, clearSession, navigate, mergeParticipants]);

  const fetchResources = React.useCallback(() => {
    if (!token || status !== "ONLINE") return;
    api.resources.list()
      .then((data) => {
        if (Array.isArray(data)) {
          mergeResources(data);
        } else {
          console.error("fetchResources expected an array, got:", data);
        }
      })
      .catch((e: any) => {
        // Only clear session for hard 401 (token invalid/expired).
        // 403/404 can be transient (e.g. participant still WAITING in cache race).
        if (e.status === 401) {
          toast.error("Session expired. Returning to Terminal.");
          clearSession(roomId);
          navigate(`/?code=${roomId || ""}`);
        } else {
          console.warn("Failed to fetch resources (will retry):", e?.status, e?.message);
        }
      });
  }, [token, status, roomId, clearSession, navigate, mergeResources]);

  useEffect(() => {
    return () => {
      useRoomStore.getState().reset();
    };
  }, []);

  useEffect(() => {
    const storeRoomId = useStore.getState().roomId;
    if (storeRoomId && roomId && storeRoomId !== roomId) {
      toast.error(`You are already in a session for room ${storeRoomId}.`);
      navigate(`/`);
      return;
    }
    if (!token || !roomId) {
      toast.error("Invalid session or room code. Returning to Terminal.");
      clearSession(roomId);
      navigate(`/?code=${roomId || ""}`);
    }
  }, [token, roomId, clearSession, navigate]);

  useEffect(() => {
    fetchResources();
    fetchParticipants();

    const startTime = Date.now();
    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - startTime) / 1000);
      const m = Math.floor(diff / 60)
        .toString()
        .padStart(2, "0");
      const s = (diff % 60).toString().padStart(2, "0");
      setDuration(`${m}:${s}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [token, status, fetchResources, fetchParticipants]);

  useEffect(() => {
    if (!socket) return;
    
    const heartbeatInterval = setInterval(() => {
        socket.emit("HEARTBEAT");
    }, 30000);
    
    const handleReady = () => {
       fetchParticipants();
       fetchResources();
    };

    let leaveTimeout: NodeJS.Timeout | null = null;

    const handleRoomStateChanged = ({ status: roomStatus }: { status: string }) => {
      if (roomStatus === "ARCHIVED" || roomStatus === "DESTROYED") {
        toast.error("The session has been ended by the host.");
        leaveTimeout = setTimeout(() => {
          socket.disconnect();
          clearSession(roomId);
          navigate("/");
        }, 2000);
      }
    };

    socket.on("READY", handleReady);
    socket.on("ROOM_STATE_CHANGED", handleRoomStateChanged);

    return () => {
      clearInterval(heartbeatInterval);
      if (leaveTimeout) clearTimeout(leaveTimeout);
      if (removeTimeoutRef.current) clearTimeout(removeTimeoutRef.current);

      socket.off("READY", handleReady);
      socket.off("ROOM_STATE_CHANGED", handleRoomStateChanged);
    };
  }, [socket, fetchParticipants, fetchResources, clearSession, navigate, roomId]);

  const myParticipant = participants.find((p) => p.id === participantId);
  const isCohost = myParticipant?.role === "COHOST";

  useEffect(() => {
    if (myParticipant && myParticipant.handRaised !== undefined) {
      setHandRaised(myParticipant.handRaised);
    }
  }, [myParticipant?.handRaised]);

  const handleApprove = async (id: string) => {
    try {
      await api.participants.updateStatus(id, "ONLINE");
      toast.success("Participant approved");
      mergeParticipants([{ id, userId: id, status: "ONLINE" } as any]);
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    }
  };

  const handleApproveAll = async () => {
    try {
      const data = await api.participants.approveAll();
      toast.success(`Successfully approved ${data?.count || 0} participants`);
      useRoomStore.getState().setParticipants(
        useRoomStore.getState().participants.map((p) => (p.status === "WAITING" ? { ...p, status: "ONLINE" } : p))
      );
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    }
  };

  const handleReject = async (id: string) => {
    try {
      await api.participants.updateStatus(id, "REJECTED");
      toast.success("Participant rejected");
      mergeParticipants([{ id, userId: id, status: "REJECTED" } as any]);
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    }
  };

  if (status === "WAITING") {
    return (
      <div className="flex h-screen bg-slate-50 dark:bg-slate-950 flex-col items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 text-center max-w-md w-full">
          <div className="w-12 h-12 rounded-full border-4 border-blue-500 border-t-transparent animate-spin mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold mb-2 text-slate-800 dark:text-slate-100">
            Waiting for Approval
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            The host has enabled the waiting room. Please wait until they
            approve your join request.
          </p>
        </div>
      </div>
    );
  }

  const hostName =
    participants.find((p) => p.role === "HOST")?.displayName || "Host";

  return (
    <div className="flex flex-col lg:flex-row min-h-screen lg:h-screen p-2 sm:p-3 gap-2 sm:gap-3 bg-gradient-to-br from-indigo-50/50 via-slate-50 to-purple-50/50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/30 overflow-x-hidden">
      <AnimatePresence>
        {isRosterOpen && (
          <motion.div
            initial={isMobile ? { height: 0, opacity: 0 } : { width: 0, opacity: 0 }}
            animate={isMobile ? { height: "auto", opacity: 1 } : { width: 256, opacity: 1 }}
            exit={isMobile ? { height: 0, opacity: 0 } : { width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="w-full lg:w-64 flex flex-col bg-white/70 dark:bg-slate-900/40 backdrop-blur-3xl border border-slate-200/50 dark:border-white/10 rounded-[1.5rem] overflow-hidden shrink-0 shadow-xl shadow-indigo-100/20 dark:shadow-none"
          >
            <div className="w-full lg:w-64 flex flex-col h-full">
              <ParticipantList 
                participants={participants} 
                onApprove={isCohost ? handleApprove : undefined}
                onApproveAll={isCohost ? handleApproveAll : undefined}
                onReject={isCohost ? handleReject : undefined}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex-1 flex flex-col items-center bg-white/70 dark:bg-slate-900/40 backdrop-blur-3xl border border-slate-200/50 dark:border-white/10 rounded-[1.5rem] overflow-hidden shadow-xl shadow-indigo-100/20 dark:shadow-none min-w-0">
        <div className="w-full p-4 border-b border-slate-100 dark:border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center sticky top-0 shadow-sm z-10 box-border gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto overflow-hidden">
            <img
              src="/favicon.svg"
              alt="SyncDeck Logo"
              className="w-8 h-8 rounded shrink-0"
            />
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 overflow-hidden">
              <h2 className="font-semibold text-base sm:text-lg text-slate-800 dark:text-slate-100 truncate">
                SyncDeck Class {isCohost && <span className="text-xs font-normal text-indigo-500 bg-indigo-50 dark:bg-indigo-950/50 px-1.5 py-0.5 rounded ml-1">Co-Host</span>}
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded font-mono border dark:border-slate-700">
                  {duration}
                </span>
                <span className="hidden xl:inline-block text-[10px] text-slate-400 font-normal">Press <kbd className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 border dark:border-slate-700 px-1 py-0.5 rounded">Cmd K</kbd></span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-3 sm:gap-4">
            <button
              onClick={() => setIsRosterOpen(!isRosterOpen)}
              aria-label="Toggle Roster"
              aria-expanded={isRosterOpen}
              className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl font-bold text-[10px] sm:text-xs transition duration-150 flex items-center gap-1.5 shadow-sm border ${
                isRosterOpen
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600 shadow-indigo-500/10"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">{isRosterOpen ? "Hide Roster" : "Show Roster"}</span>
              <span className="xs:hidden">Roster</span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-mono ${
                isRosterOpen ? "bg-white/20 text-white" : "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100/40 dark:border-indigo-900/20"
              }`}>
                {participants.filter((p) => p.status === "ONLINE").length}
              </span>
            </button>
            <button
              onClick={toggleHand}
              id="participant-raise-hand-btn"
              aria-pressed={handRaised}
              aria-label={handRaised ? "Lower raised hand" : "Raise hand to ask question"}
              className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl font-bold text-[10px] sm:text-xs transition duration-150 flex items-center gap-1.5 shadow-sm border ${
                handRaised
                  ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-500 shadow-amber-500/10"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              <span className={handRaised ? "animate-bounce" : ""}>✋</span>
              <span className="hidden xs:inline">{handRaised ? "Hand Raised" : "Raise Hand"}</span>
              <span className="xs:hidden">{handRaised ? "Raised" : "Hand"}</span>
            </button>
            <span
              className={
                isConnected
                  ? "text-green-600 dark:text-green-400 font-mono text-xs sm:text-sm inline-flex items-center gap-1.5"
                  : isConnecting
                  ? "text-orange-500 dark:text-orange-400 font-mono text-xs sm:text-sm inline-flex items-center gap-1.5"
                  : "text-red-500 dark:text-red-400 font-mono text-xs sm:text-sm inline-flex items-center gap-1.5"
              }
            >
              <span
                className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${isConnected ? "bg-green-500" : isConnecting ? "bg-orange-500 animate-pulse" : "bg-red-500"}`}
              ></span>
              <span className="hidden xs:inline">{isConnected ? "ONLINE" : isConnecting ? "CONNECTING..." : "OFFLINE"}</span>
              <span className="xs:hidden">{isConnected ? "ON" : isConnecting ? "..." : "OFF"}</span>
            </span>
            <ThemeToggle />
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 w-full xl:max-w-7xl mx-auto space-y-4">
          <NextActionPanel resources={resources} />
          
          {/* Centered big screen share */}
          <div className="w-full">
            <ScreenShareViewer />
          </div>
          
          {/* Centered big whiteboard */}
          <div className="w-full">
            <SharedCanvas isHost={isCohost} />
          </div>
          
          {/* Main interactive area: split into two columns on large screens */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="space-y-4">
              <QuickPollParticipant />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" id="personal-notes-container">
              <PersonalNotesPanel roomId={roomId} resources={resources} />
              <LiveActivityFeed participants={participants} />
            </div>
          </div>

          {isCohost && (
            <div className="bg-slate-50 dark:bg-slate-900/50 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-4">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">Co-Host Control: Share Resources</h3>
              <ResourceComposer socket={socket} token={token} />
            </div>
          )}

          {resources.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <svg className="w-16 h-16 mb-4 text-slate-300 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
              <h3 className="text-lg font-medium text-slate-600 dark:text-slate-300">Nothing to see here... yet</h3>
              <p className="text-slate-500 dark:text-slate-400 mt-2">Waiting for the host to share resources.</p>
            </div>
          )}
          
          <div id="resources-container" className="space-y-4">
            {resources.map((r) => (
              isCohost ? (
                <EditableResourceItem 
                  key={r.id} 
                  resource={r as any} 
                  socket={socket} 
                  token={token} 
                  onOptimisticEdit={(id, updates) => {
                    mergeResources([{ id, ...updates } as any]);
                  }}
                  onOptimisticRemove={(id) => {
                    useRoomStore.getState().setResources(
                      useRoomStore.getState().resources.filter((r) => r.id !== id)
                    );
                  }}
                />
              ) : (
                <ParticipantResourceItem key={r.id} resource={r as any} token={token} />
              )
            ))}
          </div>
        </div>
      </div>
      <SidebarChat
        senderName={
          participants.find((p) => p.id === participantId)?.displayName ||
          "Participant"
        }
      />
      <FloatingReactions />
    </div>
  );
}

