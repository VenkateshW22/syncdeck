import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "../store";

export interface NoteEntry {
  id: string;
  content: string;
  timestamp: number;
}

export function usePersonalNotes(roomId: string | undefined) {
  const participantId = useStore((state) => state.participantId);
  const storageKey = `syncdeck_notes_${roomId}_${participantId}`;

  const [content, setContent] = useState<string>("");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load initial notes
  useEffect(() => {
    if (!roomId || !participantId) return;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      setContent(saved);
      setLastSaved(new Date());
    }
  }, [roomId, participantId, storageKey]);

  // Save function
  const saveNotes = useCallback((newContent: string) => {
    if (!roomId || !participantId) return;
    localStorage.setItem(storageKey, newContent);
    setLastSaved(new Date());
  }, [roomId, participantId, storageKey]);

  // Auto-save logic
  useEffect(() => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    autoSaveTimeoutRef.current = setTimeout(() => {
      saveNotes(content);
    }, 5000);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [content, saveNotes]);

  // Save before unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveNotes(content);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [content, saveNotes]);

  const insertSmartAction = useCallback((text: string) => {
    const newContent = content + (content.endsWith("\n") || content === "" ? "" : "\n") + text + "\n";
    setContent(newContent);
    saveNotes(newContent);
  }, [content, saveNotes]);

  const exportNotes = useCallback((format: "txt" | "md" | "pdf") => {
    if (format === "pdf") {
      import("jspdf").then(({ jsPDF }) => {
        const doc = new jsPDF();
        const splitText = doc.splitTextToSize(content, 180);
        doc.text(splitText, 15, 15);
        doc.save(`Session_Notes_${roomId}.pdf`);
      });
      return;
    }

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Session_Notes_${roomId}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [content, roomId]);

  return {
    content,
    setContent,
    lastSaved,
    searchQuery,
    setSearchQuery,
    insertSmartAction,
    exportNotes
  };
}
