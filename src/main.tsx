import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { SocketProvider } from "./context/SocketContext";
import { logErrorToService } from "./utils/logger";
import { toast } from "sonner";

// Catch unhandled promise rejections globally
window.addEventListener("unhandledrejection", (event) => {
  logErrorToService(event.reason, "UnhandledPromiseRejection");
  toast.error("A background task failed. Our team has been notified.");
});

// Catch global uncaught errors
window.addEventListener("error", (event) => {
  logErrorToService(event.error || event.message, "GlobalError");
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SocketProvider>
      <App />
    </SocketProvider>
  </StrictMode>,
);
