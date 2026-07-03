import React from "react";
import { toast } from "sonner";
import { Resource } from "./EditableResourceItem";

function ensureAbsoluteUrl(url?: string): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

async function downloadWithAuth(fileUrl: string, fileName?: string, token?: string | null) {
  try {
    const response = await fetch(fileUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      toast.error(`Download failed: ${response.statusText}`);
      return;
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = fileName || "file";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
  } catch (err) {
    toast.error("Download failed. Please try again.");
  }
}

interface ParticipantResourceItemProps {
  resource: Resource;
  token: string | null;
}

export function ParticipantResourceItem({ resource, token }: ParticipantResourceItemProps) {
  const r = resource;

  const handleCopyText = (text: string | undefined, message: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(message);
  };

  return (
    <div
      key={r.id}
      id={`participant-resource-${r.id}`}
      className="p-5 bg-white dark:bg-slate-900 rounded-2xl shadow border border-slate-200/50 dark:border-white/5"
    >
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs font-mono font-medium tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-1 rounded uppercase">
          {r.type.replace("_", " ")}
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {new Date(r.createdAt || Date.now()).toLocaleString()}
        </span>
      </div>
      {r.title && (
        <h3 className="text-lg font-semibold mb-2 text-slate-900 dark:text-slate-100">
          {r.title}
        </h3>
      )}
      {r.type === "ANNOUNCEMENT" && (
        <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
          {r.metadata.message}
        </p>
      )}
      {r.type === "CODE_SNIPPET" && (
        <div className="relative group">
          <button
            onClick={() => handleCopyText(r.metadata.content, "Code copied!")}
            className="absolute top-2 right-2 px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-xs opacity-0 group-hover:opacity-100 transition cursor-pointer"
          >
            Copy
          </button>
          <pre className="bg-slate-900 dark:bg-black/50 border dark:border-slate-800 text-slate-50 p-4 rounded-md text-sm overflow-x-auto">
            <code className={`language-${r.metadata.message || "text"}`}>
              {r.metadata.content}
            </code>
          </pre>
        </div>
      )}
      {r.type === "URL_RESOURCE" && (
        <div className="flex flex-col gap-2 relative group bg-slate-50 dark:bg-slate-800 p-3 rounded">
          <div className="flex items-center gap-2">
            <span className="truncate text-slate-700 dark:text-slate-300 font-mono text-sm">
              {r.metadata.url}
            </span>
          </div>
          <div className="flex flex-col gap-2 mt-2">
            <button
              onClick={() => handleCopyText(r.metadata.url, "Link copied!")}
              className="w-full text-center text-xs bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-3 py-2 rounded hover:bg-slate-300 dark:hover:bg-slate-600 font-medium transition cursor-pointer"
            >
              Copy Link
            </button>
            <a
              href={ensureAbsoluteUrl(r.metadata.url)}
              target="_blank"
              rel="noreferrer"
              className="w-full text-center inline-flex justify-center items-center bg-blue-600 dark:bg-blue-500 text-white px-3 py-2 rounded hover:bg-blue-700 dark:hover:bg-blue-600 outline-none text-xs font-medium transition"
            >
              Open Link <span className="ml-1">→</span>
            </a>
          </div>
        </div>
      )}
      {r.type === "FILE_RESOURCE" && (
        <button
          onClick={() => downloadWithAuth(
            r.metadata.fileUrl || '',
            r.metadata.fileName,
            token,
          )}
          className="inline-flex items-center bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-2 rounded-md hover:bg-slate-800 dark:hover:bg-slate-200 font-medium cursor-pointer"
        >
          Download File{" "}
          <span className="ml-2 bg-slate-700 dark:bg-slate-300 px-2 py-0.5 rounded text-xs text-white">
            {r.metadata.fileName}
          </span>
        </button>
      )}
    </div>
  );
}
