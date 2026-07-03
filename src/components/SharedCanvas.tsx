import React, { useEffect, useRef, useState } from "react";
import { useSocket } from "../context/SocketContext";
import { useRoomStore } from "../store/roomStore";
import { throttle } from "lodash";
import { Paintbrush, Eraser, Trash2 } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { useCanvasSocket } from "../hooks/sockets/useCanvasSocket";

interface Line {
  id: string;
  points: number[];
  color: string;
  strokeWidth: number;
  tool: string;
}

export function SharedCanvas({ isHost = false }: { isHost?: boolean }) {
  const { socket } = useSocket();
  const { theme } = useTheme();
  
  // Detect if dark mode is active (handles system settings as well)
  const isDark = theme === "dark" || (theme === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  const brushColors = [
    { hex: "#4f46e5", darkHex: "#a5b4fc", label: "Select Indigo brush" },
    { hex: "#0d9488", darkHex: "#2dd4bf", label: "Select Teal brush" },
    { hex: "#ea580c", darkHex: "#fdba74", label: "Select Orange brush" },
    { hex: "#dc2626", darkHex: "#fca5a5", label: "Select Red brush" },
    { hex: "#1e293b", darkHex: "#f8fafc", label: "Select Charcoal/White brush" },
  ];

  const lines = useRoomStore((state) => state.canvasElements);
  const mergeCanvasElements = useRoomStore((state) => state.mergeCanvasElements);
  
  const isDrawing = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Index of currently selected brush color
  const [colorIndex, setColorIndex] = useState(0); 
  const [strokeWidth, setStrokeWidth] = useState(3); // Default medium brush
  const [tool, setTool] = useState<"pen" | "eraser">("pen");

  // Active color based on current light/dark theme
  const activeColor = isDark ? brushColors[colorIndex].darkHex : brushColors[colorIndex].hex;

  // Track the current active line drawing to draw synchronously
  const activeLineRef = useRef<Line | null>(null);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const parentWidth = containerRef.current.offsetWidth;
        const isMobile = window.innerWidth < 768;
        setDimensions({
          width: parentWidth,
          height: isMobile ? Math.min(300, parentWidth * 0.75) : Math.min(400, parentWidth * 0.6),
        });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  // Sync canvas drawing lines when state, dimensions or theme changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    canvas.style.width = `${dimensions.width}px`;
    canvas.style.height = `${dimensions.height}px`;

    ctx.scale(dpr, dpr);

    // Clear and draw all lines
    ctx.clearRect(0, 0, dimensions.width, dimensions.height);
    
    lines.forEach((line) => {
      if (!line.points || line.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = line.color;
      ctx.lineWidth = line.strokeWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      
      const startX = line.points[0] * dimensions.width;
      const startY = line.points[1] * dimensions.height;
      ctx.moveTo(startX, startY);
      for (let i = 2; i < line.points.length; i += 2) {
        const nextX = line.points[i] * dimensions.width;
        const nextY = line.points[i + 1] * dimensions.height;
        ctx.lineTo(nextX, nextY);
      }
      ctx.stroke();
    });
  }, [lines, dimensions, isDark]);

  useCanvasSocket({
    onDraw: (payload: Line | Line[]) => {
      if (!payload) return;
      const payloads = Array.isArray(payload) ? payload : [payload];
      if (payloads.length === 0) return;
      
      const prev = useRoomStore.getState().canvasElements;
      const next = [...prev];
      
      payloads.forEach(item => {
          if (!item.id) return;
          const exists = next.findIndex((line: any) => line.id === item.id);
          if (exists !== -1) {
            next[exists] = item;
          } else {
            next.push(item);
          }
      });
      
      mergeCanvasElements(next);
    },
    onCanvasCleared: () => {
      mergeCanvasElements([]);
    }
  });

  // Extract mouse or touch coordinates relative to canvas
  const getCoordinates = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    
    let clientX = 0;
    let clientY = 0;
    
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if (e.clientX !== undefined) {
      clientX = e.clientX;
      clientY = e.clientY;
    } else if (e.nativeEvent) {
      if (e.nativeEvent.touches && e.nativeEvent.touches.length > 0) {
        clientX = e.nativeEvent.touches[0].clientX;
        clientY = e.nativeEvent.touches[0].clientY;
      } else if (e.nativeEvent.clientX !== undefined) {
        clientX = e.nativeEvent.clientX;
        clientY = e.nativeEvent.clientY;
      }
    }
    
    if (clientX === 0 && clientY === 0) return null;
    
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const handleMouseDown = (e: any) => {
    if (!isHost) return;
    const coords = getCoordinates(e);
    if (!coords) return;

    isDrawing.current = true;
    
    const isDarkGlobal = document.documentElement.classList.contains("dark");
    // Eraser matches classroom background
    const lineColor = tool === "eraser" ? (isDarkGlobal ? "#020617" : "#f8fafc") : activeColor;
    const lineId = Math.random().toString(36).substring(2, 9);
    
    const normX = coords.x / (dimensions.width || 1);
    const normY = coords.y / (dimensions.height || 1);
    
    activeLineRef.current = {
      id: lineId,
      points: [normX, normY],
      color: lineColor,
      strokeWidth: strokeWidth,
      tool: tool,
    };

    // Draw starting dot synchronously
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.beginPath();
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = strokeWidth;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.moveTo(coords.x, coords.y);
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();
      }
    }
  };

  const emitDrawUpdate = useRef(
    throttle((socket: any, line: Line) => {
      socket.emit("DRAW", line);
    }, 40)
  ).current;

  const handleMouseMove = (e: any) => {
    if (!isDrawing.current || !isHost || !activeLineRef.current) return;
    const coords = getCoordinates(e);
    if (!coords) return;

    const line = activeLineRef.current;
    const lastNormX = line.points[line.points.length - 2];
    const lastNormY = line.points[line.points.length - 1];
    const lastX = lastNormX * dimensions.width;
    const lastY = lastNormY * dimensions.height;

    // Draw segment locally synchronously
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.beginPath();
        ctx.strokeStyle = line.color;
        ctx.lineWidth = line.strokeWidth;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();
      }
    }

    const normX = coords.x / (dimensions.width || 1);
    const normY = coords.y / (dimensions.height || 1);
    line.points.push(normX, normY);

    if (socket) {
      emitDrawUpdate(socket, line);
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing.current || !isHost || !activeLineRef.current) return;
    isDrawing.current = false;
    
    const line = activeLineRef.current;
    activeLineRef.current = null;

    mergeCanvasElements([...useRoomStore.getState().canvasElements, line]);

    if (socket) {
      socket.emit("DRAW", line);
    }
  };

  const handleClear = () => {
    if (!isHost || !socket) return;
    mergeCanvasElements([]);
    socket.emit("CLEAR_CANVAS");
  };

  return (
    <div
      className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-3xl border border-slate-200/50 dark:border-white/5 rounded-2xl shadow-sm flex flex-col items-center p-5 relative w-full"
      ref={containerRef}
    >
      <div className="w-full flex justify-between items-center mb-3.5">
        <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm font-sans tracking-tight">
          Interactive Session Whiteboard
        </span>
        {isHost && (
          <button
            onClick={handleClear}
            id="clear-whiteboard-btn"
            aria-label="Clear all content from whiteboard canvas"
            className="text-xs font-semibold bg-red-50 hover:bg-red-100 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-200/40 dark:border-red-900/40 px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Canvas
          </button>
        )}
      </div>

      {/* Accessible Drawing Toolbar (Visible to Hosts) */}
      {isHost && (
        <div className="w-full flex flex-wrap gap-4 items-center justify-between p-3 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200/50 dark:border-white/5 rounded-2xl mb-4 shadow-2xs">
          {/* Tool Selector */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setTool("pen")}
              id="whiteboard-tool-pen"
              aria-label="Paintbrush Brush Tool"
              aria-pressed={tool === "pen"}
              className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition ${
                tool === "pen"
                  ? "bg-indigo-600 dark:bg-indigo-500 text-white shadow-md shadow-indigo-500/10"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Paintbrush className="w-3.5 h-3.5" />
              <span>Paintbrush</span>
            </button>
            
            <button
              onClick={() => setTool("eraser")}
              id="whiteboard-tool-eraser"
              aria-label="Eraser Eraser Tool"
              aria-pressed={tool === "eraser"}
              className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition ${
                tool === "eraser"
                  ? "bg-indigo-600 dark:bg-indigo-500 text-white shadow-md shadow-indigo-500/10"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Eraser className="w-3.5 h-3.5" />
              <span>Eraser</span>
            </button>
          </div>

          {/* Whiteboard Color Selection Slots */}
          <div className={`flex items-center gap-2 transition duration-150 ${tool === "eraser" ? "opacity-35 pointer-events-none" : ""}`}>
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 dark:text-slate-400 hidden sm:inline mr-1">
              Color:
            </span>
            {brushColors.map((col, index) => {
              const isActive = colorIndex === index;
              const displayHex = isDark ? col.darkHex : col.hex;
              return (
                <button
                  key={col.hex}
                  onClick={() => setColorIndex(index)}
                  id={`whiteboard-col-${col.hex.replace("#", "")}`}
                  aria-label={col.label}
                  aria-pressed={isActive}
                  className={`w-6 h-6 rounded-full cursor-pointer transition flex items-center justify-center relative hover:scale-110 border border-white/10 ${
                    isActive ? "ring-2 ring-offset-2 ring-indigo-500 dark:ring-offset-slate-900 scale-105" : "opacity-85"
                  }`}
                  style={{ backgroundColor: displayHex }}
                >
                  {isActive && (
                    <span className="absolute w-1.5 h-1.5 rounded-full bg-white shadow-xs" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Stroke Width Buttons */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 dark:text-slate-400 hidden md:inline">
              Width:
            </span>
            <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 border border-slate-200/50 dark:border-white/5 rounded-xl">
              {[
                { size: 2, label: "Set brush to fine line size" },
                { size: 4, label: "Set brush to default medium size" },
                { size: 7, label: "Set brush to thick marker size" },
              ].map((item) => (
                <button
                  key={item.size}
                  onClick={() => setStrokeWidth(item.size)}
                  id={`whiteboard-width-${item.size}`}
                  aria-label={item.label}
                  aria-pressed={strokeWidth === item.size}
                  className={`px-2 py-1 text-[10px] font-bold rounded-lg cursor-pointer transition ${
                    strokeWidth === item.size
                      ? "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                      : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  }`}
                >
                  {item.size}px
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Drawing Stage Canvas Area */}
      <div
        className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-950/50 cursor-crosshair w-full"
        style={{ height: dimensions.height, touchAction: "none" }}
      >
        {dimensions.width > 0 && (
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleMouseDown}
            onTouchMove={handleMouseMove}
            onTouchEnd={handleMouseUp}
            className="block select-none"
          />
        )}
      </div>
    </div>
  );
}
