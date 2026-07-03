import React, { useState, useEffect, useRef } from "react";
import { useSocket } from "../context/SocketContext";
import { useRoomStore } from "../store/roomStore";
import { useChatSocket } from "../hooks/sockets/useChatSocket";

const PRESET_EMOJIS = ["👍", "❤️", "🎉", "👏", "🔥", "😮", "💡", "❓"];

const ChatBubble = React.memo(function ChatBubble({ message }: { message: any }) {
  return (
    <div className="flex flex-col group animate-[fadeIn_0.15s_ease-out]">
      <div className="flex items-baseline gap-2">
        <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 font-sans">
          {message.senderName}
        </span>
        <span className="text-[10px] text-slate-400 dark:text-slate-400 font-mono">
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
      <p className="text-xs text-slate-600 dark:text-slate-300 bg-white/70 dark:bg-slate-950/40 border border-slate-200/40 dark:border-white/5 p-2.5 rounded-xl mt-1 leading-normal shadow-xs break-words font-sans">
        {message.text}
      </p>
    </div>
  );
});

export function SidebarChat({ senderName }: { senderName: string }) {
  const { socket } = useSocket();
  const messages = useRoomStore((state) => state.chatMessages);
  const mergeChatMessages = useRoomStore((state) => state.mergeChatMessages);
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useChatSocket({
    onMessageReceived: (msg) => {
      mergeChatMessages([msg]);
    }
  });

  const handleSend = () => {
    if (!inputText.trim() || !socket) return;
    socket.emit("CHAT_MESSAGE", { text: inputText, senderName });
    setInputText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSend();
    }
  };

  return (
    <div className="w-full lg:w-80 bg-white/70 dark:bg-slate-900/40 backdrop-blur-3xl border border-slate-200/50 dark:border-white/10 rounded-[1.5rem] flex flex-col h-[40vh] lg:max-h-none lg:h-full flex-shrink-0 shadow-xl shadow-indigo-100/20 dark:shadow-none overflow-hidden">
      <div className="p-4 border-b border-slate-100 dark:border-white/5 font-semibold text-slate-800 dark:text-slate-100">
        Class Chat
      </div>
      <div className="flex-1 overflow-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-sm text-slate-400 text-center mt-4">
            No messages yet.
          </div>
        )}
        {messages.map((m) => (
          <ChatBubble key={m.id} message={m} />
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Interactive Emoji Reaction Tray */}
      <div className="px-3 py-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between gap-2 overflow-x-auto select-none shrink-0 scrollbar-none">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">React:</span>
        <div className="flex gap-1">
          {PRESET_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                if (socket) {
                  socket.emit("EMOJI_REACTION", { emoji, senderName });
                }
              }}
              className="w-7 h-7 flex items-center justify-center text-base rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-all hover:scale-125 active:scale-90 cursor-pointer duration-150"
              title={`React with ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 border-t border-slate-100 dark:border-white/5 flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Send a chat message..."
          className="flex-1 border border-slate-200 dark:border-slate-800 bg-slate-50/55 dark:bg-slate-900/30 px-3 py-2 rounded-xl text-xs outline-none focus:border-indigo-500 dark:text-slate-100 placeholder-slate-400"
        />
        <button
          onClick={handleSend}
          className="bg-indigo-600 text-white px-3.5 py-2 rounded-xl text-xs font-semibold hover:bg-indigo-700 transition cursor-pointer shrink-0"
        >
          Send
        </button>
      </div>
    </div>
  );
}
