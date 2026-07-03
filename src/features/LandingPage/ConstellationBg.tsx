import { useState, useEffect, useMemo } from "react";
import { useTheme } from "../../components/ThemeProvider";
import { Users, ClipboardList, Sparkles, FolderOpen, Laptop, BarChart3, Palette, MessageSquare } from "lucide-react";
import { motion } from "motion/react";

interface ConstellationBgProps {
  focusedInput: "hostName" | "adminKey" | "studentName" | "roomCode" | null;
  isWarping: boolean;
  warpProgress: number;
}

// Static configuration lists defined outside of component to prevent unnecessary re-renders/regeneration.
const nodeSpecs = [
  { id: "attendance", label: "Attendance", angle: -150, color: "#6366F1", glow: "rgba(99, 102, 241, 0.45)", icon: Users, status: "24 ACTIVE", pulseColor: "bg-indigo-500" },
  { id: "polls", label: "Live Polls", angle: -90, color: "#EC4899", glow: "rgba(236, 72, 153, 0.45)", icon: ClipboardList, status: "1 ACTIVE", pulseColor: "bg-pink-500" },
  { id: "ai", label: "AI Copilot", angle: -30, color: "#84CC16", glow: "rgba(132, 204, 22, 0.45)", icon: Sparkles, status: "SCANNING", pulseColor: "bg-lime-500" },
  { id: "resources", label: "Resources", angle: 30, color: "#06B6D4", glow: "rgba(6, 182, 212, 0.45)", icon: FolderOpen, status: "6 ONLINE", pulseColor: "bg-cyan-500" },
  { id: "screenshare", label: "Screencast", angle: 90, color: "#8B5CF6", glow: "rgba(139, 92, 246, 0.45)", icon: Laptop, status: "1080P CAST", pulseColor: "bg-purple-500" },
  { id: "analytics", label: "Analytics", angle: 150, color: "#FF9800", glow: "rgba(255, 152, 0, 0.45)", icon: BarChart3, status: "98% ENG", pulseColor: "bg-orange-500" },
  { id: "whiteboard", label: "Whiteboard", angle: 210, color: "#00E5FF", glow: "rgba(0, 229, 255, 0.45)", icon: Palette, status: "LIVE GRID", pulseColor: "bg-cyan-400" },
  { id: "chat", label: "Live Chat", angle: 270, color: "#10B981", glow: "rgba(16, 185, 129, 0.45)", icon: MessageSquare, status: "9+ MSGS", pulseColor: "bg-emerald-500" },
];

const connections = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0], // Outer loop
  [0, 4], [1, 5], [2, 6], [3, 7], // Cross connections
  [0, 3], [1, 4], [2, 5], [6, 3]  // Diagonals
];

const academicDoodles = [
  { symbol: "f(x) = ∫ y dx", x: 0.12, y: 0.22, speed: 1.1, phase: 0 },
  { symbol: "Σ xi * wi", x: 0.85, y: 0.15, speed: 0.8, phase: 1.5 },
  { symbol: "λ = c / ν", x: 0.25, y: 0.78, speed: 1.2, phase: 3.1 },
  { symbol: "E = mc²", x: 0.78, y: 0.72, speed: 0.9, phase: 4.5 },
  { symbol: "</>", x: 0.08, y: 0.55, speed: 1.4, phase: 2.1 },
  { symbol: "π ≈ 3.1415", x: 0.90, y: 0.50, speed: 0.7, phase: 0.8 },
  { symbol: "class SyncCard {}", x: 0.48, y: 0.08, speed: 1.0, phase: 5.2 },
  { symbol: "a² + b² = c²", x: 0.52, y: 0.88, speed: 1.3, phase: 2.7 }
];

export function ConstellationBg({ focusedInput, isWarping, warpProgress }: ConstellationBgProps) {
  const { theme } = useTheme();
  const [mouse, setMouse] = useState({ x: -2000, y: -2000 });
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });
  const [time, setTime] = useState(0);

  const isDark = theme === "dark" || (theme === "system" && typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
      
      let resizeTimeout: any;
      const handleResize = () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          setDimensions({ width: window.innerWidth, height: window.innerHeight });
        }, 200);
      };
      
      const handleMouseMove = (e: MouseEvent) => {
        setMouse({ x: e.clientX, y: e.clientY });
      };

      const handleTouch = (e: TouchEvent) => {
        if (e.touches.length > 0) {
          setMouse({ x: e.touches[0].clientX, y: e.touches[0].clientY });
        }
      };

      window.addEventListener("resize", handleResize);
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("touchstart", handleTouch, { passive: true });
      window.addEventListener("touchmove", handleTouch, { passive: true });
      
      return () => {
        window.removeEventListener("resize", handleResize);
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("touchstart", handleTouch);
        window.removeEventListener("touchmove", handleTouch);
        clearTimeout(resizeTimeout);
      };
    }
  }, []);

  useEffect(() => {
    let frameId: number;
    const startTime = Date.now();
    const update = () => {
      setTime((Date.now() - startTime) / 1000);
      frameId = requestAnimationFrame(update);
    };
    frameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frameId);
  }, []);

  // Stabilize background star generation via useMemo to avoid recreating on every tick/render pass
  const starSeeds = useMemo(() => {
    return Array.from({ length: 55 }).map((_, i) => {
      const angle = (i * 137.5) * Math.PI / 180; // golden ratio distribution
      const distance = 60 + (Math.sin(i * 91) * 0.5 + 0.5) * 580;
      const speed = 0.01 + (Math.cos(i * 17) * 0.5 + 0.5) * 0.02;
      const size = 1 + (i % 3); // 1, 2, or 3px
      const opacity = 0.12 + (Math.sin(i * 23) * 0.5 + 0.5) * 0.38;
      return { id: i, angle, distance, speed, size, opacity };
    });
  }, []);

  const centerX = dimensions.width / 2;
  const centerY = dimensions.height / 2;
  const isMobile = dimensions.width < 768;

  // Derive dynamic floating node locations
  const renderedNodes = nodeSpecs.map((spec, i) => {
    const baseRadius = isMobile 
      ? Math.max(160, Math.min(dimensions.width * 0.45, dimensions.height * 0.45))
      : Math.max(280, Math.min(dimensions.width * 0.36, dimensions.height * 0.42));
    const orbitRadius = baseRadius * (1 + warpProgress * 4.5);
    
    // Orbit speed multiplier during warp jumps
    const warpMultiply = 1 + warpProgress * 25;
    const angleRad = (spec.angle * Math.PI) / 180 + (time * (isMobile ? 0.02 : 0.04) * warpMultiply);

    // Initial floating positions coordinates
    const bx = centerX + orbitRadius * Math.cos(angleRad);
    const by = centerY + orbitRadius * Math.sin(angleRad);

    // Implied rhythmic bounce: nodes bounce to a heartbeat cycle
    const rhythmAmplitude = isMobile ? 8 : 15;
    const rhythm = Math.sin(time * (isMobile ? 1.5 : 2.5) + i * 1.8) * rhythmAmplitude;

    const ax = bx + Math.sin(time * 0.6 + i * i * 1.7) * (isMobile ? 10 : 18) + rhythm * Math.cos(angleRad);
    const ay = by + Math.cos(time * 0.42 + i * i * 1.7) * (isMobile ? 10 : 18) + rhythm * Math.sin(angleRad);

    // Direct cursor pull force mapping (react on hover within range)
    const dx = mouse.x - ax;
    const dy = mouse.y - ay;
    const dist = Math.hypot(dx, dy) || 1;

    let ox = 0;
    let oy = 0;
    const pullRadius = isMobile ? 150 : 280;
    if (dist < pullRadius) {
      const pull = Math.pow(1 - dist / pullRadius, 1.6) * (isMobile ? 25 : 45);
      ox = (dx / dist) * pull;
      oy = (dy / dist) * pull;
    }

    // Input focus handshake pulse - brightens specific nodes
    const isNodeActiveOnFocus = 
      (focusedInput === "hostName" && (spec.id === "attendance" || spec.id === "chat")) ||
      (focusedInput === "adminKey" && (spec.id === "ai" || spec.id === "analytics")) ||
      (focusedInput === "studentName" && (spec.id === "attendance" || spec.id === "polls")) ||
      (focusedInput === "roomCode" && (spec.id === "whiteboard" || spec.id === "screenshare"));

    return {
      ...spec,
      x: ax + ox,
      y: ay + oy,
      isFocused: isNodeActiveOnFocus,
    };
  });

  // Scan wave parameters
  const aiNode = renderedNodes.find(n => n.id === "ai");
  const aiScanProgress = (time % 6.5) / 6.5;
  const aiScanRadius = aiScanProgress * 320;
  const aiScanOpacity = Math.max(0, 1 - aiScanProgress) * 0.45;

  // Classroom activity pulses
  const pulseNodeIndex = Math.floor(time / 2.2) % renderedNodes.length;
  const nodePulseProgress = (time % 2.2) / 2.2;
  const activePulseNode = renderedNodes[pulseNodeIndex];

  return (
    <>
      {/* Absolute self-contained high-contrast custom keyframe overlays */}
      <style>{`
        @keyframes scan-line-swipe {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
        @keyframes warp-stars {
          0% { stroke-dashoffset: 0%; }
          100% { stroke-dashoffset: -200%; }
        }
        @keyframes crt-flicker {
          0%, 100% { opacity: 0.97; }
          45% { opacity: 1.0; }
          48% { opacity: 0.94; }
          50% { opacity: 0.99; }
          52% { opacity: 0.93; }
        }
        .scan-line-overlay {
          pointer-events: none;
          background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(99, 102, 241, 0.08) 50%), linear-gradient(90deg, rgba(236, 72, 153, 0.03), rgba(6, 182, 212, 0.03));
          background-size: 100% 4px, 6px 100%;
        }
        .ch-glow {
          text-shadow: 0 0 8px rgba(99, 102, 241, 0.4);
        }
      `}</style>

      {/* Cyber Grid scanning background layout */}
      <div className="absolute inset-0 scan-line-overlay animate-[crt-flicker_6s_infinite] select-none pointer-events-none z-1" />
      <div className="absolute inset-0 pointer-events-none select-none z-0 bg-[radial-gradient(rgba(99,102,241,0.025)_1.5px,transparent_1.5px)] [background-size:24px_24px] opacity-70" />

      {/* Absolute Interactive Classroom Network background */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none select-none overflow-hidden z-0">
        <defs>
          <filter id="network-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          
          {/* Hexagonal grid background layout */}
          <pattern id="tactical-hex" width="30" height="51.96" patternUnits="userSpaceOnUse" patternTransform="scale(0.8)">
            <path d="M15 0 L30 8.66 L30 25.98 L15 34.64 L0 25.98 L0 8.66 Z M0 51.96 L15 43.3 L30 51.96" fill="none" stroke={isDark ? "rgba(99, 102, 241, 0.018)" : "rgba(79, 70, 229, 0.03)"} strokeWidth="1" />
          </pattern>
        </defs>

        <rect width="100%" height="100%" fill="url(#tactical-hex)" />

        {/* Ambient background accent gradients */}
        <radialGradient id="radial-bg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={isDark ? "#0D0E2B" : "#DDE4FF"} stopOpacity={isDark ? "0.38" : "0.35"} />
          <stop offset="100%" stopColor={isDark ? "#060814" : "#F8FAFC"} stopOpacity="0" />
        </radialGradient>
        <rect width="100%" height="100%" fill="url(#radial-bg)" />

        {/* Deep ambient starfield particles */}
        {starSeeds.map((star) => {
          const driftAngle = star.angle + time * star.speed * 0.35;
          const sx = centerX + star.distance * Math.cos(driftAngle);
          const sy = centerY + star.distance * Math.sin(driftAngle);
          return (
            <circle
              key={`bg-star-${star.id}`}
              cx={sx}
              cy={sy}
              r={star.size}
              fill={isDark ? "#A5B4FC" : "#4F46E5"}
              opacity={star.opacity}
            />
          );
        })}

        {/* Tactical Radar Grid */}
        <g opacity={isDark ? 0.06 : 0.1} stroke={isDark ? "#6366F1" : "#4F46E5"} strokeWidth="1" fill="none">
          <circle cx={centerX} cy={centerY} r="130" strokeDasharray="3,6" className={isDark ? "animate-[spin_12s_linear_infinite]" : "animate-[spin_24s_linear_infinite]"} />
          <circle cx={centerX} cy={centerY} r="220" strokeDasharray="4,8" className={isDark ? "animate-[spin_20s_linear_infinite_reverse]" : "animate-[spin_32s_linear_infinite_reverse]"} />
          <circle cx={centerX} cy={centerY} r="330" strokeDasharray="2,14" />
          <circle cx={centerX} cy={centerY} r="460" strokeDasharray="8,24" className={isDark ? "animate-[spin_32s_linear_infinite]" : "animate-[spin_48s_linear_infinite]"} />
          <circle cx={centerX} cy={centerY} r="540" strokeDasharray="1,12" />
        </g>

        {/* AI Copilot scanning wave radiating outwards */}
        {aiNode && (
          <circle
            cx={aiNode.x}
            cy={aiNode.y}
            r={aiScanRadius}
            fill="none"
            stroke="#84CC16"
            strokeWidth={1.5}
            strokeOpacity={aiScanOpacity}
          />
        )}

        {/* Classroom active synchronization heartbeat pulses */}
        {activePulseNode && (
          <circle
            cx={activePulseNode.x}
            cy={activePulseNode.y}
            r={15 + nodePulseProgress * 80}
            fill="none"
            stroke={activePulseNode.color}
            strokeWidth={1.2}
            strokeOpacity={Math.max(0, 1 - nodePulseProgress) * 0.55}
          />
        )}

        {/* Connections glowing lines */}
        {connections.map(([a, b], idx) => {
          const na = renderedNodes[a];
          const nb = renderedNodes[b];
          if (!na || !nb) return null;

          const midX = (na.x + nb.x) / 2;
          const midY = (na.y + nb.y) / 2;
          const distToCursor = Math.hypot(mouse.x - midX, mouse.y - midY);
          const isGlowing = distToCursor < 160;
          const hasFocusHighlight = na.isFocused || nb.isFocused;

          return (
            <g key={`link-${idx}`}>
              <line
                x1={na.x}
                y1={na.y}
                x2={nb.x}
                y2={nb.y}
                stroke={isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(79, 70, 229, 0.05)"}
                strokeWidth={1}
              />
              <line
                x1={na.x}
                y1={na.y}
                x2={nb.x}
                y2={nb.y}
                stroke={na.color}
                strokeWidth={isGlowing || hasFocusHighlight ? 2.0 : 1.2}
                strokeDasharray="22 100"
                strokeDashoffset={-time * 45 - idx * 24}
                strokeOpacity={isGlowing ? 0.7 : (hasFocusHighlight ? 0.55 : 0.28)}
                className="transition-all duration-300"
              />
            </g>
          );
        })}

        {/* Rotating geometric data packet crystals */}
        {connections.map(([a, b], idx) => {
          if (isMobile && idx % 2 !== 0) return null;
          const na = renderedNodes[a];
          const nb = renderedNodes[b];
          if (!na || !nb) return null;

          const pSpeed = isWarping ? 1.6 : (isMobile ? 0.04 : 0.06);
          const p = (time * pSpeed + idx * 0.15) % 1.0;
          const px = na.x + (nb.x - na.x) * p;
          const py = na.y + (nb.y - na.y) * p;
          const packSize = (isMobile ? 3 : 4) + Math.sin(time * 6 + idx) * 1;

          return (
            <g key={`packet-${idx}`} transform={`translate(${px}, ${py}) rotate(${time * 80 + idx * 45})`}>
              <rect
                x={-packSize / 2}
                y={-packSize / 2}
                width={packSize}
                height={packSize}
                fill={na.color}
                opacity={na.isFocused || nb.isFocused ? 0.95 : 0.5}
              />
            </g>
          );
        })}

        {/* Interactive background SVG hardware cores */}
        {renderedNodes.map((node) => {
          return (
            <g key={`node-core-${node.id}`} transform={`translate(${node.x}, ${node.y})`}>
              <circle
                r={10}
                fill={node.color}
                opacity={0.08}
              />
              <circle
                r={3}
                fill={node.color}
                opacity={0.4}
              />
            </g>
          );
        })}

        {/* Soft Academic Doodles floating in 3D space */}
        {academicDoodles.map((doc, idx) => {
          const px = doc.x * dimensions.width;
          const py = doc.y * dimensions.height;
          
          const wiggleX = Math.sin(time * (isMobile ? 0.6 : 1.0) * doc.speed + doc.phase) * (isMobile ? 8 : 15);
          const wiggleY = Math.cos(time * (isMobile ? 0.5 : 0.82) * doc.speed + doc.phase) * (isMobile ? 8 : 15);
          
          const dx = mouse.x - px;
          const dy = mouse.y - py;
          const distance = Math.hypot(dx, dy) || 1;
          let pushX = 0;
          let pushY = 0;
          if (distance < 200) {
            const pushForce = Math.pow(1 - distance / 200, 2) * -35;
            pushX = (dx / distance) * pushForce;
            pushY = (dy / distance) * pushForce;
          }

          const warpOffset = warpProgress * 400 * (px < centerX ? -1 : 1);

          const tx = px + wiggleX + pushX + warpOffset;
          const ty = py + wiggleY + pushY;

          return (
            <text
              key={`doodle-${idx}`}
              x={tx}
              y={ty}
              fill={isDark ? "rgba(99, 102, 241, 0.08)" : "rgba(79, 70, 229, 0.12)"}
              fontSize="12px"
              fontFamily="monospace"
              fontWeight="bold"
              letterSpacing="0.05em"
              textAnchor="middle"
              className="pointer-events-none select-none transition-all duration-350"
            >
              {doc.symbol}
            </text>
          );
        })}

        {/* Cursor constellation lines */}
        {renderedNodes.map((node) => {
          const distToCursor = Math.hypot(mouse.x - node.x, mouse.y - node.y);
          if (distToCursor >= 260) return null;
          
          const opacity = (1 - distToCursor / 260) * 0.22;
          
          return (
            <g key={`cur-link-${node.id}`}>
              <line
                x1={mouse.x}
                y1={mouse.y}
                x2={node.x}
                y2={node.y}
                stroke={node.color}
                strokeWidth={1.2}
                strokeDasharray="4,6"
                strokeOpacity={opacity}
              />
            </g>
          );
        })}

        {/* Cursor Aura indicator */}
        <g>
          <circle
            cx={mouse.x}
            cy={mouse.y}
            r="38"
            fill="none"
            stroke={isDark ? "rgba(99, 102, 241, 0.15)" : "rgba(79, 70, 229, 0.2)"}
            strokeWidth="0.75"
            strokeDasharray="3 9"
            className="animate-[spin_12s_linear_infinite]"
          />
          <circle
            cx={mouse.x}
            cy={mouse.y}
            r="18"
            fill="none"
            stroke={isDark ? "rgba(236, 72, 153, 0.1)" : "rgba(236, 72, 153, 0.15)"}
            strokeWidth="1.5"
            strokeDasharray="1 6"
            className="animate-[spin_6s_linear_infinite_reverse]"
          />
          <circle
            cx={mouse.x}
            cy={mouse.y}
            r={5}
            fill={isDark ? "rgba(99, 102, 241, 0.25)" : "rgba(79, 70, 229, 0.3)"}
          />
        </g>
      </svg>

      {/* Interactive HTML Module Beacons Overlay */}
      <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden select-none">
        {renderedNodes.map((node) => {
          const Icon = node.icon;
          const isNodeFocused = node.isFocused;
          return (
            <motion.div
              key={`beacon-${node.id}`}
              style={{
                position: "absolute",
                left: node.x,
                top: node.y,
                x: "-50%",
                y: "-50%",
                pointerEvents: "auto",
              }}
              whileHover={{ scale: 1.05, y: -3 }}
              className="group cursor-pointer"
            >
              <div 
                className="flex items-center gap-3 bg-slate-950/80 dark:bg-slate-950/85 backdrop-blur-xl border border-white/10 dark:border-white/5 rounded-2xl p-2.5 pr-4 shadow-[0_12px_30px_-5px_rgba(0,0,0,0.65)] transition-all duration-300 group-hover:border-white/20 group-hover:shadow-[0_0_25px_var(--glow)]"
                style={{ 
                  "--glow": `${node.color}33`,
                  boxShadow: isNodeFocused ? `0 0 25px ${node.color}33, 0 12px 30px -5px rgba(0,0,0,0.65)` : undefined,
                  borderColor: isNodeFocused ? `${node.color}40` : undefined,
                } as any}
              >
                <div 
                  className="w-8.5 h-8.5 rounded-xl flex items-center justify-center relative transition-transform duration-300 group-hover:scale-110"
                  style={{ backgroundColor: `${node.color}15`, border: `1px solid ${node.color}30` }}
                >
                  <span 
                    className="absolute inset-0 rounded-xl animate-ping opacity-25"
                    style={{ backgroundColor: node.color, animationDuration: "3.5s" }}
                  />
                  <Icon className="w-4 h-4" style={{ color: node.color }} />
                </div>

                <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-white/90 tracking-tight leading-none group-hover:text-white transition-colors">
                    {node.label}
                  </span>
                  <span 
                    className="text-[8px] font-mono font-bold tracking-widest mt-1.5 flex items-center gap-1.5 leading-none transition-all duration-300 animate-pulse"
                    style={{ color: node.color }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: node.color }} />
                    {node.status}
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </>
  );
}
