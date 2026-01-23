import { createRoot } from "react-dom/client";
import { lazy, Suspense } from "react";
import "./index.css";

// CRITICAL: Global error handler to suppress Vite HMR WebSocket errors
// This prevents any error popups from showing to users
window.addEventListener('unhandledrejection', (event) => {
  const message = event.reason?.message ? String(event.reason.message) : '';
  const reasonStr = event.reason ? String(event.reason) : '';
  
  // Suppress Vite HMR WebSocket connection errors (localhost:undefined, invalid URLs)
  if ((message.includes('Failed to construct \'WebSocket\'') || message.includes('WebSocket')) &&
      (message.includes('localhost:undefined') || message.includes('wss://localhost') || message.includes('is invalid'))) {
    console.log('🔇 Suppressed Vite HMR WebSocket error (harmless in production)');
    event.preventDefault(); // Prevent error from bubbling
    return;
  }
  
  // Alternative check if message check didn't work
  if (reasonStr.includes('Failed to construct') && reasonStr.includes('WebSocket') && 
      (reasonStr.includes('localhost') || reasonStr.includes('wss://'))) {
    console.log('🔇 Suppressed Vite HMR WebSocket error (harmless in production)');
    event.preventDefault();
    return;
  }
  
  // Suppress network errors during page navigation/reload
  if (message.includes('Failed to fetch') ||
      message.includes('NetworkError') ||
      message.includes('Load failed')) {
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
  if (message.includes('WebSocket') && (message.includes('localhost:undefined') || message.includes('wss://localhost') || message.includes('is invalid'))) {
    return; // Silently ignore
  }
  if (message.includes('Failed to construct') && message.includes('WebSocket')) {
    return; // Silently ignore
  }
  originalError.apply(console, args);
};



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

if (chatRoot) {
  createRoot(chatRoot).render(
    <ThemeProvider defaultTheme="system" storageKey="oficaz-theme">
      <QueryClientProvider client={queryClient}>
        <AIAssistantChat />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
