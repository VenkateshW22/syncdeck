export const logErrorToService = (error: Error | Event | PromiseRejectionEvent | any, context?: string) => {
  // Hypothetical logging endpoint
  console.error(`[CentralizedLogger] Error in ${context || 'Unknown'}:`, error);

  let errorMessage = "Unknown error";
  let errorStack;

  if (error instanceof Error) {
    errorMessage = error.message;
    errorStack = error.stack;
  } else if (typeof error === "string") {
    errorMessage = error;
  } else {
    try {
      errorMessage = JSON.stringify(error);
    } catch {
      errorMessage = String(error);
    }
  }

  // In a real application, you would send this to Sentry, DataDog, etc.
  fetch("/api/v1/log", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      error: errorMessage,
      stack: errorStack,
      context,
      timestamp: new Date().toISOString(),
    }),
  }).catch((err) => {
    // Ignore logging endpoint failures to prevent infinite loops
    console.error("Critical: Failed to report error to logging service", err);
  });
};
