import { useState, useEffect, useMemo } from "react";
import { useSocket } from "../context/SocketContext";
import { useStore } from "../store";
import { api } from "../api/client";

export interface AuditLog {
  id: string;
  action: string;
  details: any;
  createdAt: string;
  performedBy?: string;
}

export type FeedCategory = "All" | "Resources" | "Polls" | "Announcements" | "Whiteboard" | "Chat" | "Participants";

export function useActivityFeed() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filter, setFilter] = useState<FeedCategory>("All");
  const { socket } = useSocket();
  const token = useStore((state) => state.token);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const data = await api.audit.list();
        setLogs(data);
      } catch (err) {
        console.error("Failed to fetch audit logs", err);
      }
    };
    if (token) {
      fetchLogs();
    }
  }, [token]);

  useEffect(() => {
    if (!socket) return;
    
    const handleNewLog = (log: AuditLog) => {
        setLogs(prev => [log, ...prev]);
    };

    socket.on("NEW_AUDIT_LOG", handleNewLog);
    return () => {
        socket.off("NEW_AUDIT_LOG", handleNewLog);
    };
  }, [socket]);

  const filteredLogs = useMemo(() => {
    if (filter === "All") return logs;
    return logs.filter(log => {
      switch (filter) {
        case "Resources": return log.action.includes("RESOURCE");
        case "Polls": return log.action.includes("POLL");
        case "Chat": return log.action.includes("CHAT");
        case "Participants": return log.action.includes("PARTICIPANT") || log.action.includes("ROOM");
        default: return true;
      }
    });
  }, [logs, filter]);

  return {
    logs: filteredLogs,
    filter,
    setFilter,
    totalLogs: logs.length
  };
}
