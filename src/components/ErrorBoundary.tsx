import React, { Component, ErrorInfo, ReactNode } from "react";
import { toast } from "sonner";
import { logErrorToService } from "../utils/logger";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    logErrorToService(error, "ErrorBoundary");
    toast.error("An unexpected error occurred. Our team has been notified.");
  }


  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-lg shadow-sm max-w-md text-center">
            <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">
              Something went wrong
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              {this.state.error?.message ||
                "An unexpected error occurred in the application."}
            </p>
            <button
              onClick={() => (window.location.href = "/")}
              className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-6 py-2 rounded font-medium hover:bg-slate-800 dark:hover:bg-slate-200 transition"
            >
              Return to Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
