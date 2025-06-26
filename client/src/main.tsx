import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Global error handler to prevent unhandledrejection overlay errors
window.addEventListener('unhandledrejection', (event) => {
  console.log('Handled rejection:', event.reason);
  event.preventDefault(); // Prevent the overlay from showing
});

// Global error handler for regular errors
window.addEventListener('error', (event) => {
  console.log('Handled error:', event.error);
  event.preventDefault(); // Prevent the overlay from showing
});

createRoot(document.getElementById("root")!).render(<App />);
