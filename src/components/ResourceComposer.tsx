import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { api } from "../api/client";

interface ResourceComposerProps {
  socket: any;
  token: string | null;
}

export function ResourceComposer({ socket, token }: ResourceComposerProps) {
  // Composer state
  const [type, setType] = useState<
    "CODE_SNIPPET" | "ANNOUNCEMENT" | "URL_RESOURCE" | "FILE_RESOURCE"
  >("ANNOUNCEMENT");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [fileUrl, setFileUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = useCallback(
    async (acceptedFiles: any[]) => {
      try {
        const file = acceptedFiles[0];
        if (!file) return;

        setIsUploading(true);
        setTitle(file.name);
        // Get presigned URL
        const data = await api.resources.getPresignedUrl(file.name, file.type, file.size);

        // Upload file — check response status explicitly since uploadFile returns raw Response
        const uploadResponse = await api.resources.uploadFile(data.uploadUrl, file);
        if (!uploadResponse.ok) {
          const errBody = await uploadResponse.json().catch(() => ({}));
          throw new Error(errBody?.error || `Upload failed with status ${uploadResponse.status}`);
        }

        setFileUrl(`/api/v1/uploads/download/${data.fileId}`);
        setContent(`File uploaded: ${file.name}`);
      } catch (err: any) {
        console.error("Failed to upload file:", err);
        toast.error(err?.message || "Failed to upload file");
      } finally {
        setIsUploading(false);
      }
    },
    [token],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
  } as any);

  const handleBroadcast = () => {
    if (!socket) return;
    if (!content && type !== "FILE_RESOURCE") return;

    let metadata = {};
    if (type === "CODE_SNIPPET") metadata = { language, content };
    if (type === "ANNOUNCEMENT") metadata = { message: content };
    if (type === "URL_RESOURCE") metadata = { url: content };
    if (type === "FILE_RESOURCE") metadata = { fileUrl, fileName: title };

    socket.emit(
      "ADD_RESOURCE",
      {
        type,
        title: title || undefined,
        metadata,
      },
      (res: any) => {
        if (res && res.success) {
          toast.success("Broadcast sent successfully!");
          setTitle("");
          setContent("");
          setFileUrl("");
        } else {
          toast.error(`Failed to broadcast: ${res?.error || "Unknown error"}`);
        }
      },
    );
  };

  return (
    <div className="p-3 sm:p-4 bg-white dark:bg-slate-900 border-t dark:border-slate-800 shadow-[0_-1px_10px_rgba(0,0,0,0.05)] z-20">
      <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-3">
        <button
          onClick={() => setType("ANNOUNCEMENT")}
          className={`px-3 py-1.5 text-[10px] sm:text-xs rounded-xl font-bold transition-all cursor-pointer border ${type === "ANNOUNCEMENT" ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-500/20" : "bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300"}`}
        >
          Announcement
        </button>
        <button
          onClick={() => setType("CODE_SNIPPET")}
          className={`px-3 py-1.5 text-[10px] sm:text-xs rounded-xl font-bold transition-all cursor-pointer border ${type === "CODE_SNIPPET" ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-500/20" : "bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300"}`}
        >
          Code
        </button>
        <button
          onClick={() => setType("URL_RESOURCE")}
          className={`px-3 py-1.5 text-[10px] sm:text-xs rounded-xl font-bold transition-all cursor-pointer border ${type === "URL_RESOURCE" ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-500/20" : "bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300"}`}
        >
          Link
        </button>
        <button
          onClick={() => setType("FILE_RESOURCE")}
          className={`px-3 py-1.5 text-[10px] sm:text-xs rounded-xl font-bold transition-all cursor-pointer border ${type === "FILE_RESOURCE" ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-500/20" : "bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300"}`}
        >
          File
        </button>
      </div>

      <input
        className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 dark:text-slate-100 px-3.5 py-2.5 rounded-xl mb-3 text-xs outline-none focus:border-indigo-500 transition-all placeholder-slate-400"
        placeholder="Title (optional)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      {type === "CODE_SNIPPET" && (
        <div className="mb-2 border dark:border-slate-800 rounded overflow-hidden">
          <div className="bg-slate-100 dark:bg-slate-800 p-1 flex border-b dark:border-slate-700">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-transparent text-sm p-1 outline-none dark:text-slate-200"
            >
              <option value="javascript">JavaScript</option>
              <option value="java">Java</option>
              <option value="python">Python</option>
              <option value="html">HTML</option>
              <option value="css">CSS</option>
            </select>
          </div>
          <textarea
            className="w-full bg-slate-900 border-none outline-none text-slate-100 p-3 font-mono text-sm resize-y"
            rows={10}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write code here..."
          />
        </div>
      )}

      {type === "FILE_RESOURCE" && (
        <div
          {...getRootProps()}
          className="mb-2 border-2 border-dashed dark:border-slate-700 p-8 text-center cursor-pointer rounded bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"
        >
          <input {...getInputProps()} />
          {isUploading ? (
            <p>Uploading... Please wait.</p>
          ) : isDragActive ? (
            <p>Drop files here...</p>
          ) : (
            <p>Drag 'n' drop a file here, or click to select</p>
          )}
          {fileUrl && !isUploading && (
            <p className="text-green-600 dark:text-green-400 mt-2 text-sm">
              File staged: {title}
            </p>
          )}
        </div>
      )}

      {(type === "ANNOUNCEMENT" || type === "URL_RESOURCE") && (
        <textarea
          className="w-full border dark:border-slate-700 bg-transparent dark:text-slate-100 p-2 rounded mb-2 font-mono text-sm placeholder-slate-400 dark:placeholder-slate-500"
          rows={4}
          placeholder="Content..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
        ></textarea>
      )}

      <button
        onClick={handleBroadcast}
        disabled={isUploading || (type === "FILE_RESOURCE" && !fileUrl) || (type !== "FILE_RESOURCE" && !content)}
        className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold text-xs hover:bg-indigo-700 transition shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        Broadcast to Session
      </button>
    </div>
  );
}
