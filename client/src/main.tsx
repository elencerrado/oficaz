import { createRoot } from "react-dom/client";
import { lazy, Suspense } from "react";
import "./index.css";

// Initialize Sentry for error tracking and performance monitoring
import "./sentry.client.config";

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

// Lazy load the main App component to reduce initial bundle
const App = lazy(() => import("./App"));

// Add loading spinner to DOM immediately for better UX
const root = document.getElementById("root")!;
root.innerHTML = '<div class="loading-spinner"></div>';

createRoot(root).render(
  <Suspense fallback={<div className="loading-spinner"></div>}>
    <App />
  </Suspense>
);
