import { useEffect } from "react";
import { useSocket } from "../../context/SocketContext";

export interface ChatSocketOptions {
  onMessageReceived?: (message: any) => void;
}

export function useChatSocket(options?: ChatSocketOptions) {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    const handleReceive = (msg: any) => {
      if (options?.onMessageReceived) {
        options.onMessageReceived(msg);
      }
    };

    socket.on("CHAT_MESSAGE_RECEIVED", handleReceive);

    return () => {
      socket.off("CHAT_MESSAGE_RECEIVED", handleReceive);
    };
  }, [socket, options]);
}
