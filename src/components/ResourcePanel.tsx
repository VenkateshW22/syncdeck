import React from "react";
import { EditableResourceItem } from "./EditableResourceItem";

interface ResourcePanelProps {
  resources: any[];
  setResources: React.Dispatch<React.SetStateAction<any[]>>;
  socket: any;
  token: string | null;
}

export function ResourcePanel({
  resources,
  setResources,
  socket,
  token,
}: ResourcePanelProps) {
  if (resources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-slate-50 dark:bg-slate-800/50 rounded border border-dashed border-slate-200 dark:border-slate-700 text-center">
        <svg className="w-12 h-12 mb-3 text-slate-300 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No resources shared yet</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
          Use the composer below to share announcements, code snippets, links, and files with your session.
        </p>
      </div>
    );
  }

  return (
    <>
      {resources.map((r) => (
        <EditableResourceItem
          key={r.id}
          resource={r}
          socket={socket}
          token={token}
          onOptimisticEdit={(id, updates) => {
            setResources((prev) =>
              prev.map((res) => (res.id === id ? { ...res, ...updates } : res))
            );
          }}
          onOptimisticRemove={(id) => {
            setResources((prev) => prev.filter((res) => res.id !== id));
          }}
        />
      ))}
    </>
  );
}
