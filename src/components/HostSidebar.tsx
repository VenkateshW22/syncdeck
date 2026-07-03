import React from "react";
import { ClassroomAnalytics } from "./ClassroomAnalytics";
import { ParticipantList } from "./ParticipantList";

interface HostSidebarProps {
  participants: any[];
  onApprove: (id: string) => void;
  onApproveAll: () => void;
  onReject: (id: string) => void;
  onRemove: (id: string) => void;
  onPromoteToCohost: (id: string) => void;
  onDemoteFromCohost: (id: string) => void;
}

export function HostSidebar({
  participants,
  onApprove,
  onApproveAll,
  onReject,
  onRemove,
  onPromoteToCohost,
  onDemoteFromCohost,
}: HostSidebarProps) {
  return (
    <div className="w-full lg:w-72 flex flex-col bg-white/70 dark:bg-slate-900/40 backdrop-blur-3xl border border-slate-200/50 dark:border-white/10 rounded-[1.5rem] overflow-hidden shrink-0 shadow-xl shadow-indigo-100/20 dark:shadow-none">
      <ClassroomAnalytics participants={participants} />
      <ParticipantList
        participants={participants}
        onApprove={onApprove}
        onApproveAll={onApproveAll}
        onReject={onReject}
        onRemove={onRemove}
        onPromoteToCohost={onPromoteToCohost}
        onDemoteFromCohost={onDemoteFromCohost}
      />
    </div>
  );
}


