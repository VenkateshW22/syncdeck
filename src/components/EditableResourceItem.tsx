import React, { useState } from "react";
import { toast } from "sonner";

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

export interface ResourceMetadata {
  message?: string;
  content?: string;
  url?: string;
  fileUrl?: string;
  fileName?: string;
}

export interface Resource {
  id: string;
  type: "CODE_SNIPPET" | "ANNOUNCEMENT" | "URL_RESOURCE" | "FILE_RESOURCE";
  title?: string;
  createdAt?: string;
  metadata: ResourceMetadata;
}

interface EditableResourceItemProps {
  resource: Resource;
  socket: any;
  token: string | null;
  onOptimisticEdit: (id: string, updates: any) => void;
  onOptimisticRemove: (id: string) => void;
}

export const EditableResourceItem = React.memo(function EditableResourceItem({
  resource,
  socket,
  token,
  onOptimisticEdit,
  onOptimisticRemove,
}: EditableResourceItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(resource.title || "");
  const [editMessage, setEditMessage] = useState(resource.metadata?.message || "");
  const [editContent, setEditContent] = useState(resource.metadata?.content || "");
  const [editUrl, setEditUrl] = useState(resource.metadata?.url || "");

  const handleSave = () => {
    let newMetadata = { ...resource.metadata };
    if (resource.type === "ANNOUNCEMENT") newMetadata.message = editMessage;
    if (resource.type === "CODE_SNIPPET") newMetadata.content = editContent;
    if (resource.type === "URL_RESOURCE") newMetadata.url = editUrl;

    const payload = {
      id: resource.id,
      title: editTitle,
      metadata: newMetadata,
    };
    
    // Optimistic Update
    onOptimisticEdit(resource.id, payload);
    setIsEditing(false);

    socket?.emit("EDIT_RESOURCE", payload, (res: any) => {
      if (res && res.success) {
        toast.success("Resource updated");
      } else {
        toast.error(`Failed to update: ${res?.error || "Unknown error"}`);
      }
    });
  };

  return (
    <div id={`resource-item-${resource.id}`} className="p-5 bg-white dark:bg-slate-900 rounded-2xl shadow border border-slate-200/50 dark:border-white/5 text-slate-900 dark:text-slate-100 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-1 rounded">
            {resource.type}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {new Date(resource.createdAt || Date.now()).toLocaleString()}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {resource.type !== "FILE_RESOURCE" && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-xs font-medium cursor-pointer"
            >
              Edit
            </button>
          )}
          {isEditing && (
            <button
              onClick={() => setIsEditing(false)}
              className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 text-xs font-medium cursor-pointer"
            >
              Cancel
            </button>
          )}
          <button
            onClick={() => {
              onOptimisticRemove(resource.id);
              socket?.emit("REMOVE_RESOURCE", { id: resource.id }, (res: any) => {
                if (res && res.success) toast.success("Resource deleted");
                else toast.error(`Failed to delete: ${res?.error || "Unknown error"}`);
              });
            }}
            className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-xs font-medium cursor-pointer"
          >
            Delete
          </button>
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-3 mt-2 border-t dark:border-slate-800 pt-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Title</label>
            <input
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 transition"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
            />
          </div>
          {resource.type === "ANNOUNCEMENT" && (
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Message</label>
              <textarea
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 transition"
                rows={3}
                value={editMessage}
                onChange={(e) => setEditMessage(e.target.value)}
              />
            </div>
          )}
          {resource.type === "CODE_SNIPPET" && (
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Code snippet</label>
              <textarea
                className="w-full bg-slate-900 text-slate-100 border-none outline-none p-3 font-mono text-sm resize-y rounded"
                rows={5}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
              />
            </div>
          )}
          {resource.type === "URL_RESOURCE" && (
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">URL</label>
              <input
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 transition"
                value={editUrl}
                onChange={(e) => setEditUrl(e.target.value)}
              />
            </div>
          )}
          <button
            onClick={handleSave}
            className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-blue-700 transition cursor-pointer"
          >
            Save Changes
          </button>
        </div>
      ) : (
        <>
          {resource.title && <h3 className="font-semibold mb-1">{resource.title}</h3>}
          {resource.type === "ANNOUNCEMENT" && (
            <p className="dark:text-slate-300">{resource.metadata.message}</p>
          )}
          {resource.type === "CODE_SNIPPET" && (
            <pre className="bg-slate-900 dark:bg-black/50 text-slate-50 p-4 rounded text-sm overflow-x-auto border dark:border-slate-800 mt-2">
              {resource.metadata.content}
            </pre>
          )}
          {resource.type === "URL_RESOURCE" && (
            <div className="flex flex-col gap-2 mt-2 bg-slate-50 dark:bg-slate-800 p-3 rounded border dark:border-slate-700">
              <span className="truncate text-slate-700 dark:text-slate-300 font-mono text-sm block">
                {resource.metadata.url}
              </span>
              <div className="flex flex-col gap-2 mt-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(resource.metadata.url || "");
                    toast.success("Link copied!");
                  }}
                  className="w-full text-center text-xs bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-3 py-2 rounded hover:bg-slate-300 dark:hover:bg-slate-600 font-medium transition cursor-pointer"
                >
                  Copy Link
                </button>
                <a
                  href={ensureAbsoluteUrl(resource.metadata.url)}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full text-center inline-flex justify-center items-center bg-blue-600 dark:bg-blue-500 text-white px-3 py-2 rounded hover:bg-blue-700 dark:hover:bg-blue-600 outline-none text-xs font-medium transition"
                >
                  Open Link →
                </a>
              </div>
            </div>
          )}
          {resource.type === "FILE_RESOURCE" && (
            <div className="mt-2">
              <button
                onClick={() => downloadWithAuth(
                  resource.metadata.fileUrl || resource.metadata.url || '',
                  resource.metadata.fileName || resource.title,
                  token,
                )}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium text-sm inline-flex items-center gap-1 cursor-pointer"
              >
                Download File: {resource.title} <span className="text-lg">↓</span>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
});
