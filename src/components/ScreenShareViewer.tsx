import React, { useEffect, useRef, useState } from "react";
import { useSocket } from "../context/SocketContext";
import { useStore } from "../store";
import { Tv } from "lucide-react";
import { toast } from "sonner";

type ConnectionState = "IDLE" | "REQUESTING" | "NEGOTIATING" | "CONNECTED" | "RECONNECTING" | "STOPPING" | "STOPPED" | "FAILED";

export function ScreenShareViewer() {
  const { socket } = useSocket();
  const participantId = useStore((state) => state.participantId);
  const [isActive, setIsActive] = useState(false);
  const isActiveRef = useRef(false);

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const candidateQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const stateRef = useRef<ConnectionState>("IDLE");

  const transitionState = (newState: ConnectionState) => {
    console.log(`[Viewer] State transition: ${stateRef.current} -> ${newState}`);
    stateRef.current = newState;
  };

  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden && isActiveRef.current && stateRef.current !== "CONNECTED" && stateRef.current !== "NEGOTIATING" && stateRef.current !== "REQUESTING") {
        console.log("[Viewer] Tab became visible, requesting stream again");
        transitionState("RECONNECTING");
        const requestId = Math.random().toString(36).substring(2, 15);
        socket?.emit("REQUEST_SCREEN_SHARE", { requestId });
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [socket]);

  useEffect(() => {
    if (!socket) return;

    let lastRequestTime = 0;
    const requestStream = () => {
      const now = Date.now();
      if (now - lastRequestTime < 2000) return; // Prevent spamming
      if (stateRef.current === "REQUESTING" || stateRef.current === "NEGOTIATING" || stateRef.current === "CONNECTED") {
        return;
      }
      lastRequestTime = now;
      transitionState("REQUESTING");
      const requestId = Math.random().toString(36).substring(2, 15);
      socket.emit("REQUEST_SCREEN_SHARE", { requestId });
    };

    const handleScreenShareStarted = () => {
      setIsActive(true);
      requestStream();
    };

    const handleScreenShareStopped = () => {
      transitionState("STOPPED");
      setIsActive(false);
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      candidateQueueRef.current = [];
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };

    const handleHydrateState = (data: any) => {
      if (data && data.screenShare && data.screenShare.isScreenSharing) {
        setIsActive(true);
        requestStream();
      }
    };

    let reconnectTimeout: NodeJS.Timeout | null = null;

    const handleWebRTCOfferReceived = async (payload: any) => {
      try {
        if (payload.targetId && participantId && payload.targetId !== participantId) return;

        console.log("[WebRTC] WebRTC Offer received from host:", payload.sourceId);
        toast.info("Connecting to host screen share feed...");
        transitionState("NEGOTIATING");
        
        // Clean up any existing connection first
        if (pcRef.current) {
          pcRef.current.close();
        }
        candidateQueueRef.current = [];

        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:relay.metered.ca:80" },
            {
              urls: "turn:relay.metered.ca:80?transport=udp",
              username: "metered",
              credential: "metered"
            },
            {
              urls: "turn:relay.metered.ca:443?transport=tcp",
              username: "metered",
              credential: "metered"
            }
          ],
        });
        pcRef.current = pc;

        pc.ontrack = (event) => {
          console.log("[WebRTC] Received remote stream track");
          if (videoRef.current) {
            videoRef.current.srcObject = event.streams[0];
          }
        };

        pc.oniceconnectionstatechange = () => {
          console.log("[WebRTC] ICE Connection State changed to:", pc.iceConnectionState);
          if (pc.iceConnectionState === "connected") {
            transitionState("CONNECTED");
            toast.success("Screen share connected!");
          } else if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") {
            transitionState("FAILED");
            toast.error("Screen share connection failed or disconnected.");
            // Automatically attempt to reconnect if we are still active
            if (isActiveRef.current) {
               console.log("[Viewer] Connection failed/disconnected, requesting stream again...");
               if (reconnectTimeout) clearTimeout(reconnectTimeout);
               reconnectTimeout = setTimeout(() => {
                 transitionState("RECONNECTING");
                 const requestId = Math.random().toString(36).substring(2, 15);
                 socket.emit("REQUEST_SCREEN_SHARE", { requestId });
               }, 2000);
            }
          }
        };

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            const requestId = Math.random().toString(36).substring(2, 15);
            socket.emit("WEBRTC_ICE_CANDIDATE", {
              targetId: payload.sourceId,
              candidate: event.candidate,
              requestId,
            });
          }
        };

        await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        const requestId = Math.random().toString(36).substring(2, 15);
        socket.emit("WEBRTC_ANSWER", { targetId: payload.sourceId, answer, requestId });

        // Process any queued candidates now that remote description is set
        while (candidateQueueRef.current.length > 0) {
          const cand = candidateQueueRef.current.shift();
          if (cand) {
            await pc.addIceCandidate(new RTCIceCandidate(cand)).catch((e) =>
              console.error("[WebRTC] Error adding queued candidate:", e)
            );
          }
        }
      } catch (err) {
        console.error("WebRTC offer error:", err);
      }
    };

    const handleWebRTCIceCandidateReceived = async ({ sourceId, candidate, targetId }: any) => {
      try {
        if (targetId && participantId && targetId !== participantId) return;
        const pc = pcRef.current;
        if (pc) {
          if (pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } else {
            // Queue until remote description is set
            if (candidateQueueRef.current.length < 50) {
              candidateQueueRef.current.push(candidate);
            }
          }
        }
      } catch (err) {
        console.error("WebRTC candidate error:", err);
      }
    };

    socket.on("SCREEN_SHARE_STARTED", handleScreenShareStarted);
    socket.on("SCREEN_SHARE_STOPPED", handleScreenShareStopped);
    socket.on("HYDRATE_STATE", handleHydrateState);
    socket.on("WEBRTC_OFFER_RECEIVED", handleWebRTCOfferReceived);
    socket.on("WEBRTC_ICE_CANDIDATE_RECEIVED", handleWebRTCIceCandidateReceived);

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      socket.off("SCREEN_SHARE_STARTED", handleScreenShareStarted);
      socket.off("SCREEN_SHARE_STOPPED", handleScreenShareStopped);
      socket.off("HYDRATE_STATE", handleHydrateState);
      socket.off("WEBRTC_OFFER_RECEIVED", handleWebRTCOfferReceived);
      socket.off("WEBRTC_ICE_CANDIDATE_RECEIVED", handleWebRTCIceCandidateReceived);
      
      // Complete unmount resource cleanup
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      candidateQueueRef.current = [];
    };
  }, [socket, participantId]);

  if (!isActive) return null;

  return (
    <div className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-3xl border border-slate-200/50 dark:border-white/5 p-5 rounded-2xl mb-4 shadow-sm w-full">
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-white/5">
        <div className="flex items-center gap-2">
          <Tv className="w-4 h-4 text-indigo-500 animate-pulse" />
          <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Host Casting Desktop (Live)
          </h3>
        </div>
        <span className="text-[10px] bg-red-500 text-white font-bold font-mono px-2 py-0.5 rounded-full animate-pulse">
          LIVE
        </span>
      </div>

      <div className="bg-slate-950 rounded-xl overflow-hidden aspect-video border border-slate-200 dark:border-slate-800 shadow-xl relative w-full">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-contain"
        ></video>
      </div>
    </div>
  );
}
