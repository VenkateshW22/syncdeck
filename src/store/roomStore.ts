import { create } from "zustand";

export interface ChatMessage {
  id?: string;
  text: string;
  senderId: string;
  senderName: string;
  timestamp: number;
}

export interface Poll {
  id?: string;
  question: string;
  options: any[];
  isActive: boolean;
  votes?: Record<string, number>;
}

export interface Resource {
  id: string;
  title: string;
  url?: string;
  type?: "CODE_SNIPPET" | "URL_RESOURCE" | "ANNOUNCEMENT" | "FILE_RESOURCE" | string;
  metadata?: any;
}

export interface Participant {
  id: string;
  userId?: string;
  displayName: string;
  role: string;
  status: string;
  handRaised?: boolean;
}

interface RoomState {
  resources: Resource[];
  participants: Participant[];
  chatMessages: ChatMessage[];
  poll: Poll | null;
  canvasElements: any[];
  nextAction: any | null;
  timeline: any[];
  version: number;
  
  pendingOperations: Set<string>;
  addPendingOperation: (id: string) => void;
  removePendingOperation: (id: string) => void;
  
  setResources: (resources: Resource[]) => void;
  setParticipants: (participants: Participant[]) => void;
  setChatMessages: (messages: ChatMessage[]) => void;
  setPoll: (poll: Poll | null) => void;
  setCanvasElements: (elements: any[]) => void;
  setNextAction: (action: any | null) => void;
  setTimeline: (timeline: any[]) => void;
  
  mergeHydration: (data: any) => void;
  
  mergeResources: (incoming: Resource[]) => void;
  mergeParticipants: (incoming: Participant[]) => void;
  mergeChatMessages: (incoming: ChatMessage[]) => void;
  mergeCanvasElements: (incoming: any[]) => void;
  mergePoll: (incoming: Poll | null) => void;
  mergeHandsRaised: (handsRaised: string[]) => void;
  
  reset: () => void;
}

export const useRoomStore = create<RoomState>((set, get) => ({
  resources: [],
  participants: [],
  chatMessages: [],
  poll: null,
  canvasElements: [],
  nextAction: null,
  timeline: [],
  version: 0,
  
  pendingOperations: new Set(),
  addPendingOperation: (id) => set((state) => {
    const next = new Set(state.pendingOperations);
    next.add(id);
    return { pendingOperations: next };
  }),
  removePendingOperation: (id) => set((state) => {
    const next = new Set(state.pendingOperations);
    next.delete(id);
    return { pendingOperations: next };
  }),
  
  setResources: (resources) => set({ resources }),
  setParticipants: (participants) => set({ participants }),
  setChatMessages: (chatMessages) => set({ chatMessages }),
  setPoll: (poll) => set({ poll }),
  setCanvasElements: (canvasElements) => set({ canvasElements }),
  setNextAction: (nextAction) => set({ nextAction }),
  setTimeline: (timeline) => set({ timeline }),
  
  mergeHydration: (data: any) => {
    set((state) => {
      if (data.version && data.version < state.version) {
        console.warn(`[Hydration] Skipped stale version ${data.version} < ${state.version}`);
        return state;
      }
      
      const updates: Partial<RoomState> = { version: data.version || state.version };
      
      if (data.chatMessages) {
        const merged = [...state.chatMessages];
        data.chatMessages.forEach((inc: any) => {
          const idx = merged.findIndex((m: any) => m.id === inc.id || (m.timestamp === inc.timestamp && m.senderId === inc.senderId));
          if (idx >= 0) merged[idx] = { ...merged[idx], ...inc };
          else merged.push(inc);
        });
        merged.sort((a, b) => a.timestamp - b.timestamp);
        updates.chatMessages = merged.slice(-200);
      }
      
      if (data.canvasLines) {
        if (data.isChunk || data.isDelta) {
           updates.canvasElements = [...state.canvasElements, ...data.canvasLines];
        } else {
           updates.canvasElements = data.canvasLines;
        }
      }
      
      if (data.activePoll !== undefined) {
        updates.poll = data.activePoll;
      }
      
      if (data.handsRaised) {
         updates.participants = state.participants.map(p => ({
           ...p,
           handRaised: data.handsRaised.includes(p.id)
         }));
      }
      
      if (data.nextAction !== undefined) {
         updates.nextAction = data.nextAction;
      }
      
      return updates;
    });
  },
  
  mergeResources: (incoming) => {
    set((state) => {
      const merged = [...state.resources];
      incoming.forEach(inc => {
        const idx = merged.findIndex(r => r.id === inc.id);
        if (idx >= 0) merged[idx] = { ...merged[idx], ...inc };
        else merged.push(inc);
      });
      return { resources: merged };
    });
  },
  
  mergeParticipants: (incoming) => {
    set((state) => {
      const merged = [...state.participants];
      incoming.forEach(inc => {
        const idx = merged.findIndex(p => p.id === inc.id);
        if (idx >= 0) {
          // preserve handRaised if not in incoming
          merged[idx] = { ...merged[idx], ...inc, handRaised: inc.handRaised ?? merged[idx].handRaised };
        } else {
          merged.push(inc);
        }
      });
      return { participants: merged };
    });
  },
  
  mergeChatMessages: (incoming) => {
    set((state) => {
      const merged = [...state.chatMessages];
      incoming.forEach(inc => {
        const idx = merged.findIndex(m => m.id === inc.id || (m.timestamp === inc.timestamp && m.senderId === inc.senderId));
        if (idx >= 0) merged[idx] = { ...merged[idx], ...inc };
        else merged.push(inc);
      });
      merged.sort((a, b) => a.timestamp - b.timestamp);
      return { chatMessages: merged.slice(-200) };
    });
  },
  
  mergeCanvasElements: (incoming) => {
    set({ canvasElements: incoming }); // For simplicity, full replacement if needed, or merge by id
  },
  
  mergePoll: (incoming) => {
    set({ poll: incoming });
  },
  
  mergeHandsRaised: (handsRaised: string[]) => {
    set((state) => ({
      participants: state.participants.map(p => ({
        ...p,
        handRaised: handsRaised.includes(p.id)
      }))
    }));
  },
  
  reset: () => set({
    resources: [],
    participants: [],
    chatMessages: [],
    poll: null,
    canvasElements: [],
    nextAction: null,
    timeline: [],
    version: 0,
    pendingOperations: new Set()
  })
}));
