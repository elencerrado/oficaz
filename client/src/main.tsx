import { createRoot } from "react-dom/client";
import App from "./App";
import { isMobileDevice, isLowEndDevice } from "./utils/performance";

// Start React rendering immediately with zero dependencies
createRoot(document.getElementById("root")!).render(<App />);
document.body.classList.add('loaded');

// RADICAL APPROACH: Zero CSS blocking on mobile
const initializeStyles = () => {
  const mobile = isMobileDevice();
  const lowEnd = isLowEndDevice();
  
  if (mobile) {
    // Mobile: Load absolute minimum first
    import('./styles/mobile-critical.css');
    
    // Delay Tailwind significantly on mobile
    const baseDelay = lowEnd ? 2000 : 1000;
    setTimeout(() => {
      import('./styles/tailwind-full.css');
      setTimeout(() => import('./styles/components.css'), 200);
    }, baseDelay);
  } else {
    // Desktop: Still progressive but faster
    import('./styles/immediate.css');
    setTimeout(() => {
      import('./styles/tailwind-full.css');
      setTimeout(() => import('./styles/components.css'), 100);
    }, 300);
  }
};

// Use intersection observer to delay until page is interactive
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(() => {
    initializeStyles();
    observer.disconnect();
  });
  observer.observe(document.body);
} else {
  setTimeout(initializeStyles, 100);
}
