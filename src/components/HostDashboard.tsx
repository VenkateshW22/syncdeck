import React from "react";
import { useParams } from "react-router";
import { ClassroomTimeline } from "./ClassroomTimeline";
import { AIInsightsPanel } from "./AIInsightsPanel";
import { SessionSummary } from "./SessionSummary";
import { SharedCanvas } from "./SharedCanvas";
import { SidebarChat } from "./SidebarChat";
import { QuickPollHost } from "./QuickPollHost";
import { ScreenShareHost } from "./ScreenShareHost";
import { ResourceComposer } from "./ResourceComposer";
import { FloatingReactions } from "./FloatingReactions";
import { useHostSessionState } from "../hooks/useHostSessionState";
import { generateSessionPdf } from "../utils/pdfExport";
import { HostHeader } from "./HostHeader";
import { HostSidebar } from "./HostSidebar";
import { SessionControls } from "./SessionControls";
import { ResourcePanel } from "./ResourcePanel";

export function HostDashboard() {
  const { roomId } = useParams();
  const {
    resources,
    setResources,
    participants,
    handleApprove,
    handleApproveAll,
    handleReject,
    handleRemove,
    handlePromoteToCohost,
    handleDemoteFromCohost,
    handleEndSession,
    isConnected,
    isConnecting,
    socket,
    token,
  } = useHostSessionState(roomId);

  const handleGeneratePdf = () => generateSessionPdf(roomId);

  const hostName =
    participants.find((p) => p.role === "HOST")?.displayName || "Host";

  return (
    <div className="flex flex-col lg:flex-row min-h-screen lg:h-screen p-2 sm:p-3 gap-2 sm:gap-3 bg-gradient-to-br from-indigo-50/50 via-slate-50 to-purple-50/50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/30 overflow-x-hidden">
      <HostSidebar
        participants={participants}
        onApprove={handleApprove}
        onApproveAll={handleApproveAll}
        onReject={handleReject}
        onRemove={handleRemove}
        onPromoteToCohost={handlePromoteToCohost}
        onDemoteFromCohost={handleDemoteFromCohost}
      />
      
      <div className="flex-1 flex flex-col min-w-0 bg-white/70 dark:bg-slate-900/40 backdrop-blur-3xl border border-slate-200/50 dark:border-white/10 rounded-[1.5rem] overflow-hidden shadow-xl shadow-indigo-100/20 dark:shadow-none">
        <HostHeader
          roomId={roomId}
          isConnected={isConnected}
          isConnecting={isConnecting}
          onEndSession={handleEndSession}
        />

        <div className="flex-1 overflow-auto pt-6 px-6 pb-28 flex flex-col">
          {/* PDF Report Container */}
          <div
            id="pdf-content"
            className="bg-white dark:bg-slate-900/40 p-6 rounded-2xl border border-slate-200/50 dark:border-white/10 mb-6 shadow-xs"
          >
            {/* Elegant PDF Header */}
            <div className="mb-6 pb-4 border-b border-slate-100 dark:border-white/5 flex justify-between items-center">
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">SyncDeck Session Report</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Room Code: {roomId} | Date: {new Date().toLocaleDateString()}
                </p>
              </div>
              <img src="/favicon.svg" alt="SyncDeck" className="w-8 h-8 rounded" />
            </div>
            
            <SessionSummary participants={participants} resources={resources} />
          </div>

          <SessionControls
            resourcesLength={resources.length}
            onGeneratePdf={handleGeneratePdf}
          />

          <div className="mb-6" data-html2canvas-ignore="true">
            <ScreenShareHost />
          </div>

          <div className="mb-6 flex flex-col lg:flex-row gap-6 items-start" data-html2canvas-ignore="true">
            <div className="flex-1 w-full min-w-0">
              <SharedCanvas isHost={true} />
            </div>
            <div className="w-full lg:w-80 flex-shrink-0 flex flex-col gap-6">
              <QuickPollHost />
              <ClassroomTimeline participants={participants} />
              <AIInsightsPanel participants={participants} resources={resources} />
            </div>
          </div>

          <div className="space-y-4" data-html2canvas-ignore="true">
            <ResourcePanel
              resources={resources}
              setResources={setResources}
              socket={socket}
              token={token}
            />
          </div>
        </div>

        <ResourceComposer socket={socket} token={token} />
      </div>
      <SidebarChat senderName={hostName} />
      <FloatingReactions />
    </div>
  );
}
