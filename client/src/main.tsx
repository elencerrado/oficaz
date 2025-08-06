import { createRoot } from "react-dom/client";
import { lazy, Suspense } from "react";
import "./index.css";

// Initialize Sentry
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "https://7691ecf280aae3fc175ec1e6bbbc3677@o4509796586422272.ingest.de.sentry.io/4509796599529552",
  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true
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
