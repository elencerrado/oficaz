import { createRoot } from "react-dom/client";
import App from "./App";

// Immediate render with zero CSS blocking
createRoot(document.getElementById("root")!).render(<App />);
document.body.classList.add('loaded');

// Ultra-aggressive progressive loading
const loadEssentialStyles = () => {
  // Load only essential layout utilities immediately
  import('./styles/immediate.css');
  
  // Load rest progressively
  requestAnimationFrame(() => {
    import('./styles/critical.css');
    
    requestAnimationFrame(() => {
      import('./styles/components.css');
      
      requestAnimationFrame(() => {
        import('./index.css');
      });
    });
  });
};

// Use the fastest method available
if ('requestIdleCallback' in window) {
  requestIdleCallback(loadEssentialStyles, { timeout: 1 });
} else {
  loadEssentialStyles();
}
