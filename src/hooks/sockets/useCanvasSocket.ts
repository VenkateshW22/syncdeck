import { useEffect, useRef } from "react";
import { useSocket } from "../../context/SocketContext";

export interface CanvasSocketOptions {
  onDraw?: (data: any) => void;
  onDrawLine?: (data: any) => void;
  onCanvasCleared?: () => void;
}

export function useCanvasSocket(options?: CanvasSocketOptions) {
  const { socket } = useSocket();

  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (!socket) return;

    const handleDraw = (data: any) => {
      if (optionsRef.current?.onDraw) optionsRef.current.onDraw(data);
    };

    const handleDrawLine = (data: any) => {
      if (optionsRef.current?.onDrawLine) optionsRef.current.onDrawLine(data);
    };
    
    const handleDrawUpdate = (data: any) => {
      if (optionsRef.current?.onDraw) optionsRef.current.onDraw(data);
    };

    const handleCanvasCleared = () => {
      if (optionsRef.current?.onCanvasCleared) optionsRef.current.onCanvasCleared();
    };

    socket.on("DRAW", handleDraw);
    socket.on("DRAW_LINE", handleDrawLine);
    socket.on("DRAW_UPDATE", handleDrawUpdate);
    socket.on("CANVAS_CLEARED", handleCanvasCleared);

    return () => {
      socket.off("DRAW", handleDraw);
      socket.off("DRAW_LINE", handleDrawLine);
      socket.off("DRAW_UPDATE", handleDrawUpdate);
      socket.off("CANVAS_CLEARED", handleCanvasCleared);
    };
  }, [socket]);
}
