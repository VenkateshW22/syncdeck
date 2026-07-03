import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { JwtPayload } from "../../server/utils/jwt";
import { useRoomStore } from "./roomStore";

interface SessionState {
  token: string | null;
  roomId: string | null;
  participantId: string | null;
  role: "HOST" | "PARTICIPANT" | null;
  status: "WAITING" | "ONLINE" | "REJECTED" | null;
  setSession: (
    token: string,
    roomId: string,
    participantId: string,
    role: "HOST" | "PARTICIPANT",
    status?: "WAITING" | "ONLINE" | "REJECTED",
  ) => void;
  updateStatus: (status: "WAITING" | "ONLINE" | "REJECTED") => void;
  clearSession: (targetRoomId?: string) => void;
}

const authChannel = new BroadcastChannel("syncdeck_auth");

export const useStore = create<SessionState>()(
  persist(
    (set, get) => ({
      token: null,
      roomId: null,
      participantId: null,
      role: null,
      status: null,
      setSession: (token, roomId, participantId, role, status) =>
        set({ token, roomId, participantId, role, status: status || null }),
      updateStatus: (status) => set({ status }),
      clearSession: (targetRoomId?: string) => {
        const currentRoomId = get().roomId;
        const currentParticipantId = get().participantId;
        const currentToken = get().token;
        if (targetRoomId && currentRoomId && targetRoomId !== currentRoomId) {
            return;
        }
        
        // Prevent broadcasting LOGOUT if this tab has no active session/token
        if (!currentToken) {
            return;
        }

        set({
          token: null,
          roomId: null,
          participantId: null,
          role: null,
          status: null,
        });
        useRoomStore.getState().reset(); // Clear room state upon session termination
        authChannel.postMessage({ type: "LOGOUT", roomId: currentRoomId, participantId: currentParticipantId });
      },
    }),
    {
      name: "syncdeck-session",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);

authChannel.onmessage = (event) => {
  if (event.data?.type === "LOGOUT") {
    const state = useStore.getState();
    // Only logout if we have a token, the broadcasted room ID matches ours, and it is not falsy.
    if (state.token && event.data.roomId && state.roomId === event.data.roomId) {
      if (!event.data.participantId || state.participantId === event.data.participantId) {
        state.clearSession(event.data.roomId);
      }
    }
  }
};
