import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { io, Socket } from "socket.io-client";
import { useStore } from "../store";
import { useRoomStore } from "../store/roomStore";

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  isStalled: boolean;
  isConnecting: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  isStalled: false,
  isConnecting: false,
});

export const useSocket = () => useContext(SocketContext);

interface SocketProviderProps {
  children: ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isStalled, setIsStalled] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const token = useStore((state) => state.token);
  const roomId = useStore((state) => state.roomId);

  useEffect(() => {
    let stallTimeout: NodeJS.Timeout;
    
    if (isConnected) {
        setIsStalled(false);
        setIsConnecting(false);
        clearTimeout(stallTimeout);
    } else if (socket && !isConnected) {
        stallTimeout = setTimeout(() => {
            setIsStalled(true);
            setIsConnecting(false);
        }, 3000);
    }

    return () => clearTimeout(stallTimeout);
  }, [isConnected, socket]);

  useEffect(() => {
    if (!token || !roomId) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
        setIsStalled(false);
        setIsConnecting(false);
      }
      return;
    }

    setIsConnecting(true);
    const socketInstance = io(`/ws/rooms`, {
      auth: (cb) => {
        cb({
          token,
          canvasVersion: useRoomStore.getState().canvasElements.length,
          lastEventSequence: useRoomStore.getState().version,
        });
      },
      transports: ["websocket"],
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
    });

    socketInstance.on("connect", () => {
      setIsConnected(true);
      setIsConnecting(false);
      console.log("[Socket] Connected");
    });

    socketInstance.on("disconnect", () => {
      setIsConnected(false);
      console.log("[Socket] Disconnected");
    });

    socketInstance.on("connect_error", (err) => {
      console.error("[Socket] Connection Error:", err.message);
      if (err.message.includes("Authentication error") || err.message === "Not authorized") {
          useStore.getState().clearSession(roomId);
      }
    });

    socketInstance.on("HYDRATE_STATE", (data) => {
      console.log("[Socket] Hydration Received", data);
      useRoomStore.getState().mergeHydration(data);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [token, roomId]);

  useEffect(() => {
    if (!socket) return;
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !socket.connected) {
        console.log("[Socket] Page visible, checking connection...");
        socket.connect();
      }
    };
    
    const handleOnline = () => {
      console.log("[Socket] Browser online, checking connection...");
      if (!socket.connected) {
        socket.connect();
      }
    };
    
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
    
    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, [socket]);

  return (
    <SocketContext.Provider value={{ socket, isConnected, isStalled, isConnecting }}>
      {isStalled && (
          <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white text-center py-2 text-sm font-medium animate-pulse">
              Reconnecting to Live Services... You are in read-only mode.
          </div>
      )}
      {children}
    </SocketContext.Provider>
  );
};
