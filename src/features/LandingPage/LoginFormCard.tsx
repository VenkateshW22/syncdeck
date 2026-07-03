import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useStore } from "../../store";
import { CreateRoomDTO, JoinRoomDTO } from "../../types";
import { toast } from "sonner";
import { KeyRound, User, Play, ArrowRight, Laptop } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { validateDisplayName, validateRoomCode } from "../../utils/validation";
import { api } from "../../api/client";

interface LoginFormCardProps {
  isWarping: boolean;
  setIsWarping: (warping: boolean) => void;
  focusedInput: "hostName" | "adminKey" | "studentName" | "roomCode" | null;
  setFocusedInput: (input: "hostName" | "adminKey" | "studentName" | "roomCode" | null) => void;
  activeGlowColor: string;
}

export function LoginFormCard({
  isWarping,
  setIsWarping,
  setFocusedInput,
  activeGlowColor,
}: LoginFormCardProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const codeParam = searchParams.get("code") || "";
  const setSession = useStore((state) => state.setSession);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Form states
  const [createName, setCreateName] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [joinCode, setJoinCode] = useState(codeParam);
  const [joinName, setJoinName] = useState("");
  const [waitingRoom, setWaitingRoom] = useState(false);
  const [activeTab, setActiveTab] = useState<"host" | "student">(codeParam ? "student" : "host");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update form inputs directly
  const handleInputKeystroke = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: "hostName" | "adminKey" | "studentName" | "roomCode"
  ) => {
    if (field === "hostName") setCreateName(e.target.value);
    if (field === "adminKey") setAdminKey(e.target.value);
    if (field === "studentName") setJoinName(e.target.value);
    if (field === "roomCode") setJoinCode(e.target.value);
  };

  // Instructor deploy execution handler
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || isWarping) return;

    if (adminKey !== "VK2212") {
      return toast.error("Invalid Admin Key. Please provide authorized credentials.");
    }
    const nameValidation = validateDisplayName(createName, "HOST");
    if (!nameValidation.isValid) {
      return toast.error(nameValidation.error || "Invalid host name.");
    }
    const trimmedName = nameValidation.cleanName!;

    setIsSubmitting(true);
    toast.loading(`Readying celestial pipeline for ${trimmedName}...`, { id: "login-toast" });

    try {
      const body: CreateRoomDTO = {
        hostName: trimmedName,
        persistOnClose: false,
        waitingRoomEnabled: waitingRoom,
      };
      const data = await api.rooms.create(body);
      setIsWarping(true); // TRIGGER INTENSE WARP SYSTEM
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setSession(data.hostToken, data.roomCode, data.hostId, "HOST");
        toast.success("SyncDeck space synchronized!", { id: "login-toast" });
        navigate(`/host/${data.roomCode}`);
      }, 1100);
    } catch (err: any) {
      if (err.status) {
         toast.error(`Failed to create room: ${err.message}`, { id: "login-toast" });
      } else {
         toast.error(`Error creating room: ${err.message}`, { id: "login-toast" });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Student joining execution handler
  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || isWarping) return;

    const nameValidation = validateDisplayName(joinName, "STUDENT");
    if (!nameValidation.isValid) {
      return toast.error(nameValidation.error || "Invalid display name.");
    }
    const trimmedName = nameValidation.cleanName!;

    const codeValidation = validateRoomCode(joinCode);
    if (!codeValidation.isValid) {
      return toast.error(codeValidation.error || "Invalid room code.");
    }
    const trimmedCode = codeValidation.cleanName!;

    setIsSubmitting(true);
    toast.loading(`Channeling connection to room ${trimmedCode}...`, { id: "login-toast" });

    try {
      const body: JoinRoomDTO = { displayName: trimmedName };
      const data = await api.rooms.join(trimmedCode, body);
      setIsWarping(true); // TRIGGER INTENSE WARP SYSTEM
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setSession(
          data.token,
          trimmedCode,
          data.participantId,
          "PARTICIPANT",
          data.status === "PENDING" ? "WAITING" : "ONLINE"
        );
        toast.success("Successfully arrived at terminal", { id: "login-toast" });
        navigate(`/join/${trimmedCode}`);
      }, 1100);
    } catch (err: any) {
      if (err.status) {
         toast.error(`Failed to connect: ${err.message}`, { id: "login-toast" });
      } else {
         toast.error(`Error connecting to room: ${err.message}`, { id: "login-toast" });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      animate={
        isWarping
          ? { scale: [1, 1.05, 0], opacity: [1, 0.9, 0], filter: "blur(8px)", rotate: 10 }
          : {
              y: [0, -6, 2, -4, 0],
              rotate: [0, 0.3, -0.2, 0.2, 0],
            }
      }
      transition={
        isWarping
          ? { duration: 1.1, ease: "easeInOut" }
          : {
              repeat: Infinity,
              duration: 8,
              ease: "easeInOut",
            }
      }
      whileHover={{
        scale: 1.012,
        boxShadow: `0 0 80px -10px ${activeGlowColor}50, 0 40px 75px -15px rgba(0,0,0,0.9)`,
      }}
      className="w-full max-w-[480px] bg-white/75 dark:bg-[#070b18]/65 backdrop-blur-3xl border border-white/20 dark:border-white/10 p-8 sm:p-10 rounded-[2.5rem] shadow-[0_25px_60px_rgba(0,0,0,0.65)] dark:shadow-[0_35px_80px_rgba(0,0,0,0.9)] relative mx-4 transition-all duration-300 z-10"
    >
      {/* Inner futuristic border overlay */}
      <div className="absolute inset-[1px] border border-white/5 dark:border-white/[0.03] rounded-[2.4rem] pointer-events-none" />

      {/* Hexagonal overlay on card background */}
      <div className="absolute inset-0 bg-radial from-transparent to-black/[0.15] dark:to-white/[0.01] rounded-[2.5rem] pointer-events-none" />

      {/* Dynamic boundary edge glow */}
      <div
        className="absolute inset-x-16 top-0 h-[2px] opacity-100 blur-[0.3px] transition-colors duration-500"
        style={{
          background: `linear-gradient(90deg, transparent, ${activeGlowColor}, transparent)`,
        }}
      />

      <div className="flex flex-col items-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 p-3 flex items-center justify-center hover:scale-105 transition-transform mb-5 relative group">
          <span className="absolute inset-0 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/5 blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
          <img
            src="/favicon.svg"
            alt="SyncDeck Logo"
            className="w-full h-full object-contain animate-pulse relative z-10"
          />
        </div>
        <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-wider font-sans ch-glow uppercase text-center leading-none">
          SyncDeck Terminal
        </h2>
        <span className="text-[10px] font-mono tracking-[0.25em] text-indigo-500 dark:text-indigo-400 font-bold uppercase mt-2.5">
          Real-Time Companion Workspace
        </span>
      </div>

      {/* Premium Tab Segments Switcher */}
      <div className="relative flex select-none bg-slate-100 dark:bg-black/30 p-1.5 rounded-2xl border border-slate-200 dark:border-white/[0.05] w-full mx-auto mb-6">
        <button
          type="button"
          onClick={() => setActiveTab("host")}
          className="relative flex-1 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer z-10 text-center"
        >
          {activeTab === "host" && (
            <motion.div
              layoutId="active-tab"
              className="absolute inset-0 bg-white dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 rounded-xl shadow-xs"
              transition={{ type: "spring", stiffness: 450, damping: 32 }}
            />
          )}
          <span
            className={`relative z-20 transition-colors ${
              activeTab === "host"
                ? "text-slate-800 dark:text-white font-bold"
                : "text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            Host Session
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("student")}
          className="relative flex-1 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer z-10 text-center"
        >
          {activeTab === "student" && (
            <motion.div
              layoutId="active-tab"
              className="absolute inset-0 bg-white dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 rounded-xl shadow-xs"
              transition={{ type: "spring", stiffness: 450, damping: 32 }}
            />
          )}
          <span
            className={`relative z-20 transition-colors ${
              activeTab === "student"
                ? "text-slate-800 dark:text-white font-bold"
                : "text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            Join Session
          </span>
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "host" ? (
          <motion.form
            key="host-form"
            onSubmit={handleCreateRoom}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* Host name */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-300 font-bold">
                Host Display Name
              </label>
              <div className="flex items-center border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-black/40 rounded-xl px-3.5 py-3 focus-within:border-indigo-500/50 dark:focus-within:border-[#6366F1]/50 focus-within:bg-white dark:focus-within:bg-black/60 transition-all">
                <User className="w-4 h-4 text-slate-400 dark:text-slate-400 mr-2.5 shrink-0 select-none" />
                <input
                  type="text"
                  required
                  autoComplete="off"
                  onFocus={() => setFocusedInput("hostName")}
                  onBlur={() => setFocusedInput(null)}
                  onChange={(e) => handleInputKeystroke(e, "hostName")}
                  className="flex-1 bg-transparent text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none text-xs focus:ring-0 p-0 border-0"
                  placeholder="e.g. Dr. Adam"
                  value={createName}
                />
              </div>
            </div>

            {/* Admin Secret Key */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-300 font-bold">
                Admin Secret Key
              </label>
              <div className="flex items-center border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-black/40 rounded-xl px-3.5 py-3 focus-within:border-indigo-500/50 dark:focus-within:border-[#6366F1]/55 focus-within:bg-white dark:focus-within:bg-black/60 transition-all">
                <KeyRound className="w-4 h-4 text-slate-400 dark:text-slate-400 mr-2.5 shrink-0 select-none" />
                <input
                  type="password"
                  required
                  onFocus={() => setFocusedInput("adminKey")}
                  onBlur={() => setFocusedInput(null)}
                  onChange={(e) => handleInputKeystroke(e, "adminKey")}
                  className="flex-1 bg-transparent text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none text-xs focus:ring-0 p-0 border-0"
                  placeholder="Enter admin key"
                  value={adminKey}
                />
              </div>
            </div>

            {/* Lobby Approval Switch */}
            <div className="flex items-center justify-between py-2 bg-slate-50 dark:bg-black/45 px-3.5 rounded-xl border border-slate-200 dark:border-white/[0.05] mt-1">
              <div className="flex flex-col">
                <span className="text-xs text-slate-700 dark:text-white/80 font-semibold leading-tight">
                  Require Host Approval
                </span>
                <span className="text-[9px] text-slate-400 dark:text-slate-400 leading-none mt-0.5">
                  Participants wait in lobby
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={waitingRoom}
                  onChange={(e) => setWaitingRoom(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-8 h-[18px] bg-slate-200 dark:bg-white/10 rounded-full peer peer-focus:ring-0 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[2px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-green-500" />
              </label>
            </div>

            {/* Deploy submit button */}
            <button
              type="submit"
              disabled={isSubmitting || isWarping}
              className="w-full bg-indigo-600 dark:bg-white text-white dark:text-black py-3 rounded-xl font-bold text-xs hover:bg-indigo-700 dark:hover:bg-[#F4F4F5] active:scale-[0.98] transition-all cursor-pointer mt-6 flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-current text-white dark:text-black shrink-0" />
              <span>[ Deploy SyncDeck ]</span>
            </button>
          </motion.form>
        ) : (
          <motion.form
            key="student-form"
            onSubmit={handleJoinRoom}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* Participant Display name */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-300 font-bold">
                Participant Display Name
              </label>
              <div className="flex items-center border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-black/40 rounded-xl px-3.5 py-3 focus-within:border-indigo-500/50 dark:focus-within:border-[#EC4899]/55 focus-within:bg-white dark:focus-within:bg-black/60 transition-all">
                <User className="w-4 h-4 text-slate-400 dark:text-slate-400 mr-2.5 shrink-0 select-none" />
                <input
                  type="text"
                  required
                  autoComplete="off"
                  onFocus={() => setFocusedInput("studentName")}
                  onBlur={() => setFocusedInput(null)}
                  onChange={(e) => handleInputKeystroke(e, "studentName")}
                  className="flex-1 bg-transparent text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none text-xs focus:ring-0 p-0 border-0"
                  placeholder="e.g. John Doe, Sarah"
                  value={joinName}
                />
              </div>
            </div>

            {/* 6-digit Room code */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-300 font-bold">
                6-Digit Room Code
              </label>
              <div className="flex items-center border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-black/40 rounded-xl px-3.5 py-3 focus-within:border-indigo-500/50 dark:focus-within:border-[#EC4899]/55 focus-within:bg-white dark:focus-within:bg-black/60 transition-all">
                <Laptop className="w-4 h-4 text-slate-400 dark:text-slate-400 mr-2.5 shrink-0 select-none" />
                <input
                  type="text"
                  required
                  onFocus={() => setFocusedInput("roomCode")}
                  onBlur={() => setFocusedInput(null)}
                  onChange={(e) => handleInputKeystroke(e, "roomCode")}
                  className="flex-1 bg-transparent text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none text-xs focus:ring-0 p-0 border-0 tracking-widest font-bold uppercase"
                  placeholder="Enter room code"
                  value={joinCode}
                />
              </div>
            </div>

            <div className="pt-2" />

            {/* Connect submit button */}
            <button
              type="submit"
              disabled={isSubmitting || isWarping}
              className="w-full bg-indigo-600 dark:bg-white text-white dark:text-black py-3 rounded-xl font-bold text-xs hover:bg-indigo-700 dark:hover:bg-[#F4F4F5] active:scale-[0.98] transition-all cursor-pointer mt-6 flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <span>[ Join Live Session ]</span>
              <ArrowRight className="w-3.5 h-3.5 text-white dark:text-black shrink-0" />
            </button>
          </motion.form>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
