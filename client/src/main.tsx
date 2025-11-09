import { createRoot } from "react-dom/client";
import { lazy, Suspense } from "react";
import "./index.css";

// CRITICAL: Global error handler to suppress Vite HMR WebSocket errors
// This prevents any error popups from showing to users
window.addEventListener('unhandledrejection', (event) => {
  // Suppress Vite HMR WebSocket connection errors (localhost:undefined)
  if (event.reason?.message?.includes('Failed to construct \'WebSocket\'') ||
      event.reason?.message?.includes('localhost:undefined')) {
    console.log('🔇 Suppressed Vite HMR WebSocket error (harmless in production)');
    event.preventDefault(); // Prevent error from bubbling
    return;
  }
  
  // Suppress network errors during page navigation/reload
  if (event.reason?.message?.includes('Failed to fetch') ||
      event.reason?.message?.includes('NetworkError') ||
      event.reason?.message?.includes('Load failed')) {
    console.log('🔇 Suppressed network error during navigation');
    event.preventDefault();
    return;
  }
});

// Suppress console errors from Vite HMR in production
const originalError = console.error;
console.error = (...args) => {
  // Filter out Vite HMR WebSocket errors
  const message = args[0]?.toString() || '';
  if (message.includes('WebSocket') && message.includes('localhost:undefined')) {
    return; // Silently ignore
  }
  if (message.includes('Failed to construct \'WebSocket\'')) {
    return; // Silently ignore
  }
  originalError.apply(console, args);
};

// Initialize Sentry
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "https://7691ecf280aae3fc175ec1e6bbbc3677@o4509796586422272.ingest.de.sentry.io/4509796599529552",
  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,
  // Filter out Vite HMR errors from Sentry
  beforeSend(event, hint) {
    const error = hint.originalException;
    if (error && typeof error === 'object' && 'message' in error) {
      const message = String(error.message);
      if (message.includes('localhost:undefined') || 
          message.includes('Failed to construct \'WebSocket\'')) {
        return null; // Don't send to Sentry
      }
    }
    return event;
  }
});

// Performance optimization - mark body as loaded to prevent FOUC
const markAsLoaded = () => {
  document.body.classList.add('loaded');
  // Remove loading spinner if present
  const spinner = document.querySelector('.loading-spinner');
  if (spinner) spinner.remove();
};

// Check if DOM is already ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', markAsLoaded);
} else {
  markAsLoaded();
}

// Import App directly to avoid double loading effect
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";

// Main app root
const root = document.getElementById("root")!;
createRoot(root).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

// Isolated chat root (separate React tree to prevent re-renders from navigation)
import { AIAssistantChat } from "./components/AIAssistantChat";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { ThemeProvider } from "./lib/theme-provider";

const chatRoot = document.getElementById("chat-root");
console.log("🔍 Chat root element:", chatRoot);

if (chatRoot) {
  console.log("✅ Mounting AIAssistantChat to #chat-root");
  createRoot(chatRoot).render(
    <ThemeProvider defaultTheme="system" storageKey="oficaz-theme">
      <QueryClientProvider client={queryClient}>
        <AIAssistantChat />
      </QueryClientProvider>
    </ThemeProvider>
  );
} else {
  console.error("❌ #chat-root element not found!");
}
