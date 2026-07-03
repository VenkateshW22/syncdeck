import React, { useEffect, useRef, useState } from "react";
import { useSocket } from "../context/SocketContext";
import { useStore } from "../store";
import { toast } from "sonner";
import { Tv, Play, StopCircle } from "lucide-react";

type ConnectionState = "IDLE" | "REQUESTING" | "NEGOTIATING" | "CONNECTED" | "RECONNECTING" | "STOPPING" | "STOPPED" | "FAILED";

export function ScreenShareHost() {
  const { socket } = useSocket();
  const participantId = useStore((state) => state.participantId);
  const [isSharing, setIsSharing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<{ [id: string]: RTCPeerConnection }>({});
  const candidateQueuesRef = useRef<{ [id: string]: RTCIceCandidateInit[] }>({});
  const stateRef = useRef<{ [id: string]: ConnectionState }>({});
  const retryCountRef = useRef<{ [id: string]: number }>({});
  const retryTimeoutsRef = useRef<{ [id: string]: NodeJS.Timeout }>({});

  const transitionState = (targetId: string, newState: ConnectionState) => {
    console.log(`[Host] State transition for ${targetId}: ${stateRef.current[targetId] || "IDLE"} -> ${newState}`);
    stateRef.current[targetId] = newState;
  };

  useEffect(() => {
    if (!socket) return;

    const handleRequestScreenShare = async ({ participantId: pid }: { participantId: string }) => {
      if (Object.keys(peersRef.current).length >= 50 && !peersRef.current[pid]) {
        console.warn("Max peer connections reached, rejecting screen share request.");
        return;
      }
      
      if (stateRef.current[pid] === "NEGOTIATING" || stateRef.current[pid] === "CONNECTED") {
        return; // Prevent duplicate negotiation
      }
      retryCountRef.current[pid] = 0; // reset retries on new request

      const createPeerConnection = async (targetId: string, isRetry = false) => {
        try {
          if (!streamRef.current) return;
          
          if (!isRetry) {
             transitionState(targetId, "NEGOTIATING");
          } else {
             transitionState(targetId, "RECONNECTING");
          }
          
          // Clean up previous peer connection if it already exists
          if (peersRef.current[targetId]) {
            peersRef.current[targetId].close();
            delete peersRef.current[targetId];
          }
          candidateQueuesRef.current[targetId] = [];
          
          const pc = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
          });
          peersRef.current[targetId] = pc;
  
          streamRef.current.getTracks().forEach((track) => {
            pc.addTrack(track, streamRef.current!);
          });
  
          pc.onicecandidate = (event) => {
            if (event.candidate) {
              const requestId = Math.random().toString(36).substring(2, 15);
              socket.emit("WEBRTC_ICE_CANDIDATE", {
                targetId: targetId,
                candidate: event.candidate,
                requestId,
              });
            }
          };
          
          pc.oniceconnectionstatechange = () => {
            if (pc.iceConnectionState === 'connected') {
              transitionState(targetId, "CONNECTED");
              retryCountRef.current[targetId] = 0; // reset on success
            } else if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
              transitionState(targetId, "FAILED");
              
              const attempts = retryCountRef.current[targetId] || 0;
              if (attempts < 3) {
                 retryCountRef.current[targetId] = attempts + 1;
                 const backoff = Math.pow(2, attempts) * 1000;
                 console.log(`WebRTC connection failed for ${targetId}, renegotiating in ${backoff}ms (attempt ${attempts + 1})...`);
                 
                 if (retryTimeoutsRef.current[targetId]) {
                   clearTimeout(retryTimeoutsRef.current[targetId]);
                 }
                 
                 retryTimeoutsRef.current[targetId] = setTimeout(() => {
                    createPeerConnection(targetId, true);
                 }, backoff);
              } else {
                 console.log(`WebRTC max retries reached for ${targetId}.`);
                 if (peersRef.current[targetId]) {
                   peersRef.current[targetId].close();
                   delete peersRef.current[targetId];
                 }
              }
            }
          };
  
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          const requestId = Math.random().toString(36).substring(2, 15);
          socket.emit("WEBRTC_OFFER", { targetId: targetId, offer, requestId });
        } catch (err) {
          console.error("Screen share request error:", err);
          transitionState(targetId, "FAILED");
        }
      };
      createPeerConnection(pid);
    };

    const handleWebRTCAnswerReceived = async ({ sourceId, answer, targetId }: any) => {
      try {
        if (targetId && participantId && targetId !== participantId) return;
        const pc = peersRef.current[sourceId];
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          
          // Process queued candidates for this specific peer
          const queue = candidateQueuesRef.current[sourceId] || [];
          while (queue.length > 0) {
            const cand = queue.shift();
            if (cand) {
              await pc.addIceCandidate(new RTCIceCandidate(cand)).catch((e) =>
                console.error("[WebRTC] Error adding queued host candidate:", e)
              );
            }
          }
        }
      } catch (err) {
        console.error("WebRTC answer error:", err);
      }
    };

    const handleWebRTCIceCandidateReceived = async ({ sourceId, candidate, targetId }: any) => {
      try {
        if (targetId && participantId && targetId !== participantId) return;
        const pc = peersRef.current[sourceId];
        if (pc) {
          if (pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } else {
            if (!candidateQueuesRef.current[sourceId]) {
              candidateQueuesRef.current[sourceId] = [];
            }
            if (candidateQueuesRef.current[sourceId].length < 50) {
              candidateQueuesRef.current[sourceId].push(candidate);
            }
          }
        }
      } catch (err) {
        console.error("WebRTC candidate error:", err);
      }
    };

    const handleParticipantLeft = ({ participantId: leftId }: { participantId: string }) => {
      if (peersRef.current[leftId]) {
        peersRef.current[leftId].close();
        delete peersRef.current[leftId];
      }
      delete candidateQueuesRef.current[leftId];
      if (retryTimeoutsRef.current[leftId]) {
        clearTimeout(retryTimeoutsRef.current[leftId]);
        delete retryTimeoutsRef.current[leftId];
      }
      delete stateRef.current[leftId];
      delete retryCountRef.current[leftId];
    };

    const handleParticipantUpdated = ({ participantId: updatedId, status }: { participantId: string; status: string }) => {
      if (status === "OFFLINE" || status === "REJECTED") {
        if (peersRef.current[updatedId]) {
          peersRef.current[updatedId].close();
          delete peersRef.current[updatedId];
        }
        delete candidateQueuesRef.current[updatedId];
        if (retryTimeoutsRef.current[updatedId]) {
          clearTimeout(retryTimeoutsRef.current[updatedId]);
          delete retryTimeoutsRef.current[updatedId];
        }
        delete stateRef.current[updatedId];
        delete retryCountRef.current[updatedId];
      }
    };

    socket.on("REQUEST_SCREEN_SHARE", handleRequestScreenShare);
    socket.on("WEBRTC_ANSWER_RECEIVED", handleWebRTCAnswerReceived);
    socket.on("WEBRTC_ICE_CANDIDATE_RECEIVED", handleWebRTCIceCandidateReceived);
    socket.on("PARTICIPANT_LEFT", handleParticipantLeft);
    socket.on("PARTICIPANT_UPDATED", handleParticipantUpdated);

    return () => {
      socket.off("REQUEST_SCREEN_SHARE", handleRequestScreenShare);
      socket.off("WEBRTC_ANSWER_RECEIVED", handleWebRTCAnswerReceived);
      socket.off("WEBRTC_ICE_CANDIDATE_RECEIVED", handleWebRTCIceCandidateReceived);
      socket.off("PARTICIPANT_LEFT", handleParticipantLeft);
      socket.off("PARTICIPANT_UPDATED", handleParticipantUpdated);
      
      // Clean up all peers, stream tracks, and queues on unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      Object.values(peersRef.current).forEach((pc) => pc.close());
      Object.values(retryTimeoutsRef.current).forEach((t) => clearTimeout(t));
      peersRef.current = {};
      candidateQueuesRef.current = {};
      retryTimeoutsRef.current = {};
    };
  }, [socket, participantId]);

  const startSharing = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { max: 1280 },
          height: { max: 720 },
          frameRate: { max: 15 }
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsSharing(true);

      stream.getVideoTracks()[0].onended = () => {
        stopSharing();
      };

      const requestId = Math.random().toString(36).substring(2, 15);
      socket?.emit("START_SCREEN_SHARE", { requestId });
      toast.success("Screen sharing started");
    } catch (err: any) {
      console.error("Error sharing screen", err);
      toast.error(`Failed to share screen: ${err.message}`);
    }
  };

  const stopSharing = () => {
    setIsSharing(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    Object.values(peersRef.current).forEach((pc) => pc.close());
    Object.values(retryTimeoutsRef.current).forEach((t) => clearTimeout(t));
    peersRef.current = {};
    candidateQueuesRef.current = {};
    retryTimeoutsRef.current = {};
    const requestId = Math.random().toString(36).substring(2, 15);
    socket?.emit("STOP_SCREEN_SHARE", { requestId });
    toast.info("Screen sharing stopped");
  };

  return (
    <div className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-3xl border border-slate-200/50 dark:border-white/5 p-5 rounded-2xl mb-1 shadow-sm w-full">
      <div className="flex items-center justify-between mb-3.5 pb-2 border-b border-slate-100 dark:border-white/5">
        <div className="flex items-center gap-2">
          <Tv className="w-4 h-4 text-indigo-500" />
          <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Host Casting Desktop
          </h3>
        </div>
        
        {!isSharing ? (
          <button
            onClick={startSharing}
            className="text-xs font-semibold bg-indigo-600 dark:bg-indigo-500 text-white hover:bg-indigo-700 px-4 py-2 rounded-xl transition shadow-xs flex items-center gap-1 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" /> Share Screen
          </button>
        ) : (
          <button
            onClick={stopSharing}
            className="text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-xl border border-red-200/40 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400 transition cursor-pointer flex items-center gap-1"
          >
            <StopCircle className="w-3.5 h-3.5" /> Stop Sharing
          </button>
        )}
      </div>

      {isSharing && (
        <div className="bg-slate-950 rounded-xl overflow-hidden aspect-video border border-slate-200 dark:border-slate-800 shadow-xl relative w-full">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          ></video>
          <div className="absolute top-3 left-3 bg-red-500 text-white text-[10px] font-bold tracking-widest px-2.5 py-1 rounded-md animate-pulse">
            CASTING LIVE
          </div>
        </div>
      )}
    </div>
  );
}
