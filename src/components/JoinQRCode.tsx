import React, { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { QrCode, X, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "../store";

export function JoinQRCode() {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const roomId = useStore((state) => state.roomId);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!roomId) return null;

  const joinUrl = `${window.location.origin}/?code=${roomId}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    toast.success("Join link copied to clipboard");
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center justify-center p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 dark:hover:text-slate-200 dark:hover:bg-slate-800/50 transition-colors"
        title="Show Join QR Code"
      >
        <QrCode className="w-5 h-5" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => setIsOpen(false)}
          />
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-slate-800/50">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <QrCode className="w-4 h-4 text-indigo-500" />
                Join Session
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 flex flex-col items-center justify-center">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-4">
                <QRCodeSVG
                  value={joinUrl}
                  size={200}
                  level="H"
                  includeMargin={false}
                  className="w-full h-full text-slate-900"
                />
              </div>
              <p className="text-sm text-center text-slate-600 dark:text-slate-400 mb-6">
                Scan with a mobile device camera to instantly join this session.
              </p>

              <div className="w-full bg-slate-50 dark:bg-slate-800 rounded-lg p-1.5 flex items-center gap-2 border border-slate-200/50 dark:border-slate-700">
                <div className="flex-1 truncate px-3 text-xs font-mono text-slate-600 dark:text-slate-400">
                  {joinUrl}
                </div>
                <button
                  onClick={handleCopy}
                  className="flex items-center justify-center p-2 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-md shadow-sm border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
