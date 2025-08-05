import { createRoot } from "react-dom/client";
import App from "./App";

// Load CSS asynchronously to prevent render blocking
const loadCSS = async () => {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/src/index.css';
  link.media = 'print';
  link.onload = () => { link.media = 'all'; };
  document.head.appendChild(link);
};

// Performance optimization - mark body as loaded and load CSS
const initializeApp = () => {
  document.body.classList.add('loaded');
  loadCSS();
};

// Use requestIdleCallback for better performance
if ('requestIdleCallback' in window) {
  requestIdleCallback(initializeApp);
} else {
  setTimeout(initializeApp, 1);
}

createRoot(document.getElementById("root")!).render(<App />);
