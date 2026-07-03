import { useEffect } from "react";
import { useSocket } from "../../context/SocketContext";
import { AuditLog } from "../useActivityFeed";

export interface TimelineSocketOptions {
  onNewLog?: (log: AuditLog) => void;
}

export function useTimelineSocket(options?: TimelineSocketOptions) {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    const handleNewLog = (log: AuditLog) => {
      if (options?.onNewLog) {
        options.onNewLog(log);
      }
    };

    socket.on("NEW_AUDIT_LOG", handleNewLog);

    return () => {
      socket.off("NEW_AUDIT_LOG", handleNewLog);
    };
  }, [socket, options]);
}
